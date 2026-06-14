import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { interleaveSlots } from './UpgradeTree.js';

// ── Constantes missiles ───────────────────────────────────────────────────────
const MISSILE_SPEED   = 340;
const LOCK_CONE_COS   = 0.65;     // cosinus du demi-angle du cône (~49°)
const LOCK_RANGE      = 2500;
const DAMAGE_DIRECT   = 70;       // dégâts à l'impact direct
const SPLASH_RADIUS   = 22;       // rayon de dégâts de zone
const SPLASH_DMG_PCTG = 0.30;     // fraction des dégâts directs à distance splash
const DECOY_EFFECT    = 0.75;
const HIT_RADIUS      = 14;       // rayon d'impact direct (légèrement réduit)
// Vitesse de guidage par niveau de tracking (0=standard … 3=IA)
const TURN_SPEED_LEVELS = [5, 9, 13, 17];
// Durée de piste bonus par niveau de tracking
const TRACK_TIME_BONUS  = [0, 1.5, 2.5, 4.0];
const DEBUG_MISSILES  = true;     // logs console pour diagnostiquer — passer false après validation

export class MissileSystem {
  constructor(scene, audioManager) {
    this._scene  = scene;
    this._audio  = audioManager;

    // Modèles GLB pour les missiles
    this._modelAA = null;  // air-air
    this._modelAG = null;  // air-sol (fallback sur AA si absent)
    this._loadModels();

    this._missiles = [];   // missiles actifs en vol
    this._lockTarget = null;
    this._lockProgress = 0;  // 0→1
    this._lockParams = null;  // { lockTime, trackTime, dual, hasAA, hasAG }

    // Callbacks
    this.onHit = null;   // (target, dmg) → appelé à l'impact

    // HUD callbacks
    this.onLockStart    = null;
    this.onLockComplete = null;
    this.onLockLost     = null;

    this._lockDone    = false;
    this._ecmActive   = false;
    this.friendlyFire = false;  // mis à jour par Game.js selon la config de la partie
  }

  setTerrainHeightFn(fn) { this._getTerrainH = fn; }

  _hasTerrainLOS(origin, targetPos) {
    if (!this._getTerrainH) return true;
    const steps = 14;
    const dx = targetPos.x - origin.x;
    const dy = targetPos.y - origin.y;
    const dz = targetPos.z - origin.z;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const rayY    = origin.y + dy * t;
      const terrainY = this._getTerrainH(origin.x + dx * t, origin.z + dz * t);
      if (terrainY > rayY + 2) return false;   // +2 m de marge pour éviter les faux positifs
    }
    return true;
  }

  setECMActive(active) {
    this._ecmActive = !!active;
    if (active && this._lockTarget) {
      this.onLockLost?.();
      this._lockTarget   = null;
      this._lockProgress = 0;
      this._lockDone     = false;
    }
  }

  _loadModels() {
    const loader = new GLTFLoader();
    const load = (path, cb) => loader.load(path, g => {
      const m = g.scene;
      m.scale.setScalar(0.25);
      m.traverse(n => {
        if (!n.isMesh) return;
        n.castShadow = false; n.receiveShadow = false;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(mat => {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = 1;
          mat.polygonOffsetUnits = 1;
          mat.depthWrite = true;
        });
      });
      cb(m);
    }, undefined, () => {});

    load('/Missiles/low_poly_advanced_missile_Missile1.glb', m => { this._modelAA = m; });
    load('/Missiles/game_ready_low_poly_r-77_Missile2.glb',  m => { this._modelAG = m; });
  }

  // ── Mise à jour chaque frame ──────────────────────────────────────────────
  update(delta, playerPivot, enemies, decoys = []) {
    this._updateLock(delta, playerPivot, enemies, decoys);
    this._updateMissiles(delta, enemies, decoys);
  }

  // ── Logique de verrouillage ───────────────────────────────────────────────
  _updateLock(delta, playerPivot, enemies) {
    if (!this._lockParams) return;
    if (this._ecmActive) return;

    // Pas de missiles → aucune logique de verrouillage (cible, son, indicateur).
    // Reprend automatiquement dès qu'un missile est réapprovisionné.
    if (this.missilesRemaining <= 0) {
      if (this._lockTarget) this.onLockLost?.();
      this._lockTarget   = null;
      this._lockProgress = 0;
      this._lockDone     = false;
      return;
    }

    const target = this._findBestTarget(playerPivot, enemies);

    if (!target) {
      if (this._lockTarget) this.onLockLost?.();
      this._lockTarget   = null;
      this._lockProgress = 0;
      this._lockDone     = false;
      return;
    }

    if (target !== this._lockTarget) {
      this._lockTarget   = target;
      this._lockProgress = 0;
      this._lockDone     = false;
      this.onLockStart?.(target);
    }

    if (!this._lockDone) {
      this._lockProgress += delta / this._lockParams.lockTime;
      if (this._lockProgress >= 1) {
        this._lockProgress = 1;
        this._lockDone     = true;
        this.onLockComplete?.(target);
      }
    }
  }

  _getCtx() {
    this._ownCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (this._ownCtx.state === 'suspended') this._ownCtx.resume();
    return this._ownCtx;
  }



  _findBestTarget(playerPivot, enemies) {
    if (!enemies?.length) return null;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerPivot.quaternion);
    const origin = playerPivot.position;
    let best = null, bestDot = -1;

    // Filtrage par type de missile disponible
    const canAA = this.missilesRemainingAA > 0;
    const canAG = this.missilesRemainingAG > 0;

    for (const e of enemies) {
      if (!e || e.isDead) continue;
      if (e.shieldActive) continue;                             // bouclier actif — verrouillage impossible
      if (e.isEnemy === false && !this.friendlyFire) continue;  // allié → ignorer sauf tir allié activé
      if ( e.isGround && !canAG) continue;   // cible sol  → besoin de missiles AS
      if (!e.isGround && !canAA) continue;   // cible air  → besoin de missiles AA
      const ePos = e.pivot?.position ?? e.pos;
      if (!ePos) continue;
      const dir = new THREE.Vector3().subVectors(ePos, origin);
      const dist = dir.length();
      if (dist > LOCK_RANGE) continue;
      dir.normalize();
      const dot = fwd.dot(dir);
      if (dot < LOCK_CONE_COS) continue;
      const ePos2 = e.pivot?.position ?? e.pos;
      if (!this._hasTerrainLOS(origin, ePos2)) continue;
      if (dot > bestDot) { bestDot = dot; best = e; }
    }
    return best;
  }

  // ── Tir missile ───────────────────────────────────────────────────────────
  // Toujours possible si des missiles sont disponibles.
  // Sans lock → dumb-fire (guidageStrength=0). Avec lock partiel → guidage réduit.
  fire(playerPivot) {
    if (!this._lockParams) return false;

    // Détermine le type selon la cible lockée, puis fallback AA→AG
    let type = null;
    if (this._lockTarget) {
      type = (this._lockTarget.isGround && this.missilesRemainingAG > 0) ? 'ag' : 'aa';
    }
    if (!type || (this._wingSlots ?? []).every(s => !s?.mesh || s.type !== type)) {
      // Fallback : AA d'abord, puis AG
      if (this.missilesRemainingAA > 0) type = 'aa';
      else if (this.missilesRemainingAG > 0) type = 'ag';
      else return false;
    }

    const slotIdx = (this._wingSlots ?? []).findIndex(s => s?.mesh && s.type === type);
    if (slotIdx < 0) return false;

    this._lastFiredIdx = slotIdx;
    const slot = this._wingSlots[slotIdx];

    // guidanceStrength : 0 = dumb-fire, 0..1 = lock partiel, 1 = lock complet
    const guidanceStrength = this._lockDone ? 1.0 : this._lockProgress;
    this._spawnMissile(playerPivot, this._lockTarget ?? null, type, slot.side, guidanceStrength);

    // Réinitialise le lock pour le prochain tir
    this._lockDone     = false;
    this._lockProgress = 0;
    return true;
  }

  _spawnMissile(playerPivot, target, type, side = 0, guidanceStrength = 1.0) {
    if (DEBUG_MISSILES) console.log(`[MISSILE] FIRED type=${type} side=${side > 0 ? 'R' : 'L'} target=${target ? 'yes' : 'none'} guidance=${guidanceStrength.toFixed(2)}`);
    const template = type === 'ag' ? (this._modelAG ?? this._modelAA) : this._modelAA;
    const mesh = template ? template.clone() : this._mkFallbackMesh();

    // Offset sous l'aile correspondante
    const offset = new THREE.Vector3(side * 1.5, -0.4, 0).applyQuaternion(playerPivot.quaternion);
    mesh.position.copy(playerPivot.position).add(offset);

    // Les modèles GLB ont leur axe long sur X — aligner cet axe X avec la direction forward
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerPivot.quaternion);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), fwd);
    mesh.scale.setScalar(0.5);  // plus visible que la valeur chargée (0.25)

    this._scene.add(mesh);
    this._playLaunchSound(type);

    const baseTrackTime   = this._lockParams?.trackTime ?? 4.0;
    const trackingLevel   = this._lockParams?.trackingLevel ?? 0;
    const trackTime       = baseTrackTime + (TRACK_TIME_BONUS[trackingLevel] ?? 0);
    const baseTurnSpeed = TURN_SPEED_LEVELS[trackingLevel] ?? TURN_SPEED_LEVELS[0];
    const missileData = {
      mesh,
      target,
      type,
      velocity        : new THREE.Vector3(0, 0, -1).applyQuaternion(playerPivot.quaternion).multiplyScalar(MISSILE_SPEED),
      trackRemaining  : target ? trackTime * guidanceStrength : 0,
      trackTimeBase   : trackTime,
      life            : 10.0,
      exploded        : false,
      frameCount      : 0,
      trackingLevel,
      turnSpeed       : baseTurnSpeed * guidanceStrength,
      guidanceStrength,
      reengaged       : false,
    };
    this._missiles.push(missileData);
    if (DEBUG_MISSILES) console.log(`[MISSILE] Spawned — trackTime=${trackTime}s life=10s speed=${MISSILE_SPEED}`);
  }

  _mkFallbackMesh() {
    const group = new THREE.Group();
    group.userData.selfOwned = true;
    // Corps principal — cylindre orange vif orienté sur X (axe avant du missile)
    const g = new THREE.CylinderGeometry(0.18, 0.12, 2.4, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff6600, emissive: 0xff2200, emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(g, mat);
    body.rotation.z = Math.PI / 2;
    group.add(body);
    // Ogive
    const gc = new THREE.ConeGeometry(0.12, 0.7, 8);
    const cone = new THREE.Mesh(gc, mat);
    cone.rotation.z = -Math.PI / 2;
    cone.position.x = 1.55;
    group.add(cone);
    return group;
  }

  _updateMissiles(delta, enemies, decoys = []) {
    for (let i = this._missiles.length - 1; i >= 0; i--) {
      const ms = this._missiles[i];
      if (ms.exploded) { this._removeMissile(i); continue; }

      ms.life -= delta;
      if (ms.life <= 0) { this._explodeMissile(ms); this._removeMissile(i); continue; }

      ms.frameCount = (ms.frameCount ?? 0) + 1;

      // Guidage vers la cible — proportionnel, avec lead targeting
      if (ms.target && !ms.target.isDead && ms.trackRemaining > 0) {
        const targetPos = ms.target.pivot?.position ?? ms.target.pos ?? ms.target.position;
        // Lead targeting : on prédit la position de la cible 0.4s plus tard
        const targetVel = ms.target._velocity ?? ms.target.velocity ?? null;
        const leadPos = targetPos.clone();
        if (targetVel) leadPos.addScaledVector(targetVel, 0.4);
        const toTarget = leadPos.sub(ms.mesh.position).normalize();

        // Niveau 0 : seeker IR basique — perd le verrouillage si cible hors cône avant
        let drain = delta;
        if (ms.trackingLevel === 0) {
          const dot = ms.velocity.clone().normalize().dot(toTarget);
          if (dot < 0.0)       drain = delta * 5;  // cible dans le dos → perd en ~0.3s
          else if (dot < 0.35) drain = delta * 2;  // angle >70° → perd en ~0.75s
        }
        ms.trackRemaining -= drain;

        ms.velocity.lerp(toTarget.multiplyScalar(MISSILE_SPEED), Math.min(1, ms.turnSpeed * delta));
        ms.velocity.setLength(MISSILE_SPEED);

        // Leurres
        if (decoys.length > 0 && Math.random() < DECOY_EFFECT * decoys.length * delta * 0.3) {
          if (DEBUG_MISSILES) console.log('[MISSILE] Decoy distracted missile!');
          ms.target = null;
        }

        if (DEBUG_MISSILES && ms.frameCount % 30 === 0) {
          const dist = ms.mesh.position.distanceTo(targetPos);
          console.log(`[MISSILE] Tracking — dist=${dist.toFixed(1)} trackLeft=${ms.trackRemaining.toFixed(2)}s`);
        }
      } else if (ms.target && !ms.target.isDead && ms.trackRemaining <= 0) {
        // Ré-engagement selon niveau de tracking
        if (ms.trackingLevel >= 3) {
          // Niveau IA : toujours ré-engage avec une durée réduite
          ms.trackRemaining = (ms.trackTimeBase ?? 4.0) * 0.5;
        } else if (ms.trackingLevel === 2 && !ms.reengaged) {
          // Niveau II : ré-engage une seule fois
          ms.trackRemaining = (ms.trackTimeBase ?? 4.0) * 0.6;
          ms.reengaged = true;
          if (DEBUG_MISSILES) console.log('[MISSILE] Re-engaging target (level 2)');
        }
        // Niveaux 0 et 1 : vole tout droit
      }

      // Déplacement
      ms.mesh.position.addScaledVector(ms.velocity, delta);

      // Orientation — axe X du modèle aligné sur la vélocité
      const velDir = ms.velocity.clone().normalize();
      if (velDir.lengthSq() > 0.001) {
        ms.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), velDir);
      }

      // Trail — petite traînée de fumée
      if (ms.frameCount % 2 === 0) this._spawnTrailPuff(ms.mesh.position);

      // Test collision avec ennemis
      let hitIdx = -1;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (!e || e.isDead || !e.pivot) continue;
        if (ms.mesh.position.distanceTo(e.pivot.position) < HIT_RADIUS) { hitIdx = j; break; }
      }
      if (hitIdx >= 0) {
        const dmgDirect = this._lockParams?.damage ?? DAMAGE_DIRECT;
        if (DEBUG_MISSILES) console.log(`[MISSILE] COLLISION dist<${HIT_RADIUS} → ${dmgDirect} dmg`);
        this.onHit?.(enemies[hitIdx], dmgDirect);
        if (DEBUG_MISSILES) console.log(enemies[hitIdx].isDead ? '[MISSILE] TARGET DESTROYED' : '[MISSILE] target still alive');
        // Dégâts de souffle sur cibles proches
        for (let j = 0; j < enemies.length; j++) {
          if (j === hitIdx) continue;
          const e = enemies[j];
          if (!e || e.isDead || !e.pivot) continue;
          const d = ms.mesh.position.distanceTo(e.pivot.position);
          if (d < SPLASH_RADIUS) {
            const splashDmg = Math.round(dmgDirect * SPLASH_DMG_PCTG * (SPLASH_RADIUS - d) / (SPLASH_RADIUS - HIT_RADIUS));
            if (splashDmg > 0) this.onHit?.(e, splashDmg);
          }
        }
        this._explodeMissile(ms);
        ms.exploded = true;
      }

      if (ms.exploded) this._removeMissile(i);
    }
  }

  _spawnTrailPuff(pos) {
    const g = new THREE.SphereGeometry(0.25, 4, 4);
    const m = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.45 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.copy(pos);
    this._scene.add(mesh);
    let t = 0;
    const tick = (delta) => {
      t += delta;
      mesh.material.opacity = Math.max(0, 0.45 - t * 1.8);
      mesh.scale.setScalar(1 + t * 3);
      if (t > 0.25) { this._scene.remove(mesh); g.dispose(); m.dispose(); return false; }
      return true;
    };
    this._explosions = this._explosions ?? [];
    this._explosions.push(tick);
  }

  _explodeMissile(ms) {
    const pos = ms.mesh ? ms.mesh.position.clone() : null;
    if (ms.mesh) {
      this._scene.remove(ms.mesh);
      if (ms.mesh.userData.selfOwned) {
        ms.mesh.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
      }
      ms.mesh = null;
    }
    this._spawnExplosion(pos ?? new THREE.Vector3());
  }

  _spawnExplosion(pos) {
    const g = new THREE.SphereGeometry(2, 8, 8);
    const m = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(g, m);
    if (pos) mesh.position.copy(pos);
    this._scene.add(mesh);
    let t = 0;
    const tick = (delta) => {
      t += delta;
      const s = 1 + t * 6;
      mesh.scale.setScalar(s);
      mesh.material.opacity = Math.max(0, 0.9 - t * 3);
      if (t > 0.4) { this._scene.remove(mesh); g.dispose(); m.dispose(); return false; }
      return true;
    };
    this._explosions = this._explosions ?? [];
    this._explosions.push(tick);
  }

  _removeMissile(i) {
    const ms = this._missiles[i];
    if (ms.mesh) this._scene.remove(ms.mesh);
    this._missiles.splice(i, 1);
  }

  // ── Modèles sous les ailes (statiques — cosmétiques) ─────────────────────
  attachWingMissiles(model, upgradeIds, count) {
    if (this._wingMeshes) this._wingMeshes.forEach(m => m.parent?.remove(m));
    this._wingMeshes  = [];
    this._wingSlots   = [];  // [{mesh, side}] en ordre de tir : outer-L, outer-R, mid-L, …
    this._fireWingIdx = 0;
    if (count <= 0) return;

    let aaCount = 0, agCount = 0;
    if (upgradeIds.includes('missile_aa'))   aaCount += 2;
    if (upgradeIds.includes('missile_imp1')) aaCount += 2;
    if (upgradeIds.includes('missile_imp2')) aaCount += 2;
    if (upgradeIds.includes('missile_ag'))   agCount += 2;
    if (upgradeIds.includes('missile_ag2'))  agCount += 2;
    if (upgradeIds.includes('missile_ag3'))  agCount += 2;

    const { aaSlots, agSlots } = interleaveSlots(aaCount, agCount);

    const invScale   = 1 / (model.scale.x || 1);
    const BASE_Y     = -0.18;   // Y de référence (slot le plus extérieur)
    const Y_STEP     = 0.03;    // chaque slot vers le fuselage descend de Y_STEP
    const MAX_SLOT   = 2;       // slot max AA (référence pour la hauteur)

    // Construit les meshes pour un type (AA ou AG), dans l'ordre outer→inner
    const buildType = (src, slots, rx, ry, rz, type) => {
      if (!src || !slots.length) return;
      src.rotation.set(rx, ry, rz);
      src.updateMatrixWorld(true);
      const srcScale   = src.scale.x || 1;
      const TARGET_LEN = 0.85;
      const box  = new THREE.Box3().setFromObject(src);
      const size = new THREE.Vector3(); box.getSize(size);
      const rawLen     = Math.max(size.x, size.y, size.z) || 1;
      const localScale = (TARGET_LEN / rawLen) * invScale * srcScale;

      // Outer first (descendant) → alternance L/R pour chaque slot
      const sortedDesc = [...slots].sort((a, b) => b - a);
      for (const slot of sortedDesc) {
        // Staircase : slot proche fuselage = plus bas (Y plus négatif)
        const localY = (BASE_Y - (MAX_SLOT - slot) * Y_STEP) * invScale;
        const localX = (0.7 + slot * 0.42) * invScale;
        for (const side of [-1, +1]) {  // gauche d'abord, puis droite
          const m = src.clone();
          m.position.set(side * localX, localY, 0.1 * invScale);
          m.scale.setScalar(localScale);
          model.add(m);
          this._wingMeshes.push(m);
          this._wingSlots.push({ mesh: m, side, type });
        }
      }
    };

    buildType(this._modelAA,                  aaSlots, 0, -Math.PI / 2 + 0.26, 0, 'aa');
    buildType(this._modelAG ?? this._modelAA, agSlots, 0, -Math.PI / 2,        0, 'ag');
  }

  _playLaunchSound(type = 'aa') {
    try {
      const ctx = this._audio?._ctx ?? this._getCtx();
      const out = this._audio?._bus?.sfx ?? ctx.destination;
      const sr  = ctx.sampleRate;
      const t0  = ctx.currentTime;

      // ── Utilitaire : bruit blanc dans un buffer ───────────────────────────
      const mkNoise = (dur, shape) => {
        const len = Math.floor(sr * dur);
        const buf = ctx.createBuffer(1, len, sr);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * shape(i / len);
        const src = ctx.createBufferSource(); src.buffer = buf;
        return src;
      };
      // ── Utilitaire : gain avec enveloppe simple ───────────────────────────
      const mkEnv = (atk, peak, decay) => {
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + atk);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + decay);
        return g;
      };

      if (type === 'aa') {
        // ── AA : claquement sec d'éjection + sifflement moteur qui s'éloigne ─
        // 1. Impulsion d'éjection : bruit large bande très court
        const snap = mkNoise(0.06, x => Math.exp(-x * 18));
        const snapHp = ctx.createBiquadFilter(); snapHp.type = 'highpass'; snapHp.frequency.value = 600;
        const snapG = mkEnv(0.002, 0.9, 0.055);
        snap.connect(snapHp); snapHp.connect(snapG); snapG.connect(out);
        snap.start(t0);

        // 2. Souffle de propulsion — bruit filtré passe-bande montant
        const whoosh = mkNoise(0.55, x => Math.pow(x < 0.05 ? x / 0.05 : 1, 1) * Math.exp(-x * 3.5));
        const whooshBp = ctx.createBiquadFilter(); whooshBp.type = 'bandpass';
        whooshBp.frequency.setValueAtTime(1800, t0 + 0.02);
        whooshBp.frequency.linearRampToValueAtTime(4500, t0 + 0.55);
        whooshBp.Q.value = 1.2;
        const whooshG = mkEnv(0.015, 0.55, 0.50);
        whoosh.connect(whooshBp); whooshBp.connect(whooshG); whooshG.connect(out);
        whoosh.start(t0 + 0.01);

      } else {
        // ── AG : grondement d'éjection lourd + propulsion soutenue ───────────
        // 1. Thud grave d'éjection
        const thud = mkNoise(0.12, x => Math.exp(-x * 12));
        const thudLp = ctx.createBiquadFilter(); thudLp.type = 'lowpass'; thudLp.frequency.value = 280;
        const thudG = mkEnv(0.004, 1.1, 0.11);
        thud.connect(thudLp); thudLp.connect(thudG); thudG.connect(out);
        thud.start(t0);

        // 2. Rumble moteur — bruit large bande grave, enveloppe progressive
        const rumble = mkNoise(0.70, x => (x < 0.08 ? x / 0.08 : 1) * Math.exp(-x * 2.2));
        const rumbleLp = ctx.createBiquadFilter(); rumbleLp.type = 'lowpass';
        rumbleLp.frequency.setValueAtTime(380, t0);
        rumbleLp.frequency.linearRampToValueAtTime(820, t0 + 0.70);
        const rumbleG = mkEnv(0.03, 0.75, 0.60);
        rumble.connect(rumbleLp); rumbleLp.connect(rumbleG); rumbleG.connect(out);
        rumble.start(t0 + 0.03);

        // 3. Couche mid — ajoute de la texture au moteur
        const mid = mkNoise(0.50, x => (x < 0.1 ? x / 0.1 : 1) * Math.exp(-x * 3.0));
        const midBp = ctx.createBiquadFilter(); midBp.type = 'bandpass'; midBp.frequency.value = 900; midBp.Q.value = 0.7;
        const midG = mkEnv(0.04, 0.35, 0.42);
        mid.connect(midBp); midBp.connect(midG); midG.connect(out);
        mid.start(t0 + 0.04);
      }
    } catch (_) {}
  }

  removeWingMissile() {
    const idx  = this._lastFiredIdx ?? 0;
    const slot = this._wingSlots?.[idx];
    if (slot?.mesh) {
      slot.mesh.parent?.remove(slot.mesh);
      slot.mesh = null;
    } else if (this._wingMeshes?.length) {
      const m = this._wingMeshes.pop();
      m.parent?.remove(m);
    }
  }

  // ── Pods de leurres sous le fuselage (cosmétiques) ───────────────────────
  attachDecoyPods(model, count) {
    if (this._decoyMeshes) this._decoyMeshes.forEach(m => m.parent?.remove(m));
    this._decoyMeshes = [];
    if (count <= 0) return;

    const invScale = 1 / (model.scale.x || 1);
    if (!this._decoyGeo) this._decoyGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6);
    if (!this._decoyMat) this._decoyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.5 });

    for (let i = 0; i < count; i++) {
      const m    = new THREE.Mesh(this._decoyGeo, this._decoyMat);
      const row  = Math.floor(i / 2);
      const side = (i % 2 === 0) ? -1 : 1;
      const wx = side * 0.18, wy = -0.26, wz = -0.25 - row * 0.18;
      m.position.set(wx * invScale, wy * invScale, wz * invScale);
      m.scale.setScalar(invScale);
      m.rotation.x = Math.PI / 2; // axe horizontal, dans l'axe du fuselage
      model.add(m);
      this._decoyMeshes.push(m);
    }
  }

  removeDecoyPod() {
    if (this._decoyMeshes?.length) {
      const m = this._decoyMeshes.pop();
      m.parent?.remove(m);
    }
  }

  // ── Leurres (compteur + effet) ────────────────────────────────────────────
  deployDecoy(playerPivot) {
    const pos = playerPivot.position;
    // Direction arrière de l'appareil en espace monde
    const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerPivot.quaternion);

    this._decoyObjects  = this._decoyObjects  ?? [];
    this._decoyParticles = this._decoyParticles ?? [];

    // Objet logique (pour la déviation des missiles ennemis)
    const logicLife = 6.0;
    const logicPos  = pos.clone();
    const logicObj  = { position: logicPos, life: logicLife };
    this._decoyObjects.push(logicObj);

    // Nuage de particules visuelles (chaff / leurres thermiques)
    const COLORS = [0xffffff, 0xffee88, 0xffcc22, 0xff8800, 0xffaaaa];
    const COUNT  = 20;
    for (let i = 0; i < COUNT; i++) {
      const radius = 0.055 + Math.random() * 0.075;
      const geo  = new THREE.SphereGeometry(radius, 4, 3);
      const mat  = new THREE.MeshBasicMaterial({
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        transparent: true, opacity: 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this._scene.add(mesh);

      // Vélocité : majoritairement vers l'arrière + dispersion en cône
      const spd = 12 + Math.random() * 22;
      const vel = backward.clone().multiplyScalar(spd);
      vel.x += (Math.random() - 0.5) * 14;
      vel.y += (Math.random() - 0.5) * 10 + 2;
      vel.z += (Math.random() - 0.5) * 14;

      const life = 1.2 + Math.random() * 1.4;
      this._decoyParticles.push({ mesh, vel, life, totalLife: life });
    }

    return logicObj;
  }

  updateDecoys(delta) {
    // Leurres logiques
    if (this._decoyObjects) {
      for (let i = this._decoyObjects.length - 1; i >= 0; i--) {
        const d = this._decoyObjects[i];
        d.life -= delta;
        if (d.life <= 0) this._decoyObjects.splice(i, 1);
      }
    }
    // Particules visuelles
    if (this._decoyParticles) {
      for (let i = this._decoyParticles.length - 1; i >= 0; i--) {
        const p = this._decoyParticles[i];
        p.life -= delta;
        if (p.life <= 0) {
          this._scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          this._decoyParticles.splice(i, 1);
          continue;
        }
        // Physique : gravité légère + amortissement
        p.vel.y -= 12 * delta;
        p.vel.multiplyScalar(1 - 0.55 * delta);
        p.mesh.position.addScaledVector(p.vel, delta);
        // Fondu de sortie sur les 40% finaux
        const t = p.life / p.totalLife;
        p.mesh.material.opacity = Math.min(1.0, t * 2.5);
      }
    }
  }

  getActiveDecoys() { return this._decoyObjects ?? []; }

  // Tick des explosions
  tickExplosions(delta) {
    if (!this._explosions?.length) return;
    this._explosions = this._explosions.filter(fn => fn(delta));
  }

  // ── Accesseurs ────────────────────────────────────────────────────────────
  setParams(params) { this._lockParams = params; }
  clearParams()     { this._lockParams = null; this._lockTarget = null; this._lockProgress = 0; this._lockDone = false; }
  get lockProgress() { return this._lockProgress; }
  get lockTarget()   { return this._lockTarget; }
  get isLocked()     { return this._lockDone; }
  get activeMissileCount() { return this._missiles.length; }
  get missilesRemaining() {
    return (this._wingSlots ?? []).reduce((n, s) => n + (s?.mesh ? 1 : 0), 0);
  }
  get missilesRemainingAA() {
    return (this._wingSlots ?? []).reduce((n, s) => n + (s?.mesh && s.type === 'aa' ? 1 : 0), 0);
  }
  get missilesRemainingAG() {
    return (this._wingSlots ?? []).reduce((n, s) => n + (s?.mesh && s.type === 'ag' ? 1 : 0), 0);
  }
}

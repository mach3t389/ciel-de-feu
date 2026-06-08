import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// ══════════════════════════════════════════════════════════════════════════════
//  IA AVION — Machine à états simple et robuste
//  PATROL (idle, tourne autour de la base) → FOLLOW → ATTACK → FLEE
//  PRIORITÉ ABSOLUE : éviter le terrain (look-ahead), peu importe l'état.
// ══════════════════════════════════════════════════════════════════════════════

// États
const PATROL = 'PATROL';
const FOLLOW = 'FOLLOW';
const ATTACK = 'ATTACK';
const FLEE   = 'FLEE';

// Combat
const ATTACK_ENTER = 440;   // FOLLOW → ATTACK quand le joueur est à portée
const ATTACK_EXIT  = 640;   // ATTACK → FOLLOW quand il s'échappe
const FLEE_HP      = 0.25;

// ── Niveaux de compétence ────────────────────────────────────────────────────
//  detect    : rayon de détection
//  steer     : gain de virage (réactivité du pilotage)
//  fireRange : portée de tir
//  fireCos   : étroitesse du cône de tir (cos de l'angle ; + grand = plus précis)
//  fireCd    : cadence de tir (s entre deux tirs ; + petit = plus rapide)
//  aimErr    : dispersion du tir (rad ; + grand = rate plus souvent)
const SKILLS = {
  rookie:  { detect: 1100, steer: 0.55, fireRange: 250, fireCos: Math.cos(THREE.MathUtils.degToRad(58)), fireCd: 0.85, aimErr: 0.14 },
  regular: { detect: 1600, steer: 0.95, fireRange: 320, fireCos: Math.cos(THREE.MathUtils.degToRad(48)), fireCd: 0.50, aimErr: 0.075 },
  ace:     { detect: 2200, steer: 1.55, fireRange: 390, fireCos: Math.cos(THREE.MathUtils.degToRad(38)), fireCd: 0.28, aimErr: 0.030 },
};
const DETECT_COS_DEFAULT = Math.cos(THREE.MathUtils.degToRad(85)); // FOV total 170° — détecte quasi omnidirectionnel

// Sécurité terrain — l'avion garde toujours cette marge au-dessus du sol
const CLEARANCE    = 180;   // mètres au-dessus du terrain
const MIN_ALT      = 220;   // plancher absolu
const LOOK_DISTS   = [90, 180, 300, 450, 620]; // échantillons devant l'avion
const STEEP_GAP    = 130;   // si le sol devant dépasse de +130m → évitement latéral

// Vitesses
const SPD_PATROL = 54;
const SPD_FOLLOW = 95;
const SPD_ATTACK = 102;
const SPD_FLEE   = 104;
const SPD_MAX    = 110;

export let AI_DEBUG = false;
export function setAIDebug(v) { AI_DEBUG = v; }

export class Enemy {
  constructor(scene, spawnPos, options = {}) {
    this.scene  = scene;
    this.hp     = options.hp ?? 100;
    this._maxHp = this.hp;
    this.isDead = false;

    // 'defender' (reste près de sa base) ou 'attacker' (peut poursuivre loin)
    this.role   = options.role ?? 'defender';
    this._home  = options.homeZone ?? { x: spawnPos.x, z: spawnPos.z, radius: 600 };
    this._leash = options.leash ?? (this.role === 'attacker' ? 5000 : 1500);

    this._passive     = options.passive     ?? false; // mode pratique : ne détecte ni tire jamais
    this._alwaysChase = options.alwaysChase ?? false; // mode test : voit/poursuit partout
    this._leader     = options.leader ?? null;
    this._wingOffset = options.wingOffset ?? new THREE.Vector3(-35, 5, -25);

    // Compétence
    this.skill   = options.skill ?? 'regular';
    const sk     = SKILLS[this.skill] ?? SKILLS.regular;
    // detect peut être surchargé (ex. défenseurs avec grande vigilance)
    this._detect    = options.detect ?? sk.detect;
    this._lose      = this._detect * 1.3;    // hystérésis
    this._steerGain = sk.steer;
    this._fireRange = sk.fireRange;
    this._fireCos   = sk.fireCos;
    this._fireCdBase = sk.fireCd;
    this._aimErr    = sk.aimErr;

    // Mémoire d'engagement : une fois la cible vue, on la poursuit ce temps même hors de vue
    this._engage     = 0;
    this._engageTime = options.engageTime ?? (this.role === 'attacker' ? 16 : 8);

    // FSM
    this._state = PATROL;

    // Physique (Euler)
    this._yaw    = Math.random() * Math.PI * 2;
    this._pitch  = 0;
    this._roll   = 0;
    this.speed   = SPD_PATROL;
    this._stickX = 0;
    this._stickY = 0;

    // Navigation
    this._goal          = new THREE.Vector3();
    this._prevPlayerPos = null;
    this._playerVel     = new THREE.Vector3();
    this._orbitAngle    = Math.random() * Math.PI * 2;
    // Rayon d'orbite borné à ~60 % de la laisse pour rester dans la zone
    this._orbitR     = Math.min(this._leash * 0.6, 150 + Math.random() * 100);

    // Combat
    this.onFire      = null;
    this._shootCd    = 0.3 + Math.random() * 0.4;

    // Altitude de patrouille personnalisée (override du plancher global)
    this._minAlt    = options.minAlt    ?? MIN_ALT;
    this._clearance = options.clearance ?? CLEARANCE;

    // Terrain
    this.getTerrainHeight = null;

    // Debug
    this.debugInfo = {
      state: PATROL, dist: 0, distHome: 0,
      terrainClear: 0, hp: this.hp, alt: 0, terrainAlt: 0,
    };

    // Rendu / mort
    this._deathTimer = 0;
    this._hitFlash   = 0;
    this._baseColor  = (this.role === 'attacker') ? 0xaa1515 : 0x8b1a1a;
    this._loaded     = false;
    this._propBone   = null;
    this._meshNodes  = [];
    this._label      = null;
    this._labelState = null;

    this.pivot = new THREE.Object3D();
    this.pivot.position.copy(spawnPos);
    scene.add(this.pivot);
    this.mesh = null;

    const preloaded = options.preloadedScene ?? null;
    if (preloaded) {
      this._initMesh(skeletonClone(preloaded));
    } else {
      this._loadAsync();
    }
  }

  // ── Initialisation du mesh (à partir d'une scène clonée) ───────────────────
  _initMesh(scene) {
    this.mesh = scene;
    const box = new THREE.Box3().setFromObject(this.mesh);
    const sz  = new THREE.Vector3(); box.getSize(sz);
    const d   = Math.max(sz.x, sz.y, sz.z);
    this.mesh.scale.setScalar(d > 0 ? 4 / d : 1);
    this.mesh.rotation.y = Math.PI;

    this.mesh.traverse(n => {
      if (n.name === 'SK_Veh_Plane_Stunt_01_Crop_Duster') {
        n.visible = false;
        n.traverse(c => { c.visible = false; });
      }
    });

    this._meshNodes = [];
    this.mesh.traverse(n => {
      if (n.isMesh || n.isSkinnedMesh) {
        const m = n.material.clone();
        m.color.setHex(this._baseColor);
        m.transparent = false; m.opacity = 1; m.alphaTest = 0;
        m.side = THREE.FrontSide; m.needsUpdate = true;
        n.material = m; n.frustumCulled = false; n.visible = true;
        this._meshNodes.push(n);
      }
    });
    this.mesh.traverse(n => {
      if (n.name === 'SK_Veh_Plane_Stunt_01_Prop') this._propBone = n;
    });
    this.pivot.add(this.mesh);
    this._buildLabel();
    this._loaded = true;
  }

  // ── Fallback : chargement async si aucune scène préchargée ─────────────────
  _loadAsync() {
    new GLTFLoader().load('/SK_Veh_Plane_Stunt_01.glb', (gltf) => {
      this._initMesh(gltf.scene);
    }, undefined, e => console.error('[Enemy]', e));
  }

  // ── Label d'état flottant (debug) ───────────────────────────────────────────
  _buildLabel() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    this._labelCanvas = cv;
    this._labelTex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({
      map: this._labelTex, transparent: true, depthTest: false, depthWrite: false,
    });
    this._label = new THREE.Sprite(mat);
    this._label.scale.set(16, 4, 1);
    this._label.position.set(0, 6, 0);
    this._label.visible = false;
    this._label.renderOrder = 999;
    this.pivot.add(this._label);
  }

  _drawLabel() {
    const ctx = this._labelCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    const colors = { PATROL: '#88cc66', FOLLOW: '#ffcc44', ATTACK: '#ff4444', FLEE: '#44aaff' };
    ctx.font = 'bold 38px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(this._state, 128, 32);
    ctx.fillStyle = colors[this._state] || '#fff';
    ctx.fillText(this._state, 128, 32);
    this._labelTex.needsUpdate = true;
  }

  // ── API publique ────────────────────────────────────────────────────────────
  hit(dmg) {
    if (this.isDead) return;
    this.hp -= dmg;
    this._hitFlash = 0.15;
    if (this.hp <= 0) { this.isDead = true; this._deathTimer = 0; }
  }
  get position() { return this.pivot.position; }

  // Vélocité monde (pour l'indicateur de visée balistique du joueur)
  get velocity() {
    return this._forward().multiplyScalar(this.speed);
  }

  // ── Boucle principale ───────────────────────────────────────────────────────
  update(delta, playerPos, allyGroundTargets = []) {
    if (!this._loaded) return;
    if (this.isDead) { this._death(delta); return; }

    this._allyGroundTargets = allyGroundTargets;
    this._think(delta, playerPos);   // FSM + choix du but de navigation
    this._avoidTerrain();            // PRIORITÉ : relève le but au-dessus du relief
    this._steer();                   // calcule stickX / stickY vers le but
    this._fly(delta);                // intègre la physique
    this._combat(delta, playerPos);  // tir (uniquement en ATTACK)

    if (this._propBone) this._propBone.rotation.y += 40 * delta;

    if (this._hitFlash > 0) {
      this._hitFlash -= delta;
      const hex = this._hitFlash > 0 ? 0xffffff : this._baseColor;
      for (const n of this._meshNodes) n.material.color.setHex(hex);
    }

    // Label debug
    if (this._label) {
      this._label.visible = AI_DEBUG;
      if (AI_DEBUG && this._state !== this._labelState) {
        this._labelState = this._state;
        this._drawLabel();
      }
    }
  }

  // ── Réflexion : FSM + but de navigation ─────────────────────────────────────
  _think(delta, playerPos) {
    // Track player velocity for prediction & six-clock pursuit
    if (!this._prevPlayerPos) {
      this._prevPlayerPos = playerPos.clone();
      this._playerVel = new THREE.Vector3();
    } else {
      this._playerVel.subVectors(playerPos, this._prevPlayerPos).divideScalar(Math.max(delta, 0.001));
      this._prevPlayerPos.copy(playerPos);
    }

    const pos  = this.pivot.position;
    const dist = pos.distanceTo(playerPos);
    const dHome = this._distHome();

    // Wingman : suit simplement son leader, pas de FSM (sauf mode test → poursuit aussi)
    if (this.role === 'wingman' && !this._alwaysChase) {
      if (this._leader && !this._leader.isDead) {
        this._goalFromLeader();
        this._setDebug(dist, dHome);
        return;
      }
      this.role = 'defender';   // leader mort → autonome
    }

    const detected = (!this._passive && this._alwaysChase) ? true : (!this._passive && this._canSee(playerPos, dist));

    // Mémoire d'engagement : tant qu'elle dure, l'ennemi garde la cible même hors de vue
    if (detected) this._engage = this._engageTime;
    else          this._engage = Math.max(0, this._engage - delta);
    const engaged = this._engage > 0;

    // ── Transitions ──────────────────────────────────────────────────────────
    // FLEE prioritaire : santé critique
    if (this.hp < this._maxHp * FLEE_HP && this._state !== FLEE) {
      this._state = FLEE;
    }

    // Les attaquants ignorent le leash tant qu'ils sont engagés → poursuite tenace
    const leashActive = !this._alwaysChase && !(this.role === 'attacker' && engaged);
    const beyondLeash = leashActive && dHome > this._leash * 0.9;

    // On n'abandonne (lost) que si l'engagement est complètement épuisé
    const lost = !this._alwaysChase && !engaged && dist > this._lose;

    switch (this._state) {
      case FLEE:
        // Sort de FLEE quand loin du joueur et revenu près de la base
        if (dist > this._lose && dHome < this._leash * 0.6) this._state = PATROL;
        break;

      case PATROL:
        if (detected && !beyondLeash) this._state = FOLLOW;
        break;

      case FOLLOW:
        if (beyondLeash || lost) this._state = PATROL;
        else if (dist < ATTACK_ENTER) this._state = ATTACK;
        break;

      case ATTACK:
        if (beyondLeash || lost)      this._state = PATROL;
        else if (dist > ATTACK_EXIT)  this._state = FOLLOW;
        break;
    }

    // ── Comportement (but de navigation) ───────────────────────────────────────
    // Si trop loin de la base, on force le retour — leash absolu, tous états
    if (beyondLeash) {
      this._goalToBase();
    } else {
      switch (this._state) {
        case PATROL: this._goalPatrol(delta);            break;
        case FOLLOW: this._goalChase(playerPos);         break;
        case ATTACK: this._goalAttack(playerPos);        break;
        case FLEE:   this._goalFlee(playerPos);          break;
      }
    }

    this._setDebug(dist, dHome);
  }

  _setDebug(dist, dHome) {
    if (!AI_DEBUG) return;
    const pos = this.pivot.position;
    const tA  = this._gnd(pos.x, pos.z);
    this.debugInfo.state        = this._state;
    this.debugInfo.skill        = this.skill;
    this.debugInfo.role         = this.role;
    this.debugInfo.dist         = Math.round(dist);
    this.debugInfo.distHome     = Math.round(dHome);
    this.debugInfo.hp           = Math.round(this.hp);
    this.debugInfo.alt          = Math.round(pos.y);
    this.debugInfo.terrainAlt   = Math.round(tA);
    this.debugInfo.terrainClear = Math.round(pos.y - tA);
  }

  // ── Détection ───────────────────────────────────────────────────────────────
  _canSee(playerPos, dist) {
    const range = (this._state === FOLLOW || this._state === ATTACK) ? this._lose : this._detect;
    if (dist > range) return false;
    // Une fois engagé, on ne perd pas la cible sur le FOV
    if (this._state === FOLLOW || this._state === ATTACK) return true;
    const toP = new THREE.Vector3().subVectors(playerPos, this.pivot.position).normalize();
    return this._forward().dot(toP) > DETECT_COS_DEFAULT;
  }

  // ── Buts de navigation par état ─────────────────────────────────────────────
  _goalPatrol(delta) {
    // Cercle autour de la base
    this._orbitAngle += (this.speed / this._orbitR) * delta;
    this._goal.set(
      this._home.x + Math.cos(this._orbitAngle) * this._orbitR,
      0,
      this._home.z + Math.sin(this._orbitAngle) * this._orbitR
    );
    this._desiredSpeed = SPD_PATROL;
  }

  _goalToBase() {
    this._goal.set(this._home.x, 0, this._home.z);
    this._desiredSpeed = SPD_FOLLOW;
  }

  _goalChase(playerPos) {
    this._goal.set(playerPos.x, 0, playerPos.z);
    this._goalY = playerPos.y;
    this._desiredSpeed = SPD_FOLLOW;
  }

  _goalAttack(playerPos) {
    const vel = this._playerVel ?? new THREE.Vector3();
    const velXZ = new THREE.Vector3(vel.x, 0, vel.z);
    const velLen = velXZ.length();

    if (velLen > 8) {
      velXZ.normalize();
      // Vector from enemy to player
      const toPlayer = new THREE.Vector3().subVectors(playerPos, this.pivot.position);
      const toPlayerXZ = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();
      // How much we are already behind the player (1 = directly behind, -1 = head-on)
      const behindness = toPlayerXZ.dot(velXZ);

      if (behindness > 0.3) {
        // We're approaching from behind — lead the target position
        const leadTime = Math.min(1.5, toPlayer.length() / 100);
        const predicted = playerPos.clone().addScaledVector(vel, leadTime);
        this._goal.set(predicted.x, 0, predicted.z);
        this._goalY = predicted.y;
      } else {
        // Not behind player — fly toward their six o'clock to reposition
        const sixClock = playerPos.clone().addScaledVector(velXZ, -130);
        this._goal.set(sixClock.x, 0, sixClock.z);
        this._goalY = playerPos.y;
      }
    } else {
      // Player nearly stationary — aim directly
      this._goal.set(playerPos.x, 0, playerPos.z);
      this._goalY = playerPos.y;
    }

    this._desiredSpeed = SPD_ATTACK;
  }

  _goalFlee(playerPos) {
    // Fuit vers la base (zone sûre) — borné par le leash, ne part jamais à l'infini
    this._goal.set(this._home.x, 0, this._home.z);
    this._goalY = this.pivot.position.y + 60;
    this._desiredSpeed = SPD_FLEE;
  }

  _goalFromLeader() {
    const leader = this._leader;
    // Yaw seul pour fwd/right — le roll du leader ne doit pas contaminer la position de formation
    const qYaw  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), leader._yaw);
    const fwd   = new THREE.Vector3(0, 0, -1).applyQuaternion(qYaw);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(qYaw);
    const lpos  = leader.pivot.position;
    this._goal.set(
      lpos.x + fwd.x * this._wingOffset.z + right.x * this._wingOffset.x,
      0,
      lpos.z + fwd.z * this._wingOffset.z + right.z * this._wingOffset.x,
    );
    this._goalY = lpos.y + this._wingOffset.y;
    this._desiredSpeed = Math.min(SPD_MAX, leader.speed + 4);
  }

  // ── PRIORITÉ : évitement du terrain ─────────────────────────────────────────
  _avoidTerrain() {
    const pos = this.pivot.position;

    // 1) Altitude de but : on part de _goalY (ou altitude actuelle en patrouille)
    let goalY = this._goalY ?? pos.y;
    this._goalY = null; // reset pour le prochain tick

    // 2) Échantillonne le sol DEVANT l'avion, prend le plus haut
    const fx = -Math.sin(this._yaw), fz = -Math.cos(this._yaw);
    let maxAhead = this._gnd(pos.x, pos.z);
    for (const d of LOOK_DISTS) {
      const h = this._gnd(pos.x + fx * d, pos.z + fz * d);
      if (h > maxAhead) maxAhead = h;
    }
    const terrainFloor = Math.max(this._minAlt, maxAhead + this._clearance);

    // 3) L'altitude finale ne descend jamais sous le plancher du relief
    this._goal.y = Math.max(goalY, terrainFloor);

    // 4) Si le relief devant est vraiment haut → évitement latéral :
    //    tourne vers le côté le plus bas (en plus de monter)
    this._yawBias = 0;
    if (maxAhead + CLEARANCE > pos.y + STEEP_GAP) {
      const side = 320;
      const lx = pos.x + (-fz) * side, lz = pos.z + (fx) * side;   // gauche
      const rx = pos.x + (fz) * side,  rz = pos.z + (-fx) * side;  // droite
      const gL = this._gnd(lx, lz), gR = this._gnd(rx, rz);
      this._yawBias = (gL < gR) ? +0.9 : -0.9;  // pousse le yaw vers le côté dégagé
    }
  }

  // ── Steering vers _goal ──────────────────────────────────────────────────────
  _steer() {
    const pos = this.pivot.position;

    // Yaw vers le but XZ
    const desYaw = Math.atan2(-(this._goal.x - pos.x), -(this._goal.z - pos.z));
    let yawErr = desYaw - this._yaw;
    while (yawErr >  Math.PI) yawErr -= Math.PI * 2;
    while (yawErr < -Math.PI) yawErr += Math.PI * 2;
    this._stickX = THREE.MathUtils.clamp(yawErr * this._steerGain + (this._yawBias || 0), -1, 1);

    // Pitch vers l'altitude visée (relief inclus)
    const altErr = this._goal.y - pos.y;
    this._stickY = THREE.MathUtils.clamp(-altErr * 0.02, -1, 1);
  }

  // ── Physique ────────────────────────────────────────────────────────────────
  _fly(delta) {
    // Vitesse cible
    const ds = this._desiredSpeed ?? SPD_PATROL;
    this.speed = THREE.MathUtils.lerp(this.speed, ds, delta * 1.2);

    const man = 1 - 0.3 * (this.speed / SPD_MAX);

    // Roulis (pilote le lacet) — signe + pour un feedback correct vers la cible
    this._roll += this._stickX * 0.6 * man * delta;
    const rollAct = Math.min(1, Math.abs(this._stickX) * 2);
    this._roll *= Math.exp(-1.4 * delta * (1 - rollAct));
    this._roll  = THREE.MathUtils.clamp(this._roll, -Math.PI * 0.20, Math.PI * 0.20);

    // Tangage
    this._pitch += -this._stickY * 0.45 * man * delta;
    this._pitch *= Math.exp(-1.6 * delta * (1 - Math.min(1, Math.abs(this._stickY) * 2)));
    this._pitch  = THREE.MathUtils.clamp(this._pitch, -0.65, 0.65);

    // Lacet induit par le roulis
    const sf = 1 - 0.6 * (this.speed / SPD_MAX);
    this._yaw += Math.sin(this._roll) * 1.4 * sf * delta;

    // Orientation
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), this._yaw);
    const qP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this._pitch);
    const qR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), this._roll);
    this.pivot.quaternion.copy(qY).multiply(qP).multiply(qR);

    // Avance
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().copy(qY).multiply(qP));
    this.pivot.position.addScaledVector(fwd, this.speed * delta);

    // Filet de sécurité (ne devrait jamais servir grâce au look-ahead)
    const gY   = this._gnd(this.pivot.position.x, this.pivot.position.z);
    const hardFloor = gY + 45;
    if (this.pivot.position.y < hardFloor) {
      this.pivot.position.y = hardFloor;
      if (this._pitch < 0.2) this._pitch = 0.2;
    }
    if (this.pivot.position.y > 950) this.pivot.position.y = 950;
  }

  // ── Tir ─────────────────────────────────────────────────────────────────────
  _combat(delta, playerPos) {
    this._shootCd -= delta;
    if (!this.onFire || this._shootCd > 0 || this._passive) return;
    const canFire = (this.role === 'wingman') ? true : (this._state === ATTACK);

    // ── Tentative de tir sur le joueur ───────────────────────────────────────
    if (canFire) {
      const toP  = new THREE.Vector3().subVectors(playerPos, this.pivot.position);
      const dist = toP.length();
      if (dist <= this._fireRange && dist >= 8) {
        const fwd = this._forward();
        if (fwd.dot(toP.normalize()) >= this._fireCos) {
          const vel = this._playerVel ?? new THREE.Vector3();
          const travelTime = (dist / 950) * 0.45;
          const aimDir = new THREE.Vector3().subVectors(
            playerPos.clone().addScaledVector(vel, travelTime),
            this.pivot.position
          ).normalize();
          if (this._aimErr > 0) {
            aimDir.x += (Math.random() - 0.5) * 2 * this._aimErr;
            aimDir.y += (Math.random() - 0.5) * 2 * this._aimErr;
            aimDir.z += (Math.random() - 0.5) * 2 * this._aimErr;
            aimDir.normalize();
          }
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), aimDir);
          this.onFire(this.pivot.position.clone().addScaledVector(fwd, 4), quat);
          this._shootCd = this._fireCdBase + Math.random() * this._fireCdBase * 0.4;
          return;
        }
      }
    }

    // ── Tir opportuniste sur tourelles alliées (si joueur hors portée d'attaque) ──
    if (this._state !== ATTACK && this._allyGroundTargets?.length) {
      const fwd = this._forward();
      let bestDist = this._fireRange, bestTarget = null;
      for (const gt of this._allyGroundTargets) {
        if (gt.isDead) continue;
        const d = this.pivot.position.distanceTo(gt.pos);
        if (d < bestDist) { bestDist = d; bestTarget = gt; }
      }
      if (bestTarget) {
        const toT = new THREE.Vector3().subVectors(bestTarget.pos, this.pivot.position);
        if (fwd.dot(toT.clone().normalize()) >= this._fireCos) {
          const aimDir = toT.normalize();
          if (this._aimErr > 0) {
            aimDir.x += (Math.random() - 0.5) * 2 * this._aimErr * 1.5;
            aimDir.y += (Math.random() - 0.5) * 2 * this._aimErr * 1.5;
            aimDir.z += (Math.random() - 0.5) * 2 * this._aimErr * 1.5;
            aimDir.normalize();
          }
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), aimDir);
          this.onFire(this.pivot.position.clone().addScaledVector(fwd, 4), quat);
          this._shootCd = this._fireCdBase * 1.5 + Math.random() * this._fireCdBase;
        }
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  _gnd(x, z)  { return this.getTerrainHeight?.(x, z) ?? 0; }
  _distHome() { return Math.hypot(this.pivot.position.x - this._home.x, this.pivot.position.z - this._home.z); }
  _forward()  {
    // Avant horizontal basé sur yaw+pitch (sens de tir réel)
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0,1,0), this._yaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this._pitch));
    return new THREE.Vector3(0,0,-1).applyQuaternion(q);
  }

  // ── Mort ──────────────────────────────────────────────────────────────────────
  _death(delta) {
    if (this._label) this._label.visible = false;
    this._deathTimer += delta;
    this._pitch = THREE.MathUtils.lerp(this._pitch, -1.1, delta * 0.35);
    this._roll += (0.8 + this._deathTimer * 0.6) * delta;
    this.speed  = Math.max(8, this.speed - 12 * delta);

    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), this._yaw);
    const qP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this._pitch);
    const qR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), this._roll);
    this.pivot.quaternion.copy(qY).multiply(qP).multiply(qR);
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().copy(qY).multiply(qP));
    this.pivot.position.addScaledVector(fwd, this.speed * delta);
    if (this._deathTimer > 6) { this.scene.remove(this.pivot); this.mesh = null; }
  }
}

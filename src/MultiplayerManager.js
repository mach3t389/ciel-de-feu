import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Couleurs fixes : allié = vert, ennemi = rouge
const ALLY_COLOR = 0x33cc66;
const ENEMY_COLOR = 0xcc2222;

// Interpolation par snapshots : on affiche les joueurs distants ~100 ms dans le
// passé et on interpole entre les deux derniers paquets reçus. Ça absorbe la gigue
// réseau (Railway gratuit) et supprime le rubber-banding de l'extrapolation pure.
const INTERP_DELAY = 0.10;

// Représente un joueur distant (lecture seule — données reçues du réseau)
class RemotePlayer {
  // isEnemy : true si ce joueur est dans l'équipe adverse (TDM) ou en FFA
  constructor(scene, id, info, isEnemy = false) {
    this.id          = id;
    this.name        = info.name || 'UNKNOWN';
    this.team        = info.team || 'rouge';
    this.isEnemy     = isEnemy;
    this.isDead      = false;
    this.hp          = 100;
    this.speed       = 40;
    this.kills       = 0;   // synchronisé via score_update
    this.deaths      = 0;
    this.shieldActive = false;
    this.shieldType   = null;
    this._shieldMesh  = null;

    this.pivot = new THREE.Object3D();
    scene.add(this.pivot);

    this.mesh        = null;
    this._loaded     = false;
    this._deathTimer = 0;

    this._buffer      = [];    // snapshots { t, pos, quat, speed } pour interpolation
    this._initialized = false; // true dès le premier paquet (téléportation initiale)
    this._velocity    = new THREE.Vector3();

    this._markerColor = isEnemy ? '#cc2222' : '#33cc66';
    this._emissiveHex = isEnemy ? ENEMY_COLOR : ALLY_COLOR;

    this._load(scene);
    this._buildMarker();
  }

  _load(scene) {
    new GLTFLoader().load('/SK_Veh_Plane_Stunt_01.glb', (gltf) => {
      this.mesh = gltf.scene;
      const box = new THREE.Box3().setFromObject(this.mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      this.mesh.scale.setScalar(maxDim > 0 ? 4 / maxDim : 1);
      this.mesh.rotation.y = Math.PI;

      this._mats = [];
      this.mesh.traverse(node => {
        if (node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => {
            if (m.emissive !== undefined) {
              m.emissive = new THREE.Color(this._emissiveHex);
              m.emissiveIntensity = 0.18;
              this._mats.push(m);
            }
          });
        }
      });

      this.pivot.add(this.mesh);
      this._loaded = true;
    });
  }

  _buildMarker() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;  // résolution doublée → texte net même réduit
    const ctx = canvas.getContext('2d');
    const color = this._markerColor;

    if (this.isEnemy) {
      // Ennemi : encadré plein, bien visible
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 252, 60);
      ctx.fillStyle = color;
      ctx.font = 'bold 26px Courier New';
    } else {
      // Allié : juste le nom, sans cadre — discret
      ctx.fillStyle = color;
      ctx.font = '22px Courier New';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.name.slice(0, 10), 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    this._marker = new THREE.Sprite(mat);
    const scale = this.isEnemy ? 18 : 6;
    this._marker.scale.set(scale, scale * 0.25, 1);
    this._marker.material.opacity = this.isEnemy ? 1.0 : 0.4;
    this._marker.position.set(0, this.isEnemy ? 8 : 5, 0);
    this.pivot.add(this._marker);
  }

  _updateShieldMesh() {
    if (this.shieldActive) {
      if (!this._shieldMesh) {
        const col = this.shieldType === 'shield_rear' ? 0xff8844
                  : this.shieldType === 'shield_front' ? 0x4488ff
                  : 0x44ccff;
        const mat = new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.22,
          side: THREE.DoubleSide, depthWrite: false,
        });
        this._shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(12, 10, 7), mat);
        this.pivot.add(this._shieldMesh);
      }
      this._shieldMesh.visible = true;
    } else if (this._shieldMesh) {
      this._shieldMesh.visible = false;
    }
  }

  // Applique l'état reçu du réseau → empile un snapshot horodaté pour l'interpolation
  applyState(state) {
    if (state.speed !== undefined) this.speed = state.speed;
    if (state.shieldActive !== undefined) {
      this.shieldActive = state.shieldActive;
      this.shieldType   = state.shieldType ?? null;
      this._updateShieldMesh();
    }
    if (state.position && state.quaternion) {
      const now = performance.now() / 1000;
      const p = state.position, q = state.quaternion;
      const entry = {
        t   : now,
        pos : new THREE.Vector3(p.x, p.y, p.z),
        quat: new THREE.Quaternion(q.x, q.y, q.z, q.w),
      };
      this._buffer.push(entry);
      // Conserver ~1 s d'historique (au moins 2 snapshots pour interpoler)
      while (this._buffer.length > 2 && now - this._buffer[0].t > 1.0) this._buffer.shift();
      if (!this._initialized) {
        // Premier paquet : téléporter pour éviter un glissement depuis l'origine
        this.pivot.position.copy(entry.pos);
        this.pivot.quaternion.copy(entry.quat);
        this._initialized = true;
      }
      // Vélocité monde courante (nez × vitesse) — sert à la visée balistique et à
      // l'extrapolation si le réseau décroche
      this._velocity.set(0, 0, -1).applyQuaternion(entry.quat).multiplyScalar(this.speed);
    }
    if (state.hp !== undefined) {
      // La cible est autoritaire, mais on a pu appliquer des dégâts optimistes
      // (réactivité). On accepte une baisse de PV (plus de dégâts) ou un plein
      // (réapparition / ravitaillement), mais pas une hausse partielle qui
      // annulerait nos dégâts optimistes en attendant l'aller-retour réseau.
      if (state.hp <= this.hp || state.hp >= 100) this.hp = state.hp;
      if (this.hp <= 0 && !this.isDead) this._die();
    }
    if (state.dead !== undefined && state.dead && !this.isDead) this._die();
    if (state.dead === false && this.isDead) this.respawn(state.position);
  }

  // Dégâts optimistes appliqués localement par le tireur → réaction immédiate
  // (la cible reste autoritaire et resynchronisera ses PV juste après)
  applyLocalHit(dmg) {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - dmg);
    this._flashTimer = 0.16;
    // La mort reste autoritaire (décidée par la cible) → évite les kills
    // fantômes et le double comptage de score.
  }

  _die() {
    this.isDead = true;
    this._deathTimer = 3;
    if (this.mesh) this.mesh.visible = false;
    if (this._marker) this._marker.visible = false;
    if (this._onDie) this._onDie(this.isEnemy);
  }

  respawn(pos) {
    this.isDead = false;
    this.hp = 100;
    this._buffer.length = 0;
    this._initialized = false;
    if (pos) this.pivot.position.set(pos.x, pos.y, pos.z);
    if (this.mesh) this.mesh.visible = true;
    if (this._marker) this._marker.visible = true;
  }

  get position() { return this.pivot.position; }
  get quaternion() { return this.pivot.quaternion; }
  // Vélocité monde (pour l'indicateur de visée balistique du joueur)
  get velocity() { return this._velocity; }

  // Position prédite à l'instant présent (la mire de visée doit anticiper, pas
  // afficher la position retardée de 100 ms utilisée pour le rendu fluide)
  get aimPosition() {
    const buf = this._buffer;
    if (buf.length === 0) return this.pivot.position;
    const last  = buf[buf.length - 1];
    const ahead = Math.min(performance.now() / 1000 - last.t, 0.3);
    return last.pos.clone().addScaledVector(this._velocity, ahead);
  }

  update(delta) {
    if (this.isDead) {
      this._deathTimer -= delta;
      return;
    }
    const buf = this._buffer;
    if (buf.length === 0) return;

    const now     = performance.now() / 1000;
    const renderT = now - INTERP_DELAY;
    const last    = buf[buf.length - 1];

    if (buf.length === 1 || renderT <= buf[0].t) {
      // Pas assez d'historique : suivre le plus ancien snapshot en douceur
      this.pivot.position.lerp(buf[0].pos, 1 - Math.exp(-18 * delta));
      this.pivot.quaternion.slerp(buf[0].quat, 1 - Math.exp(-16 * delta));
    } else if (renderT >= last.t) {
      // Réseau en retard : extrapoler depuis le dernier snapshot (plafonné 0.3 s)
      const ahead     = Math.min(renderT - last.t, 0.3);
      const predicted = last.pos.clone().addScaledVector(this._velocity, ahead);
      this.pivot.position.lerp(predicted, 1 - Math.exp(-18 * delta));
      this.pivot.quaternion.slerp(last.quat, 1 - Math.exp(-16 * delta));
    } else {
      // Cas nominal : interpoler entre les deux snapshots encadrant renderT
      let i = 0;
      while (i < buf.length - 1 && buf[i + 1].t < renderT) i++;
      const a = buf[i], b = buf[i + 1];
      const span = b.t - a.t;
      const f = span > 1e-4 ? (renderT - a.t) / span : 0;
      this.pivot.position.lerpVectors(a.pos, b.pos, f);
      this.pivot.quaternion.copy(a.quat).slerp(b.quat, f);
    }

    // Flash de touche (retour visuel immédiat quand on tire dessus)
    if (this._flashTimer > 0) {
      this._flashTimer -= delta;
      const lit = this._flashTimer > 0;
      if (this._mats) for (const m of this._mats) m.emissiveIntensity = lit ? 1.6 : 0.18;
    }

    // Pulse du bouclier
    if (this._shieldMesh?.visible) {
      this._shieldMesh.material.opacity = 0.12 + 0.18 * Math.abs(Math.sin(performance.now() / 280));
    }
  }

  remove(scene) {
    scene.remove(this.pivot);
  }
}

// ── RemoteBot ─────────────────────────────────────────────────────────────────
// Bot IA host-authoritative : rendu côté client, positions reçues du réseau.
class RemoteBot {
  constructor(scene, netId) {
    this.netId    = netId;
    this.isEnemy  = true;
    this.isDead   = false;
    this.hp       = 100;
    this._killSent = false;

    this.pivot = new THREE.Object3D();
    scene.add(this.pivot);

    this._buffer      = [];
    this._initialized = false;
    this._velocity    = new THREE.Vector3();
    this.mesh         = null;
    this._deathTimer  = 0;

    this._load(scene);
    this._buildMarker();
  }

  _load(scene) {
    new GLTFLoader().load('/SK_Veh_Plane_Stunt_01.glb', (gltf) => {
      this.mesh = gltf.scene;
      const box = new THREE.Box3().setFromObject(this.mesh);
      const sz  = new THREE.Vector3(); box.getSize(sz);
      const maxDim = Math.max(sz.x, sz.y, sz.z);
      this.mesh.scale.setScalar(maxDim > 0 ? 4 / maxDim : 1);
      this.mesh.rotation.y = Math.PI;
      this.mesh.traverse(node => {
        if (node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => {
            if (m.emissive !== undefined) {
              m.emissive = new THREE.Color(ENEMY_COLOR);
              m.emissiveIntensity = 0.18;
              this._mats = this._mats ?? [];
              this._mats.push(m);
            }
          });
        }
      });
      this.pivot.add(this.mesh);
    });
  }

  _buildMarker() {
    const canvas = document.createElement('canvas');
    canvas.width = 192; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 192, 48);
    ctx.strokeStyle = '#cc2222';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 190, 46);
    ctx.fillStyle = '#cc2222';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOT', 96, 24);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    this._marker = new THREE.Sprite(mat);
    this._marker.scale.set(14, 3.5, 1);
    this._marker.position.set(0, 8, 0);
    this.pivot.add(this._marker);
  }

  applyState(state) {
    if (state.hp   !== undefined) this.hp = state.hp;
    if (state.dead && !this.isDead)        this._die();
    if (state.dead === false && this.isDead) this._revive(state.pos);
    if (state.pos && state.quat) {
      const now = performance.now() / 1000;
      const p = state.pos, q = state.quat;
      const entry = {
        t   : now,
        pos : new THREE.Vector3(p.x, p.y, p.z),
        quat: new THREE.Quaternion(q.x, q.y, q.z, q.w),
      };
      this._buffer.push(entry);
      while (this._buffer.length > 2 && now - this._buffer[0].t > 1.0) this._buffer.shift();
      if (!this._initialized) {
        this.pivot.position.copy(entry.pos);
        this.pivot.quaternion.copy(entry.quat);
        this._initialized = true;
      }
      this._velocity.set(0, 0, -1).applyQuaternion(entry.quat).multiplyScalar(60);
    }
  }

  applyLocalHit(dmg) {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - dmg);
  }

  _die() {
    this.isDead = true;
    this._deathTimer = 3;
    this._killSent   = false;
    if (this.mesh)    this.mesh.visible    = false;
    if (this._marker) this._marker.visible = false;
  }

  _revive(pos) {
    this.isDead  = false;
    this.hp      = 100;
    this._killSent = false;
    this._buffer.length = 0;
    this._initialized   = false;
    if (pos) this.pivot.position.set(pos.x, pos.y, pos.z);
    if (this.mesh)    this.mesh.visible    = true;
    if (this._marker) this._marker.visible = true;
  }

  get position()    { return this.pivot.position; }
  get quaternion()  { return this.pivot.quaternion; }
  get aimPosition() {
    const buf = this._buffer;
    if (buf.length === 0) return this.pivot.position;
    const last  = buf[buf.length - 1];
    const ahead = Math.min(performance.now() / 1000 - last.t, 0.3);
    return last.pos.clone().addScaledVector(this._velocity, ahead);
  }

  update(delta) {
    if (this.isDead) { this._deathTimer -= delta; return; }
    const buf = this._buffer;
    if (buf.length === 0) return;
    const now     = performance.now() / 1000;
    const renderT = now - INTERP_DELAY;
    const last    = buf[buf.length - 1];
    if (buf.length === 1 || renderT <= buf[0].t) {
      this.pivot.position.lerp(buf[0].pos, 1 - Math.exp(-18 * delta));
      this.pivot.quaternion.slerp(buf[0].quat, 1 - Math.exp(-16 * delta));
    } else if (renderT >= last.t) {
      const ahead     = Math.min(renderT - last.t, 0.3);
      const predicted = last.pos.clone().addScaledVector(this._velocity, ahead);
      this.pivot.position.lerp(predicted, 1 - Math.exp(-18 * delta));
      this.pivot.quaternion.slerp(last.quat, 1 - Math.exp(-16 * delta));
    } else {
      let i = 0;
      while (i < buf.length - 1 && buf[i + 1].t < renderT) i++;
      const a = buf[i], b = buf[i + 1];
      const span = b.t - a.t;
      const f    = span > 1e-4 ? (renderT - a.t) / span : 0;
      this.pivot.position.lerpVectors(a.pos, b.pos, f);
      this.pivot.quaternion.copy(a.quat).slerp(b.quat, f);
    }
    if (this._flashTimer > 0) {
      this._flashTimer -= delta;
      const lit = this._flashTimer > 0;
      if (this._mats) for (const m of this._mats) m.emissiveIntensity = lit ? 1.6 : 0.18;
    }
  }

  remove(scene) { scene.remove(this.pivot); }
}

// ── MultiplayerManager ───────────────────────────────────────────────────────
export class MultiplayerManager {
  constructor(scene, networkManager, config = {}) {
    this._scene   = scene;
    this._network = networkManager;
    this._config  = config;   // { mode, playerTeam, friendlyFire }
    this._players = new Map();
    this._bots    = new Map();  // netId → RemoteBot (FFA host-authoritative)
    this._botsEnabled = false;

    if (this._network) this._bindNetwork();
  }

  _isEnemy(info) {
    const mode = this._config.mode;
    if (mode === 'ffa') return true;          // tout le monde est ennemi en versus
    if (mode === 'tdm') return info.playerTeam !== this._config.playerTeam;
    return false;                             // coop / freeflight → tous alliés
  }

  _bindNetwork() {
    this._network.on('player_update', ({ id, state }) => {
      const p = this._players.get(id);
      if (p) p.applyState(state);
    });

    this._network.on('player_joined', ({ player }) => {
      if (!this._players.has(player.id)) {
        this.addRemotePlayer(player.id, player);
      }
      this._emit('remote_player_joined', { id: player?.id, name: player?.name });
    });

    this._network.on('player_left', ({ id }) => {
      const p = this._players.get(id);
      if (p) this._emit('remote_player_left', { id, name: p.name });
      this.removeRemotePlayer(id);
    });

    this._network.on('bullet_fired', ({ id, position, quaternion }) => {
      this._emit('remoteBullet', { position, quaternion });
    });

    this._network.on('player_hit', ({ targetId, damage, shooterId }) => {
      this._emit('remoteHit', { targetId, damage, shooterId });
    });

    this._network.on('player_respawn', ({ id, position }) => {
      const p = this._players.get(id);
      if (p) p.respawn(position);
    });

    this._network.on('enemy_killed', ({ netId }) => {
      this._emit('enemy_killed', { netId });
    });

    // Positions des bots IA (FFA host-authoritative) — hôte → tous les clients
    this._network.on('bot_state', ({ bots }) => {
      if (!this._botsEnabled || !bots) return;
      for (const state of bots) {
        let bot = this._bots.get(state.netId);
        if (!bot) {
          bot = new RemoteBot(this._scene, state.netId);
          this._bots.set(state.netId, bot);
        }
        bot.applyState(state);
      }
    });

    // Scores des autres joueurs (kills / deaths) pour le tableau des scores
    this._network.on('score_update', ({ id, kills, deaths, name }) => {
      const p = this._players.get(id);
      if (p) {
        if (kills  !== undefined) p.kills  = kills;
        if (deaths !== undefined) p.deaths = deaths;
        if (name) p.name = name;
        this._emit('scoreboard_changed', {});
      }
    });
  }

  addRemotePlayer(id, info) {
    if (this._players.has(id)) return;
    const p = new RemotePlayer(this._scene, id, info, this._isEnemy(info));
    p._onDie = (isEnemy) => this._emit('remote_player_died', { id, isEnemy });
    this._players.set(id, p);
    return p;
  }

  removeRemotePlayer(id) {
    const p = this._players.get(id);
    if (p) { p.remove(this._scene); this._players.delete(id); }
  }

  // Envoie l'état local au réseau (extra : { shieldActive, shieldType })
  sendLocalState(player, extra = {}) {
    if (!this._network) return;
    this._network.send('player_update', {
      state: {
        position    : { x: player.position.x, y: player.position.y, z: player.position.z },
        quaternion  : { x: player.quaternion.x, y: player.quaternion.y, z: player.quaternion.z, w: player.quaternion.w },
        speed       : player.speed,
        hp          : player.health,
        dead        : player.isDead,
        shieldActive: extra.shieldActive ?? false,
        shieldType  : extra.shieldType  ?? null,
      },
    });
  }

  // Diffuse notre score (kills/deaths) — appelé à chaque changement
  sendScore(kills, deaths, name) {
    if (!this._network) return;
    this._network.send('score_update', { kills, deaths, name });
  }

  sendBullet(position, quaternion) {
    if (!this._network) return;
    this._network.send('bullet_fired', {
      position  : { x: position.x,   y: position.y,   z: position.z },
      quaternion: { x: quaternion.x,  y: quaternion.y,  z: quaternion.z, w: quaternion.w },
    });
  }

  sendHit(targetId, damage) {
    if (!this._network) return;
    this._network.send('player_hit', { targetId, damage });
  }

  sendEnemyKill(netId) {
    if (!this._network || netId === undefined) return;
    this._network.send('enemy_killed', { netId });
  }

  // Diffuse les états des bots IA (appelé par l'hôte toutes les 100 ms)
  sendBotStates(states) {
    if (!this._network) return;
    this._network.send('bot_state', { bots: states });
  }

  // Active la réception des bot_state (clients FFA uniquement)
  enableBotReceive() {
    this._botsEnabled = true;
  }

  getRemotePlayers() {
    return Array.from(this._players.values());
  }

  getRemoteBots() {
    return Array.from(this._bots.values());
  }

  removeAllBots() {
    this._bots.forEach(b => b.remove(this._scene));
    this._bots.clear();
  }

  update(delta) {
    this._players.forEach(p => p.update(delta));
    this._bots.forEach(b => b.update(delta));
  }

  // Mini event bus interne
  _listeners = new Map();
  _emit(type, data) {
    (this._listeners.get(type) || []).forEach(h => h(data));
  }
  on(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }
}

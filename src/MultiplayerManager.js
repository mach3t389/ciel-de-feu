import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Couleurs fixes : allié = vert, ennemi = rouge
const ALLY_COLOR = 0x33cc66;
const ENEMY_COLOR = 0xcc2222;

// Représente un joueur distant (lecture seule — données reçues du réseau)
class RemotePlayer {
  // isEnemy : true si ce joueur est dans l'équipe adverse (TDM) ou en FFA
  constructor(scene, id, info, isEnemy = false) {
    this.id       = id;
    this.name     = info.name || 'UNKNOWN';
    this.team     = info.team || 'rouge';
    this.isEnemy  = isEnemy;
    this.isDead   = false;
    this.hp       = 100;
    this.speed    = 40;

    this.pivot = new THREE.Object3D();
    scene.add(this.pivot);

    this.mesh        = null;
    this._loaded     = false;
    this._deathTimer = 0;

    this._targetPos  = null;
    this._targetQuat = new THREE.Quaternion();

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

      this.mesh.traverse(node => {
        if (node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(m => {
            if (m.emissive !== undefined) {
              m.emissive = new THREE.Color(this._emissiveHex);
              m.emissiveIntensity = 0.18;
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
    canvas.width = 128; canvas.height = 40;
    const ctx = canvas.getContext('2d');
    const color = this._markerColor;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 128, 40);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, 126, 38);
    ctx.fillStyle = color;
    ctx.font = 'bold 13px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.name.slice(0, 10), 64, 20);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    this._marker = new THREE.Sprite(mat);
    const scale = this.isEnemy ? 18 : 11;
    this._marker.scale.set(scale, scale * 0.31, 1);
    this._marker.material.opacity = this.isEnemy ? 1.0 : 0.55;
    this._marker.position.set(0, 8, 0);
    this.pivot.add(this._marker);
  }

  // Applique l'état reçu du réseau (stocke les cibles pour interpolation)
  applyState(state) {
    if (state.position) {
      const p = state.position;
      if (!this._targetPos) {
        // Premier paquet : téléporter directement pour éviter un glissement depuis l'origine
        this.pivot.position.set(p.x, p.y, p.z);
      }
      this._targetPos = new THREE.Vector3(p.x, p.y, p.z);
    }
    if (state.quaternion) {
      const q = state.quaternion;
      this._targetQuat.set(q.x, q.y, q.z, q.w);
    }
    if (state.speed !== undefined) this.speed = state.speed;
    if (state.hp    !== undefined) {
      this.hp = state.hp;
      if (this.hp <= 0 && !this.isDead) this._die();
    }
    if (state.dead !== undefined && state.dead && !this.isDead) this._die();
    if (state.dead === false && this.isDead) this.respawn(state.position);
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
    if (pos) this.pivot.position.set(pos.x, pos.y, pos.z);
    if (this.mesh) this.mesh.visible = true;
    if (this._marker) this._marker.visible = true;
  }

  get position() { return this.pivot.position; }
  get quaternion() { return this.pivot.quaternion; }

  update(delta) {
    if (this.isDead) {
      this._deathTimer -= delta;
      return;
    }
    const t = Math.min(1, delta * 8);
    if (this._targetPos) this.pivot.position.lerp(this._targetPos, t);
    this.pivot.quaternion.slerp(this._targetQuat, t);
  }

  remove(scene) {
    scene.remove(this.pivot);
  }
}

// ── MultiplayerManager ───────────────────────────────────────────────────────
export class MultiplayerManager {
  constructor(scene, networkManager, config = {}) {
    this._scene   = scene;
    this._network = networkManager;
    this._config  = config;   // { mode, playerTeam, friendlyFire }
    this._players = new Map();

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
    });

    this._network.on('player_left', ({ id }) => {
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

  // Envoie l'état local au réseau
  sendLocalState(player) {
    if (!this._network) return;
    this._network.send('player_update', {
      state: {
        position  : { x: player.position.x, y: player.position.y, z: player.position.z },
        quaternion: { x: player.quaternion.x, y: player.quaternion.y, z: player.quaternion.z, w: player.quaternion.w },
        speed     : player.speed,
        hp        : player.health,
        dead      : player.isDead,
      },
    });
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

  getRemotePlayers() {
    return Array.from(this._players.values());
  }

  update(delta) {
    this._players.forEach(p => p.update(delta));
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

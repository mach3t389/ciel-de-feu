import * as THREE from 'three';

const BULLET_SPEED    = 950;
const PLAYER_LIFETIME = 0.95;  // ≈ 900 u de portée
const ENEMY_LIFETIME  = 0.62;  // ≈ 590 u

const _geo     = new THREE.CylinderGeometry(0.10, 0.10, 0.9, 6);
_geo.rotateX(Math.PI / 2);
const _mat      = new THREE.MeshBasicMaterial({ color: 0xff3300 });
const _matEnemy = new THREE.MeshBasicMaterial({ color: 0x55bbff });
const _matAlly  = new THREE.MeshBasicMaterial({ color: 0x88ff44 });

// Pools de mailles — réutilise THREE.Mesh pour éviter la GC pressure
const _playerPool = [];
const _enemyPool  = [];
const _allyPool   = [];

const _acquire = (pool, mat) => {
  if (pool.length > 0) { const m = pool.pop(); m.visible = true; return m; }
  return new THREE.Mesh(_geo, mat);
};
const _release = (pool, mesh) => { mesh.visible = false; pool.push(mesh); };

// Vecteur scratch partagé pour calculer la direction au moment du tir (A4)
const _fireDir = new THREE.Vector3();

export class BulletManager {
  constructor(scene) {
    this.scene    = scene;
    this._bullets = [];
  }

  fire(position, quaternion, dmg = null, ally = false) {
    const pool = ally ? _allyPool : _playerPool;
    const mat  = ally ? _matAlly  : _mat;
    const mesh = _acquire(pool, mat);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    this.scene.add(mesh);

    _fireDir.set(0, 0, -1).applyQuaternion(quaternion);
    const dir = _fireDir.clone();

    this._bullets.push({ mesh, dir, age: 0, dmg, ally });
  }

  update(delta) {
    for (let i = this._bullets.length - 1; i >= 0; i--) {
      const b = this._bullets[i];
      b.age += delta;

      if (b.age > PLAYER_LIFETIME) {
        this.scene.remove(b.mesh);
        _release(b.ally ? _allyPool : _playerPool, b.mesh);
        this._bullets.splice(i, 1);
        continue;
      }

      b.mesh.position.addScaledVector(b.dir, BULLET_SPEED * delta);
    }
  }

  getBullets() { return this._bullets; }

  dispose() {
    this._bullets.forEach(b => {
      this.scene.remove(b.mesh);
      _release(b.ally ? _allyPool : _playerPool, b.mesh);
    });
    this._bullets = [];
  }
}

// Balles ennemies — couleur bleue, même physique
export class EnemyBulletManager {
  constructor(scene) {
    this.scene    = scene;
    this._bullets = [];
  }

  fire(position, quaternion, dmg = null) {
    const mesh = _acquire(_enemyPool, _matEnemy);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    this.scene.add(mesh);
    _fireDir.set(0, 0, -1).applyQuaternion(quaternion);
    const bullet = { mesh, dir: _fireDir.clone(), age: 0, dmg };
    this._bullets.push(bullet);
    return bullet;
  }

  update(delta) {
    for (let i = this._bullets.length - 1; i >= 0; i--) {
      const b = this._bullets[i];
      b.age += delta;
      if (b.age > ENEMY_LIFETIME) {
        this.scene.remove(b.mesh);
        _release(_enemyPool, b.mesh);
        this._bullets.splice(i, 1);
        continue;
      }
      b.mesh.position.addScaledVector(b.dir, BULLET_SPEED * delta);
    }
  }

  getBullets() { return this._bullets; }

  dispose() {
    this._bullets.forEach(b => {
      this.scene.remove(b.mesh);
      _release(_enemyPool, b.mesh);
    });
    this._bullets = [];
  }
}

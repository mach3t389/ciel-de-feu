import * as THREE from 'three';

const BULLET_SPEED    = 950;
const PLAYER_LIFETIME = 0.95;  // ≈ 900 u de portée (engagements plus longs)
const ENEMY_LIFETIME  = 0.62;  // ≈ 590 u (avions + tourelles ennemies)

const _geo     = new THREE.CylinderGeometry(0.10, 0.10, 0.9, 6);
_geo.rotateX(Math.PI / 2);
const _mat      = new THREE.MeshBasicMaterial({ color: 0xff3300 });
const _matEnemy = new THREE.MeshBasicMaterial({ color: 0x55bbff });
const _matAlly  = new THREE.MeshBasicMaterial({ color: 0x88ff44 }); // vert — tirs sol allié

export class BulletManager {
  constructor(scene) {
    this.scene   = scene;
    this._bullets = [];
  }

  // Tire un projectile depuis la position de l'avion dans sa direction
  fire(position, quaternion, dmg = null, ally = false) {
    const mesh = new THREE.Mesh(_geo, ally ? _matAlly : _mat);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    this.scene.add(mesh);

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);

    this._bullets.push({ mesh, dir, age: 0, dmg });
  }

  update(delta) {
    for (let i = this._bullets.length - 1; i >= 0; i--) {
      const b = this._bullets[i];
      b.age += delta;

      if (b.age > PLAYER_LIFETIME) {
        this.scene.remove(b.mesh);
        this._bullets.splice(i, 1);
        continue;
      }

      b.mesh.position.addScaledVector(b.dir, BULLET_SPEED * delta);
    }
  }

  // Pour les collisions futures avec des ennemis
  getBullets() { return this._bullets; }

  dispose() {
    this._bullets.forEach(b => this.scene.remove(b.mesh));
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
    const mesh = new THREE.Mesh(_geo, _matEnemy);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    this.scene.add(mesh);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    this._bullets.push({ mesh, dir, age: 0, dmg });
  }

  update(delta) {
    for (let i = this._bullets.length - 1; i >= 0; i--) {
      const b = this._bullets[i];
      b.age += delta;
      if (b.age > ENEMY_LIFETIME) { this.scene.remove(b.mesh); this._bullets.splice(i, 1); continue; }
      b.mesh.position.addScaledVector(b.dir, BULLET_SPEED * delta);
    }
  }

  getBullets() { return this._bullets; }

  dispose() {
    this._bullets.forEach(b => this.scene.remove(b.mesh));
    this._bullets = [];
  }
}

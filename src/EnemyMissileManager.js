import * as THREE from 'three';

const MISSILE_SPEED = 190;
const HIT_RADIUS    = 18;
const MAX_AGE       = 12;
const DECOY_RANGE   = 380;

export class EnemyMissileManager {
  constructor(scene) {
    this._scene    = scene;
    this._missiles = [];
    this._getTerrainH = null;

    this.onPlayerHit    = null;  // (damage) → Game.js
    this.onMissileFired = null;  // () → UI / audio
    this.onAllGone      = null;  // () → UI
  }

  setTerrainHeightFn(fn) { this._getTerrainH = fn; }

  fire(origin, direction, { damage = 35, trackTime = 3, turnSpeed = 3.5 } = {}) {
    const mesh = this._mkMesh();
    mesh.position.copy(origin);
    const vel = direction.clone().normalize().multiplyScalar(MISSILE_SPEED);
    this._scene.add(mesh);
    this._missiles.push({ mesh, vel, damage, trackTime, turnSpeed, age: 0, decoyed: false, decoyTarget: null });
    this.onMissileFired?.();
  }

  // Appelé quand le joueur déploie un leurre — attire les missiles proches
  deployDecoy(decoyPos) {
    for (const ms of this._missiles) {
      if (ms.decoyed) continue;
      if (ms.mesh.position.distanceTo(decoyPos) < DECOY_RANGE) {
        ms.decoyed = true;
        ms.decoyTarget = decoyPos.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 40)
        );
      }
    }
  }

  update(delta, playerPos) {
    const toRemove = [];

    for (const ms of this._missiles) {
      ms.age += delta;
      const target = ms.decoyed ? ms.decoyTarget : playerPos;

      // Guidage vers la cible
      if (ms.age < ms.trackTime && target) {
        const desired = new THREE.Vector3()
          .subVectors(target, ms.mesh.position)
          .normalize()
          .multiplyScalar(MISSILE_SPEED);
        ms.vel.lerp(desired, Math.min(1, ms.turnSpeed * delta));
      }

      ms.mesh.position.addScaledVector(ms.vel, delta);

      // Orienter le mesh le long de la vélocité
      const spd = ms.vel.length();
      if (spd > 1) {
        const dir = ms.vel.clone().divideScalar(spd);
        ms.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      }

      // Collision terrain
      if (this._getTerrainH) {
        const th = this._getTerrainH(ms.mesh.position.x, ms.mesh.position.z);
        if (ms.mesh.position.y < th + 5) { toRemove.push(ms); continue; }
      }
      if (ms.mesh.position.y < 3) { toRemove.push(ms); continue; }

      // Touche le joueur
      if (playerPos && ms.mesh.position.distanceTo(playerPos) < HIT_RADIUS) {
        this.onPlayerHit?.(ms.damage);
        toRemove.push(ms);
        continue;
      }

      // Attire par un leurre et le touche
      if (ms.decoyed && ms.decoyTarget &&
          ms.mesh.position.distanceTo(ms.decoyTarget) < HIT_RADIUS) {
        toRemove.push(ms);
        continue;
      }

      if (ms.age > MAX_AGE) { toRemove.push(ms); continue; }
    }

    for (const ms of toRemove) {
      this._scene.remove(ms.mesh);
      ms.mesh.geometry?.dispose();
      ms.mesh.material?.dispose();
      const i = this._missiles.indexOf(ms);
      if (i >= 0) this._missiles.splice(i, 1);
    }

    if (toRemove.length > 0 && this._missiles.length === 0) this.onAllGone?.();
  }

  _mkMesh() {
    const geo  = new THREE.CylinderGeometry(0.18, 0.18, 1.4, 6);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    return new THREE.Mesh(geo, mat);
  }

  get hasActiveMissiles() { return this._missiles.length > 0; }

  dispose() {
    for (const ms of this._missiles) {
      this._scene.remove(ms.mesh);
      ms.mesh.geometry?.dispose();
      ms.mesh.material?.dispose();
    }
    this._missiles = [];
  }
}

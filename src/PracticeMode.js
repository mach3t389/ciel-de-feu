import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();
const loadGLB = p => new Promise(res => _loader.load(p, res, null, () => res(null)));

// Parcours elliptique — positions relatives à la base joueur
// ry calculé dynamiquement depuis la direction entre anneaux consécutifs
const RING_POSITIONS = [
  { x:  280, y: 160, z:    0 },
  { x:  256, y: 175, z:   90 },
  { x:  186, y: 200, z:  165 },
  { x:   87, y: 220, z:  209 },
  { x:  -29, y: 210, z:  219 },
  { x: -140, y: 190, z:  190 },
  { x: -226, y: 175, z:  129 },
  { x: -274, y: 165, z:   46 },
  { x: -274, y: 170, z:  -46 },
  { x: -226, y: 185, z: -129 },
  { x: -140, y: 200, z: -190 },
  { x:  -29, y: 215, z: -219 },
  { x:   87, y: 205, z: -209 },
  { x:  186, y: 185, z: -165 },
  { x:  256, y: 170, z:  -90 },
];

const TARGET_POSITIONS = [
  {  x: 120, y: 130, z: -150 },
  {  x: -90, y: 110, z: -220 },
  {  x: 200, y: 160, z:  -80 },
  {  x: -50, y: 140, z:  180 },
  {  x: 300, y: 120, z:  100 },
];

export class PracticeMode {
  constructor(scene, basePos = new THREE.Vector3(0, 0, 0)) {
    this.scene   = scene;
    this.basePos = basePos;
    this._rings   = [];
    this._targets = [];
    this._ringCompleted = 0;
    this._loaded = false;
  }

  async build() {
    const [ringGltf, targetGltf] = await Promise.all([
      loadGLB('/Mode libre/SM_Prop_Plane_Ring_01_Anneau_de_pratique.glb'),
      loadGLB('/Mode libre/SM_PolygonPrototype_Prop_Target_03_cibles.glb'),
    ]);
    this._ringScene   = ringGltf?.scene   ?? null;
    this._targetScene = targetGltf?.scene ?? null;

    this._spawnRings();
    this._spawnTargets();
    this._loaded = true;
  }

  _spawnRings() {
    if (!this._ringScene) return;
    const N = RING_POSITIONS.length;

    for (let i = 0; i < N; i++) {
      const r   = RING_POSITIONS[i];
      const prev = RING_POSITIONS[(i + N - 1) % N];
      const dx   = r.x - prev.x;
      const dz   = r.z - prev.z;
      const ry   = Math.atan2(dx, dz);

      const mesh = this._ringScene.clone(true);
      const box  = new THREE.Box3().setFromObject(mesh);
      const sz   = new THREE.Vector3(); box.getSize(sz);
      const d    = Math.max(sz.x, sz.y, sz.z) || 1;
      mesh.scale.setScalar(28 / d);

      const pos = new THREE.Vector3(
        this.basePos.x + r.x,
        r.y,
        this.basePos.z + r.z,
      );
      mesh.position.copy(pos);
      mesh.rotation.y = ry;
      mesh.traverse(n => { if (n.isMesh) n.frustumCulled = false; });
      this.scene.add(mesh);

      const label = this._makeLabel(i + 1);
      label.position.copy(pos).add(new THREE.Vector3(0, 18, 0));
      this.scene.add(label);

      this._rings.push({ mesh, label, pos, radius: 14, done: false, index: i });
    }

    // Visibilité initiale
    this._refreshVisibility();
  }

  _refreshVisibility() {
    const c = this._ringCompleted;
    for (let i = 0; i < this._rings.length; i++) {
      if (i === c)     this._setRingMode(i, 'active');
      else if (i === c + 1) this._setRingMode(i, 'next');
      else             this._setRingMode(i, 'hidden');
    }
  }

  _setRingMode(i, mode) {
    const ring = this._rings[i];
    if (!ring) return;
    if (mode === 'hidden') {
      ring.mesh.visible  = false;
      ring.label.visible = false;
      return;
    }
    ring.mesh.visible  = true;
    ring.label.visible = mode === 'active';
    const opacity = mode === 'active' ? 1.0 : 0.22;
    ring.mesh.traverse(n => {
      if (!n.isMesh) return;
      if (!n._matCloned) { n.material = n.material.clone(); n._matCloned = true; }
      n.material.transparent = true;
      n.material.opacity = opacity;
    });
  }

  _makeLabel(n) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 38px "Courier New"';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,220,60,0.9)';
    ctx.fillText(n, 64, 32);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp  = new THREE.Sprite(mat);
    sp.scale.set(12, 6, 1);
    sp.renderOrder = 10;
    return sp;
  }

  _spawnTargets() {
    if (!this._targetScene) return;
    for (const tp of TARGET_POSITIONS) {
      const mesh = this._targetScene.clone(true);
      const box  = new THREE.Box3().setFromObject(mesh);
      const sz   = new THREE.Vector3(); box.getSize(sz);
      const d    = Math.max(sz.x, sz.y, sz.z) || 1;
      mesh.scale.setScalar(8 / d);
      const pos = new THREE.Vector3(
        this.basePos.x + tp.x, tp.y, this.basePos.z + tp.z,
      );
      mesh.position.copy(pos);
      mesh.traverse(n => { if (n.isMesh) n.frustumCulled = false; });
      this.scene.add(mesh);
      this._targets.push({ mesh, pos, hp: 1, maxHp: 1, isDead: false, _spin: Math.random() * Math.PI * 2 });
    }
  }

  update(delta, playerPos) {
    if (!this._loaded) return;

    const c = this._ringCompleted;
    if (c < this._rings.length) {
      const ring = this._rings[c];
      if (playerPos.distanceTo(ring.pos) < ring.radius) {
        ring.done = true;
        this._ringCompleted++;
        this._refreshVisibility();
      }
    }

    for (const t of this._targets) {
      if (!t.isDead) {
        t._spin += delta * 0.8;
        t.mesh.rotation.y = t._spin;
      }
    }
  }

  checkBulletHits(bullets) {
    let anyHit = false;
    for (const t of this._targets) {
      if (t.isDead) continue;
      for (const b of bullets) {
        if (b.age >= 999) continue;
        if (b.mesh.position.distanceTo(t.pos) < 6) {
          b.age = 999;
          t.hp--;
          anyHit = true;
          if (t.hp <= 0) {
            t.isDead = true;
            this._destroyTarget(t);
          }
          break;
        }
      }
    }
    return anyHit;
  }

  _destroyTarget(t) {
    let flashes = 0;
    const iv = setInterval(() => {
      t.mesh.visible = !t.mesh.visible;
      if (++flashes > 5) {
        clearInterval(iv);
        t.mesh.visible = false;
        setTimeout(() => {
          t.hp = t.maxHp;
          t.isDead = false;
          t.mesh.visible = true;
        }, 8000);
      }
    }, 120);
  }

  getRingsCompleted() { return this._ringCompleted; }
  getTotalRings()     { return this._rings.length; }
  allRingsDone()      { return this._ringCompleted >= this._rings.length; }

  dispose() {
    for (const r of this._rings) {
      this.scene.remove(r.mesh);
      this.scene.remove(r.label);
    }
    for (const t of this._targets) this.scene.remove(t.mesh);
    this._rings   = [];
    this._targets = [];
  }
}

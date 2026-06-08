import * as THREE from 'three';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';

const _mod = new SimplifyModifier();

function _simplify(geo, ratio) {
  try {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const target = Math.max(3, Math.floor(g.attributes.position.count * ratio));
    if (target >= g.attributes.position.count) return null;
    const s = _mod.modify(g, target);
    s.computeVertexNormals();
    s.computeBoundingSphere();
    return s;
  } catch {
    return null;
  }
}

function _triCount(geo) {
  if (!geo) return 0;
  return geo.index
    ? geo.index.count / 3
    : (geo.attributes?.position?.count ?? 0) / 3;
}

/**
 * Wraps one model type with 3 LOD levels (InstancedMesh per sub-mesh × LOD level).
 *
 * LOD0 : full geometry     (0 → lod0Dist)
 * LOD1 : ~50 % triangles   (lod0Dist → lod1Dist)
 * LOD2 : ~20 % triangles   (lod1Dist → cullDist)
 * beyond cullDist : hidden
 *
 * Usage (map build phase):
 *   const g = new InstancedLOD(scene, modelScene, maxCount, 'tree');
 *   // place instances with existing dummy/setMatrixAt code on g.instances (= LOD0),
 *   // then also call g.recordInstance(wx, wz, dummy.matrix) each time.
 *
 * Usage (game loop):
 *   g.updateLOD(camX, camZ, 600, 1500, 3000);
 */
export class InstancedLOD {
  constructor(scene, modelScene, maxCount, category = '') {
    modelScene.updateWorldMatrix(true, true);
    const bbox          = new THREE.Box3().setFromObject(modelScene);
    this.baseOffset     = -bbox.min.y;
    this.naturalHeight  = bbox.max.y - bbox.min.y;
    this.maxCount       = maxCount;
    this.category       = category;

    // per-instance data recorded at build time
    this._positions = []; // flat [x0,z0, x1,z1, …]
    this._matrices  = []; // Matrix4[]

    // _lods[lodLevel] = array of InstancedMesh (one per model sub-mesh)
    this._lods = [[], [], []];

    modelScene.traverse(n => {
      if (!n.isMesh) return;
      const gFull = n.geometry.clone();
      gFull.applyMatrix4(n.matrixWorld);
      gFull.computeBoundingSphere();
      const mat = n.material;

      const gLod1 = _simplify(gFull.clone(), 0.5) ?? gFull;
      const gLod2 = _simplify(gFull.clone(), 0.2) ?? gLod1;

      for (let lv = 0; lv < 3; lv++) {
        const geo = lv === 0 ? gFull : lv === 1 ? gLod1 : gLod2;
        const im  = new THREE.InstancedMesh(geo, mat, maxCount);
        im.count           = 0;
        im.frustumCulled   = false;
        im.userData.category = category;
        im.userData.lodLevel = lv;
        scene.add(im);
        this._lods[lv].push(im);
      }
    });

    // backward-compat alias: existing build code uses group.instances
    this.instances = this._lods[0];
  }

  // Call once per placed instance during map build (after setMatrixAt on LOD0)
  recordInstance(x, z, matrix) {
    this._positions.push(x, z);
    const m = new THREE.Matrix4();
    m.copy(matrix);
    this._matrices.push(m);
  }

  // Called from the game loop to redistribute instances across LOD levels
  updateLOD(camX, camZ, lod0Dist, lod1Dist, cullDist) {
    const d0sq   = lod0Dist * lod0Dist;
    const d1sq   = lod1Dist * lod1Dist;
    const cullSq = cullDist * cullDist;

    for (let lv = 0; lv < 3; lv++)
      for (const im of this._lods[lv]) im.count = 0;

    const n   = this._matrices.length;
    const pos = this._positions;

    for (let i = 0; i < n; i++) {
      const dx = pos[i * 2]     - camX;
      const dz = pos[i * 2 + 1] - camZ;
      const d2 = dx * dx + dz * dz;
      if (d2 >= cullSq) continue;

      const lv     = d2 < d0sq ? 0 : d2 < d1sq ? 1 : 2;
      const meshes = this._lods[lv];
      const idx    = meshes[0].count;
      for (const im of meshes) {
        im.setMatrixAt(idx, this._matrices[i]);
        im.count = idx + 1;
      }
    }

    for (let lv = 0; lv < 3; lv++)
      for (const im of this._lods[lv])
        im.instanceMatrix.needsUpdate = true;
  }

  // Current visible triangle count (sum across all active LOD levels)
  visibleTriCount() {
    let total = 0;
    for (let lv = 0; lv < 3; lv++)
      for (const im of this._lods[lv])
        if (im.count > 0) total += _triCount(im.geometry) * im.count;
    return Math.round(total);
  }
}

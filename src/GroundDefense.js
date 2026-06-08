import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _loader = new GLTFLoader();
const loadGLB = (p) => new Promise((res) => _loader.load(p, res, null, () => res(null)));

const PATHS = {
  tank  : '/Village defense/panzer_iii_low-poly_tank.glb',
  truck : '/Village defense/truck.glb',
  mg    : '/Village defense/machinegun_low_poly.glb',
};

// Taille cible (unités monde) par type
const SIZE = { tank: 9, truck: 8, mg: 4 };
// Points de vie
const HP   = { tank: 120, truck: 60, mg: 80 };

// Tourelle AA (mitrailleuse) — menace réelle mais survivable
const MG_RANGE   = 900;   // portée d'engagement
const MG_FIRE_CD = 0.7;   // cadence lente (rafales espacées)
const MG_BURST   = 3;     // balles par rafale
const MG_BURST_GAP = 0.09;
const MG_MIN_ALT = 25;    // ne tire que sur des cibles assez hautes
const MG_AIM_ERR = 0.06;  // dispersion de base (× facteur de distance)
const MG_DMG     = 5;     // dégâts par balle (vs 12 pour les avions)

export class GroundDefense {
  // Précharge les 3 modèles GLB — appeler dans preload() avant de créer l'instance
  static async preloadModels() {
    const [tank, truck, mg] = await Promise.all([
      loadGLB(PATHS.tank), loadGLB(PATHS.truck), loadGLB(PATHS.mg),
    ]);
    return { tank: tank?.scene, truck: truck?.scene, mg: mg?.scene };
  }

  constructor(scene, getTerrainHeight, passive = false) {
    this.scene = scene;
    this.getTerrainHeight = getTerrainHeight;
    this._passive = passive;
    this.units = [];
    this._models = {};
  }

  // villages : [{ x, z, team:'ally'|'enemy' }]
  // airports : [{ x, z, ang, team:'ally'|'enemy' }]
  // preloadedModels : résultat de GroundDefense.preloadModels() (optionnel)
  // decorative : true en training — props passifs, sans marqueur d'équipe
  async build(villages, airports = [], preloadedModels = null, decorative = false) {
    this._decorative = decorative;
    if (preloadedModels) {
      this._models = preloadedModels;
    } else {
      const [tank, truck, mg] = await Promise.all([
        loadGLB(PATHS.tank), loadGLB(PATHS.truck), loadGLB(PATHS.mg),
      ]);
      this._models = { tank: tank?.scene, truck: truck?.scene, mg: mg?.scene };
    }

    for (const v of villages) {
      const layout = [
        ['tank', 0.00], ['tank', 0.5],
        ['truck', 0.18], ['truck', 0.68],
        ['mg', 0.33], ['mg', 0.83], ['mg', 0.1],
      ];
      layout.forEach(([kind, frac], i) => {
        const ang = frac * Math.PI * 2 + (i * 0.3);
        const r   = (kind === 'mg') ? 130 + Math.random() * 40 : 150 + Math.random() * 50;
        const x = v.x + Math.cos(ang) * r;
        const z = v.z + Math.sin(ang) * r;
        this._spawnUnit(kind, x, z, v.team, ang);
      });
    }

    // Une tourelle AA de chaque côté de chaque piste
    for (const ap of airports) {
      const side = 32; // distance latérale depuis l'axe de piste
      const perpX =  Math.cos(ap.ang);
      const perpZ = -Math.sin(ap.ang);
      // surfaceY : dessus de la plateforme de piste (évite que la tourelle passe sous le sol)
      const sy = ap.surfaceY ?? null;
      this._spawnUnit('mg', ap.x - perpX * side, ap.z + perpZ * side, ap.team, ap.ang + Math.PI / 2, sy);
      this._spawnUnit('mg', ap.x + perpX * side, ap.z - perpZ * side, ap.team, ap.ang - Math.PI / 2, sy);
    }
  }

  _spawnUnit(kind, x, z, team, faceAng, surfaceY = null) {
    const model = this._models[kind];
    const root = new THREE.Object3D();
    const gY = surfaceY !== null ? surfaceY : (this.getTerrainHeight ? this.getTerrainHeight(x, z) : 0);
    root.position.set(x, gY, z);
    root.rotation.y = faceAng;

    if (model) {
      const clone = model.clone(true);
      const box = new THREE.Box3().setFromObject(clone);
      const sz  = new THREE.Vector3(); box.getSize(sz);
      const d   = Math.max(sz.x, sz.y, sz.z) || 1;
      clone.scale.setScalar(SIZE[kind] / d);
      clone.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(clone);
      clone.position.y = -box2.min.y;
      clone.traverse(n => {
        if (n.isMesh) {
          n.frustumCulled = false;
          n.castShadow = false; n.receiveShadow = false;
        }
      });
      root.add(clone);
    }
    this.scene.add(root);

    if (!this._decorative) this._addTeamMarker(root, team);

    this.units.push({
      kind, team, root,
      hp: HP[kind], maxHp: HP[kind], isDead: false,
      pos: root.position,
      fireCd: Math.random() * MG_FIRE_CD,
      burstLeft: 0, burstCd: 0,
      radius: SIZE[kind] * 0.6,
    });
  }

  _addTeamMarker(root, team) {
    const col  = team === 'ally' ? 0x33cc66 : 0xcc2222;
    const mat  = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.82 });
    const sq   = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.3), mat);
    sq.position.y = 13;
    root.add(sq);
  }

  // ── Boucle : visée + tir des tourelles AA ───────────────────────────────────
  // ctx : { playerPos, playerAlive, enemies, enemyFire(pos,quat), alliedFire(pos,quat) }
  update(delta, ctx) {
    if (this._passive) return; // mode pratique : aucun tir
    for (const u of this.units) {
      if (u.isDead || u.kind !== 'mg') continue;

      // Cible selon l'équipe
      let target = null;
      if (u.team === 'enemy') {
        if (ctx.playerAlive) target = ctx.playerPos;
      } else {
        target = this._nearestEnemy(u.pos, ctx.enemies);
      }
      u.fireCd -= delta;
      if (!target) { u.burstLeft = 0; continue; }

      const muzzle = u.pos.clone(); muzzle.y += 3.5;
      const toT = new THREE.Vector3().subVectors(target, muzzle);
      const dist = toT.length();
      // Ligne de vue : un bâtiment entre la tourelle et la cible bloque le tir
      const inRange = dist <= MG_RANGE && (target.y - u.pos.y) >= MG_MIN_ALT;
      const clear   = inRange && (!ctx.blockedLOS || !ctx.blockedLOS(muzzle, target));
      if (!clear) { u.burstLeft = 0; continue; }

      // Oriente la tourelle vers la cible (yaw)
      u.root.rotation.y = Math.atan2(toT.x, toT.z);

      // Rafales espacées (cadence lente)
      if (u.burstLeft > 0) {
        u.burstCd -= delta;
        if (u.burstCd <= 0) {
          this._fireOne(u, muzzle, toT, ctx);
          u.burstLeft--; u.burstCd = MG_BURST_GAP;
        }
      } else if (u.fireCd <= 0) {
        u.burstLeft = MG_BURST; u.burstCd = 0; u.fireCd = MG_FIRE_CD;
      }
    }
  }

  _fireOne(u, muzzle, toT, ctx) {
    const dist = toT.length();
    const dir = toT.clone().normalize();
    // Dispersion croissante avec la distance : précises de près, imprécises de loin
    const err = MG_AIM_ERR * (0.5 + (dist / MG_RANGE) * 1.6);
    dir.x += (Math.random() - 0.5) * err;
    dir.y += (Math.random() - 0.5) * err;
    dir.z += (Math.random() - 0.5) * err;
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    if (u.team === 'enemy') ctx.enemyFire(muzzle, quat, MG_DMG);
    else                    ctx.alliedFire(muzzle, quat, MG_DMG);
  }

  _nearestEnemy(pos, enemies) {
    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (e.isDead) continue;
      const d = pos.distanceTo(e.position);
      if (d < bestD) { bestD = d; best = e.position; }
    }
    return best;
  }

  // ── Dégâts aux unités alliées (balles ennemies) ──────────────────────────────
  damageAllyAt(point, radius, dmg) {
    for (const u of this.units) {
      if (u.isDead || u.team !== 'ally') continue;
      const dx = point.x - u.pos.x, dy = point.y - (u.pos.y + 3), dz = point.z - u.pos.z;
      if (dx*dx + dy*dy + dz*dz < (radius + u.radius) ** 2) {
        u.hp -= dmg;
        if (u.hp <= 0) { u.isDead = true; u.root.visible = false; }
        return u;
      }
    }
    return null;
  }

  // ── Dégâts : renvoie l'unité touchée (équipe 'enemy' seulement) ou null ──────
  damageAt(point, radius, dmg) {
    for (const u of this.units) {
      if (u.isDead || u.team !== 'enemy') continue;
      const dx = point.x - u.pos.x, dy = point.y - (u.pos.y + 3), dz = point.z - u.pos.z;
      if (dx*dx + dy*dy + dz*dz < (radius + u.radius) ** 2) {
        u.hp -= dmg;
        if (u.hp <= 0) { u.isDead = true; u.root.visible = false; }
        return u;
      }
    }
    return null;
  }

  // Cibles au sol ennemies vivantes (pour le HUD) — aucune en décor (training)
  getEnemyGroundTargets() {
    if (this._decorative) return [];
    return this.units.filter(u => !u.isDead && u.team === 'enemy');
  }

  allEnemiesDead() {
    return this.units.every(u => u.team !== 'enemy' || u.isDead);
  }

  getEnemyCount() {
    return this.units.filter(u => u.team === 'enemy' && !u.isDead).length;
  }

  getEnemyCountByKind(...kinds) {
    return this.units.filter(u => u.team === 'enemy' && !u.isDead && kinds.includes(u.kind)).length;
  }

  get debugStats() {
    const alive = this.units.filter(u => !u.isDead);
    return {
      turrets : alive.filter(u => u.kind === 'mg').length,
      tanks   : alive.filter(u => u.kind === 'tank').length,
      vehicles: alive.filter(u => u.kind === 'truck').length,
    };
  }

  dispose() {
    this.units.forEach(u => this.scene.remove(u.root));
    this.units = [];
  }
}

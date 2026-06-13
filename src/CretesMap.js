import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { InstancedLOD } from './LODManager.js';

const _loader = new GLTFLoader();
const loadGLB = (path) => new Promise((res, rej) => _loader.load(path, res, null, rej));

const SEGS = 280;
const SIZE = 8000;

// ── Géographie ──────────────────────────────────────────────────────────────
// Base alliée : extrémité OUEST (-2400, 0)
// Base ennemie : extrémité EST  (+2400, 0)
// Villages côtiers près des bases + 2 villages aux extrémités N/S

const PEAKS = [
  [ 1400, -1000, 500, 580],  // grande montagne NE
  [-1500,   600, 340, 1400], // grande montagne NO — base très étalée (face spawn)
  [  800,  1700, 460, 540],  // montagne SE
  [ -700, -1800, 420, 520],  // montagne SO
  [  300,   200, 300, 460],  // massif central
  [-1000,  -300, 360, 620],  // crête NO-centre
  [ 1100,   900, 320, 440],  // crête E-centre
];

const LAKES = [
  [-1700,   430, 130, 5],  // lac vallée ouest
  [ 1700,  -430, 110, 5],  // lac vallée est
  [  -80,  -650,  90, 4],  // lac central nord
  [  320,   850,  80, 4],  // lac central sud
];

// Village 0 = allié (près base joueur), villages 1-3 = ennemis
const VILLAGES = [
  { name: 'Rochefort', x: -2050, z:  200, h: 38, outerR: 490, innerR: 165 },
  { name: 'Eastholm',  x:  2050, z: -200, h: 38, outerR: 480, innerR: 162 },
  { name: 'Nordvil',   x:     0, z:-2400, h: 52, outerR: 460, innerR: 155 },
  { name: 'Sudvil',    x:   100, z: 2400, h: 48, outerR: 460, innerR: 155 },
];

// Airport 0 = allié (ouest), Airport 1 = ennemi (est) — pistes E-O (ang=PI/2)
// Repositionnés à ±2400 (pas ±2800) pour éviter que l'approche touche la zone de fondu côtier
const AIRPORTS = [
  { x: -2400, z: 0, h: 35, len: 280, wid: 28, ang: Math.PI / 2 },
  { x:  2400, z: 0, h: 35, len: 280, wid: 28, ang: Math.PI / 2 },
];

const rng = (a, b) => a + Math.random() * (b - a);

export class CretesMap {
  constructor(scene) {
    this.scene = scene;
    this.getTerrainHeight = null;
    this._time = 0;
    this.airports = AIRPORTS.map(a => ({
      center  : new THREE.Vector3(a.x, a.h + 2.5, a.z),
      surfaceY: a.h + 1.0,
      radius  : a.len * 0.65,
      ang     : a.ang,
    }));
  }

  async build() {
    this._buildTerrain();
    this._buildWater();
    this._buildAirportMeshes();
    this._statsBuildingCount = (await this._buildVillages()) ?? 0;
    const treeData = await this._buildTrees();
    if (treeData) await this._buildVillageTrees(treeData);
    this._statsTreeCount = treeData ? treeData.placed.reduce((a, b) => a + b, 0) : 0;
    this._statsRockCount = (await this._buildRocks())  ?? 0;
    this._statsBushCount = (await this._buildBushes()) ?? 0;
    return {
      getTerrainHeight: this.getTerrainHeight,
      airports        : this.airports,
      isOnRunway      : (x, z) => this.isOnRunway(x, z),
    };
  }

  getVillageZones() {
    return VILLAGES.map((v, i) => ({
      x: v.x, z: v.z, radius: v.outerR * 1.8,
      team: i === 0 ? 'ally' : 'enemy',
    }));
  }

  getEnemyZones() {
    return VILLAGES.slice(1).map(v => ({ x: v.x, z: v.z, radius: v.outerR * 1.8, team: 'enemy' }));
  }

  update(delta) { this._time += delta; }

  // ── Terrain ──────────────────────────────────────────────────────────────────
  _buildTerrain() {
    const hash = (x, z) => {
      const n = Math.sin(x * 127.1 + z * 311.7 + 41.3) * 43758.5453;
      return n - Math.floor(n);
    };
    const vnoise = (x, z) => {
      const xi = Math.floor(x), zi = Math.floor(z);
      const xf = x - xi, zf = z - zi;
      const ux = xf*xf*(3-2*xf), uz = zf*zf*(3-2*zf);
      return hash(xi,zi)*(1-ux)*(1-uz) + hash(xi+1,zi)*ux*(1-uz) +
             hash(xi,zi+1)*(1-ux)*uz   + hash(xi+1,zi+1)*ux*uz;
    };
    const fbm = (x, z) => {
      let v=0, a=1, f=1, s=0;
      for (let i=0; i<8; i++) { v += vnoise(x*f, z*f)*a; s += a; a *= 0.48; f *= 2.13; }
      return v / s;
    };
    const detail = (x, z) => {
      let v=0, a=1, f=1, s=0;
      for (let i=0; i<4; i++) { v += vnoise(x*f+73.1, z*f+19.7)*a; s += a; a *= 0.5; f *= 3.1; }
      return (v/s - 0.5) * 2;
    };
    const PEAK_MAXDEG = 32;
    const _peakTan = Math.tan(PEAK_MAXDEG * Math.PI / 180);
    const _sqE     = Math.sqrt(Math.E);
    const smoother = (u) => u*u*u*(u*(u*6 - 15) + 10);
    const gauss = (wx, wz, px, pz, h, r) => {
      const coreR = Math.max(r, h / (_peakTan * _sqE));
      const dd = (wx - px) * (wx - px) + (wz - pz) * (wz - pz);
      const d  = Math.sqrt(dd);
      const g  = h * Math.exp(-dd / (2 * coreR * coreR));
      const Rin = coreR * 2.2, R = coreR * 3.4;
      if (d <= Rin) return g;
      if (d >= R)   return 0;
      return g * (1 - smoother((d - Rin) / (R - Rin)));
    };

    const getBase = (wx, wz) => {
      const d    = Math.sqrt(wx*wx + wz*wz);
      // Zone plate autour de l'origine pour le spawn central
      const flat = smoother(Math.min(1, Math.max(0, (d - 80) / 120)));
      const n    = fbm(wx * 0.003, wz * 0.003);
      const ridge = 1 - Math.abs(2*n - 1);
      const micro = detail(wx * 0.012, wz * 0.012) * 8;
      let h = (n*0.85 + ridge*0.15) * 340 * flat + micro * flat;
      for (const [px, pz, ph, pr] of PEAKS)
        h += gauss(wx, wz, px, pz, ph, pr) * Math.min(1, Math.max(0, (d-50)/100));

      // Fondu bords vers l'océan — commence plus tôt pour ne pas mordre sur les approches
      const edge = Math.max(Math.abs(wx), Math.abs(wz));
      const et   = Math.max(0, Math.min(1, (edge - 2900) / 900));
      h = h * (1 - et*et*(3-2*et)) + (-10) * (et*et*(3-2*et));
      return h;
    };

    const getH = (wx, wz) => {
      let h = getBase(wx, wz);

      // Plateau village
      for (const v of VILLAGES) {
        const d = Math.hypot(wx - v.x, wz - v.z);
        if (d < v.outerR) {
          const t = Math.max(0, d - v.innerR) / (v.outerR - v.innerR);
          const s = t*t*(3-2*t);
          h = h * s + v.h * (1 - s);
        }
      }

      // Piste + tarmac
      for (const ap of AIRPORTS) {
        const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
        const lx  = (wx - ap.x) * cos - (wz - ap.z) * sin;
        const lz  = (wx - ap.x) * sin + (wz - ap.z) * cos;

        const platformTop = ap.h + 1.0;
        // Zone complètement plate : piste + marge généreuse en bout de piste
        const flatHW = ap.wid / 2 + 22, flatHL = ap.len / 2 + 80;
        if (Math.abs(lx) < flatHW && Math.abs(lz) < flatHL) { return platformTop; }

        // Zone de fondu large (120 unités) — critique pour terrain montagneux
        const blend = 120;
        const blendHW = flatHW + blend, blendHL = flatHL + blend;
        if (Math.abs(lx) < blendHW && Math.abs(lz) < blendHL) {
          // Clamp [0,1] impératif : sans ça smoothstep hors-domaine crée des trous
          const tx = Math.min(1, Math.max(0, (Math.abs(lx) - flatHW) / blend));
          const tz = Math.min(1, Math.max(0, (Math.abs(lz) - flatHL) / blend));
          const t  = Math.max(tx, tz);
          const s  = t * t * (3 - 2 * t);
          h = h * s + platformTop * (1 - s);
          continue;
        }

        // Couloir d'approche : descente douce sur 900 unités en bout de piste
        const approachW = 90, approachExt = 900;
        if (Math.abs(lx) < approachW && Math.abs(lz) < flatHL + approachExt) {
          const beyond = Math.max(0, Math.abs(lz) - flatHL);
          const fadeW  = Math.max(0, Math.abs(lx) - ap.wid/2) / (approachW - ap.wid/2);
          const fadeL  = beyond / approachExt;
          const s      = Math.max(fadeW, fadeL)**2 * (3 - 2*Math.max(fadeW, fadeL));
          h = h * s + ap.h * (1 - s);
        }
      }

      // Lacs — zone de sécurité de 700 unités autour des aéroports (évite lac sous piste)
      const nearAp = AIRPORTS.some(ap => Math.hypot(wx - ap.x, wz - ap.z) < 700);
      if (!nearAp) {
        for (const [lx, lz, lr, lh] of LAKES) {
          const ld = Math.hypot(wx - lx, wz - lz);
          if (ld < lr) {
            const tEdge = Math.max(0, (ld - lr * 0.45) / (lr * 0.55));
            const s     = 1 - tEdge*tEdge*(3-2*tEdge);
            h = h * (1-s) + lh * s;
          }
        }
      }

      // Plafond de relief autour des aéroports — empêche montagnes de surgir près des pistes
      for (const ap of AIRPORTS) {
        const dx = wx - ap.x, dz = wz - ap.z;
        const dRaw = Math.sqrt(dx*dx + dz*dz);
        if (dRaw < 1100) {
          const t = Math.max(0, dRaw - 200) / (1100 - 200);
          h = Math.min(h, ap.h + t*t * 180);
        }
      }

      return h;
    };

    this.getTerrainHeight = getH;

    // Palette low-poly — couleurs vives et saturées
    const hColor = (h, steep) => {
      if (h < -4)  return [0.10, 0.62, 0.82]; // eau
      if (h <  5)  return [0.88, 0.80, 0.52]; // sable/berge
      if (steep > 0.60) {
        if (h > 380) return [0.60, 0.55, 0.50]; // roche haute
        return [0.50, 0.44, 0.36];              // roche
      }
      if (h <  45) return [0.28, 0.76, 0.22];  // plaine verte
      if (h < 130) return [0.16, 0.58, 0.14];  // forêt
      if (h < 270) return [0.32, 0.64, 0.24];  // prairie alpine
      if (h < 420) return [0.58, 0.50, 0.38];  // roche claire
      if (h < 580) return [0.70, 0.65, 0.58];  // roche haute
      return [0.94, 0.96, 0.98];               // neige
    };

    const vCount = (SEGS+1) * (SEGS+1);
    const ys  = new Float32Array(vCount);

    for (let z=0; z<=SEGS; z++)
      for (let x=0; x<=SEGS; x++)
        ys[z*(SEGS+1)+x] = getH((x/SEGS-0.5)*SIZE, (z/SEGS-0.5)*SIZE);

    // Lissage des pics — passe 3×3 box filter aux altitudes > 500 m (B1)
    {
      const sm = new Float32Array(vCount);
      const _g = SEGS + 1;
      for (let z = 0; z <= SEGS; z++) {
        for (let x = 0; x <= SEGS; x++) {
          let sum = 0, cnt = 0;
          for (let dz = -1; dz <= 1; dz++) {
            const nz = z + dz; if (nz < 0 || nz > SEGS) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx; if (nx < 0 || nx > SEGS) continue;
              sum += ys[nz * _g + nx]; cnt++;
            }
          }
          sm[z * _g + x] = sum / cnt;
        }
      }
      for (let i = 0; i < vCount; i++) {
        const t = Math.max(0, Math.min(1, (ys[i] - 300) / 200));
        ys[i] = ys[i] * (1 - t * 0.7) + sm[i] * (t * 0.7);
      }
    }

    // Plafond global — altitude max joueur = 1000 m
    for (let i = 0; i < vCount; i++) ys[i] = Math.min(ys[i], 940);

    // Cône de pente max (raise-only, borné) — filet de sécurité anti-murs résiduels
    {
      const _gg      = SEGS + 1;
      const cellSize = SIZE / SEGS;
      const maxStep  = cellSize * Math.tan(38 * Math.PI / 180); // ~22.3 u/cellule
      const RAISE_MAX = 60;
      const orig = ys.slice();

      const locked = new Uint8Array(vCount);
      for (let z = 0; z <= SEGS; z++) {
        for (let x = 0; x <= SEGS; x++) {
          const i  = z * _gg + x;
          const wx = (x / SEGS - 0.5) * SIZE;
          const wz = (z / SEGS - 0.5) * SIZE;
          let lock = false;
          if (Math.hypot(wx, wz) < 140) lock = true;
          if (!lock) for (const ap of AIRPORTS) {
            const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
            const lx  = (wx - ap.x) * cos - (wz - ap.z) * sin;
            const lz  = (wx - ap.x) * sin + (wz - ap.z) * cos;
            const flatHW = ap.wid / 2 + 22, flatHL = ap.len / 2 + 80;
            if (Math.abs(lx) < flatHW + 10 && Math.abs(lz) < flatHL + 10) { lock = true; break; }
          }
          if (!lock) for (const v of VILLAGES)
            if (Math.hypot(wx - v.x, wz - v.z) < v.outerR + 10) { lock = true; break; }
          if (!lock) {
            const nearAp = AIRPORTS.some(ap => Math.hypot(wx - ap.x, wz - ap.z) < 700);
            if (!nearAp) for (const [lx, lz, lr] of LAKES)
              if (Math.hypot(wx - lx, wz - lz) < lr) { lock = true; break; }
          }
          if (Math.max(Math.abs(wx), Math.abs(wz)) > 2900) lock = true;
          locked[i] = lock ? 1 : 0;
        }
      }

      const apply = (i, lim) => {
        if (locked[i]) return;
        if (lim > ys[i]) ys[i] = Math.min(lim, orig[i] + RAISE_MAX);
      };
      for (let it = 0; it < 6; it++) {
        for (let z = 0; z <= SEGS; z++) for (let x = 1; x <= SEGS; x++)
          apply(z*_gg+x, ys[z*_gg+x-1] - maxStep);
        for (let z = 0; z <= SEGS; z++) for (let x = SEGS-1; x >= 0; x--)
          apply(z*_gg+x, ys[z*_gg+x+1] - maxStep);
        for (let x = 0; x <= SEGS; x++) for (let z = 1; z <= SEGS; z++)
          apply(z*_gg+x, ys[(z-1)*_gg+x] - maxStep);
        for (let x = 0; x <= SEGS; x++) for (let z = SEGS-1; z >= 0; z--)
          apply(z*_gg+x, ys[(z+1)*_gg+x] - maxStep);
      }
    }

    // Géométrie non-indexée : couleur uniforme par triangle (flat shading low-poly)
    const _g = SEGS + 1;
    const triCount = SEGS * SEGS * 2;
    const flatPos = new Float32Array(triCount * 9);
    const flatCol = new Float32Array(triCount * 9);
    let pi = 0, ci = 0;

    const pushTri = (i0, i1, i2) => {
      const verts = [i0, i1, i2].map(i => {
        const gx = i % _g, gz = Math.floor(i / _g);
        return [(gx / SEGS - 0.5) * SIZE, ys[i], (gz / SEGS - 0.5) * SIZE];
      });
      for (const [x, y, z] of verts) { flatPos[pi++] = x; flatPos[pi++] = y; flatPos[pi++] = z; }

      const hc = (ys[i0] + ys[i1] + ys[i2]) / 3;
      const [ax,ay,az] = verts[0], [bx,by,bz] = verts[1], [cx,cy,cz] = verts[2];
      const ex=bx-ax, ey=by-ay, ez=bz-az, fx=cx-ax, fy=cy-ay, fz=cz-az;
      const ny = ez*fx - ex*fz;
      const nl = Math.sqrt((ey*fz-ez*fy)**2 + ny**2 + (ex*fy-ey*fx)**2) || 1;
      const steep = 1 - Math.abs(ny / nl);
      const [r,g,b] = hColor(hc, steep);
      for (let k = 0; k < 3; k++) { flatCol[ci++] = r; flatCol[ci++] = g; flatCol[ci++] = b; }
    };

    for (let z=0; z<SEGS; z++) {
      for (let x=0; x<SEGS; x++) {
        const a = z*_g+x, b = a+1, c = (z+1)*_g+x, d = c+1;
        pushTri(a, c, b);
        pushTri(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(flatPos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(flatCol, 3));
    geo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

    // Lookup bilinéaire rapide — remplace le fBm 8 octaves (~200× plus rapide) (A3)
    {
      const _g = SEGS + 1;
      this.getTerrainHeight = (wx, wz) => {
        const nx = Math.max(0, Math.min(SEGS, (wx / SIZE + 0.5) * SEGS));
        const nz = Math.max(0, Math.min(SEGS, (wz / SIZE + 0.5) * SEGS));
        const xi = Math.min(SEGS - 1, Math.floor(nx));
        const zi = Math.min(SEGS - 1, Math.floor(nz));
        const xf = nx - xi, zf = nz - zi;
        const h00 = ys[zi * _g + xi];
        const h10 = ys[zi * _g + xi + 1];
        const h01 = ys[(zi + 1) * _g + xi];
        const h11 = ys[(zi + 1) * _g + xi + 1];
        return h00 * (1 - xf) * (1 - zf) + h10 * xf * (1 - zf)
             + h01 * (1 - xf) * zf        + h11 * xf * zf;
      };
    }

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(40000, 40000, 4, 4),
      new THREE.MeshLambertMaterial({ color: 0x1a9fd4, flatShading: true })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1;
    this.scene.add(ocean);
  }

  _buildWater() {
    for (const [lx, lz, lr, lh] of LAKES) {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(lr * 0.44, 48),
        new THREE.MeshLambertMaterial({ color: 0x3a8fcc, depthWrite: false })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(lx, lh + 2, lz);
      mesh.renderOrder = 2;
      this.scene.add(mesh);
    }
  }

  _buildAirportMeshes() {
    for (const ap of AIRPORTS) {
      const cos = Math.cos(ap.ang), sin = Math.sin(ap.ang);
      const platformH   = 3.5;
      const platformTop = ap.h + 1.0;

      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(ap.wid + 70, platformH, ap.len + 120),
        new THREE.MeshLambertMaterial({ color: 0x5a5650 })
      );
      platform.rotation.y = -ap.ang;
      platform.position.set(ap.x, platformTop - platformH/2, ap.z);
      this.scene.add(platform);

      const tarmac = new THREE.Mesh(
        new THREE.PlaneGeometry(ap.wid + 22, ap.len + 60),
        new THREE.MeshLambertMaterial({
          color: 0x3e3c38,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
        })
      );
      tarmac.rotation.x = -Math.PI / 2;
      tarmac.rotation.z = -ap.ang;
      tarmac.position.set(ap.x, platformTop + 0.2, ap.z);
      this.scene.add(tarmac);

      const S = 256, L = 1024;
      const c = document.createElement('canvas');
      c.width = S; c.height = L;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1c1c1a'; ctx.fillRect(0, 0, S, L);
      ctx.setLineDash([60, 40]);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(S/2, 50); ctx.lineTo(S/2, L-50); ctx.stroke();
      ctx.setLineDash([]);
      for (const yPos of [90, L-90]) {
        for (let i = -2; i <= 2; i++) {
          if (i === 0) continue;
          ctx.fillStyle = '#e0e0e0';
          ctx.fillRect(S/2 + i*44 - 11, yPos - 38, 22, 76);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(ap.wid, ap.len),
        new THREE.MeshLambertMaterial({
          map: tex, transparent: true,
          depthTest: true, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
        })
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.rotation.z = -ap.ang;
      stripe.position.set(ap.x, platformTop + 0.4, ap.z);
      this.scene.add(stripe);

      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const beaconGeo = new THREE.SphereGeometry(1.2, 6, 6);
      const hl = ap.len/2, hw = ap.wid/2;
      for (const [sl, sw] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const bx = ap.x + sl*hl*cos - sw*hw*sin;
        const bz = ap.z + sl*hl*sin + sw*hw*cos;
        const b  = new THREE.Mesh(beaconGeo, beaconMat);
        b.position.set(bx, platformTop + 1.2, bz);
        this.scene.add(b);
      }
    }
  }

  async _buildVillages() {
    const paths = {
      maison1: '/Village/Maison1.glb',
      maison2: '/Village/Maison2.glb',
      maison3: '/Village/Maison3.glb',
      maison4: '/Village/Maison4.glb',
      maison5: '/Village/Maison5.glb',
    };
    const MAX_PER_TYPE = 60;
    const glbs = {};
    await Promise.all(
      Object.entries(paths).map(async ([key, path]) => {
        const gltf = await loadGLB(path).catch(() => null);
        if (gltf) glbs[key] = gltf.scene;
      })
    );

    const groups = {};
    for (const [key, scene] of Object.entries(glbs)) {
      const g = this._createInstancedGroup(scene, MAX_PER_TYPE, 'building');
      if (g) {
        const bbox = new THREE.Box3().setFromObject(scene);
        g.naturalHeight = bbox.max.y - bbox.min.y;
        groups[key] = g;
      }
    }

    const dummy  = new THREE.Object3D();
    const counts = Object.fromEntries(Object.keys(paths).map(k => [k, 0]));
    const placed = [];

    for (const v of VILLAGES) {
      const square = new THREE.Mesh(
        new THREE.CircleGeometry(22, 16),
        new THREE.MeshLambertMaterial({ color: 0x7a6e52, depthWrite: false, transparent: true, opacity: 0.55 })
      );
      square.rotation.x = -Math.PI / 2;
      square.position.set(v.x, v.h + 0.35, v.z);
      square.renderOrder = 1;
      this.scene.add(square);

      for (const [dx, dz, type, targetH, rotY] of this._makeVillageLayout()) {
        const g = groups[type];
        if (!g || counts[type] >= MAX_PER_TYPE || g.naturalHeight <= 0) continue;
        const wx = v.x + dx, wz = v.z + dz;
        if (this._nearAirport(wx, wz, 80)) continue;
        const halfFp = (g.naturalFootprint ?? 20) * (targetH / g.naturalHeight) / 2;
        if (placed.some(([px, pz, hr]) => (wx-px)**2 + (wz-pz)**2 < (halfFp + hr + 3) ** 2)) continue;
        const scale = targetH / g.naturalHeight;
        // Validation 4 coins — rejette si la pente est trop forte (B2)
        const c0 = this.getTerrainHeight(wx - 14, wz - 14);
        const c1 = this.getTerrainHeight(wx + 14, wz - 14);
        const c2 = this.getTerrainHeight(wx - 14, wz + 14);
        const c3 = this.getTerrainHeight(wx + 14, wz + 14);
        if (Math.max(c0, c1, c2, c3) - Math.min(c0, c1, c2, c3) > 4) continue;
        const gY = (c0 + c1 + c2 + c3) / 4;
        dummy.position.set(wx, gY + g.baseOffset * scale, wz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        const idx = counts[type];
        for (const inst of g.instances) {
          inst.setMatrixAt(idx, dummy.matrix);
          if (idx + 1 > inst.count) inst.count = idx + 1;
        }
        counts[type]++;
        g.recordInstance(wx, wz, dummy.matrix);
        placed.push([wx, wz, halfFp]);
      }
    }
    for (const g of Object.values(groups))
      if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    this._bldgLODGroups = Object.values(groups).filter(Boolean);
    this.buildingPositions = placed;
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }

  get debugStats() {
    const tri = gs => (gs ?? []).reduce((s, g) => s + (g?.visibleTriCount() ?? 0), 0);
    return {
      trees       : this._statsTreeCount     ?? 0,
      rocks       : this._statsRockCount     ?? 0,
      bushes      : this._statsBushCount     ?? 0,
      buildings   : this._statsBuildingCount ?? 0,
      triTrees    : tri(this._treeLODGroups),
      triRocks    : tri(this._rockLODGroups),
      triBushes   : tri(this._bushLODGroups),
      triBuildings: tri(this._bldgLODGroups),
    };
  }

  updateLOD(camPos, fwdX = 0, fwdZ = -1, ultra = false) {
    const x = camPos.x, z = camPos.z;
    if (ultra) {
      this._treeLODGroups?.forEach(g => g.updateLOD(x, z, 300,  600, 1000, fwdX, fwdZ));
      this._rockLODGroups?.forEach(g => g.updateLOD(x, z, 200,  400,  600, fwdX, fwdZ));
      this._bushLODGroups?.forEach(g => g.updateLOD(x, z, 150,  300,  400, fwdX, fwdZ));
      this._bldgLODGroups?.forEach(g => g.updateLOD(x, z, 400,  800, 2000, fwdX, fwdZ));
    } else {
      this._treeLODGroups?.forEach(g => g.updateLOD(x, z, 1200, 2800, 5500, fwdX, fwdZ));
      this._rockLODGroups?.forEach(g => g.updateLOD(x, z,  800, 1600, 3000, fwdX, fwdZ));
      this._bushLODGroups?.forEach(g => g.updateLOD(x, z,  600, 1200, 2500, fwdX, fwdZ));
      this._bldgLODGroups?.forEach(g => g.updateLOD(x, z, 1000, 2500, 4500, fwdX, fwdZ));
    }
  }

  _makeVillageLayout() {
    const house = ['maison1','maison2','maison3','maison4','maison5'];
    const FIXED_H = 11;
    const rings = [
      { r:  50, count:  5, offset: 0             },
      { r: 108, count: 12, offset: Math.PI / 12  },
      { r: 166, count: 18, offset: Math.PI / 18  },
      { r: 225, count: 24, offset: Math.PI / 24  },
    ];
    const p = [];
    let hIdx = 0;
    for (const { r, count, offset } of rings) {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + offset;
        p.push([Math.cos(ang) * r, Math.sin(ang) * r, house[hIdx % house.length], FIXED_H, ang + Math.PI]);
        hIdx++;
      }
    }
    return p;
  }

  async _buildTrees() {
    const paths = [
      '/Arbres/SM_Tree_A.glb', '/Arbres/SM_Tree_B.glb',
      '/Arbres/SM_Tree_C.glb', '/Arbres/SM_Tree_Root.glb',
    ];
    const MAX   = 1200;
    const gltfs = await Promise.all(paths.map(p => loadGLB(p).catch(() => null)));
    const groups = gltfs.map(g => g ? this._createInstancedGroup(g.scene, MAX, 'tree') : null);
    if (groups.every(g => !g)) return null;

    const dummy  = new THREE.Object3D();
    const placed = [0, 0, 0, 0];
    let attempts = 0;
    const TARGET = 3800;

    while (placed.reduce((a,b)=>a+b,0) < TARGET && attempts < TARGET * 14) {
      attempts++;
      const wx = rng(-SIZE * 0.46, SIZE * 0.46);
      const wz = rng(-SIZE * 0.46, SIZE * 0.46);
      const h  = this.getTerrainHeight(wx, wz);

      if (h < 6 || h > 480) continue;
      const hR = this.getTerrainHeight(wx + 14, wz);
      const hU = this.getTerrainHeight(wx, wz + 14);
      if (Math.sqrt(((hR-h)/14)**2 + ((hU-h)/14)**2) > 0.85) continue;
      if (this._nearVillageOrAirport(wx, wz, 95, 15)) continue;
      if (this._nearLake(wx, wz, 30)) continue;

      let ti;
      if (h < 60)        ti = Math.random() < 0.6 ? 0 : 1;
      else if (h < 180)  ti = Math.floor(rng(0, 3));
      else               ti = 1 + Math.floor(rng(0, 2));

      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = rng(0.9, 2.2);
      dummy.position.set(wx, h + group.baseOffset * scale, wz);
      dummy.rotation.y = rng(0, Math.PI * 2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      for (const inst of group.instances) {
        inst.setMatrixAt(placed[ti], dummy.matrix);
        if (placed[ti] + 1 > inst.count) inst.count = placed[ti] + 1;
      }
      placed[ti]++;
      group.recordInstance(wx, wz, dummy.matrix);
    }
    for (const g of groups) if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    this._treeLODGroups = groups.filter(Boolean);
    return { groups, placed, MAX };
  }

  async _buildVillageTrees({ groups, placed, MAX }) {
    const dummy = new THREE.Object3D();
    for (const v of VILLAGES) {
      const layers = [
        { rMin: v.outerR * 0.92, rMax: v.outerR * 1.5,  count: 22, scaleMin: 1.1, scaleMax: 2.0 },
        { rMin: v.innerR * 1.55, rMax: v.outerR * 0.92, count: 20, scaleMin: 1.0, scaleMax: 1.8 },
        { rMin: v.innerR * 1.10, rMax: v.innerR * 1.55, count: 12, scaleMin: 0.8, scaleMax: 1.4 },
        { rMin: 28,              rMax: v.innerR * 1.10, count:  8, scaleMin: 0.5, scaleMax: 1.0 },
      ];
      for (const layer of layers) {
        let placed_layer = 0, att = 0;
        while (placed_layer < layer.count && att < layer.count * 20) {
          att++;
          const ang = Math.random() * Math.PI * 2;
          const r   = layer.rMin + Math.random() * (layer.rMax - layer.rMin);
          const wx  = v.x + Math.cos(ang) * r;
          const wz  = v.z + Math.sin(ang) * r;
          const h   = this.getTerrainHeight(wx, wz);
          if (h < 5) continue;
          if (this._nearLake(wx, wz, 15)) continue;
          if (this._nearAirport(wx, wz, 80)) continue;
          const ti = Math.floor(Math.random() * 4);
          const g  = groups[ti];
          if (!g || placed[ti] >= MAX) continue;
          const scale = rng(layer.scaleMin, layer.scaleMax);
          dummy.position.set(wx, h + g.baseOffset * scale, wz);
          dummy.rotation.y = Math.random() * Math.PI * 2;
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          for (const inst of g.instances) {
            inst.setMatrixAt(placed[ti], dummy.matrix);
            if (placed[ti] + 1 > inst.count) inst.count = placed[ti] + 1;
          }
          placed[ti]++;
          g.recordInstance(wx, wz, dummy.matrix);
          placed_layer++;
        }
      }
    }
    for (const g of groups) if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
  }

  async _buildRocks() {
    const paths = [
      '/Montagnes/SM_Rock_A.glb', '/Montagnes/SM_Rock_B.glb',
      '/Montagnes/SM_Rock_C.glb', '/Montagnes/SM_Rock_D.glb',
      '/Montagnes/SM_Rock_E.glb', '/Montagnes/SM_Rock_F.glb',
      '/Montagnes/SM_Rock_G.glb', '/Montagnes/SM_Rock_I.glb',
    ];
    const MAX   = 80;
    const gltfs = await Promise.all(paths.map(p => loadGLB(p).catch(() => null)));
    const groups = gltfs.map(g => g ? this._createInstancedGroup(g.scene, MAX, 'rock') : null);
    if (groups.every(g => !g)) return;

    const dummy  = new THREE.Object3D();
    const placed = new Array(paths.length).fill(0);
    let attempts = 0;

    while (placed.reduce((a,b)=>a+b,0) < 480 && attempts < 18000) {
      attempts++;
      const wx = rng(-SIZE * 0.46, SIZE * 0.46);
      const wz = rng(-SIZE * 0.46, SIZE * 0.46);
      const h  = this.getTerrainHeight(wx, wz);
      if (h < 15) continue;
      if (this._nearVillageOrAirport(wx, wz, 30, 30)) continue;
      const hR = this.getTerrainHeight(wx + 12, wz);
      const hU = this.getTerrainHeight(wx, wz + 12);
      const steep = Math.sqrt(((hR-h)/12)**2 + ((hU-h)/12)**2);
      if (steep > 2.2) continue;
      if (h < 100 && steep < 0.30 && Math.random() > 0.25) continue;

      const ti = Math.floor(rng(0, paths.length));
      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = h > 120 ? rng(0.5, 2.0) : rng(0.30, 1.1);
      dummy.position.set(wx, h + group.baseOffset * scale, wz);
      dummy.rotation.y = rng(0, Math.PI * 2);
      dummy.rotation.z = rng(-0.10, 0.10);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      for (const inst of group.instances) {
        inst.setMatrixAt(placed[ti], dummy.matrix);
        if (placed[ti] + 1 > inst.count) inst.count = placed[ti] + 1;
      }
      placed[ti]++;
      group.recordInstance(wx, wz, dummy.matrix);
    }
    for (const g of groups) if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    this._rockLODGroups = groups.filter(Boolean);
    return placed.reduce((a, b) => a + b, 0);
  }

  async _buildBushes() {
    const paths = ['/Buissons/SM_Tree_Bush_A.glb', '/Buissons/SM_Tree_Bush_B.glb'];
    const MAX   = 220;
    const gltfs = await Promise.all(paths.map(p => loadGLB(p).catch(() => null)));
    const groups = gltfs.map(g => g ? this._createInstancedGroup(g.scene, MAX, 'bush') : null);
    if (groups.every(g => !g)) return;

    const dummy  = new THREE.Object3D();
    const placed = [0, 0];
    let attempts = 0;

    while (placed[0] + placed[1] < 380 && attempts < 14000) {
      attempts++;
      const wx = rng(-SIZE * 0.46, SIZE * 0.46);
      const wz = rng(-SIZE * 0.46, SIZE * 0.46);
      const h  = this.getTerrainHeight(wx, wz);
      if (h < 5 || h > 200) continue;
      if (this._nearVillageOrAirport(wx, wz, 90, 20)) continue;
      if (this._nearLake(wx, wz, 20)) continue;

      const ti    = Math.floor(rng(0, 2));
      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = rng(1.0, 2.5);
      dummy.position.set(wx, h + group.baseOffset * scale, wz);
      dummy.rotation.y = rng(0, Math.PI * 2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      for (const inst of group.instances) {
        inst.setMatrixAt(placed[ti], dummy.matrix);
        if (placed[ti] + 1 > inst.count) inst.count = placed[ti] + 1;
      }
      placed[ti]++;
      group.recordInstance(wx, wz, dummy.matrix);
    }
    for (const g of groups) if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    this._bushLODGroups = groups.filter(Boolean);
    return placed[0] + placed[1];
  }

  _createInstancedGroup(modelScene, maxCount, category = '', lodRatios) {
    const lod = new InstancedLOD(this.scene, modelScene, maxCount, category, lodRatios);
    return lod.instances.length > 0 ? lod : null;
  }

  _nearVillageOrAirport(wx, wz, airportBuffer, villageBuffer = -1) {
    const vBuf = villageBuffer < 0 ? airportBuffer : villageBuffer;
    for (const v of VILLAGES)
      if (Math.hypot(wx - v.x, wz - v.z) < v.outerR + vBuf) return true;
    for (const ap of AIRPORTS) {
      const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
      const lx  = (wx - ap.x) * cos - (wz - ap.z) * sin;
      const lz  = (wx - ap.x) * sin + (wz - ap.z) * cos;
      if (Math.abs(lx) < ap.wid/2 + airportBuffer && Math.abs(lz) < ap.len/2 + airportBuffer) return true;
      if (Math.abs(lx) < 40 && Math.abs(lz) < ap.len/2 + 180) return true;
    }
    return false;
  }

  _nearAirport(wx, wz, buffer) {
    for (const ap of AIRPORTS) {
      const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
      const lx  = (wx - ap.x) * cos - (wz - ap.z) * sin;
      const lz  = (wx - ap.x) * sin + (wz - ap.z) * cos;
      if (Math.abs(lx) < ap.wid/2 + buffer && Math.abs(lz) < ap.len/2 + buffer) return true;
    }
    return false;
  }

  isOnRunway(wx, wz) { return this._nearAirport(wx, wz, 6); }

  _nearLake(wx, wz, margin) {
    for (const [lx, lz, lr] of LAKES)
      if (Math.hypot(wx - lx, wz - lz) < lr + margin) return true;
    return false;
  }
}

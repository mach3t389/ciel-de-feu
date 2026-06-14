import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { InstancedLOD } from './LODManager.js';

const _loader = new GLTFLoader();
const loadGLB = (path) => new Promise((res, rej) => _loader.load(path, res, null, rej));

const SEGS = 170;
const SIZE = 6800;

// Pics — tous les centres à ≤1150 du centre, épaule (centre+r) ≤1400
// → impossible de créer un mur au bord de la carte
const PEAKS = [
  // Grandes montagnes de bord (700-800 m) — bien à l'intérieur de la carte
  [ -950, -1150, 760, 205],
  [  850, -1100, 710, 195],
  [ 1150,  -300, 740, 210],
  [ 1100,   850, 700, 200],
  [  450,  1150, 680, 195],
  [ -650,  1100, 650, 190],
  [-1150,   450, 720, 205],
  [ -900,  -850, 680, 195],
  // Collines inter-villages (300-450 m) — bloquent la vue directe entre bases
  [ -100,  -380, 420, 175],   // corridor Alpha-Beta
  [  260,   460, 390, 160],   // corridor Beta-Gamma
  [ -560,   160, 360, 150],   // corridor Alpha-Gamma
  // Petites collines décoratives (180-300 m) — relief général
  [  550,  -680, 290, 138],
  [ -650,   580, 265, 130],
  [  850,   420, 245, 125],
  [ -180,  -980, 310, 142],
  [  380,   820, 220, 118],
  [ -820,    80, 240, 128],
];

const LAKES = [
  [ -480,   820, 165,  4],
  [  920, -1020, 140,  5],
  [-1550,  -380, 110,  6],
  [  460,  1480, 120,  4],
];

// Villages — joueur Alpha (NW), ennemis Beta (E) et Gamma (base ennemie éloignée, SE)
// Alpha village placé en périphérie du bout de piste joueur (visible au décollage)
const VILLAGES = [
  { name: 'Alpha', x:  -650, z:  -250, h: 45, outerR: 520, innerR: 175 },
  { name: 'Beta',  x:  1050, z:  -800, h: 38, outerR: 580, innerR: 185 },
  { name: 'Gamma', x:   250, z:  2050, h: 42, outerR: 560, innerR: 180 },
];

// 2 aéroports : Alpha (joueur, NW) et Gamma (ennemi, SE) — base ennemie 1,5× plus loin (~3 200 m)
const AIRPORTS = [
  { x:  -950, z:  -580, h: 45, len: 300, wid: 30, ang:  0.00 },  // Alpha — base joueur
  { x:   250, z:  2390, h: 42, len: 260, wid: 30, ang:  0.08 },  // Gamma — base ennemie
];

const rng = (a, b) => a + Math.random() * (b - a);

export class BocageMap {
  constructor(scene) {
    this.scene = scene;
    this.getTerrainHeight = null;
    this._balloons = [];
    this._time = 0;
    this.airports = AIRPORTS.map(a => ({
      center  : new THREE.Vector3(a.x, a.h + 2.5, a.z),
      surfaceY: a.h + 1.0,   // dessus de la plateforme de piste (platformTop)
      radius  : a.len * 0.65,
      ang     : a.ang,
    }));
  }

  async build() {
    this._buildTerrain();
    this._buildWater();
    this._buildAirportMeshes();
    this._statsBuildingCount = (await this._buildVillages()) ?? 0;
    const treeGroups = await this._buildTrees();
    if (treeGroups) await this._buildVillageTrees(treeGroups);
    this._statsTreeCount = treeGroups ? treeGroups.placed.reduce((a, b) => a + b, 0) : 0;
    this._statsRockCount = (await this._buildRocks())  ?? 0;
    this._statsBushCount = (await this._buildBushes()) ?? 0;
    await this._buildBalloons();
    return {
      getTerrainHeight: this.getTerrainHeight,
      airports: this.airports,
      isOnRunway: (x, z) => this.isOnRunway(x, z),
    };
  }

  getVillageZones() {
    return VILLAGES.map(v => ({ x: v.x, z: v.z, radius: v.outerR * 1.8 }));
  }

  // Zones ennemies seulement (exclut Alpha = base joueur, index 0)
  getEnemyZones() {
    return VILLAGES.slice(1).map(v => ({ x: v.x, z: v.z, radius: v.outerR * 1.8 }));
  }

  update(delta) {
    this._time += delta;
    const t = this._time;
    this._balloons.forEach((b, i) => {
      b.group.position.set(
        b.ox + Math.sin(t * 0.08 + i * 1.3) * 18,
        b.oy + Math.sin(t * 0.17 + i * 0.7) * 7,
        b.oz + Math.cos(t * 0.11 + i * 0.9) * 15
      );
      b.group.rotation.y += delta * 0.04 * (i % 2 ? 1 : -1);
    });
  }

  // ── Terrain ─────────────────────────────────────────────────────────────────
  _buildTerrain() {
    const hash = (x, z) => {
      const n = Math.sin(x * 113.5 + z * 271.9 + 47.3) * 43758.5453;
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
      for (let i=0; i<8; i++) { v+=vnoise(x*f,z*f)*a; s+=a; a*=0.48; f*=2.13; }
      return v / s;
    };
    const detail = (x, z) => {
      let v=0, a=1, f=1, s=0;
      for (let i=0; i<4; i++) { v+=vnoise(x*f+91.2,z*f+33.7)*a; s+=a; a*=0.5; f*=3.1; }
      return (v/s - 0.5) * 2;
    };
    const gauss = (wx, wz, px, pz, h, r) =>
      h * Math.exp(-((wx-px)**2 + (wz-pz)**2) / (2*r*r));

    const getBase = (wx, wz) => {
      const d = Math.sqrt(wx*wx + wz*wz);
      const flat = Math.min(1, Math.max(0, (d - 80) / 180));
      const n = fbm(wx * 0.0024, wz * 0.0024);
      const ridge = 1 - Math.abs(2*n - 1);
      const micro = detail(wx * 0.016, wz * 0.016) * 3;
      let h = (n*0.55 + ridge*0.45) ** 1.8 * 500 * flat + micro * flat;
      for (const [px,pz,ph,pr] of PEAKS)
        h += gauss(wx, wz, px, pz, ph, pr) * Math.min(1, Math.max(0, (d-60)/120));
      // Fondu de bord : carte agrandie, océan vers 3400 → laisse la place à la base ennemie éloignée
      const edge = Math.max(Math.abs(wx), Math.abs(wz));
      const et = Math.max(0, Math.min(1, (edge - 1900) / 1500));
      const s = et*et*(3-2*et);
      return h * (1-s) + (-8) * s;
    };

    const getH = (wx, wz) => {
      let h = getBase(wx, wz);

      // Plateau village (grande zone aplanie)
      for (const v of VILLAGES) {
        const d = Math.hypot(wx - v.x, wz - v.z);
        if (d < v.outerR) {
          const t = Math.max(0, d - v.innerR) / (v.outerR - v.innerR);
          const s = t * t * (3 - 2 * t);
          h = h * s + v.h * (1 - s);
        }
      }

      // Piste + corridors d'approche (800 m de chaque côté)
      for (const ap of AIRPORTS) {
        const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
        const lx = (wx - ap.x) * cos - (wz - ap.z) * sin;
        const lz = (wx - ap.x) * sin + (wz - ap.z) * cos;

        // Surface du tarmac : retourne la hauteur réelle de la plateforme (ap.h + 1.0)
        // pour que le joueur pose les roues au bon endroit, sans clipper à travers.
        const platformTop = ap.h + 1.0;
        const tarmacHW = ap.wid / 2 + 11, tarmacHL = ap.len / 2 + 30;
        if (Math.abs(lx) < tarmacHW && Math.abs(lz) < tarmacHL) {
          return platformTop;
        }

        // Zone centrale de la piste — élargie pour couvrir toute l'emprise de l'apron
        const hw = ap.wid / 2 + 55, hl = ap.len / 2 + 75;
        if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
          const blend = 22;
          const tx = Math.max(0, (Math.abs(lx) - ap.wid/2) / blend);
          const tz = Math.max(0, (Math.abs(lz) - ap.len/2) / blend);
          const s  = Math.max(tx, tz) ** 2 * (3 - 2 * Math.max(tx, tz));
          h = h * s + platformTop * (1 - s);  // fondu vers platformTop, pas ap.h
          continue;
        }

        // Corridors d'approche : 120m de large, 900m de long au-delà de la piste
        const approachW = 70, approachExt = 900;
        if (Math.abs(lx) < approachW && Math.abs(lz) < ap.len/2 + approachExt) {
          const beyondRunway = Math.max(0, Math.abs(lz) - ap.len/2);
          const fadeW = Math.max(0, (Math.abs(lx) - ap.wid/2)) / (approachW - ap.wid/2);
          const fadeL = beyondRunway / approachExt;
          const t = Math.max(fadeW, fadeL);
          const s = t * t * (3 - 2 * t);
          h = h * s + ap.h * (1 - s);
        }
      }

      // Lacs
      for (const [lx, lz, lr, lh] of LAKES) {
        const ld = Math.hypot(wx - lx, wz - lz);
        if (ld < lr) {
          const tEdge = Math.max(0, (ld - lr * 0.45) / (lr * 0.55));
          const s = 1 - tEdge*tEdge*(3-2*tEdge);
          h = h * (1-s) + lh * s;
        }
      }

      // Terrain autour des aéroports : plateau plat + transition douce
      for (const ap of AIRPORTS) {
        const cos = Math.cos(ap.ang), sin = Math.sin(ap.ang);
        const dx = wx - ap.x, dz = wz - ap.z;
        // Coordonnées locales le long de l'axe de piste
        const lx = dx * cos - dz * sin;  // travers
        const lz = dx * sin + dz * cos;  // long de la piste
        const halfLen = ap.len / 2 + 160; // zone à aplatir : piste + marges aux extrémités
        const halfWid = ap.wid / 2 + 80;

        // Distance "boîte arrondie" qui suit la forme de la piste
        const boxDx = Math.max(0, Math.abs(lx) - halfWid);
        const boxDz = Math.max(0, Math.abs(lz) - halfLen);
        const dBox  = Math.sqrt(boxDx*boxDx + boxDz*boxDz);

        // Plafond circulaire global (évite les pics trop proches)
        const dRaw = Math.sqrt(dx*dx + dz*dz);
        if (dRaw < 950) {
          const t = Math.max(0, dRaw - 150) / (950 - 150);
          h = Math.min(h, ap.h + t * t * 220);
        }

        // Plateau : relève et aplatit le terrain dans la zone de la piste + marges
        if (dBox < 320) {
          const blend = 1 - Math.min(1, dBox / 320);
          const smooth = blend * blend * (3 - 2 * blend); // smoothstep
          h = h * (1 - smooth) + Math.max(h, ap.h) * smooth;
        }
      }

      return h;
    };

    this.getTerrainHeight = getH;

    // ── Build mesh ─────────────────────────────────────────────────────────
    const vCount = (SEGS+1) * (SEGS+1);
    const ys  = new Float32Array(vCount);

    for (let z=0; z<=SEGS; z++) {
      for (let x=0; x<=SEGS; x++) {
        const wx = (x/SEGS - 0.5) * SIZE;
        const wz = (z/SEGS - 0.5) * SIZE;
        ys[z*(SEGS+1)+x] = getH(wx, wz);
      }
    }

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
        const t = Math.max(0, Math.min(1, (ys[i] - 500) / 250));
        ys[i] = ys[i] * (1 - t * 0.7) + sm[i] * (t * 0.7);
      }
    }

    const hColor = (h, steep) => {
      if (h < -4)  return [0.10, 0.62, 0.82];
      if (h <  6)  return [0.88, 0.80, 0.52];
      if (steep > 0.60) {
        if (h > 400) return [0.60, 0.55, 0.50];
        return [0.50, 0.44, 0.36];
      }
      if (h <  55) return [0.28, 0.76, 0.22];
      if (h < 160) return [0.16, 0.58, 0.14];
      if (h < 320) return [0.32, 0.64, 0.24];
      if (h < 500) return [0.58, 0.50, 0.38];
      if (h < 680) return [0.70, 0.65, 0.58];
      return [0.94, 0.96, 0.98];
    };

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
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      vertexColors: true, flatShading: true,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
    })));

    // Lookup bilinéaire rapide — remplace le fBm 8 octaves (~200× plus rapide par appel) (A3)
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

    // Océan sous le terrain
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(40000, 40000, 4, 4),
      new THREE.MeshPhongMaterial({ color: 0x1a4a6e, shininess: 50, specular: new THREE.Color(0x2266aa) })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1;
    this.scene.add(ocean);
  }

  // ── Lacs ─────────────────────────────────────────────────────────────────────
  _buildWater() {
    for (const [lx, lz, lr, lh] of LAKES) {
      const geo = new THREE.CircleGeometry(lr * 0.44, 48);
      const mat = new THREE.MeshLambertMaterial({ color: 0x3a8fcc, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(lx, lh + 2, lz);
      mesh.renderOrder = 2;
      this.scene.add(mesh);
    }
  }

  // ── Pistes d'aéroport ────────────────────────────────────────────────────────
  _buildAirportMeshes() {
    for (const ap of AIRPORTS) {
      const cos = Math.cos(ap.ang), sin = Math.sin(ap.ang);

      // Plateforme — boîte 3D solide avec rebord visible (remplace l'apron + tarmac plats)
      const platformH = 3.5;
      const platformTop = ap.h + 1.0;
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(ap.wid + 70, platformH, ap.len + 120),
        new THREE.MeshLambertMaterial({ color: 0x5a5650 })
      );
      platform.rotation.y = -ap.ang;
      platform.position.set(ap.x, platformTop - platformH / 2, ap.z);
      this.scene.add(platform);

      // Tarmac (surface intérieure plus sombre, sur le dessus de la plateforme)
      const tarmacGeo = new THREE.PlaneGeometry(ap.wid + 22, ap.len + 60);
      const tarmac = new THREE.Mesh(tarmacGeo, new THREE.MeshLambertMaterial({
        color: 0x3e3c38,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      }));
      tarmac.rotation.x = -Math.PI / 2;
      tarmac.rotation.z = -ap.ang;
      tarmac.position.set(ap.x, platformTop + 0.2, ap.z);
      this.scene.add(tarmac);

      // Marquages piste
      const S = 256, L = 1024;
      const c = document.createElement('canvas');
      c.width = S; c.height = L;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1c1c1a';
      ctx.fillRect(0, 0, S, L);
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
      // Marquage — depthTest:true (respecte la profondeur), polygonOffset pour éviter
      // le z-fighting avec le tarmac sans jamais passer au-dessus des autres objets
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(ap.wid, ap.len),
        new THREE.MeshLambertMaterial({
          map: tex,
          transparent: true,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
        })
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.rotation.z = -ap.ang;
      stripe.position.set(ap.x, platformTop + 0.4, ap.z);
      this.scene.add(stripe);

      // Balisage (petites sphères jaunes aux coins)
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const beaconGeo = new THREE.SphereGeometry(1.2, 6, 6);
      const hl = ap.len / 2, hw = ap.wid / 2;
      for (const [sl, sw] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const bx = ap.x + sl * hl * cos - sw * hw * sin;
        const bz = ap.z + sl * hl * sin + sw * hw * cos;
        const b = new THREE.Mesh(beaconGeo, beaconMat);
        b.position.set(bx, platformTop + 1.2, bz);
        this.scene.add(b);
      }
    }
  }

  // ── Villages (InstancedMesh — un seul draw call par mesh de bâtiment) ────────
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
    // placed est global inter-villages pour éviter les superpositions entre deux villages voisins
    const placed = [];

    for (const v of VILLAGES) {
      for (const [dx, dz, type, targetH, rotY] of this._makeVillageLayout()) {
        const g = groups[type];
        if (!g || counts[type] >= MAX_PER_TYPE || g.naturalHeight <= 0) continue;
        const wx = v.x + dx, wz = v.z + dz;
        if (this._nearAirport(wx, wz, 80)) continue;
        const halfFp = (g.naturalFootprint ?? 20) * (targetH / g.naturalHeight) / 2;
        if (placed.some(([px, pz, hr]) => (wx-px)**2 + (wz-pz)**2 < (halfFp + hr + 3) ** 2)) continue;
        const scale = Math.max(0.3, Math.min(4.0, targetH / g.naturalHeight));
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

    for (const g of Object.values(groups)) {
      if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    }
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
      triTrees    : tri(this._treeLODGroups),
      triRocks    : tri(this._rockLODGroups),
      triBushes   : tri(this._bushLODGroups),
      buildings   : this._statsBuildingCount ?? 0,
      triBuildings: tri(this._bldgLODGroups),
    };
  }

  _makeVillageLayout() {
    const house = ['maison1','maison2','maison3','maison4','maison5'];
    // Hauteur cible unique → scale identique pour toutes les maisons
    const FIXED_H = 11;
    // Rayons réduits (~80 %) pour resserrer les maisons.
    // Chaque corde reste ≥ 44u — suffisant pour des bâtiments d'empreinte ~20u.
    const rings = [
      { r:  40, count:  5, offset: 0              },  // corde ≈ 47.0
      { r:  86, count: 12, offset: Math.PI / 12   },  // corde ≈ 44.5
      { r: 132, count: 18, offset: Math.PI / 18   },  // corde ≈ 46.0
      { r: 178, count: 24, offset: Math.PI / 24   },  // corde ≈ 46.7
    ];
    const p = [[0, 0, 'maison1', 18, 0]];
    let hIdx = 0;
    for (const { r, count, offset } of rings) {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + offset;
        p.push([
          Math.cos(ang) * r,
          Math.sin(ang) * r,
          house[hIdx % house.length],
          FIXED_H,
          ang + Math.PI,   // façade orientée vers le centre du village
        ]);
        hIdx++;
      }
    }
    return p;
  }

  _placeModel(model, wx, wz, targetH, rotY) {
    const clone = model.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const nat = box.max.y - box.min.y;
    if (nat <= 0) return;
    const sc = targetH / nat;
    clone.scale.setScalar(sc);
    clone.rotation.y = rotY;
    clone.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(clone);
    const gY = this.getTerrainHeight(wx, wz);
    clone.position.set(wx, gY - box2.min.y, wz);
    clone.traverse(n => { if (n.isMesh) n.receiveShadow = false; });
    this.scene.add(clone);
  }

  // ── Arbres (InstancedMesh) — positions précises sur le terrain ──────────────
  async _buildTrees() {
    const paths = [
      '/Arbres/SM_Tree_A.glb',
      '/Arbres/SM_Tree_B.glb',
      '/Arbres/SM_Tree_C.glb',
      '/Arbres/SM_Tree_Root.glb',
    ];
    const MAX = 1250;
    const gltfs = await Promise.all(paths.map(p => loadGLB(p).catch(() => null)));
    const groups = gltfs.map(g => g ? this._createInstancedGroup(g.scene, MAX, 'tree') : null);
    if (groups.every(g => !g)) return null;

    const dummy = new THREE.Object3D();
    const placed = [0, 0, 0, 0];
    let attempts = 0;
    const TARGET = 3200;

    while (placed.reduce((a,b)=>a+b,0) < TARGET && attempts < TARGET * 12) {
      attempts++;
      const wx = rng(-SIZE * 0.47, SIZE * 0.47);
      const wz = rng(-SIZE * 0.47, SIZE * 0.47);
      const h  = this.getTerrainHeight(wx, wz);

      if (h < 5 || h > 900) continue;
      const hRt = this.getTerrainHeight(wx + 14, wz);
      const hUt = this.getTerrainHeight(wx, wz + 14);
      const steepT = Math.sqrt(((hRt-h)/14)**2 + ((hUt-h)/14)**2);
      if (steepT > 0.85) continue;
      if (this._nearVillageOrAirport(wx, wz, 90, 15)) continue;
      if (this._nearLake(wx, wz, 30)) continue;

      let ti;
      if (h < 60)       ti = 0;
      else if (h < 200) ti = Math.floor(rng(0, 3));
      else if (h < 420) ti = 1 + Math.floor(rng(0, 2));
      else              ti = 2;

      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = rng(0.9, 2.2);
      dummy.position.set(wx, h + group.baseOffset * scale, wz);
      dummy.rotation.y = rng(0, Math.PI * 2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      const idx = placed[ti];
      for (const inst of group.instances) {
        inst.setMatrixAt(idx, dummy.matrix);
        if (idx + 1 > inst.count) inst.count = idx + 1;
      }
      placed[ti]++;
      group.recordInstance(wx, wz, dummy.matrix);
    }
    for (const g of groups) if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    this._treeLODGroups = groups.filter(Boolean);
    return { groups, placed, dummy: new THREE.Object3D(), MAX };
  }

  // ── Arbres dans les villages — plusieurs couches de densité ──────────────────
  async _buildVillageTrees({ groups, placed, MAX }) {
    const dummy = new THREE.Object3D();

    for (const v of VILLAGES) {
      // 3 couches : bord extérieur (dense), milieu (moyen), intérieur (rare)
      const layers = [
        { rMin: v.innerR * 1.55, rMax: v.outerR * 0.92, count: 18, scaleMin: 1.1, scaleMax: 1.8 },
        { rMin: v.innerR * 1.10, rMax: v.innerR * 1.55, count: 12, scaleMin: 0.8, scaleMax: 1.4 },
        { rMin: 28,              rMax: v.innerR * 1.10, count: 10, scaleMin: 0.5, scaleMax: 1.0 },
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

          const scale = rng(layer.scaleMin ?? 0.5, layer.scaleMax);
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

  // ── Roches décoratives (petites, InstancedMesh) ────────────────────────────
  async _buildRocks() {
    const paths = [
      '/Montagnes/SM_Rock_A.glb', '/Montagnes/SM_Rock_B.glb',
      '/Montagnes/SM_Rock_C.glb', '/Montagnes/SM_Rock_D.glb',
      '/Montagnes/SM_Rock_E.glb', '/Montagnes/SM_Rock_F.glb',
      '/Montagnes/SM_Rock_G.glb', '/Montagnes/SM_Rock_I.glb',
    ];
    const MAX = 55;
    const gltfs = await Promise.all(paths.map(p => loadGLB(p).catch(() => null)));
    const groups = gltfs.map(g => g ? this._createInstancedGroup(g.scene, MAX, 'rock') : null);
    if (groups.every(g => !g)) return;

    const dummy = new THREE.Object3D();
    const placed = new Array(paths.length).fill(0);
    let attempts = 0;
    const TARGET = 380;

    while (placed.reduce((a,b)=>a+b,0) < TARGET && attempts < 18000) {
      attempts++;
      const wx = rng(-SIZE * 0.46, SIZE * 0.46);
      const wz = rng(-SIZE * 0.46, SIZE * 0.46);
      const h  = this.getTerrainHeight(wx, wz);

      if (h < 15) continue;
      if (this._nearVillageOrAirport(wx, wz, 25, 30)) continue;

      const hR = this.getTerrainHeight(wx + 12, wz);
      const hU = this.getTerrainHeight(wx, wz + 12);
      const steep = Math.sqrt(((hR-h)/12)**2 + ((hU-h)/12)**2);
      if (steep > 2.2) continue;                               // falaise verticale → skip
      if (h < 120 && steep < 0.25 && Math.random() > 0.2) continue;

      const ti = Math.floor(rng(0, paths.length));
      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      // Petites roches décoratives — échelles fortement réduites
      const scale = h > 450 ? rng(0.6, 2.0) : rng(0.35, 1.2);
      dummy.position.set(wx, h + group.baseOffset * scale, wz);
      dummy.rotation.y = rng(0, Math.PI * 2);
      dummy.rotation.z = rng(-0.12, 0.12);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      const idx = placed[ti];
      for (const inst of group.instances) {
        inst.setMatrixAt(idx, dummy.matrix);
        if (idx + 1 > inst.count) inst.count = idx + 1;
      }
      placed[ti]++;
      group.recordInstance(wx, wz, dummy.matrix);
    }
    for (const g of groups) if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    this._rockLODGroups = groups.filter(Boolean);
    return placed.reduce((a, b) => a + b, 0);
  }

  // ── Buissons (InstancedMesh) ───────────────────────────────────────────────
  async _buildBushes() {
    const paths = ['/Buissons/SM_Tree_Bush_A.glb', '/Buissons/SM_Tree_Bush_B.glb'];
    const MAX = 220;
    const gltfs = await Promise.all(paths.map(p => loadGLB(p).catch(() => null)));
    const groups = gltfs.map(g => g ? this._createInstancedGroup(g.scene, MAX, 'bush') : null);
    if (groups.every(g => !g)) return;

    const dummy = new THREE.Object3D();
    const placed = [0, 0];
    let attempts = 0;

    while (placed[0] + placed[1] < 380 && attempts < 12000) {
      attempts++;
      const wx = rng(-SIZE * 0.46, SIZE * 0.46);
      const wz = rng(-SIZE * 0.46, SIZE * 0.46);
      const h  = this.getTerrainHeight(wx, wz);

      if (h < 5 || h > 200) continue;
      if (this._nearVillageOrAirport(wx, wz, 90, 20)) continue;
      if (this._nearLake(wx, wz, 20)) continue;

      const ti = Math.floor(rng(0, 2));
      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = rng(1.1, 2.6);
      dummy.position.set(wx, h + group.baseOffset * scale, wz);
      dummy.rotation.y = rng(0, Math.PI * 2);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      const idx = placed[ti];
      for (const inst of group.instances) {
        inst.setMatrixAt(idx, dummy.matrix);
        if (idx + 1 > inst.count) inst.count = idx + 1;
      }
      placed[ti]++;
      group.recordInstance(wx, wz, dummy.matrix);
    }
    for (const g of groups) if (g) for (const inst of g.instances) inst.instanceMatrix.needsUpdate = true;
    this._bushLODGroups = groups.filter(Boolean);
    return placed[0] + placed[1];
  }

  updateLOD(camPos, fwdX = 0, fwdZ = -1, ultra = false) {
    const x = camPos.x, z = camPos.z;
    if (ultra) {
      this._treeLODGroups?.forEach(g => g.updateLOD(x, z, 300,  600, 1000, fwdX, fwdZ));
      this._rockLODGroups?.forEach(g => g.updateLOD(x, z, 200,  400,  600, fwdX, fwdZ));
      this._bushLODGroups?.forEach(g => g.updateLOD(x, z, 150,  300,  400, fwdX, fwdZ));
      this._bldgLODGroups?.forEach(g => g.updateLOD(x, z, 400,  800, 2000, fwdX, fwdZ));
    } else {
      this._treeLODGroups?.forEach(g => g.updateLOD(x, z, 1100, 2500, 5000, fwdX, fwdZ));
      this._rockLODGroups?.forEach(g => g.updateLOD(x, z,  800, 1400, 2500, fwdX, fwdZ));
      this._bushLODGroups?.forEach(g => g.updateLOD(x, z,  700, 1200, 2500, fwdX, fwdZ));
      this._bldgLODGroups?.forEach(g => g.updateLOD(x, z, 1500, 3500, 6000, fwdX, fwdZ));
    }
  }

  // ── Montgolfières — au-dessus des villages ─────────────────────────────────
  async _buildBalloons() {
    const gltf = await loadGLB('/Montgolfières/Montgolfière.glb').catch(() => null);
    if (!gltf) return;

    // Positions au-dessus de chaque village + satellites proches
    const positions = [
      // Au-dessus de Village Alpha
      [VILLAGES[0].x,       VILLAGES[0].h + 360, VILLAGES[0].z],
      [VILLAGES[0].x +  90, VILLAGES[0].h + 280, VILLAGES[0].z - 120],
      // Au-dessus de Village Beta
      [VILLAGES[1].x,       VILLAGES[1].h + 400, VILLAGES[1].z],
      [VILLAGES[1].x -  80, VILLAGES[1].h + 310, VILLAGES[1].z +  90],
      // Au-dessus de Village Gamma
      [VILLAGES[2].x,       VILLAGES[2].h + 380, VILLAGES[2].z],
      [VILLAGES[2].x + 110, VILLAGES[2].h + 295, VILLAGES[2].z -  80],
    ];

    for (const [ox, oy, oz] of positions) {
      const group = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(group);
      const maxDim = box.max.y - box.min.y;
      group.scale.setScalar(maxDim > 0 ? 40 / maxDim : 1);
      group.position.set(ox, oy, oz);
      this.scene.add(group);
      this._balloons.push({ group, ox, oy, oz });
    }
  }

  // ── Utilitaires ────────────────────────────────────────────────────────────

  _createInstancedGroup(modelScene, maxCount, category = '', lodRatios) {
    const lod = new InstancedLOD(this.scene, modelScene, maxCount, category, lodRatios);
    return lod.instances.length > 0 ? lod : null;
  }

  // villageBuffer : marge au-delà du outerR du village
  // airportBuffer : marge au-delà de la demi-largeur/longueur de la piste
  _nearVillageOrAirport(wx, wz, airportBuffer, villageBuffer = -1) {
    const vBuf = villageBuffer < 0 ? airportBuffer : villageBuffer;
    for (const v of VILLAGES) {
      if (Math.hypot(wx - v.x, wz - v.z) < v.outerR + vBuf) return true;
    }
    for (const ap of AIRPORTS) {
      const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
      const lx = (wx - ap.x) * cos - (wz - ap.z) * sin;
      const lz = (wx - ap.x) * sin + (wz - ap.z) * cos;
      // Zone autour de la piste
      if (Math.abs(lx) < ap.wid/2 + airportBuffer && Math.abs(lz) < ap.len/2 + airportBuffer) return true;
      // Approche immédiate dégagée (axe 40 m de large, 180 m au-delà de la piste)
      if (Math.abs(lx) < 40 && Math.abs(lz) < ap.len/2 + 180) return true;
    }
    return false;
  }

  _nearAirport(wx, wz, buffer) {
    for (const ap of AIRPORTS) {
      const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
      const lx = (wx - ap.x) * cos - (wz - ap.z) * sin;
      const lz = (wx - ap.x) * sin + (wz - ap.z) * cos;
      if (Math.abs(lx) < ap.wid/2 + buffer && Math.abs(lz) < ap.len/2 + buffer) return true;
    }
    return false;
  }

  // Public : le point (wx,wz) est-il sur le tarmac d'une piste ? (atterrissage sûr)
  isOnRunway(wx, wz) { return this._nearAirport(wx, wz, 6); }

  _nearLake(wx, wz, margin) {
    for (const [lx, lz, lr] of LAKES) {
      if (Math.hypot(wx - lx, wz - lz) < lr + margin) return true;
    }
    return false;
  }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { InstancedLOD } from './LODManager.js';

const _loader = new GLTFLoader();
const loadGLB = (path) => new Promise((res, rej) => _loader.load(path, res, null, rej));

const SEGS = 220;
const SIZE = 6800;

// ── Géographie ──────────────────────────────────────────────────────────────
// Île Angleterre  : centre (-2000, -1600), rayon ~750 — petite île alliée (NW)
// Île Normandie   : centre (400, 1000), ellipse EW×1.35, rayon ~1600 — grande île ennemie
// La Manche       : ~1300 unités de côte à côte (~58 s à 80 km/h)

const ENG_CX = -2000, ENG_CZ = -1600, ENG_R = 750;
const NOR_CX =   400, NOR_CZ =  1000, NOR_R = 1600, NOR_STRETCH = 1.35;

// Collines douces sur la Normandie — max ~110 m (pas de montagnes)
const PEAKS = [
  [  50,  700,  92, 370],  // collines centrales-nord
  [-300, 1200, 108, 380],  // collines de l'ouest
  [ 750, 1100,  85, 310],  // collines de l'est
  [ 350, 1750,  90, 340],  // collines du sud
  [1000,  800,  66, 255],  // collines est
  [-650, 1400,  72, 265],  // collines ouest-sud
];

// Petits lacs intérieurs sur la Normandie + étang en Angleterre
const LAKES = [
  [ 300, 1300, 120,  5],   // lac central
  [-450, 1100,  85,  4],   // étang de l'ouest
  [ 800,  900,  75,  4],   // étang de l'est
  [-1950,-1700,  60,  4],  // étang d'Angleterre (décoratif)
];

// 4 villages sur la Normandie — tous ennemis
// 2 villages côtiers (plage nord) + 2 villages intérieurs
const VILLAGES = [
  { name: 'Sainte-Mère-Église', x: -520, z:  200, h: 12, outerR: 470, innerR: 158 },
  { name: 'Arromanches',        x:  920, z:  200, h: 12, outerR: 460, innerR: 155 },
  { name: 'Bayeux',             x: -150, z:  950, h: 30, outerR: 500, innerR: 168 },
  { name: 'Falaise',            x:  450, z: 1750, h: 22, outerR: 460, innerR: 155 },
];

// Aéroport 0 = Angleterre (joueur), Aéroport 1 = Normandie Ouest (ennemi)
// L'aéroport est normand a été supprimé — village d'Arromanches conservé sans piste
const AIRPORTS = [
  { x: -2000, z: -1600, h:  6, len: 270, wid: 28, ang:  0.22 },
  { x:  -580, z:   380, h: 10, len: 260, wid: 28, ang: -0.15 },
];

const rng = (a, b) => a + Math.random() * (b - a);

export class NormandyMap {
  constructor(scene) {
    this.scene = scene;
    this.getTerrainHeight = null;
    this._balloons = [];
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
    const treeGroups = await this._buildTrees();
    if (treeGroups) await this._buildVillageTrees(treeGroups);
    this._statsTreeCount = treeGroups ? treeGroups.placed.reduce((a, b) => a + b, 0) : 0;
    this._statsRockCount = (await this._buildRocks())  ?? 0;
    this._statsBushCount = (await this._buildBushes()) ?? 0;
    await this._buildBalloons();
    return {
      getTerrainHeight: this.getTerrainHeight,
      airports        : this.airports,
      isOnRunway      : (x, z) => this.isOnRunway(x, z),
    };
  }

  // Toutes les zones de villages (pour GroundDefense — toutes ennemies sur cette carte)
  getVillageZones() {
    return VILLAGES.map(v => ({ x: v.x, z: v.z, radius: v.outerR * 1.8, team: 'enemy' }));
  }

  getEnemyZones() {
    return this.getVillageZones();
  }

  update(delta) {
    this._time += delta;
    const t = this._time;
    this._balloons.forEach((b, i) => {
      b.group.position.set(
        b.ox + Math.sin(t * 0.08 + i * 1.3) * 16,
        b.oy + Math.sin(t * 0.17 + i * 0.7) * 6,
        b.oz + Math.cos(t * 0.11 + i * 0.9) * 13
      );
      b.group.rotation.y += delta * 0.04 * (i % 2 ? 1 : -1);
    });
  }

  // ── Terrain ─────────────────────────────────────────────────────────────────
  _buildTerrain() {
    const hash = (x, z) => {
      const n = Math.sin(x * 127.3 + z * 311.7 + 91.1) * 43758.5453;
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

    // Masques d'île — 1 = cœur, 0 = océan, valeurs negatives = au-delà du rivage
    const engMaskRaw = (wx, wz) => {
      const n = fbm(wx * 0.0031 + 5.1, wz * 0.0031 + 8.3) * 0.32 + 0.68;
      return 1 - Math.hypot(wx - ENG_CX, wz - ENG_CZ) / (ENG_R * n);
    };
    const norMaskRaw = (wx, wz) => {
      const dx = (wx - NOR_CX) / NOR_STRETCH;
      const dz =  wz - NOR_CZ;
      const n = fbm(wx * 0.0026 + 15.7, wz * 0.0026 + 12.4) * 0.32 + 0.68;
      return 1 - Math.sqrt(dx*dx + dz*dz) / (NOR_R * n);
    };

    const getBase = (wx, wz) => {
      const emRaw = engMaskRaw(wx, wz);
      const nmRaw = norMaskRaw(wx, wz);
      const em = Math.max(0, emRaw);
      const nm = Math.max(0, nmRaw);

      // Océan — léger fondu au bord du rivage pour éviter une falaise brutale
      if (em <= 0 && nm <= 0) {
        const coastFade = Math.max(emRaw, nmRaw); // < 0
        const fade = Math.max(0, 1 + coastFade / 0.08); // 0→1 sur les 8% de transition
        return -10 + fade * 12; // -10 à +2 juste au bord
      }

      // ── Île d'Angleterre : terrain doux, max ~32 m ──────────────────────────
      if (em >= nm) {
        const n1 = fbm(wx * 0.0070, wz * 0.0070);
        const n2 = fbm(wx * 0.0025 + 3.3, wz * 0.0025 + 7.7);
        const hillH = (n1 * 0.6 + n2 * 0.4) * 32 * em;
        return Math.max(2, hillH);
      }

      // ── Île de Normandie : collines douces, bocage, plages ──────────────────
      const baseNoise = fbm(wx * 0.0019 + 22.4, wz * 0.0019 + 18.6);
      const ridge = 1 - Math.abs(2*baseNoise - 1);
      const micro = detail(wx * 0.013, wz * 0.013) * 3.5;

      let h = (baseNoise * 0.62 + ridge * 0.38) * nm * 165 + micro * nm;

      // Collines gaussiennes (max ~110 m)
      for (const [px, pz, ph, pr] of PEAKS)
        h += gauss(wx, wz, px, pz, ph, pr) * Math.max(0, (nm - 0.10) / 0.90);

      // Plage : fondu vers h=3 dans les 12% de transition côtière
      if (nm < 0.12) {
        const t = nm / 0.12;
        const s = t * t * (3 - 2 * t);
        h = h * s + 3 * (1 - s);
      }

      return Math.max(2, h);
    };

    const getH = (wx, wz) => {
      let h = getBase(wx, wz);

      // Plateau village
      for (const v of VILLAGES) {
        const d = Math.hypot(wx - v.x, wz - v.z);
        if (d < v.outerR) {
          const t = Math.max(0, d - v.innerR) / (v.outerR - v.innerR);
          const s = t * t * (3 - 2 * t);
          h = h * s + v.h * (1 - s);
        }
      }

      // Piste + tarmac (identique à VillageMap)
      for (const ap of AIRPORTS) {
        const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
        const lx = (wx - ap.x) * cos - (wz - ap.z) * sin;
        const lz = (wx - ap.x) * sin + (wz - ap.z) * cos;

        const platformTop = ap.h + 1.0;
        const tarmacHW = ap.wid / 2 + 11, tarmacHL = ap.len / 2 + 30;
        if (Math.abs(lx) < tarmacHW && Math.abs(lz) < tarmacHL) {
          return platformTop;
        }

        const hw = ap.wid / 2 + 55, hl = ap.len / 2 + 75;
        if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
          const blend = 22;
          const tx = Math.max(0, (Math.abs(lx) - ap.wid/2) / blend);
          const tz = Math.max(0, (Math.abs(lz) - ap.len/2) / blend);
          const s  = Math.max(tx, tz) ** 2 * (3 - 2 * Math.max(tx, tz));
          h = h * s + platformTop * (1 - s);
          continue;
        }

        const approachW = 70, approachExt = 800;
        if (Math.abs(lx) < approachW && Math.abs(lz) < ap.len/2 + approachExt) {
          const beyondRunway = Math.max(0, Math.abs(lz) - ap.len/2);
          const fadeW = Math.max(0, Math.abs(lx) - ap.wid/2) / (approachW - ap.wid/2);
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

      // Plateau aéroport + plafond de relief à proximité
      for (const ap of AIRPORTS) {
        const cos = Math.cos(ap.ang), sin = Math.sin(ap.ang);
        const dx = wx - ap.x, dz = wz - ap.z;
        const lxAp = dx * cos - dz * sin;
        const lzAp = dx * sin + dz * cos;
        const halfLen = ap.len / 2 + 160, halfWid = ap.wid / 2 + 80;
        const boxDx = Math.max(0, Math.abs(lxAp) - halfWid);
        const boxDz = Math.max(0, Math.abs(lzAp) - halfLen);
        const dBox  = Math.sqrt(boxDx*boxDx + boxDz*boxDz);
        const dRaw  = Math.sqrt(dx*dx + dz*dz);
        if (dRaw < 900) {
          const t = Math.max(0, dRaw - 140) / (900 - 140);
          h = Math.min(h, ap.h + t * t * 200);
        }
        if (dBox < 300) {
          const blend = 1 - Math.min(1, dBox / 300);
          const smooth = blend * blend * (3 - 2 * blend);
          h = h * (1 - smooth) + Math.max(h, ap.h) * smooth;
        }
      }

      return h;
    };

    this.getTerrainHeight = getH;

    // ── Mesh terrain ────────────────────────────────────────────────────────
    const vCount = (SEGS+1) * (SEGS+1);
    const pos = new Float32Array(vCount * 3);
    const col = new Float32Array(vCount * 3);
    const ys  = new Float32Array(vCount);
    const idx = [];

    for (let z=0; z<=SEGS; z++) {
      for (let x=0; x<=SEGS; x++) {
        const wx = (x/SEGS - 0.5) * SIZE;
        const wz = (z/SEGS - 0.5) * SIZE;
        ys[z*(SEGS+1)+x] = getH(wx, wz);
      }
    }

    // Palette Normandie : bocage vert, plages de sable, falaises ocre
    const hColor = (h, steep, wx, wz) => {
      const px  = hash(Math.floor(wx / 100) * 17.3, Math.floor(wz / 100) * 31.7);
      const j   = (hash(wx * 0.09, wz * 0.09) - 0.5) * 0.05;

      if (h < -3) return [0.18, 0.15, 0.12];                   // fond océan
      if (h < 5)  return [0.64+j, 0.55+j*0.5, 0.34];          // plage sablonneuse
      if (steep > 1.05) return [0.44+j*0.3, 0.39, 0.30];       // falaise/roche
      if (h < 30) {
        if (px > 0.82) return [0.46+j, 0.62+j, 0.20+j];        // champ ouvert clair
        if (px < 0.18) return [0.20+j*0.5, 0.42+j*0.5, 0.11];  // bocage dense sombre
        return [0.28+j, 0.55+j*0.7, 0.18+j];                   // prairie normande
      }
      if (h < 80) {
        if (px > 0.76) return [0.34+j, 0.53+j, 0.17];
        return [0.22+j*0.5, 0.46+j*0.5, 0.14+j*0.3];
      }
      if (h < 130) return [0.28+j, 0.49+j*0.4, 0.17+j*0.3];
      return [0.36+j, 0.48+j*0.3, 0.22];                       // hauts plateaux
    };

    for (let z=0; z<=SEGS; z++) {
      for (let x=0; x<=SEGS; x++) {
        const i  = z*(SEGS+1)+x;
        const wx = (x/SEGS - 0.5) * SIZE;
        const wz = (z/SEGS - 0.5) * SIZE;
        const wy = ys[i];
        pos[i*3] = wx; pos[i*3+1] = wy; pos[i*3+2] = wz;
        const hR = x < SEGS ? ys[i+1] : wy;
        const hU = z < SEGS ? ys[i+(SEGS+1)] : wy;
        const steep = Math.sqrt(((hR-wy)/(SIZE/SEGS))**2 + ((hU-wy)/(SIZE/SEGS))**2);
        const [r,g,b] = hColor(wy, steep, wx, wz);
        col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b;
      }
    }
    for (let z=0; z<SEGS; z++) {
      for (let x=0; x<SEGS; x++) {
        const a = z*(SEGS+1)+x, b = a+1;
        const c = (z+1)*(SEGS+1)+x, d = c+1;
        idx.push(a,c,b, b,c,d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));

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

    // Mer — plane énorme sous tout le terrain
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(40000, 40000, 4, 4),
      new THREE.MeshPhongMaterial({
        color: 0x1a4a72, shininess: 60,
        specular: new THREE.Color(0x2266aa),
      })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -1;
    this.scene.add(ocean);
  }

  // ── Lacs ────────────────────────────────────────────────────────────────────
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

  // ── Pistes (identique à VillageMap) ─────────────────────────────────────────
  _buildAirportMeshes() {
    for (const ap of AIRPORTS) {
      const cos = Math.cos(ap.ang), sin = Math.sin(ap.ang);

      const platformH = 3.5;
      const platformTop = ap.h + 1.0;
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(ap.wid + 70, platformH, ap.len + 120),
        new THREE.MeshLambertMaterial({ color: 0x5a5650 })
      );
      platform.rotation.y = -ap.ang;
      platform.position.set(ap.x, platformTop - platformH / 2, ap.z);
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

  // ── Villages (identique à VillageMap) ───────────────────────────────────────
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
      if (g) groups[key] = g;
    }

    const dummy  = new THREE.Object3D();
    const counts = Object.fromEntries(Object.keys(paths).map(k => [k, 0]));
    // global inter-villages — évite les superpositions entre villages voisins
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

  // ── Arbres ──────────────────────────────────────────────────────────────────
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

    const dummy  = new THREE.Object3D();
    const placed = [0, 0, 0, 0];
    let attempts = 0;
    const TARGET = 3200;

    while (placed.reduce((a,b)=>a+b,0) < TARGET && attempts < TARGET * 12) {
      attempts++;
      const wx = rng(-SIZE * 0.47, SIZE * 0.47);
      const wz = rng(-SIZE * 0.47, SIZE * 0.47);
      const h  = this.getTerrainHeight(wx, wz);

      if (h < 6 || h > 160) continue;
      const hRt = this.getTerrainHeight(wx + 14, wz);
      const hUt = this.getTerrainHeight(wx, wz + 14);
      const steepT = Math.sqrt(((hRt-h)/14)**2 + ((hUt-h)/14)**2);
      if (steepT > 0.80) continue;
      if (this._nearVillageOrAirport(wx, wz, 90, 15)) continue;
      if (this._nearLake(wx, wz, 30)) continue;

      let ti;
      if (h < 50)       ti = Math.random() < 0.65 ? 0 : 1;
      else if (h < 110) ti = Math.floor(rng(0, 3));
      else              ti = 1 + Math.floor(rng(0, 2));

      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = rng(0.9, 2.1);
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
    return { groups, placed, dummy: new THREE.Object3D(), MAX };
  }

  async _buildVillageTrees({ groups, placed, MAX }) {
    const dummy = new THREE.Object3D();

    for (const v of VILLAGES) {
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

  // ── Roches ──────────────────────────────────────────────────────────────────
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

    const dummy  = new THREE.Object3D();
    const placed = new Array(paths.length).fill(0);
    let attempts = 0;
    const TARGET = 320;

    while (placed.reduce((a,b)=>a+b,0) < TARGET && attempts < 16000) {
      attempts++;
      const wx = rng(-SIZE * 0.46, SIZE * 0.46);
      const wz = rng(-SIZE * 0.46, SIZE * 0.46);
      const h  = this.getTerrainHeight(wx, wz);

      if (h < 15) continue;
      if (this._nearVillageOrAirport(wx, wz, 25, 30)) continue;

      const hR = this.getTerrainHeight(wx + 12, wz);
      const hU = this.getTerrainHeight(wx, wz + 12);
      const steep = Math.sqrt(((hR-h)/12)**2 + ((hU-h)/12)**2);
      if (steep > 2.0) continue;
      if (h < 80 && steep < 0.25 && Math.random() > 0.20) continue;

      const ti = Math.floor(rng(0, paths.length));
      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = h > 90 ? rng(0.5, 1.8) : rng(0.30, 1.0);
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

  // ── Buissons ────────────────────────────────────────────────────────────────
  async _buildBushes() {
    const paths = ['/Buissons/SM_Tree_Bush_A.glb', '/Buissons/SM_Tree_Bush_B.glb'];
    const MAX = 220;
    const gltfs = await Promise.all(paths.map(p => loadGLB(p).catch(() => null)));
    const groups = gltfs.map(g => g ? this._createInstancedGroup(g.scene, MAX, 'bush') : null);
    if (groups.every(g => !g)) return;

    const dummy  = new THREE.Object3D();
    const placed = [0, 0];
    let attempts = 0;

    while (placed[0] + placed[1] < 380 && attempts < 12000) {
      attempts++;
      const wx = rng(-SIZE * 0.46, SIZE * 0.46);
      const wz = rng(-SIZE * 0.46, SIZE * 0.46);
      const h  = this.getTerrainHeight(wx, wz);

      if (h < 5 || h > 160) continue;
      if (this._nearVillageOrAirport(wx, wz, 90, 20)) continue;
      if (this._nearLake(wx, wz, 20)) continue;

      const ti = Math.floor(rng(0, 2));
      const group = groups[ti];
      if (!group || placed[ti] >= MAX) continue;

      const scale = rng(1.0, 2.4);
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

  // ── Montgolfières — au-dessus de l'Angleterre + des 3 villages normands ─────
  async _buildBalloons() {
    const gltf = await loadGLB('/Montgolfières/Montgolfière.glb').catch(() => null);
    if (!gltf) return;

    const positions = [
      // Angleterre
      [ENG_CX,       8  + 340, ENG_CZ],
      [ENG_CX + 80,  8  + 260, ENG_CZ - 110],
      // Villages normands
      [VILLAGES[0].x,       VILLAGES[0].h + 350, VILLAGES[0].z],
      [VILLAGES[0].x +  80, VILLAGES[0].h + 275, VILLAGES[0].z - 100],
      [VILLAGES[1].x,       VILLAGES[1].h + 380, VILLAGES[1].z],
      [VILLAGES[1].x -  75, VILLAGES[1].h + 300, VILLAGES[1].z +  85],
      [VILLAGES[2].x,       VILLAGES[2].h + 360, VILLAGES[2].z],
      [VILLAGES[2].x + 100, VILLAGES[2].h + 280, VILLAGES[2].z -  70],
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

  _createInstancedGroup(modelScene, maxCount, category = '', lodRatios) {
    const lod = new InstancedLOD(this.scene, modelScene, maxCount, category, lodRatios);
    return lod.instances.length > 0 ? lod : null;
  }

  _nearVillageOrAirport(wx, wz, airportBuffer, villageBuffer = -1) {
    const vBuf = villageBuffer < 0 ? airportBuffer : villageBuffer;
    for (const v of VILLAGES) {
      if (Math.hypot(wx - v.x, wz - v.z) < v.outerR + vBuf) return true;
    }
    for (const ap of AIRPORTS) {
      const cos = Math.cos(-ap.ang), sin = Math.sin(-ap.ang);
      const lx = (wx - ap.x) * cos - (wz - ap.z) * sin;
      const lz = (wx - ap.x) * sin + (wz - ap.z) * cos;
      if (Math.abs(lx) < ap.wid/2 + airportBuffer && Math.abs(lz) < ap.len/2 + airportBuffer) return true;
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

  isOnRunway(wx, wz) { return this._nearAirport(wx, wz, 6); }

  _nearLake(wx, wz, margin) {
    for (const [lx, lz, lr] of LAKES) {
      if (Math.hypot(wx - lx, wz - lz) < lr + margin) return true;
    }
    return false;
  }
}

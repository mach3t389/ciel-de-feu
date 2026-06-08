import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CursorFX } from './CursorFX.js';
import { AudioManager } from './AudioManager.js';
import { t, tTips, tModeInfo, getLang, setLang } from './i18n.js';

// ── Scrollbar cockpit — injectée une seule fois ───────────────────────────────
(() => {
  const s = document.createElement('style');
  s.textContent = `
    .menu-panel::-webkit-scrollbar { width: 4px; }
    .menu-panel::-webkit-scrollbar-track { background: #0a0a06; border-left: 1px solid #2a2418; }
    .menu-panel::-webkit-scrollbar-thumb { background: #4a4030; border-radius: 2px; }
    .menu-panel::-webkit-scrollbar-thumb:hover { background: #7a6848; }
    .menu-panel { scrollbar-width: thin; scrollbar-color: #4a4030 #0a0a06; }
  `;
  document.head.appendChild(s);
})();

// ── Palette menu aviation militaire ──────────────────────────────────────────
const M = {
  bg      : '#080806',
  panel   : '#12110a',
  panelMid: '#1a180f',
  border  : '#3a3020',
  cream   : '#d4c88a',
  dimCream: '#7a7050',
  accent  : '#cc3300',
  accentDim:'#6a1a00',
  green   : '#22aa44',
  red     : '#cc2222',
  blue    : '#2255cc',
  yellow  : '#ccaa22',
};

const TEAM_COLORS = {
  rouge: { hex: '#cc2222', label: 'ROUGE', three: 0xcc2222, path: '/Avions/SK_Veh_Plane_Stunt_01_AvionRouge.glb' },
  bleu : { hex: '#2255cc', label: 'BLEU',  three: 0x2255cc, path: '/Avions/SK_Veh_Plane_Stunt_01_AvionBleu.glb'  },
  jaune: { hex: '#ccaa22', label: 'JAUNE', three: null,      path: '/Avions/SK_Veh_Plane_Stunt_01_AvionJaune.glb' },
  blanc: { hex: '#ffffff', label: 'BLANC', three: null,      path: '/Avions/SK_Veh_Plane_Stunt_01_AvionBlanc.glb' },
};

// ── Style focus global — navigation manette/clavier ────────────────────────
(() => {
  const s = document.createElement('style');
  s.textContent = `
    button:not(.choice-btn):focus-visible,
    button:not(.choice-btn):focus {
      outline: 2px solid #d4c88a !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 8px rgba(212,200,138,0.55) !important;
    }

    /* ── Boutons de choix (radio-like) — état piloté par data-active ── */
    .choice-btn {
      background: transparent;
      border: 2px solid var(--cb-border);
      color: var(--cb-color);
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      letter-spacing: 2px;
      padding: 6px 10px;
      flex: 1;
      cursor: pointer;
      outline: none;
      box-shadow: none;
      transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
    }
    .choice-btn:hover {
      background: var(--cb-hover);
    }
    /* focus manette/clavier : fond crème léger + bordure cream bien visible */
    .choice-btn:focus,
    .choice-btn:focus-visible {
      outline: none;
      border-color: #d4c88a !important;
      background: rgba(212,200,138,0.20) !important;
      box-shadow: inset 0 0 0 1px #d4c88a !important;
      z-index: 1;
      position: relative;
    }
    /* bouton actif focalisé : contour blanc pour distinguer actif+focus */
    .choice-btn[data-active="1"]:focus,
    .choice-btn[data-active="1"]:focus-visible {
      border-color: #ffffff !important;
      box-shadow: inset 0 0 0 1px #ffffff !important;
    }
    .choice-btn[data-active="1"] {
      background: var(--cb-fill);
      color: #080806;
      border-color: rgba(0,0,0,0.30);
    }
    .choice-btn[data-active="1"]:hover {
      background: var(--cb-fill);
    }
    .choice-btn[data-disabled="1"] {
      color: #3a3020 !important;
      border-color: #2a2418 !important;
      background: transparent !important;
      opacity: 0.45;
      cursor: default;
    }
    input:focus, input:focus-visible {
      outline: 2px solid #d4c88a !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 8px rgba(212,200,138,0.55) !important;
    }
  `;
  document.head.appendChild(s);
})();

const css = (el, props) => Object.assign(el.style, props);
const el = (tag, props = {}) => {
  const e = document.createElement(tag);
  if (props.style) css(e, props.style);
  if (props.text)  e.textContent = props.text;
  if (props.id)    e.id = props.id;
  if (props.placeholder) e.placeholder = props.placeholder;
  if (props.type)  e.type = props.type;
  return e;
};

const BASE = {
  position: 'fixed', inset: '0',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  background: '#5a8ab0',
  fontFamily: '"Courier New", Courier, monospace',
  color: M.cream,
  zIndex: '1000',
  overflow: 'hidden',
};

// Scanlines overlay
function buildScanlines() {
  const s = document.createElement('div');
  css(s, {
    position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1',
    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px)',
  });
  return s;
}

// Bouton style militaire
function mkBtn(label, color = M.cream) {
  const b = document.createElement('button');
  b.textContent = label;
  css(b, {
    background   : 'transparent',
    border       : `1px solid ${color}`,
    color,
    fontFamily   : '"Courier New", Courier, monospace',
    fontSize     : '14px',
    letterSpacing: '3px',
    padding      : '13px 24px',
    cursor       : 'pointer',
    textTransform: 'uppercase',
    transition   : 'background 0.15s, color 0.15s',
    width        : '100%',
    boxSizing    : 'border-box',
    whiteSpace   : 'nowrap',
    textAlign    : 'left',
  });
  const onActive   = () => css(b, { background: color, color: M.bg });
  const onInactive = () => css(b, { background: 'transparent', color });
  b.addEventListener('mouseover', onActive);
  b.addEventListener('mouseout',  onInactive);
  b.addEventListener('focus',     onActive);
  b.addEventListener('blur',      onInactive);
  return b;
}

// Titre section
function mkLabel(text) {
  const d = el('div', { text, style: { fontSize: '10px', letterSpacing: '3px', color: M.dimCream, marginBottom: '8px', textTransform: 'uppercase' }});
  return d;
}

// Panel cockpit centré — style uniforme pour tous les écrans
function mkPanel(width = '400px') {
  return el('div', { style: {
    position     : 'absolute', left: '50%', top: '50%',
    transform    : 'translate(-50%, -50%)',
    display      : 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '14px',
    zIndex       : '3', width,
    background   : 'rgba(6,8,4,0.84)',
    border       : '1px solid #3a3020',
    borderRadius : '3px',
    padding      : '28px 32px',
    boxShadow    : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
  }});
}

// Panel ancré à gauche — pour les écrans multijoueur
function mkPanelLeft(width = '400px') {
  const d = el('div', { style: {
    position     : 'absolute', left: '5%', top: '50%',
    transform    : 'translateY(-50%)',
    display      : 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px',
    zIndex       : '3', width,
    maxHeight    : '92vh', overflowY: 'auto',
    background   : 'rgba(6,8,4,0.88)',
    border       : '1px solid #3a3020',
    borderRadius : '3px',
    padding      : '28px 32px',
    boxShadow    : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
  }});
  d.classList.add('menu-panel');
  return d;
}

// En-tête de section avec lignes décoratives
function mkSectionTitle(text) {
  const wrap = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }});
  const line = () => el('div', { style: { flex: '1', height: '1px', background: M.border }});
  const star = el('div', { text: '✦', style: { color: M.accent, fontSize: '10px', flexShrink: '0' }});
  wrap.appendChild(line());
  wrap.appendChild(star);
  wrap.appendChild(el('div', { text, style: { color: M.cream, fontSize: '15px', fontWeight: 'bold', letterSpacing: '5px', flexShrink: '0' }}));
  wrap.appendChild(star.cloneNode(true));
  wrap.appendChild(line());
  return wrap;
}

// Divider
function mkDivider() {
  const d = el('div', { style: { width: '100%', height: '1px', background: M.border, margin: '8px 0' }});
  return d;
}

// Input texte
function mkInput(placeholder, value = '') {
  const i = el('input', { placeholder, type: 'text', style: {
    background  : M.panelMid,
    border      : `1px solid ${M.border}`,
    color       : M.cream,
    fontFamily  : '"Courier New", Courier, monospace',
    fontSize    : '13px',
    letterSpacing: '2px',
    padding     : '10px 12px',
    width       : '100%',
    boxSizing   : 'border-box',
    outline     : 'none',
    textTransform: 'uppercase',
  }});
  i.value = value;
  i.addEventListener('focus', () => css(i, { borderColor: M.cream }));
  i.addEventListener('blur',  () => css(i, { borderColor: M.border }));
  return i;
}

// Groupe de choix (radio-like) — état 100 % CSS via data-active + variables
function mkChoiceGroup(options, defaultVal, onChange) {
  const container = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }});
  let active = defaultVal;
  const btns = [];
  options.forEach(({ value, label, color, borderColor, disabled }) => {
    const b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = label;
    const col       = color || M.cream;
    const borderCol = borderColor || col;          // bordure explicite (ex. blanc) sinon couleur propre
    // Variables CSS consommées par les règles .choice-btn
    b.style.setProperty('--cb-color',  col);
    b.style.setProperty('--cb-border', borderCol);
    b.style.setProperty('--cb-fill',   col);
    b.style.setProperty('--cb-hover',  `${col}22`);
    if (disabled) b.setAttribute('data-disabled', '1');
    const setActive = () => b.setAttribute('data-active', value === active && !disabled ? '1' : '0');
    setActive();
    btns.push({ value, setActive });
    if (!disabled) {
      b.addEventListener('click', () => {
        if (active === value) return;              // déjà sélectionné → no-op (pas de re-trigger)
        active = value;
        btns.forEach(x => x.setActive());
        onChange(value);
      });
    }
    container.appendChild(b);
  });
  // API programmatique : permet de synchroniser l'état actif depuis l'extérieur
  container.setValue = (v) => { active = v; btns.forEach(x => x.setActive()); };
  return container;
}

// Logo vintage militaire français
function buildLogo() {
  const wrap = el('div', { style: { textAlign: 'left', marginBottom: '28px' }});

  // Ligne décorative supérieure
  const topBar = el('div', { style: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
  }});
  const mkLine = (w) => {
    const d = el('div', { style: { height: '1px', background: M.border, flex: w ? '0 0 ' + w : '1' }});
    return d;
  };
  const star = el('div', { text: '✦', style: { color: M.accent, fontSize: '11px', opacity: '0.8' }});
  topBar.appendChild(mkLine('32px'));
  topBar.appendChild(star);
  topBar.appendChild(mkLine());
  wrap.appendChild(topBar);

  // Titre principal
  const title = el('div', { style: {
    fontSize   : '38px',
    fontWeight : 'bold',
    letterSpacing: '10px',
    color      : M.cream,
    lineHeight : '1',
    textTransform: 'uppercase',
    textShadow : `0 0 40px rgba(212,200,138,0.25), 2px 2px 0px rgba(0,0,0,0.8)`,
  }});
  title.textContent = 'CIEL DE FEU';
  wrap.appendChild(title);

  // Ligne intermédiaire avec silhouette avion
  const midRow = el('div', { style: {
    display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', marginBottom: '6px',
  }});
  midRow.appendChild(mkLine('12px'));
  const plane = el('div', { text: '✈', style: { color: M.accent, fontSize: '13px', transform: 'scaleX(-1)' }});
  midRow.appendChild(plane);
  midRow.appendChild(mkLine());
  wrap.appendChild(midRow);

  // Sous-titre
  const sub = el('div', { style: {
    display: 'flex', alignItems: 'center', gap: '12px',
  }});
  sub.appendChild(el('div', { text: '◆', style: { color: M.accent, fontSize: '7px', opacity: '0.7' }}));
  sub.appendChild(el('div', { text: t('squadron'), style: {
    color: M.dimCream, fontSize: '10px', letterSpacing: '5px',
  }}));
  sub.appendChild(el('div', { text: '◆', style: { color: M.accent, fontSize: '7px', opacity: '0.7' }}));
  wrap.appendChild(sub);

  // Tagline
  wrap.appendChild(el('div', { text: t('tagline'), style: {
    color        : M.cream,
    fontSize     : '10px',
    fontWeight   : 'bold',
    letterSpacing: '3px',
    fontFamily   : '"Courier New", Courier, monospace',
    marginTop    : '12px',
    opacity      : '0.7',
  }}));

  return wrap;
}

export class Menu {
  constructor() {
    this._root = el('div', { style: BASE });
    this._root.appendChild(buildScanlines());
    document.body.appendChild(this._root);
    this._config = {
      mode        : 'solo',
      map         : 4,
      team        : 'jaune',
      pilotName   : localStorage.getItem('pilotName') || '',
      maxPlayers  : 4,
      difficulty  : 'standard',
      totalEnemies: 30,
    };
    this._preview = null;
    this._cursor  = new CursorFX();
    this._cursor.start();
    this._init3DPreview();
  }

  // Point d'entrée → retourne une Promise résolue avec la config finale
  show() {
    return new Promise(resolve => {
      this._resolve = resolve;
      // Libérer le pointer lock résiduel (chrome affiche "appuyez sur Echap" sinon)
      if (document.pointerLockElement) document.exitPointerLock();
      if (!this._audio) {
        this._audio = new AudioManager();
        this._audio.init();
        this._audio.startMenuMusic();
        // Si le navigateur suspend le contexte (autoplay bloqué), on le reprend au premier geste
        if (this._audio._ctx?.state === 'suspended') {
          const resume = () => {
            this._audio._ctx?.resume();
            document.removeEventListener('pointerdown', resume);
            document.removeEventListener('keydown', resume);
          };
          document.addEventListener('pointerdown', resume, { once: true });
          document.addEventListener('keydown',     resume, { once: true });
        }
      }
      this._showMain();
      this._startGamepadNav();
    });
  }

  hide() {
    this._stopPreview();
    this._stopGamepadNav();
    this._cursor.stop();
    this._audio?.stopMenuMusic();
    this._root.remove();
  }

  // ── Prévisualisation 3D de l'avion ─────────────────────────────────────────
  _init3DPreview() {
    const canvas = document.createElement('canvas');
    css(canvas, {
      position     : 'absolute',
      inset        : '0',
      width        : '100%',
      height       : '100%',
      pointerEvents: 'none',
      zIndex       : '0',
      opacity      : '0',
      transition   : 'opacity 0.8s ease',
    });
    this._root.appendChild(canvas);
    this._previewCanvas = canvas;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ab8d8);
    scene.fog = new THREE.Fog(0xadd4f0, 18, 55);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 1.8, 7.2);
    camera.lookAt(-1.8, -0.5, 0);

    // Lumières de ciel lumineux
    const ambient  = new THREE.AmbientLight(0xd8eaff, 2.8);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 4.5);
    sun.position.set(5, 8, 4);
    scene.add(sun);

    const skyLight = new THREE.DirectionalLight(0x90c8f0, 1.8);
    skyLight.position.set(-4, 6, 2);
    scene.add(skyLight);

    const rimLight = new THREE.DirectionalLight(0xffa040, 1.4);
    rimLight.position.set(-3, 0.5, -5);
    scene.add(rimLight);

    // Nuages
    this._buildMenuClouds(scene);

    // État souris + zoom caméra
    this._camOrbit        = { x: 0, y: 0 };
    this._camTarget       = { x: 0, y: 0 };
    this._camRadius       = 7.2;   // rayon courant (lerpé)
    this._camRadiusTarget = 7.2;   // rayon cible
    this._camLookX        = -1.8;  // décalage lookAt X courant
    this._camLookXTarget  = -1.8;  // décalage lookAt X cible

    this._mouseMoveHandler = (e) => {
      this._camTarget.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      this._camTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', this._mouseMoveHandler);

    // Chargement du modèle
    let propBone = null, aileronL = null, aileronR = null, modelRoot = null;

    const loadPreviewModel = (path) => {
      if (modelRoot) { scene.remove(modelRoot); modelRoot = null; propBone = null; aileronL = null; aileronR = null; }
      new GLTFLoader().load(path, (gltf) => {
        modelRoot = gltf.scene;
        const box = new THREE.Box3().setFromObject(modelRoot);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const sc = maxDim > 0 ? 3.2 / maxDim : 1;
        modelRoot.scale.setScalar(sc);
        modelRoot.rotation.y = -0.28;
        const center = new THREE.Vector3();
        box.getCenter(center);
        modelRoot.position.set(-center.x * sc, -center.y * sc + 0.1, -center.z * sc);
        modelRoot.traverse(n => {
          if (n.name === 'SK_Veh_Plane_Stunt_01_Crop_Duster') {
            n.visible = false;
            n.traverse(c => { c.visible = false; });
          }
        });
        modelRoot.traverse(n => {
          if (n.isBone) {
            if (n.name.includes('Prop'))       propBone = n;
            if (n.name.includes('Flap_fl_01')) aileronL = n;
            if (n.name.includes('Flap_fr_01')) aileronR = n;
          }
        });
        scene.add(modelRoot);
        canvas.style.opacity = '1';
      });
    };

    this._loadPreviewModel = loadPreviewModel;
    loadPreviewModel(TEAM_COLORS[this._config.team]?.path || '/Avions/SK_Veh_Plane_Stunt_01_AvionJaune.glb');

    // ── Boucle de rendu ──────────────────────────────────────────────────────
    let animId = null;
    let t = 0;

    const loop = () => {
      animId = requestAnimationFrame(loop);
      t += 0.016;

      const lerpF = 0.025;
      this._camOrbit.x  += (this._camTarget.x      - this._camOrbit.x)  * lerpF;
      this._camOrbit.y  += (this._camTarget.y      - this._camOrbit.y)  * lerpF;
      this._camRadius   += (this._camRadiusTarget  - this._camRadius)   * lerpF;
      this._camLookX    += (this._camLookXTarget   - this._camLookX)    * lerpF;

      const orbitH = this._camOrbit.x * (Math.PI / 10);
      const orbitV = this._camOrbit.y * (Math.PI / 22);
      const r      = this._camRadius;
      const BASE_Y = 1.8 + (7.2 - r) * 0.08;
      camera.position.set(Math.sin(orbitH) * r, BASE_Y - orbitV * 2.2, Math.cos(orbitH) * r);
      camera.lookAt(this._camLookX, -0.5, 0);

      if (modelRoot) {
        modelRoot.rotation.z = Math.sin(t * 0.31) * 0.018;
        modelRoot.rotation.x = Math.sin(t * 0.19) * 0.012 + Math.sin(t * 0.47) * 0.008;
      }
      if (propBone) propBone.rotation.y += 0.42;
      if (aileronL) aileronL.rotation.z =  Math.sin(t * 0.27) * 0.05;
      if (aileronR) aileronR.rotation.z = -Math.sin(t * 0.27) * 0.05;

      this._updateMenuClouds(t, this._camOrbit.x, this._camOrbit.y);

      renderer.render(scene, camera);
    };
    loop();

    this._preview = { renderer, scene, camera, stopFn: () => { if (animId) cancelAnimationFrame(animId); } };

    this._resizeHandler = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  _buildMenuClouds(scene) {
    this._menuClouds = [];
    const rng = (a, b) => a + Math.random() * (b - a);

    // Trois couches : proches rapides, moyens, lointains lents
    const layers = [
      { count: 4, zMin: -2.5, zMax: -5,   sizeMin: 0.9, sizeMax: 2.2, blobMin: 5, blobMax: 10, driftMin: 0.40, driftMax: 0.75, spread: 18 },
      { count: 6, zMin: -6,   zMax: -14,  sizeMin: 0.6, sizeMax: 1.5, blobMin: 4, blobMax:  8, driftMin: 0.16, driftMax: 0.35, spread: 26 },
      { count: 8, zMin: -16,  zMax: -34,  sizeMin: 0.3, sizeMax: 0.9, blobMin: 3, blobMax:  7, driftMin: 0.05, driftMax: 0.14, spread: 40 },
    ];

    // Bandes verticales : 60 % au-dessus de l'avion, 40 % en dessous — jamais au niveau de l'avion
    const pickY = () => Math.random() < 0.6 ? rng(1.3, 5.5) : rng(-4.5, -1.2);

    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        const group  = new THREE.Group();
        const baseX  = rng(-layer.spread, layer.spread);
        const baseY  = pickY();
        const baseZ  = rng(layer.zMin, layer.zMax);
        group.position.set(baseX, baseY, baseZ);

        const blobCount = Math.floor(rng(layer.blobMin, layer.blobMax));
        for (let j = 0; j < blobCount; j++) {
          const r   = rng(layer.sizeMin, layer.sizeMax);
          const geo = new THREE.IcosahedronGeometry(r, 1);
          const mat = new THREE.MeshLambertMaterial({
            color      : new THREE.Color().setHSL(0.58, 0.05, rng(0.86, 0.97)),
            transparent: true,
            opacity    : rng(0.55, 0.85),
            flatShading: true,
            depthWrite : false,
          });
          const mesh = new THREE.Mesh(geo, mat);
          const spread = r * 1.8;
          mesh.position.set(rng(-spread, spread), rng(-r * 0.5, r * 0.5), rng(-spread * 0.7, spread * 0.7));
          group.add(mesh);
        }
        scene.add(group);
        this._menuClouds.push({
          group,
          baseX, baseY, baseZ,
          drift : rng(layer.driftMin, layer.driftMax),
          phase : rng(0, Math.PI * 2),
          spread: layer.spread,
        });
      }
    });
  }

  _updateMenuClouds(t, mouseX, mouseY) {
    if (!this._menuClouds) return;
    this._menuClouds.forEach((c) => {
      const span  = c.spread * 2;
      // Dérive vers la droite en boucle continue
      const driftX = ((c.baseX + t * c.drift + c.spread) % span) - c.spread;
      // Parallaxe : les nuages proches (z proche de 0) bougent BEAUCOUP avec la souris
      const depth = Math.abs(c.baseZ) + 1;
      const px    = -mouseX * (2.5 / depth) * 4;
      const py    =  mouseY * (1.2 / depth) * 2;
      c.group.position.x = driftX + px;
      c.group.position.y = c.baseY + Math.sin(t * 0.18 + c.phase) * 0.14 + py;
    });
  }

  _showPreview(zoom = 'normal') {
    if (this._previewCanvas) this._previewCanvas.style.opacity = '1';
    if (zoom === 'close') {
      this._camRadiusTarget = 4.2;
      this._camLookXTarget  = -0.4; // légèrement à gauche pour l'accueil
    } else if (zoom === 'settings') {
      this._camRadiusTarget = 4.2;  // même taille que l'accueil
      this._camLookXTarget  = -1.6; // décalé vers la droite (panneau large à gauche)
    } else {
      this._camRadiusTarget = 7.2;
      this._camLookXTarget  = -3.0; // légèrement à droite pour les sous-menus
    }
  }

  _hidePreview() {
    if (this._previewCanvas) this._previewCanvas.style.opacity = '0';
  }

  _stopPreview() {
    if (this._preview) this._preview.stopFn();
    window.removeEventListener('mousemove', this._mouseMoveHandler);
    window.removeEventListener('resize',    this._resizeHandler);
  }

  // ── Écran principal ─────────────────────────────────────────────────────────
  _showMain() {
    this._clear();
    this._showPreview('close');

    // ── Bouton FR / EN — haut droite ────────────────────────────────────────
    const langBtn = el('button', { style: {
      position     : 'absolute', top: '18px', right: '20px',
      background   : 'rgba(6,8,4,0.70)',
      border       : `1px solid ${M.cream}`,
      color        : M.cream,
      fontFamily   : '"Courier New", Courier, monospace',
      fontSize     : '13px',
      letterSpacing: '3px',
      padding      : '10px 20px',
      cursor       : 'pointer',
      transition   : 'background 0.15s, color 0.15s',
      zIndex       : '5',
    }});
    const curLang = getLang();
    langBtn.textContent = curLang === 'fr' ? 'EN' : 'FR';
    langBtn.title = curLang === 'fr' ? 'Switch to English' : 'Passer en français';
    langBtn.addEventListener('click', () => {
      setLang(curLang === 'fr' ? 'en' : 'fr');
      this._showMain();
    });
    langBtn.addEventListener('mouseover', () => { langBtn.style.background = M.cream; langBtn.style.color = M.bg; });
    langBtn.addEventListener('mouseout',  () => { langBtn.style.background = 'rgba(6,8,4,0.70)'; langBtn.style.color = M.cream; });
    this._root.appendChild(langBtn);

    // Panel cockpit — encadré dark style jeu, ancré à gauche
    const panel = el('div', { style: {
      position      : 'absolute',
      left          : '5%',
      top           : '50%',
      transform     : 'translateY(-50%)',
      display       : 'flex',
      flexDirection : 'column',
      alignItems    : 'stretch',
      gap           : '10px',
      zIndex        : '3',
      width         : '340px',
      background    : 'rgba(6,8,4,0.84)',
      border        : '1px solid #3a3020',
      borderRadius  : '3px',
      padding       : '28px 32px',
      boxShadow     : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
    }});

    panel.appendChild(buildLogo());

    const btnSolo     = mkBtn(t('solo'),     M.cream);
    const btnMulti    = mkBtn(t('multi'),    M.cream);
    const btnSettings = mkBtn(t('settings'), M.dimCream);

    btnSolo.addEventListener('click',     () => this._showSolo());
    btnMulti.addEventListener('click',    () => this._showMultiplayer());
    btnSettings.addEventListener('click', () => this._showSettings());

    [btnSolo, btnMulti, mkDivider(), btnSettings].forEach(b => panel.appendChild(b));
    this._root.appendChild(panel);

    // Crédit bas-droite
    const nameRight = el('div', { text: t('credit'), style: {
      position     : 'absolute', bottom: '22px', right: '5%',
      color        : '#000000', fontSize: '9px', letterSpacing: '3px',
      zIndex       : '3', opacity: '0.8',
    }});
    this._root.appendChild(nameRight);

    // ── Panneau ASTUCES ──────────────────────────────────────────────────────
    const TIPS = tTips();

    let tipIdx = 0;
    let tipTimer = null;

    const tipIcon = el('div', { style: { fontSize: '16px', marginBottom: '4px', textAlign: 'center', opacity: '0.8' }});
    const tipText = el('div', { style: {
      fontSize: '10px', color: '#2a2820', letterSpacing: '1px', lineHeight: '1.7',
      textAlign: 'center', minHeight: '34px',
    }});
    const tipDots = el('div', { style: { display: 'flex', gap: '5px', justifyContent: 'center', marginTop: '6px' }});

    const tipDotActive   = '#3a3020';
    const tipDotInactive = 'rgba(58,48,32,0.28)';

    const dots = TIPS.map(() => {
      const d = el('div', { style: {
        width: '4px', height: '4px', borderRadius: '50%',
        background: tipDotInactive, transition: 'background 0.2s',
      }});
      tipDots.appendChild(d);
      return d;
    });

    const showTip = (idx) => {
      tipIdx = ((idx % TIPS.length) + TIPS.length) % TIPS.length;
      tipIcon.textContent = TIPS[tipIdx].icon;
      tipText.textContent = TIPS[tipIdx].text;
      dots.forEach((d, i) => { d.style.background = i === tipIdx ? tipDotActive : tipDotInactive; });
    };

    const mkArrow = (label, dir) => {
      const btn = el('div', { text: label, style: {
        color: '#9a8c60', fontSize: '13px', cursor: 'pointer',
        padding: '0 6px', userSelect: 'none', transition: 'color 0.15s',
      }});
      btn.addEventListener('mouseover', () => btn.style.color = '#4a4030');
      btn.addEventListener('mouseout',  () => btn.style.color = '#9a8c60');
      btn.addEventListener('click', () => { showTip(tipIdx + dir); resetTimer(); });
      return btn;
    };

    const nav = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }});
    nav.appendChild(mkArrow('‹', -1));
    nav.appendChild(tipDots);
    nav.appendChild(mkArrow('›', +1));

    // Panel couleurs inversées — fond clair, texte sombre — moins dominant que le panel de gauche
    const tipPanel = el('div', { style: {
      position    : 'absolute', bottom: '56px',
      left        : '50%', transform: 'translateX(-50%)',
      width       : '440px',
      background  : 'rgba(212,200,138,0.18)',
      border      : '1px solid rgba(212,200,138,0.30)',
      borderRadius: '3px',
      padding     : '14px 24px',
      zIndex      : '3',
      backdropFilter: 'blur(2px)',
    }});

    const tipTitle = el('div', { style: {
      fontSize: '7px', letterSpacing: '3px', color: '#7a6e4a',
      textAlign: 'center', marginBottom: '8px',
    }});
    tipTitle.textContent = t('tipsTitle');

    tipPanel.appendChild(tipTitle);
    tipPanel.appendChild(tipIcon);
    tipPanel.appendChild(tipText);
    tipPanel.appendChild(nav);
    this._root.appendChild(tipPanel);

    showTip(0);

    const resetTimer = () => {
      clearInterval(tipTimer);
      tipTimer = setInterval(() => showTip(tipIdx + 1), 6000);
    };
    resetTimer();

    // Nettoyage du timer quand on quitte l'écran principal
    const origClear = this._clear.bind(this);
    this._clear = () => { clearInterval(tipTimer); this._clear = origClear; origClear(); };

    // Version bas-gauche
    const ver = el('div', { text: 'v0.2 — ALPHA', style: {
      position     : 'absolute', bottom: '22px', left: '5%',
      color        : '#000000', fontSize: '9px', letterSpacing: '3px',
      zIndex       : '3', opacity: '0.8',
    }});
    this._root.appendChild(ver);

  }

  // ── Sous-menu Solo ──────────────────────────────────────────────────────────
  _showSolo() {
    this._clear();
    this._showPreview('close');
    const wrap = mkPanelLeft('340px');
    wrap.appendChild(mkSectionTitle(t('solo')));
    wrap.appendChild(mkDivider());

    const modes = [
      { label: t('training'), desc: t('trainingDesc'), mode: 'freeflight' },
      { label: t('mission'),  desc: t('missionDesc'),  mode: 'solo'       },
      { label: t('survival'), desc: t('survivalDesc'), mode: 'survival'   },
    ];

    modes.forEach(({ label, desc, mode }) => {
      const btn = mkBtn(label, M.cream);
      const sub = el('div', { text: desc, style: {
        fontSize: '8px', color: M.dimCream, letterSpacing: '1px',
        marginTop: '-6px', marginBottom: '4px', paddingLeft: '2px',
      }});
      btn.addEventListener('click', () => {
        this._config.mode = mode;
        this._showConfig();
      });
      wrap.appendChild(btn);
      wrap.appendChild(sub);
    });

    wrap.appendChild(mkDivider());
    const btnBack = mkBtn(t('back'), M.dimCream);
    btnBack.addEventListener('click', () => this._showMain());
    wrap.appendChild(btnBack);
    this._root.appendChild(wrap);
  }

  // ── Configuration de partie ─────────────────────────────────────────────────
  _showConfig() {
    this._clear();
    this._showPreview();

    const modeLabels = { freeflight: t('training'), solo: t('mission'), coop: t('mMission'), multiplayer: t('multi') + ' PvP', survival: t('survival') };
    const hasEnemies   = this._config.mode !== 'freeflight';
    const showEnemyCnt = hasEnemies && this._config.mode !== 'survival';
    const hasPlayers   = this._config.mode === 'coop' || this._config.mode === 'multiplayer';

    // Panel gauche — avion preview visible à droite
    const wrap = el('div', { style: {
      position     : 'absolute', left: '5%', top: '50%',
      transform    : 'translateY(-50%)',
      display      : 'flex', flexDirection: 'column', gap: '10px',
      zIndex       : '3', width: '700px',
      background   : 'rgba(6,8,4,0.84)',
      border       : '1px solid #3a3020',
      borderRadius : '3px',
      padding      : '16px 28px',
      boxShadow    : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
    }});

    wrap.appendChild(mkSectionTitle(modeLabels[this._config.mode]));
    wrap.appendChild(mkDivider());

    // Corps : colonne gauche + séparateur + colonne droite (carte)
    const body = el('div', { style: { display: 'flex', gap: '32px', alignItems: 'flex-start' }});

    // ── Colonne gauche ───────────────────────────────────────────────────────
    const colL = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }});

    colL.appendChild(mkLabel(t('pilotName')));
    const nameInput = mkInput(t('pilotPlaceh'), this._config.pilotName);
    nameInput.addEventListener('input', () => {
      this._config.pilotName = nameInput.value.toUpperCase().slice(0, 12);
    });
    colL.appendChild(nameInput);
    colL.appendChild(mkDivider());

    colL.appendChild(mkLabel(t('plane')));
    colL.appendChild(mkChoiceGroup(
      Object.entries(TEAM_COLORS).map(([k, v]) => ({ value: k, label: t('color_' + k), color: v.hex, borderColor: v.borderHex })),
      this._config.team,
      v => {
        this._config.team = v;
        if (this._loadPreviewModel && TEAM_COLORS[v]?.path) {
          this._loadPreviewModel(TEAM_COLORS[v].path);
        }
      }
    ));

    if (hasPlayers) {
      colL.appendChild(mkDivider());
      colL.appendChild(mkLabel(t('maxPlayers')));
      colL.appendChild(mkChoiceGroup(
        [2, 4, 8, 16].map(n => ({ value: n, label: String(n) })),
        this._config.maxPlayers,
        v => this._config.maxPlayers = v
      ));
    }

    if (hasEnemies) {
      colL.appendChild(mkDivider());
      colL.appendChild(mkLabel(t('difficulty')));
      const DIFF_LABELS = {
        easy    : t('easyDesc'),
        standard: t('standardDesc'),
        hard    : t('hardDesc'),
      };
      const diffDesc = el('div', { style: { fontSize: '9px', letterSpacing: '2px', color: M.dimCream, marginTop: '2px' }});
      diffDesc.textContent = DIFF_LABELS[this._config.difficulty];
      colL.appendChild(mkChoiceGroup(
        [
          { value: 'easy',     label: t('easy'),     color: '#44aa44' },
          { value: 'standard', label: t('standard'), color: M.cream  },
          { value: 'hard',     label: t('hard'),     color: '#cc4422' },
        ],
        this._config.difficulty,
        v => { this._config.difficulty = v; diffDesc.textContent = DIFF_LABELS[v]; }
      ));
      colL.appendChild(diffDesc);

      if (showEnemyCnt) {
      colL.appendChild(mkDivider());
      colL.appendChild(mkLabel(t('enemyCount')));
      colL.appendChild(mkChoiceGroup(
        [
          { value: 20, label: '20' },
          { value: 30, label: '30' },
          { value: 40, label: '40' },
          { value: 60, label: '60' },
        ],
        this._config.totalEnemies,
        v => { this._config.totalEnemies = v; }
      ));
      }
      const waveNote = el('div', { style: { fontSize: '8px', letterSpacing: '2px', color: '#5a5440', marginTop: '2px' }});
      waveNote.textContent = t('waveNote');
      colL.appendChild(waveNote);
    }

    // ── Colonne droite : carte ───────────────────────────────────────────────
    const colR = el('div', { style: { width: '290px', flexShrink: '0', display: 'flex', flexDirection: 'column', gap: '8px' }});
    colR.appendChild(mkLabel(t('map')));
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = 290; mapCanvas.height = 200;
    Object.assign(mapCanvas.style, { display: 'block', border: `1px solid ${M.border}` });
    this._drawMapPreview(mapCanvas, this._config.map);
    // Conteneur stats contextuel (rechargé si la carte change)
    const statsContainer = el('div');
    const refreshStats = () => {
      statsContainer.innerHTML = '';
      const built = this._buildContextualStats(this._config.mode, this._config.map);
      if (built) statsContainer.appendChild(built);
    };

    colR.appendChild(mkChoiceGroup(
      [{ value: 4, label: t('mapShort_4') }, { value: 5, label: t('mapShort_5') }, { value: 1, label: t('mapShort_1') }],
      this._config.map,
      v => { this._config.map = v; this._drawMapPreview(mapCanvas, v); refreshStats(); }
    ));
    colR.appendChild(mapCanvas);

    // ── Stats contextuelles par mode + carte ─────────────────────────────────
    refreshStats();
    colR.appendChild(statsContainer);

    body.appendChild(colL);
    body.appendChild(el('div', { style: { width: '1px', background: M.border, alignSelf: 'stretch' }}));
    body.appendChild(colR);
    wrap.appendChild(body);

    // ── Boutons bas ──────────────────────────────────────────────────────────
    wrap.appendChild(mkDivider());
    const btnRow = el('div', { style: { display: 'flex', gap: '12px' }});
    const btnBack  = mkBtn(t('back'),    M.dimCream);
    const btnStart = mkBtn(t('takeoff'), M.accent);
    btnStart.style.fontWeight = 'bold';
    btnBack.addEventListener('click',  () => this._showSolo());
    btnStart.addEventListener('click', () => {
      if (!this._config.pilotName.trim()) {
        nameInput.style.borderColor = M.red;
        nameInput.placeholder = t('pilotPlaceh');
        nameInput.focus();
        return;
      }
      localStorage.setItem('pilotName', this._config.pilotName);
      this._resolve(this._config);
      this.hide();
    });
    btnRow.appendChild(btnBack);
    btnRow.appendChild(btnStart);
    wrap.appendChild(btnRow);

    this._root.appendChild(wrap);
  }

  // ── Écran multijoueur ───────────────────────────────────────────────────────
  _showMultiplayer() {
    this._clear();
    this._showPreview('close');
    const wrap = mkPanelLeft('360px');
    wrap.appendChild(mkSectionTitle(t('multi')));
    wrap.appendChild(mkDivider());

    const btnHost = mkBtn(t('host'), M.cream);
    const btnJoin = mkBtn(t('join'), M.cream);
    const btnBack = mkBtn(t('back'), M.dimCream);

    btnHost.addEventListener('click', () => this._showHost());
    btnJoin.addEventListener('click', () => this._showJoin());
    btnBack.addEventListener('click', () => this._showMain());

    [btnHost, btnJoin, mkDivider(), btnBack].forEach(b => wrap.appendChild(b));
    this._root.appendChild(wrap);
  }

  // ── Héberger ───────────────────────────────────────────────────────────────
  _showHost() {
    this._clear();
    this._showPreview('close');
    const wrap = mkPanelLeft('380px');
    wrap.appendChild(mkSectionTitle(t('host')));
    wrap.appendChild(mkDivider());

    const code = this._generateRoomCode();

    wrap.appendChild(mkLabel(t('joinCode')));
    const codeRow = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }});
    const codeDisplay = el('div', { text: code, style: {
      flex: '1', fontSize: '30px', letterSpacing: '12px', color: M.cream,
      border: `1px solid ${M.border}`, padding: '10px 12px',
      background: M.panelMid, textAlign: 'center',
    }});
    const btnCopy = el('button', { text: '⎘', style: {
      background: M.panelMid, border: `1px solid ${M.border}`, color: M.cream,
      fontSize: '18px', padding: '10px 14px', cursor: 'pointer', flexShrink: '0',
    }});
    btnCopy.title = t('copyCode');
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        btnCopy.textContent = '✓';
        setTimeout(() => { btnCopy.textContent = '⎘'; }, 1500);
      });
    });
    codeRow.appendChild(codeDisplay);
    codeRow.appendChild(btnCopy);
    wrap.appendChild(codeRow);
    wrap.appendChild(mkDivider());

    wrap.appendChild(mkLabel(t('pilotName')));
    const nameInput = mkInput(t('pilotPlaceh'), this._config.pilotName);
    nameInput.addEventListener('input', () => {
      this._config.pilotName = nameInput.value.toUpperCase().slice(0, 12);
      nameErrHost.textContent = '';
    });
    wrap.appendChild(nameInput);
    const nameErrHost = el('div', { text: '', style: { color: M.red, fontSize: '10px', letterSpacing: '2px', minHeight: '14px' }});
    wrap.appendChild(nameErrHost);
    wrap.appendChild(mkDivider());

    const btnLobby = mkBtn(t('openLobby'), M.accent);
    const btnBack  = mkBtn(t('back'),      M.dimCream);

    btnLobby.addEventListener('click', () => {
      if (!this._config.pilotName.trim()) { nameErrHost.textContent = t('nameRequired'); return; }
      localStorage.setItem('pilotName', this._config.pilotName);
      this._config.isHost   = true;
      this._config.roomCode = code;
      if (!['coop','multiplayer'].includes(this._config.mode)) this._config.mode = 'coop';
      this._showLobby();
    });
    btnBack.addEventListener('click', () => this._showMultiplayer());

    wrap.appendChild(btnLobby);
    wrap.appendChild(btnBack);
    this._root.appendChild(wrap);
  }

  // ── Rejoindre ──────────────────────────────────────────────────────────────
  _showJoin() {
    this._clear();
    this._showPreview('close');
    const wrap = mkPanelLeft('360px');
    wrap.appendChild(mkSectionTitle(t('join')));
    wrap.appendChild(mkDivider());

    wrap.appendChild(mkLabel(t('joinCode')));
    const codeInput = mkInput('XXXX', '');
    Object.assign(codeInput.style, { fontSize: '28px', letterSpacing: '12px', textAlign: 'center' });
    codeInput.maxLength = 4;
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    });
    wrap.appendChild(codeInput);
    wrap.appendChild(mkDivider());

    wrap.appendChild(mkLabel(t('pilotName')));
    const nameInput = mkInput(t('pilotPlaceh'), this._config.pilotName);
    nameInput.addEventListener('input', () => {
      this._config.pilotName = nameInput.value.toUpperCase().slice(0, 12);
      nameErrJoin.textContent = '';
    });
    wrap.appendChild(nameInput);
    const nameErrJoin = el('div', { text: '', style: { color: M.red, fontSize: '10px', letterSpacing: '2px', minHeight: '14px' }});
    wrap.appendChild(nameErrJoin);
    wrap.appendChild(mkDivider());

    // Couleur d'avion choisie dans le lobby (pas ici) — évite la redondance

    const errMsg = el('div', { text: '', style: { color: M.red, fontSize: '10px', letterSpacing: '2px', minHeight: '14px' }});
    wrap.appendChild(errMsg);

    const btnJoin = mkBtn(t('joinBtn'), M.accent);
    const btnBack = mkBtn(t('back'),   M.dimCream);

    btnJoin.addEventListener('click', () => {
      const code = codeInput.value.trim();
      if (!this._config.pilotName.trim()) { nameErrJoin.textContent = t('nameRequired'); return; }
      if (code.length !== 4) { errMsg.textContent = t('invalidCode'); return; }
      localStorage.setItem('pilotName', this._config.pilotName);
      this._config.isHost   = false;
      this._config.roomCode = code;
      this._showLobby();
    });
    btnBack.addEventListener('click', () => this._showMultiplayer());

    wrap.appendChild(btnJoin);
    wrap.appendChild(btnBack);
    this._root.appendChild(wrap);
  }

  // ── Lobby deux-colonnes ────────────────────────────────────────────────────
  _showLobby() {
    this._clear();
    this._showPreview();
    this._camLookXTarget = -4.4; // avion légèrement décalé à droite dans le lobby

    const isHost = this._config.isHost;
    const code   = this._config.roomCode || '????';

    // Réseau déclaré tôt (référencé dans les callbacks des groupes)
    let nm = null;

    // ── Panel gauche large — même ancrage que les autres menus ──
    const wrap = mkPanelLeft('980px');
    wrap.style.gap = '0';
    // Hauteur fixe pour permettre à la liste joueurs de s'étirer (flex: 1 sur playerSection)
    wrap.style.height    = '82vh';
    wrap.style.maxHeight = '82vh';
    wrap.style.overflowY = 'hidden';

    // Header
    const header = el('div', { style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px',
    }});
    header.appendChild(el('div', { text: t('lobby'), style: { fontSize: '15px', letterSpacing: '6px', color: M.cream }}));
    const codeWrap = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' }});
    codeWrap.appendChild(el('div', { text: `${t('roomCode')} ${code}`, style: { fontSize: '16px', letterSpacing: '8px', color: M.accent }}));
    const btnCopyCode = el('button', { text: '⎘', style: {
      background: 'transparent', border: `1px solid ${M.border}`, color: M.dimCream,
      fontSize: '14px', padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit',
    }});
    btnCopyCode.addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        btnCopyCode.textContent = '✓'; setTimeout(() => { btnCopyCode.textContent = '⎘'; }, 1500);
      });
    });
    codeWrap.appendChild(btnCopyCode);
    header.appendChild(codeWrap);
    wrap.appendChild(header);
    wrap.appendChild(el('div', { style: { height: '1px', background: M.border, marginBottom: '16px' }}));

    // ── Corps deux colonnes — flex: 1 pour que les colonnes s'étendent jusqu'en bas ──
    const body = el('div', { style: { display: 'flex', gap: '24px', alignItems: 'stretch', flex: '1', minHeight: '0' }});

    // Helpers
    const lbl = (txt) => el('div', { text: txt, style: {
      fontSize: '9px', letterSpacing: '3px', color: M.dimCream, marginTop: '12px', marginBottom: '5px',
    }});
    const divider = () => el('div', { style: { height: '1px', background: M.border, margin: '10px 0' }});

    // ── Colonne gauche : avion + config hôte ──
    const leftCol = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column' }});

    leftCol.appendChild(lbl(t('plane')));
    leftCol.appendChild(mkChoiceGroup(
      Object.entries(TEAM_COLORS).map(([k, v]) => ({ value: k, label: t('color_' + k), color: v.hex, borderColor: v.borderHex })),
      this._config.team,
      v => {
        this._config.team = v;
        self.team = v;
        renderPlayers();
        if (this._loadPreviewModel && TEAM_COLORS[v]?.path) this._loadPreviewModel(TEAM_COLORS[v].path);
        if (nm) nm.send('player_plane', { plane: v });
      }
    ));
    leftCol.appendChild(divider());

    leftCol.appendChild(lbl(t('gameMode')));

    // Bloc de description — hauteur fixe : 6 lignes × 9px × 1.65 + titre + padding
    const modeDesc = el('div', { style: {
      marginTop: '8px', marginBottom: '4px',
      padding: '8px 10px',
      background: 'rgba(212,200,138,0.06)',
      border: `1px solid rgba(212,200,138,0.15)`,
      borderRadius: '2px',
      fontSize: '9px',
      lineHeight: '1.65',
      color: M.dimCream,
      letterSpacing: '0.5px',
      height: '120px',        // fixe : ne change jamais de hauteur
      overflow: 'hidden',
      boxSizing: 'border-box',
    }});
    const renderModeDesc = (mode) => {
      const info = tModeInfo(mode);
      modeDesc.innerHTML =
        `<div style="color:${M.accent};font-size:8px;letter-spacing:2px;margin-bottom:4px;">${info.title}</div>` +
        info.lines.map(l => `<div>· ${l}</div>`).join('');
    };
    renderModeDesc(this._config.mode ?? 'coop');

    const modeGroup = mkChoiceGroup(
      [
        { value: 'freeflight', label: t('mTraining') },
        { value: 'coop',       label: t('mMission')  },
        { value: 'survival',   label: t('mSurvival') },
        { value: 'ffa',        label: t('mFFA')      },
        { value: 'tdm',        label: t('mTDM')      },
      ],
      this._config.mode ?? 'coop',
      v => {
        this._config.mode = v;
        renderModeDesc(v);
        teamSection.style.display      = v === 'tdm'  ? '' : 'none';
        diffSection.style.display       = (v === 'coop' || v === 'survival') ? '' : 'none';
        enemyCountSection.style.display = (v === 'coop') ? '' : 'none';
        timeLimitSection.style.display  = isCompetitive(v) ? '' : 'none';
        refreshLobbyStats();
        renderPlayers();
        if (nm) nm.send('config_update', { mode: v });
      }
    );
    if (!isHost) { modeGroup.style.pointerEvents = 'none'; modeGroup.style.opacity = '0.45'; }
    leftCol.appendChild(modeGroup);
    leftCol.appendChild(modeDesc);

    // Conteneur à hauteur fixe — évite le saut de layout quand on change de mode
    const optionsWrap = el('div', { style: { minHeight: '64px', position: 'relative' } });
    leftCol.appendChild(optionsWrap);

    // Sélecteur de difficulté IA — visible uniquement en mode MISSION/SURVIE (host only)
    const diffSection = el('div', { style: { display: ['coop','survival'].includes(this._config.mode ?? 'coop') ? '' : 'none' }});
    diffSection.appendChild(lbl(t('aiDiff')));
    const diffChoices = mkChoiceGroup(
      [
        { value: 'easy',     label: t('easy')     },
        { value: 'standard', label: t('standard') },
        { value: 'hard',     label: t('hard')     },
      ],
      this._config.difficulty ?? 'standard',
      v => {
        this._config.difficulty = v;
        if (nm) nm.send('config_update', { difficulty: v });
      }
    );
    if (!isHost) { diffChoices.style.pointerEvents = 'none'; diffChoices.style.opacity = '0.45'; }
    diffSection.appendChild(diffChoices);
    optionsWrap.appendChild(diffSection);

    // Nombre d'ennemis — mode Mission (coop) uniquement
    const enemyCountSection = el('div', { style: { display: this._config.mode === 'coop' ? '' : 'none' }});
    enemyCountSection.appendChild(lbl(t('enemyCount')));
    const enemyCountChoices = mkChoiceGroup(
      [{ value: 20, label: '20' }, { value: 30, label: '30' }, { value: 40, label: '40' }, { value: 60, label: '60' }],
      this._config.totalEnemies ?? 30,
      v => { this._config.totalEnemies = v; if (nm) nm.send('config_update', { totalEnemies: v }); }
    );
    if (!isHost) { enemyCountChoices.style.pointerEvents = 'none'; enemyCountChoices.style.opacity = '0.45'; }
    enemyCountSection.appendChild(enemyCountChoices);
    optionsWrap.appendChild(enemyCountSection);

    // Limite de temps — Versus (ffa) et Équipes (tdm) uniquement
    const isCompetitive = (m) => m === 'ffa' || m === 'tdm';
    const timeLimitSection = el('div', { style: { display: isCompetitive(this._config.mode ?? 'coop') ? '' : 'none' }});
    timeLimitSection.appendChild(lbl(t('ffaTimeLimit')));
    const timeGroup = mkChoiceGroup(
      [
        { value: 5,  label: t('ffaTime5')    },
        { value: 10, label: t('ffaTime10')   },
        { value: 15, label: t('ffaTime15')   },
        { value: 20, label: t('ffaTime20')   },
        { value: 0,  label: t('ffaTimeUnlim') },
      ],
      this._config.ffaTimeLimit ?? 10,
      v => { this._config.ffaTimeLimit = v; if (nm) nm.send('config_update', { ffaTimeLimit: v }); }
    );
    if (!isHost) { timeGroup.style.pointerEvents = 'none'; timeGroup.style.opacity = '0.45'; }
    timeLimitSection.appendChild(timeGroup);
    optionsWrap.appendChild(timeLimitSection);

    // Tir allié — dans colonne gauche, juste après options
    leftCol.appendChild(divider());
    leftCol.appendChild(lbl(t('friendlyFire')));
    const ffGroup = mkChoiceGroup(
      [{ value: false, label: t('disabled') }, { value: true, label: t('enabled') }],
      this._config.friendlyFire ?? false,
      v => { this._config.friendlyFire = v; if (nm) nm.send('config_update', { friendlyFire: v }); }
    );
    if (!isHost) { ffGroup.style.pointerEvents = 'none'; ffGroup.style.opacity = '0.45'; }
    leftCol.appendChild(ffGroup);

    if (!isHost) {
      leftCol.appendChild(el('div', { text: t('hostOnly'), style: {
        fontSize: '9px', letterSpacing: '1px', color: M.dimCream, marginTop: '10px', lineHeight: '1.6',
      }}));
    }

    body.appendChild(leftCol);

    // ── Colonne droite : joueurs (extensible) + carte + stats (collés en bas) ──
    const rightCol = el('div', { style: {
      width: '320px', flexShrink: '0',
      display: 'flex', flexDirection: 'column',
    }});

    // ── Section haute : équipe + liste des joueurs (prend tout l'espace dispo) ──
    const playerSection = el('div', { style: {
      flex: '1', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', minHeight: '0',
    }});

    // Sélecteur d'équipe (tdm uniquement)
    const teamSection = el('div', { style: { display: (this._config.mode === 'tdm') ? '' : 'none', flexShrink: '0' }});
    teamSection.appendChild(lbl(t('team')));
    teamSection.appendChild(mkChoiceGroup(
      [
        { value: 'team1', label: t('team1Label'), color: '#2266cc' },
        { value: 'team2', label: t('team2Label'), color: '#cc2222' },
      ],
      this._config.playerTeam ?? 'team1',
      v => {
        this._config.playerTeam = v;
        self.playerTeam = v;
        renderPlayers();
        if (nm) nm.send('player_team', { playerTeam: v });
      }
    ));
    playerSection.appendChild(teamSection);

    // Étiquette + liste joueurs — la liste s'étire pour remplir l'espace
    playerSection.appendChild(lbl(t('players')));
    const playerList = el('div', { style: {
      border: `1px solid ${M.border}`, background: M.panelMid,
      padding: '6px', overflowY: 'auto', flex: '1', minHeight: '60px',
    }});

    const self = {
      id: 'local', name: this._config.pilotName, team: this._config.team,
      playerTeam: this._config.playerTeam ?? 'team1', isReady: false, isHost,
    };
    const players = [self];

    const renderPlayers = () => {
      const isTDM = this._config.mode === 'tdm';
      playerList.innerHTML = '';
      players.forEach(p => {
        const row = el('div', { style: {
          display: 'flex', alignItems: 'center',
          padding: '6px 4px', borderBottom: `1px solid ${M.border}`, gap: '6px',
        }});
        row.appendChild(el('span', { text: p.isHost ? '★' : '·', style: { color: M.accent, fontSize: '12px', flexShrink: '0' }}));
        row.appendChild(el('span', { text: p.name, style: { color: M.cream, fontSize: '10px', letterSpacing: '1px', flex: '1', overflow: 'hidden' }}));
        if (isTDM) {
          const tCol = p.playerTeam === 'team2' ? '#cc2222' : '#2266cc';
          const tLbl = p.playerTeam === 'team2' ? t('team2Short') : t('team1Short');
          row.appendChild(el('span', { text: tLbl, style: { color: tCol, fontSize: '9px', flexShrink: '0' }}));
        } else {
          row.appendChild(el('span', { text: p.team ? t('color_' + p.team) : '—', style: { color: TEAM_COLORS[p.team]?.hex || M.dimCream, fontSize: '9px', flexShrink: '0' }}));
        }
        row.appendChild(el('span', { text: p.isReady ? '■' : '□', style: { color: p.isReady ? M.green : M.dimCream, fontSize: '12px', flexShrink: '0' }}));
        playerList.appendChild(row);
      });
    };
    renderPlayers();
    playerSection.appendChild(playerList);
    rightCol.appendChild(playerSection);

    // Statut de connexion (juste sous la liste, ne s'étire pas)
    const statusEl = el('div', { text: 'Connexion...', style: {
      color: M.dimCream, fontSize: '9px', letterSpacing: '1px',
      margin: '5px 0', flexShrink: '0',
    }});
    rightCol.appendChild(statusEl);

    // ── Section basse : carte + stats — collée en bas ────────────────────────
    this._config.maxPlayers = 8;
    const mapSection = el('div', { style: { flexShrink: '0' }});
    mapSection.appendChild(el('div', { style: { height: '1px', background: M.border, margin: '8px 0 4px' }}));
    mapSection.appendChild(lbl(t('map')));
    const mapGroup = mkChoiceGroup(
      [{ value: 4, label: t('mapShort_4') }, { value: 5, label: t('mapShort_5') }, { value: 1, label: t('mapShort_1') }],
      this._config.map ?? 4,
      v => { this._config.map = v; refreshLobbyStats(); if (nm) nm.send('config_update', { map: v }); }
    );
    if (!isHost) { mapGroup.style.pointerEvents = 'none'; mapGroup.style.opacity = '0.45'; }
    mapSection.appendChild(mapGroup);

    // Stats contextuelles (même logique que solo)
    const lobbyStatsContainer = el('div');
    const refreshLobbyStats = () => {
      lobbyStatsContainer.innerHTML = '';
      const built = this._buildContextualStats(this._config.mode, this._config.map ?? 4);
      if (built) lobbyStatsContainer.appendChild(built);
    };
    refreshLobbyStats();
    mapSection.appendChild(lobbyStatsContainer);
    rightCol.appendChild(mapSection);

    body.appendChild(rightCol);
    wrap.appendChild(body);

    // ── Séparateur + boutons ──
    wrap.appendChild(el('div', { style: { height: '1px', background: M.border, margin: '16px 0 12px' }}));

    const btnRow = el('div', { style: { display: 'flex', gap: '10px' }});

    const btnBack = mkBtn(t('lobbyQuit'), M.dimCream);
    btnBack.style.margin = '0';

    let isReady = false;
    const btnReady = mkBtn(t('lobbyReady'), M.cream);
    btnReady.style.margin = '0';
    btnReady.style.flex = '1';
    self.isReady = false;
    btnReady.addEventListener('click', () => {
      isReady = !isReady;
      self.isReady = isReady;
      renderPlayers();
      btnReady.textContent = isReady ? t('lobbyReadyCancel') : t('lobbyReady');
      if (nm) nm.send('player_ready', { ready: isReady });
    });

    const btnStart = mkBtn(t('lobbyStart'), M.accent);
    btnStart.style.margin = '0';
    btnStart.style.flex = '1';
    if (!isHost) btnStart.style.display = 'none';

    btnRow.appendChild(btnBack);
    btnRow.appendChild(btnReady);
    btnRow.appendChild(btnStart);
    wrap.appendChild(btnRow);

    this._root.appendChild(wrap);

    // ── Réseau ──
    const launchMultiplayer = (network, config) => {
      // Slot déterministe : tri des IDs → chaque client calcule le même index
      const myId   = network?.id ?? 'local';
      const allIds = players.map(p => (p.id === 'local' ? myId : p.id)).sort();
      const playerSlot = Math.max(0, allIds.indexOf(myId));
      const remotePlayers = players.filter(p => p.id !== 'local' && p.id !== myId);
      this._config = { ...this._config, ...config, networkManager: network, playerSlot, remotePlayers };
      this._resolve(this._config);
      this.hide();
    };

    const connectToServer = async () => {
      try {
        const { NetworkManager } = await import('./NetworkManager.js');
        nm = new NetworkManager();
        await nm.connect();

        if (isHost) {
          await nm.createRoom({ code, map: this._config.map, maxPlayers: 8, mode: this._config.mode, name: this._config.pilotName, team: this._config.team });
          statusEl.textContent = 'En attente de joueurs...';
          statusEl.style.color = M.green;
        } else {
          const res = await nm.joinRoom(code, { name: self.name, team: self.team });
          statusEl.textContent = `Connecté — ${code}`;
          statusEl.style.color = M.green;
          if (res.config) {
            // Ne copier QUE les réglages partagés de la partie — jamais l'identité
            // du joueur (name / pilotName / team), sinon on hérite du nom et de la
            // couleur de l'hôte.
            const cfg = res.config;
            for (const k of ['mode', 'map', 'maxPlayers', 'difficulty', 'totalEnemies', 'ffaTimeLimit', 'friendlyFire']) {
              if (cfg[k] !== undefined) this._config[k] = cfg[k];
            }
            if (cfg.mode         !== undefined) { modeGroup.setValue(cfg.mode); renderModeDesc(cfg.mode); teamSection.style.display = cfg.mode === 'tdm' ? '' : 'none'; diffSection.style.display = ['coop','survival'].includes(cfg.mode) ? '' : 'none'; enemyCountSection.style.display = cfg.mode === 'coop' ? '' : 'none'; timeLimitSection.style.display = isCompetitive(cfg.mode) ? '' : 'none'; refreshLobbyStats(); }
            if (cfg.difficulty   !== undefined) diffChoices.setValue(cfg.difficulty);
            if (cfg.totalEnemies !== undefined) enemyCountChoices.setValue(cfg.totalEnemies);
            if (cfg.ffaTimeLimit !== undefined) timeGroup.setValue(cfg.ffaTimeLimit);
            if (cfg.friendlyFire !== undefined) ffGroup.setValue(cfg.friendlyFire);
            if (cfg.map          !== undefined) { mapGroup.setValue(cfg.map); refreshLobbyStats(); }
          }
          if (res.players) {
            res.players.forEach(p => { if (p.id !== nm.id) players.push({ ...p, isReady: false }); });
            renderPlayers();
          }
        }

        nm.on('player_joined',  ({ player })           => {
          players.push({ ...player, isReady: false }); renderPlayers();
          // L'hôte resynchronise le nouvel arrivant (config complète + sa couleur)
          if (isHost && nm) {
            nm.send('config_update', {
              mode: this._config.mode, map: this._config.map,
              difficulty: this._config.difficulty, totalEnemies: this._config.totalEnemies,
              ffaTimeLimit: this._config.ffaTimeLimit, friendlyFire: this._config.friendlyFire,
            });
            nm.send('player_plane', { plane: this._config.team });
          }
        });
        nm.on('player_left',    ({ id })               => { const i = players.findIndex(p => p.id === id); if (i > -1) players.splice(i, 1); renderPlayers(); });
        nm.on('player_ready',   ({ id, ready })        => { const p = players.find(p => p.id === id); if (p) { p.isReady = ready; renderPlayers(); } });
        nm.on('player_plane',   ({ id, plane })        => { const p = players.find(p => p.id === id); if (p) { p.team = plane; renderPlayers(); } });
        nm.on('player_team',    ({ id, playerTeam })   => { const p = players.find(p => p.id === id); if (p) { p.playerTeam = playerTeam; renderPlayers(); } });
        nm.on('config_update',  (patch) => {
          Object.assign(this._config, patch);
          if (patch.mode !== undefined) {
            modeGroup.setValue(patch.mode);
            renderModeDesc(patch.mode);
            teamSection.style.display       = patch.mode === 'tdm' ? '' : 'none';
            diffSection.style.display       = ['coop','survival'].includes(patch.mode) ? '' : 'none';
            enemyCountSection.style.display = patch.mode === 'coop' ? '' : 'none';
            timeLimitSection.style.display  = isCompetitive(patch.mode) ? '' : 'none';
            refreshLobbyStats();
          }
          if (patch.difficulty   !== undefined) diffChoices.setValue(patch.difficulty);
          if (patch.totalEnemies !== undefined) enemyCountChoices.setValue(patch.totalEnemies);
          if (patch.ffaTimeLimit !== undefined) timeGroup.setValue(patch.ffaTimeLimit);
          if (patch.friendlyFire !== undefined) ffGroup.setValue(patch.friendlyFire);
          if (patch.map          !== undefined) { mapGroup.setValue(patch.map); refreshLobbyStats(); }
          renderPlayers();
        });
        nm.on('game_start',     ({ config })           => launchMultiplayer(nm, config));
        nm.on('return_lobby',   ()                     => this._showLobby());

        this._config.networkManager = nm;
      } catch {
        statusEl.textContent = 'Serveur indisponible — hors-ligne';
        statusEl.style.color = M.yellow;
      }
    };
    connectToServer();

    btnStart.addEventListener('click', () => {
      // playerCount : difficulté/nombre d'ennemis mis à l'échelle côté jeu (coop/survie)
      const startConfig = { ...this._config, playerCount: players.length };
      if (nm) nm.send('start_game', { config: startConfig });
      launchMultiplayer(nm, startConfig);
    });
    btnBack.addEventListener('click', () => {
      if (nm) nm.disconnect();
      this._showMultiplayer();
    });
  }

  // ── Section audio réutilisable (menu accueil + pause) ──────────────────────
  // Retourne un fragment DOM. audioMgr peut être null (menu principal sans jeu actif).
  _mkAudioSection(audioMgr) {
    const frag = document.createDocumentFragment();

    const mkSliderRow = (label, storageKey, baseVol, busKey, initialVal) => {
      const row = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }});

      const top = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }});
      top.appendChild(el('span', { text: label, style: { color: M.dimCream, fontSize: '11px', letterSpacing: '2px' }}));
      const valLabel = el('span', { text: Math.round(initialVal * 100) + '%', style: { color: M.cream, fontSize: '11px', letterSpacing: '2px', minWidth: '36px', textAlign: 'right' }});
      top.appendChild(valLabel);
      row.appendChild(top);

      const slider = document.createElement('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '100';
      slider.value = Math.round(initialVal * 100);
      Object.assign(slider.style, {
        width: '100%', accentColor: M.cream, cursor: 'pointer',
        background: 'transparent',
      });
      slider.addEventListener('input', () => {
        const v = parseInt(slider.value) / 100;
        valLabel.textContent = slider.value + '%';
        localStorage.setItem(storageKey, v);
        if (audioMgr?._bus?.[busKey]) {
          audioMgr._bus[busKey].gain.setTargetAtTime(baseVol * v, audioMgr._ctx.currentTime, 0.05);
        }
      });
      row.appendChild(slider);
      return row;
    };

    frag.appendChild(mkSliderRow(
      t('musicVol'), 'audio_music', 0.38, 'ambient',
      AudioManager.getMusicVolume()
    ));
    frag.appendChild(mkSliderRow(
      t('sfxVol'), 'audio_sfx', 0.55, 'sfx',
      AudioManager.getSFXVolume()
    ));

    return frag;
  }

  // ── Paramètres ─────────────────────────────────────────────────────────────
  _showSettings() {
    this._clear();
    this._showPreview('settings');
    const wrap = mkPanelLeft('640px');
    wrap.appendChild(mkSectionTitle(t('settings')));
    wrap.appendChild(mkDivider());

    // ── 2 colonnes ────────────────────────────────────────────────────────────
    const cols = el('div', { style: { display: 'flex', gap: '32px', alignItems: 'flex-start' }});
    const colL = el('div', { style: { flex: '1', minWidth: '0' }});
    const colR = el('div', { style: { flex: '1', minWidth: '0' }});

    // ── Colonne gauche : Stats + Audio ────────────────────────────────────────
    colL.appendChild(mkLabel(t('stats')));

    const statKeys = [
      { key: t('eliminations'), ls: 'stats_kills'   },
      { key: t('morts'),        ls: 'stats_deaths'  },
      { key: t('gamesPlayed'),  ls: 'stats_games'   },
    ];
    const valueEls = [];
    statKeys.forEach(({ key, ls }) => {
      const row = el('div', { style: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0', borderBottom: `1px solid ${M.border}`,
      }});
      row.appendChild(el('span', { text: key, style: { color: M.dimCream, fontSize: '10px', letterSpacing: '2px' }}));
      const vEl = el('span', { text: localStorage.getItem(ls) || '0', style: { color: M.cream, fontSize: '13px', letterSpacing: '2px', fontWeight: 'bold' }});
      row.appendChild(vEl);
      valueEls.push({ el: vEl, ls });
      colL.appendChild(row);
    });

    const survRow = el('div', { style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: `1px solid ${M.border}`,
    }});
    survRow.appendChild(el('span', { text: `${t('statsSurvival')} — ${t('bestWave')}`, style: { color: M.dimCream, fontSize: '10px', letterSpacing: '2px' }}));
    const bestWaveEl = el('span', { text: localStorage.getItem('stats_bestWave') || '0', style: { color: '#cc9933', fontSize: '13px', letterSpacing: '2px', fontWeight: 'bold' }});
    survRow.appendChild(bestWaveEl);
    colL.appendChild(survRow);

    const btnReset = mkBtn(t('resetStats'), M.red);
    btnReset.style.marginTop = '6px';
    btnReset.addEventListener('click', () => {
      ['stats_kills','stats_deaths','stats_games','stats_bestWave'].forEach(k => localStorage.removeItem(k));
      valueEls.forEach(({ el }) => { el.textContent = '0'; });
      bestWaveEl.textContent = '0';
      btnReset.textContent = '✓';
      setTimeout(() => { btnReset.textContent = t('resetStats'); }, 1500);
    });
    colL.appendChild(btnReset);
    colL.appendChild(mkDivider());
    colL.appendChild(mkLabel(t('audio')));
    colL.appendChild(this._mkAudioSection(this._audio ?? null));

    // ── Colonne droite : Qualité graphique + Mode de contrôle ─────────────────
    const GFX_MODES = [
      { value: 0, label: t('gfxHigh'), color: M.cream,    desc: t('gfxHighDesc') },
      { value: 1, label: t('gfxMed'),  color: '#ccaa33',  desc: t('gfxMedDesc')  },
      { value: 2, label: t('gfxLow'),  color: '#dd6633',  desc: t('gfxLowDesc')  },
    ];
    const curGfx = parseInt(localStorage.getItem('lowGraphics') || '0', 10);
    const gfxDesc = el('div', { style: {
      fontSize: '9px', color: M.dimCream, letterSpacing: '1px', lineHeight: '1.6',
      marginTop: '4px', minHeight: '28px',
    }});
    gfxDesc.textContent = GFX_MODES.find(m => m.value === curGfx)?.desc ?? '';

    colR.appendChild(mkLabel(t('graphicsQuality')));
    colR.appendChild(mkChoiceGroup(
      GFX_MODES.map(({ value, label, color }) => ({ value, label, color })),
      curGfx,
      v => {
        localStorage.setItem('lowGraphics', String(v));
        gfxDesc.textContent = GFX_MODES.find(m => m.value === v)?.desc ?? '';
      }
    ));
    colR.appendChild(gfxDesc);
    colR.appendChild(mkDivider());

    const CTRL_MODES = [
      { value: 'standard',  label: t('ctrlStd'), color: M.cream,    desc: t('ctrlStdDesc') },
      { value: 'simulator', label: t('ctrlSim'), color: '#88aacc',  desc: t('ctrlSimDesc') },
    ];
    const curCtrl = localStorage.getItem('ctrlMode') || 'standard';
    const ctrlDesc = el('div', { style: {
      fontSize: '9px', color: M.dimCream, letterSpacing: '1px', lineHeight: '1.6',
      marginTop: '4px', minHeight: '28px',
    }});
    ctrlDesc.textContent = CTRL_MODES.find(m => m.value === curCtrl)?.desc ?? '';

    colR.appendChild(mkLabel(t('ctrlMode')));
    colR.appendChild(mkChoiceGroup(
      CTRL_MODES.map(({ value, label, color, disabled }) => ({ value, label, color, disabled })),
      curCtrl,
      v => {
        localStorage.setItem('ctrlMode', v);
        ctrlDesc.textContent = CTRL_MODES.find(m => m.value === v)?.desc ?? '';
      }
    ));
    colR.appendChild(ctrlDesc);

    cols.appendChild(colL);
    cols.appendChild(colR);
    wrap.appendChild(cols);
    wrap.appendChild(mkDivider());

    const btnBack = mkBtn(t('back'), M.dimCream);
    btnBack.addEventListener('click', () => this._showMain());
    wrap.appendChild(btnBack);
    this._root.appendChild(wrap);
  }

  // ── Stats contextuelles par mode + carte ─────────────────────────────────
  _buildContextualStats(mode, mapId) {
    const wrap = el('div');
    wrap.appendChild(mkDivider());

    const mkStat = (label, value, color = M.cream) => {
      const row = el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${M.border}` }});
      row.appendChild(el('span', { text: label, style: { fontSize: '9px', letterSpacing: '2px', color: M.dimCream, textTransform: 'uppercase' }}));
      row.appendChild(el('span', { text: String(value), style: { fontSize: '13px', letterSpacing: '2px', fontWeight: 'bold', color }}));
      return row;
    };

    const ls = (key) => localStorage.getItem(`stats_${mode}_${mapId}_${key}`) || null;

    if (mode === 'freeflight') {
      wrap.appendChild(el('div', { text: t('trainingModeLabel'), style: { fontSize: '10px', letterSpacing: '3px', color: M.dimCream, textTransform: 'uppercase', marginBottom: '4px' }}));
      wrap.appendChild(el('div', { text: t('trainingModeHint'), style: { fontSize: '9px', color: '#5a5438', letterSpacing: '1px' }}));

    } else if (mode === 'survival') {
      wrap.appendChild(mkLabel(t('mapRecord')));
      const DIFFS = [
        { key: 'easy',     color: '#88cc66', label: t('easy')     },
        { key: 'standard', color: '#cc9933', label: t('standard') },
        { key: 'hard',     color: '#dd5533', label: t('hard')     },
      ];
      for (const d of DIFFS) {
        const best = ls(`bestWave_${d.key}`);
        const valueText = best !== null ? `${t('waveLabel')} ${best}` : '—';
        wrap.appendChild(mkStat(d.label, valueText, best !== null ? d.color : '#3a3428'));
      }

    } else if (mode === 'solo' || mode === 'coop') {
      wrap.appendChild(mkLabel(t('mapRecord')));
      const diff   = ls('highestDiff');
      const killed = ls('mostEnemies');
      const DIFF_LABELS = { easy: 'FACILE', standard: 'STANDARD', hard: 'DIFFICILE' };
      wrap.appendChild(mkStat(t('highestDiff'), diff ? `${DIFF_LABELS[diff] || diff} ${t('diffCompleted')}` : t('noRecord'), '#a0d080'));
      wrap.appendChild(mkStat(t('mostEnemies'), killed ?? t('noRecord'), M.cream));

    } else if (mode === 'ffa' || mode === 'tdm') {
      wrap.appendChild(mkLabel(t('mapRecord')));
      const elim = ls('bestElim');
      wrap.appendChild(mkStat(t('mostEliminations'), elim ?? t('noRecord'), M.cream));
    }

    return wrap;
  }

  // ── Aperçu stylisé de carte ───────────────────────────────────────────────
  _drawMapPreview(canvas, mapId) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const MAPS = {
      1: {
        name  : t('mapName_1'),
        desc  : ['2 bases · 4 villages · 7 massifs · lacs', 'Altitude max : 900 m · Grande carte'],
        sky   : ['#0c1820', '#1a3050'],
        water : '#1a4878', low: '#1e4010', forest: '#2a5a18', rock: '#6a5030', snow: '#d8dce0',
        peaks : [[0.60,0.32,0.09],[0.38,0.55,0.07],[0.65,0.62,0.06],[0.28,0.35,0.08],[0.52,0.70,0.05],[0.73,0.42,0.06],[0.42,0.22,0.07]],
        lakes : [[0.22,0.52,0.04],[0.75,0.47,0.04],[0.47,0.42,0.03],[0.54,0.62,0.03]],
        villages : [[0.20,0.50],[0.80,0.50],[0.50,0.13],[0.51,0.87]],
        airports : [[0.20,0.50],[0.80,0.50]],
        roads    : [[[0.20,0.50],[0.50,0.13]],[[0.20,0.50],[0.51,0.87]],[[0.80,0.50],[0.50,0.13]],[[0.80,0.50],[0.51,0.87]]],
      },
      2: {
        name  : t('mapName_2'),
        desc  : ['Haute altitude · 6 sommets · neige dense', 'Altitude max : 1 800 m'],
        sky   : ['#080c18', '#10203a'],
        water : '#0e2840', low: '#2a3a50', forest: '#304858', rock: '#5a5a70', snow: '#e8eaf0',
        peaks : [[0.42,0.30,0.12],[0.65,0.25,0.09],[0.25,0.45,0.10],[0.72,0.55,0.08],[0.38,0.68,0.07],[0.60,0.70,0.06]],
        lakes : [[0.50,0.50,0.05],[0.28,0.60,0.03],[0.68,0.40,0.03]],
      },
      3: {
        name  : t('mapName_3'),
        desc  : ['Terrain plat · 2 sommets · grands lacs', 'Altitude max : 800 m'],
        sky   : ['#100808', '#281410'],
        water : '#1a3060', low: '#304820', forest: '#3a5a18', rock: '#786040', snow: '#c8b890',
        peaks : [[0.30,0.28,0.06],[0.72,0.60,0.05]],
        lakes : [[0.52,0.45,0.10],[0.25,0.58,0.07],[0.70,0.30,0.06],[0.40,0.75,0.05]],
      },
      99: {
        name  : t('mapName_99'),
        desc  : ['En développement', 'Bientôt disponible'],
        sky   : ['#060804', '#0a0e08'],
        water : '#0e1812', low: '#0a100a', forest: '#0c120c', rock: '#141210', snow: '#1e1c18',
        peaks : [], lakes : [],
      },
      5: {
        name  : t('mapName_5'),
        desc  : ['2 îles · La Manche · 4 villages · 2 aéroports', 'Relief doux · Plages · Altitude max : 160 m'],
        sky   : ['#0c1824', '#1a3048'],
        water : '#1a4878',
        low   : '#2a5018', forest: '#1e4410', rock : '#6a5830', snow: '#c8c0a0',
        peaks : [[0.51,0.56,0.04],[0.62,0.65,0.04],[0.57,0.73,0.04],[0.67,0.60,0.04],[0.45,0.67,0.04]],
        lakes : [[0.55,0.65,0.03],[0.47,0.59,0.02],[0.63,0.57,0.02]],
        // Îles dessinées manuellement dans le rendu custom ci-dessous
        _normandy: true,
        villages : [[0.42,0.49],[0.64,0.49],[0.48,0.60],[0.57,0.73]],
        airports : [[0.21,0.20],[0.41,0.53]],
        roads    : [[[0.42,0.49],[0.48,0.60]],[[0.64,0.49],[0.48,0.60]],[[0.48,0.60],[0.57,0.73]]],
      },
      4: {
        name  : t('mapName_4'),
        desc  : ['Villages · ravitaillement · lacs alpins', 'Altitude max : 1 250 m'],
        sky   : ['#0e1a0c', '#1c3018'],
        water : '#2a6a8c', low: '#2e5a1a', forest: '#1a4a0e', rock: '#5a4830', snow: '#d0d4cc',
        peaks : [[0.75,0.18,0.10],[0.85,0.38,0.08],[0.60,0.28,0.07],[0.20,0.20,0.08],[0.12,0.42,0.07]],
        lakes : [[0.35,0.60,0.05],[0.62,0.70,0.04],[0.18,0.62,0.03],[0.50,0.45,0.03]],
        villages: [[0.28,0.55],[0.50,0.65],[0.70,0.52]],
        airports: [[0.24,0.44],[0.72,0.60]],
        roads: [[[0.28,0.55],[0.50,0.65]],[[0.50,0.65],[0.70,0.52]]],
      },
    };

    const m = MAPS[mapId] || MAPS[1];

    // Fond dégradé
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, m.sky[0]); bg.addColorStop(1, m.sky[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    if (m._normandy) {
      // ── Rendu spécial Normandie : deux îles séparées par la Manche ──────────
      // Mer en fond
      ctx.fillStyle = m.water; ctx.fillRect(0, 0, W, H);

      // Île d'Angleterre (petite, NW) — décalée vers le haut
      const exW = 0.21 * W, exH = 0.20 * H;
      const eGrad = ctx.createRadialGradient(exW, exH, 0, exW, exH, 0.13*W);
      eGrad.addColorStop(0, '#3a6020'); eGrad.addColorStop(0.7, '#2e5018'); eGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = eGrad;
      ctx.beginPath(); ctx.ellipse(exW, exH, 0.12*W, 0.14*H, -0.4, 0, Math.PI*2); ctx.fill();
      // Plage légère sur le bord sud de l'Angleterre
      ctx.fillStyle = 'rgba(180,160,100,0.35)';
      ctx.beginPath(); ctx.ellipse(exW+0.02*W, exH+0.06*H, 0.07*W, 0.04*H, 0.2, 0, Math.PI*2); ctx.fill();

      // Île de Normandie (grande, SE, ellipse EW) — décalée vers le haut
      const nxW = 0.57 * W, nxH = 0.54 * H;
      const nGrad = ctx.createRadialGradient(nxW, nxH, 0, nxW, nxH, 0.36*W);
      nGrad.addColorStop(0, '#385c14'); nGrad.addColorStop(0.65, '#2c5010'); nGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = nGrad;
      ctx.beginPath(); ctx.ellipse(nxW, nxH, 0.37*W, 0.27*H, 0.15, 0, Math.PI*2); ctx.fill();
      // Plages nord de Normandie (face à l'Angleterre)
      ctx.fillStyle = 'rgba(190,165,105,0.45)';
      ctx.beginPath(); ctx.ellipse(nxW - 0.08*W, nxH - 0.15*H, 0.24*W, 0.06*H, -0.1, 0, Math.PI*2); ctx.fill();

      // Forêt bocage sur la Normandie
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 7; i++) {
        const fx = 0.36 + (i * 0.083) % 0.38, fy = 0.40 + (i * 0.11) % 0.28;
        const gr = ctx.createRadialGradient(fx*W, fy*H, 0, fx*W, fy*H, 0.09*W);
        gr.addColorStop(0, m.forest); gr.addColorStop(1, 'transparent');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(fx*W, fy*H, 0.09*W, 0.07*H, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // Terrain de base (bas de la carte) — part de haut pour que les montagnes ne flottent pas
      ctx.fillStyle = m.low; ctx.fillRect(0, H * 0.08, W, H);

      // Forêt patches
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 9; i++) {
        const fx = (0.08 + i * 0.105) % 0.92, fy = 0.33 + (i * 0.137) % 0.55;
        const grad = ctx.createRadialGradient(fx*W, fy*H, 0, fx*W, fy*H, 0.13*W);
        grad.addColorStop(0, m.forest); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(fx*W, fy*H, 0.13*W, 0.10*H, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Lacs
    m.lakes.forEach(([lx, ly, lr]) => {
      ctx.fillStyle = m.water;
      ctx.beginPath(); ctx.ellipse(lx*W, ly*H, lr*W*1.4, lr*H*0.85, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(180,220,255,0.13)';
      ctx.beginPath(); ctx.ellipse((lx-lr*0.2)*W, (ly-lr*0.15)*H, lr*W*0.5, lr*H*0.25, -0.3, 0, Math.PI*2); ctx.fill();
    });

    // Sommets
    m.peaks.forEach(([px, py, pr]) => {
      ctx.fillStyle = m.rock;
      ctx.beginPath();
      ctx.moveTo(px*W, (py-pr*2.2)*H);
      ctx.lineTo((px-pr*1.5)*W, (py+pr*0.4)*H);
      ctx.lineTo((px+pr*1.5)*W, (py+pr*0.4)*H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = m.snow;
      ctx.beginPath();
      ctx.moveTo(px*W, (py-pr*2.2)*H);
      ctx.lineTo((px-pr*0.65)*W, (py-pr*1.0)*H);
      ctx.lineTo((px+pr*0.65)*W, (py-pr*1.0)*H);
      ctx.closePath(); ctx.fill();
    });

    // Routes entre villages (carte 4)
    if (m.roads) {
      ctx.strokeStyle = 'rgba(210,190,120,0.35)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      m.roads.forEach(([[x1,y1],[x2,y2]]) => {
        ctx.beginPath(); ctx.moveTo(x1*W, y1*H); ctx.lineTo(x2*W, y2*H); ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    // Villages (carte 4)
    if (m.villages) {
      m.villages.forEach(([vx, vy], i) => {
        // Halo lumineux
        const grad = ctx.createRadialGradient(vx*W, vy*H, 0, vx*W, vy*H, 18);
        grad.addColorStop(0, 'rgba(220,180,80,0.35)'); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(vx*W, vy*H, 18, 0, Math.PI*2); ctx.fill();
        // Point village
        ctx.fillStyle = 'rgba(220,185,95,0.85)';
        ctx.beginPath(); ctx.arc(vx*W, vy*H, 5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#e8d890'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(vx*W, vy*H, 5, 0, Math.PI*2); ctx.stroke();
      });
    }
    // Aéroports (carte 4) — piste stylisée avec couleur d'équipe
    if (m.airports) {
      const apColors = ['#33cc66', '#cc2222'];
      m.airports.forEach(([ax, ay], i) => {
        const col = apColors[i] || '#aaaaaa';
        // Ombre de la piste
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(ax*W - 13, ay*H - 5, 26, 10);
        // Piste
        ctx.fillStyle = 'rgba(55,55,55,0.85)';
        ctx.fillRect(ax*W - 12, ay*H - 4, 24, 8);
        // Ligne centrale de piste
        ctx.strokeStyle = 'rgba(255,255,180,0.5)'; ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(ax*W - 10, ay*H); ctx.lineTo(ax*W + 10, ay*H); ctx.stroke();
        ctx.setLineDash([]);
        // Bordure couleur équipe
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        ctx.strokeRect(ax*W - 12, ay*H - 4, 24, 8);
        // (icône texte supprimée)
      });
    }

    // Grille topo
    ctx.strokeStyle = 'rgba(212,200,138,0.06)'; ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= W; gx += 28) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
    for (let gy = 0; gy <= H; gy += 28) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }

    // Point spawn — sur l'aéroport allié (index 0) si la carte en a un, sinon au centre
    const spawnX = m.airports ? m.airports[0][0] : 0.5;
    const spawnY = m.airports ? m.airports[0][1] : 0.5;
    ctx.strokeStyle = '#d4c88a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(spawnX*W-8, spawnY*H); ctx.lineTo(spawnX*W+8, spawnY*H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(spawnX*W, spawnY*H-8); ctx.lineTo(spawnX*W, spawnY*H+8); ctx.stroke();
    ctx.fillStyle = M.accent; ctx.beginPath(); ctx.arc(spawnX*W, spawnY*H, 3, 0, Math.PI*2); ctx.fill();


    // Overlay "bientôt" pour placeholder
    if (mapId === 99) {
      ctx.fillStyle = 'rgba(4,6,3,0.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#3a3020';
      ctx.font = 'bold 11px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('EN DÉVELOPPEMENT', W/2, H/2 - 8);
      ctx.font = '8px "Courier New"';
      ctx.fillStyle = '#2a2018';
      ctx.fillText('BIENTÔT DISPONIBLE', W/2, H/2 + 10);
    }

    // Cadre
    ctx.strokeStyle = 'rgba(212,200,138,0.20)'; ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, W-2, H-2);

    // Rose des vents
    const rx = W-18, ry = 18;
    ctx.strokeStyle = 'rgba(212,200,138,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx, ry-6); ctx.lineTo(rx, ry+6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx-6, ry); ctx.lineTo(rx+6, ry); ctx.stroke();
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────────
  _clear() {
    const children = Array.from(this._root.children);
    children.forEach(c => {
      // Garder : scanlines (div), canvas 3D preview
      if (c === this._previewCanvas) return;
      if (c.style.background?.includes('repeating-linear-gradient')) return;
      c.remove();
    });
    // Auto-focus le premier bouton interactif après chaque changement d'écran
    requestAnimationFrame(() => {
      const btn = this._root.querySelector('button:not(:disabled)');
      if (btn) { btn.focus(); btn.scrollIntoView({ block: 'nearest' }); }
    });
  }

  // ── Navigation manette dans le menu (spatiale) ───────────────────────────
  _startGamepadNav() {
    if (this._gpNavId) return;
    this._gpNavPrev = {};
    this._gpNavRepeat = {}; // timers pour l'auto-répétition

    // Navigation spatiale : trouve le meilleur élément dans la direction donnée
    const spatialMove = (dir) => {
      // Scoped au menu courant — éléments visibles, non désactivés
      const isVisible = (el) => {
        let n = el;
        while (n && n !== this._root) {
          if (n.style && n.style.display === 'none') return false;
          n = n.parentElement;
        }
        return el.offsetParent !== null;
      };
      const all = Array.from(this._root.querySelectorAll('button, input'))
        .filter(el => !el.disabled && !el.dataset.disabled && isVisible(el));
      const focused = document.activeElement;

      if (!focused || !all.includes(focused)) { all[0]?.focus(); return; }

      const fr = focused.getBoundingClientRect();
      const fcx = fr.left + fr.width  / 2;
      const fcy = fr.top  + fr.height / 2;

      const horizontal = dir === 'left' || dir === 'right';

      let best = null, bestScore = Infinity, bestInBeam = false;
      for (const el of all) {
        if (el === focused) continue;
        const r  = el.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        const dx = cx - fcx, dy = cy - fcy;

        // Seuil directionnel : l'élément cible doit être dans la bonne direction
        const inDir = dir === 'up'    ? dy < -4
                    : dir === 'down'  ? dy >  4
                    : dir === 'left'  ? dx < -4
                    :                   dx >  4;
        if (!inDir) continue;

        // « Beam » : l'élément chevauche-t-il l'axe perpendiculaire de l'élément
        // focalisé ? (même rangée pour gauche/droite, même colonne pour haut/bas).
        // Un candidat dans le beam bat TOUJOURS un candidat hors beam → pas de saut
        // diagonal (ex. aller à gauche ne remonte plus vers une couleur d'avion).
        const inBeam = horizontal
          ? (r.top  < fr.bottom && r.bottom > fr.top)
          : (r.left < fr.right  && r.right  > fr.left);

        const primary   = horizontal ? Math.abs(dx) : Math.abs(dy);
        const secondary = horizontal ? Math.abs(dy) : Math.abs(dx);
        // Dans le beam : seule la distance en direction compte (le plus proche gagne).
        // Hors beam : forte pénalité d'écart perpendiculaire (fallback si rien aligné).
        const score = inBeam ? primary : primary + secondary * 8;

        const better = (inBeam && !bestInBeam) ||
                       (inBeam === bestInBeam && score < bestScore);
        if (better) { best = el; bestScore = score; bestInBeam = inBeam; }
      }
      if (best) {
        best.focus();
        best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    };

    // Auto-répétition : déclenche une action si la touche est maintenue
    const held = (key, pressed, action) => {
      const prev = this._gpNavPrev;
      const rep  = this._gpNavRepeat;
      if (pressed && !prev[key]) { action(); rep[key] = Date.now() + 400; } // délai initial
      else if (pressed && Date.now() > (rep[key] ?? Infinity)) { action(); rep[key] = Date.now() + 120; } // répétition
      else if (!pressed) { rep[key] = null; }
      prev[key] = pressed;
    };

    const tick = () => {
      if (!this._gpNavId) return;
      this._gpNavId = requestAnimationFrame(tick);

      const gamepads = navigator.getGamepads?.();
      const gp = gamepads ? Array.from(gamepads).find(g => g !== null) : null;
      if (!gp) return;

      const dz = (v) => Math.abs(v) < 0.28 ? 0 : v;

      // 4 directions : D-pad OU stick gauche
      held('up',    (gp.buttons[12]?.pressed) || dz(gp.axes[1]) < -0.5, () => spatialMove('up'));
      held('down',  (gp.buttons[13]?.pressed) || dz(gp.axes[1]) >  0.5, () => spatialMove('down'));
      held('left',  (gp.buttons[14]?.pressed) || dz(gp.axes[0]) < -0.5, () => spatialMove('left'));
      held('right', (gp.buttons[15]?.pressed) || dz(gp.axes[0]) >  0.5, () => spatialMove('right'));


      const prev = this._gpNavPrev;

      // A → confirmer (clic)
      const btnA = gp.buttons[0]?.pressed ?? false;
      if (btnA && !prev.a) {
        const f = document.activeElement;
        if (f && f.tagName === 'BUTTON' && !f.disabled) f.click();
      }
      prev.a = btnA;

      // B → retour
      const btnB = gp.buttons[1]?.pressed ?? false;
      if (btnB && !prev.b) {
        const backBtn = Array.from(this._root.querySelectorAll('button'))
          .find(b => b.textContent.includes('←') || b.textContent.includes('RETOUR') || b.textContent.includes('BACK'));
        if (backBtn) backBtn.click();
      }
      prev.b = btnB;
    };
    this._gpNavId = requestAnimationFrame(tick);
  }

  _stopGamepadNav() {
    if (this._gpNavId) { cancelAnimationFrame(this._gpNavId); this._gpNavId = null; }
  }

  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}

export { TEAM_COLORS };

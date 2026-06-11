import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CursorFX } from './CursorFX.js';
import { AudioManager } from './AudioManager.js';
import { t, tTips, tModeInfo, tModeBullets, tCtrlKb, tCtrlGp, getLang, setLang, tEquip } from './i18n.js';
import { ProgressionSystem, xpToNextLevel, calcRewards } from './ProgressionSystem.js';
import { UPGRADES, CAT_ORDER, CAT_LABELS, BASE_STATS, computeStats, loadModifiers, serviceTimeMult, EQUIPMENT_CATALOG, DEFAULT_LOADOUT, loadoutToUpgradeIds, interleaveSlots, OPTION_COSTS } from './UpgradeTree.js';
import { IS_MOBILE } from './MobileControls.js';

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
      border-radius: 4px;
      color: var(--cb-color);
      font-family: Rajdhani, 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 2px;
      padding: 6px 10px;
      flex: 1;
      cursor: pointer;
      outline: none;
      box-shadow: none;
      transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
    }
    .choice-btn:hover,
    .choice-btn:active {
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
  fontFamily: 'Rajdhani, sans-serif',
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
    borderRadius : '4px',
    color,
    fontFamily   : 'Rajdhani, sans-serif',
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
  // Feedback tactile mobile : surbrillance pendant l'appui
  b.addEventListener('touchstart', onActive,   { passive: true });
  b.addEventListener('touchend',   onInactive, { passive: true });
  b.addEventListener('touchcancel',onInactive, { passive: true });
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
    borderRadius : '8px',
    padding      : '28px 32px',
    boxShadow    : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
  }});
}

// Panel ancré à gauche — pour les écrans multijoueur
function mkPanelLeft(width = '400px') {
  // Centré dans l'espace SOUS la topbar (52px) pour éviter tout chevauchement.
  // Le centre virtuel passe de 50vh à (52px + (100vh-52px)/2) = calc(50% + 26px).
  // maxHeight réduit d'autant pour rester confortable.
  const d = el('div', { style: {
    position     : 'absolute', left: '5%', top: 'calc(50% + 26px)',
    transform    : 'translateY(-50%)',
    display      : 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px',
    zIndex       : '3', width,
    maxHeight    : 'calc(100vh - 80px)', overflowY: 'auto',
    background   : 'rgba(6,8,4,0.88)',
    border       : '1px solid #3a3020',
    borderRadius : '8px',
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
    borderRadius: '4px',
    color       : M.cream,
    fontFamily  : 'Rajdhani, sans-serif',
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
    fontFamily   : 'Rajdhani, sans-serif',
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

    // Topbar persistante (profil + bouton langue + paramètres) — survit à _clear
    this._buildProfileBar();
    this._config = {
      mode        : 'solo',
      map         : 4,
      team        : 'jaune',
      pilotName   : localStorage.getItem('pilotName') || '',
      maxPlayers  : 4,
      difficulty  : 'standard',
      totalEnemies: 40,
    };
    this._preview = null;
    this._cursor  = new CursorFX();
    this._cursor.start();
    // Progression avant le preview 3D : l'avion d'accueil charge directement la
    // couleur de l'avion actif (#1 par défaut), sans flash de la couleur par défaut.
    this._progression = new ProgressionSystem();
    this._config.team = this._progression.getPlane(this._progression.activePlane).color;
    this._init3DPreview();

    // DEV : taper cheat() dans la console pour passer niveau 50 + crédits illimités
    window.cheat = () => {
      const r = this._progression.devUnlockAll();
      console.log(`✓ Niveau ${r.level} — ${r.credits.toLocaleString()} crédits. Reviens dans Mon Avion pour rafraîchir.`);
      return r;
    };
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
    if (this._profileBar) this._profileBar.style.display = 'none';
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
    this._camRadius       = 7.2;   // rayon courant (spring)
    this._camRadiusTarget = 7.2;   // rayon cible
    this._camLookX        = -1.8;  // décalage lookAt X courant
    this._camLookXTarget  = -1.8;  // décalage lookAt X cible
    this._camLookY        = -0.5;  // décalage lookAt Y courant
    this._camLookYTarget  = -0.5;  // décalage lookAt Y cible
    this._camHeight       = 0;     // offset vertical caméra courant (spring)
    this._camHeightTarget = 0;     // offset vertical cible (mode hangar = 2.4)
    // Vitesses pour le système spring/damper (donne easeInOut naturel)
    this._camVelRadius    = 0;
    this._camVelLookX     = 0;
    this._camVelLookY     = 0;
    this._camVelHeight    = 0;

    this._mouseMoveHandler = (e) => {
      this._camTarget.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      this._camTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', this._mouseMoveHandler);

    // Chargement du modèle
    let propBone = null, aileronL = null, aileronR = null, modelRoot = null;

    const loadPreviewModel = (path) => {
      this._currentPreviewPath = path;
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
        this._previewModelRoot = modelRoot;
        if (this._onPreviewModelLoaded) this._onPreviewModelLoaded(modelRoot);
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

      // Parallaxe souris : lerp rapide et réactif
      this._camOrbit.x  += (this._camTarget.x - this._camOrbit.x) * 0.025;
      this._camOrbit.y  += (this._camTarget.y - this._camOrbit.y) * 0.025;

      // Springs de navigation — radius/height/lookX/lookY transitionnent en douceur
      const SK = 0.010, SD = 0.88;
      this._camVelRadius += (this._camRadiusTarget - this._camRadius) * SK; this._camVelRadius *= SD;
      this._camVelLookX  += (this._camLookXTarget  - this._camLookX)  * SK; this._camVelLookX  *= SD;
      this._camVelLookY  += (this._camLookYTarget  - this._camLookY)  * SK; this._camVelLookY  *= SD;
      this._camVelHeight += (this._camHeightTarget  - this._camHeight) * SK; this._camVelHeight *= SD;
      this._camRadius += this._camVelRadius;
      this._camLookX  += this._camVelLookX;
      this._camLookY  += this._camVelLookY;
      this._camHeight += this._camVelHeight;

      const orbitH = this._camOrbit.x * (Math.PI / 10);
      const orbitV = this._camOrbit.y * (Math.PI / 22);
      const r      = this._camRadius;
      const BASE_Y = 1.8 + (7.2 - r) * 0.08;

      camera.position.set(Math.sin(orbitH) * r, BASE_Y - orbitV * 2.2 + this._camHeight, Math.cos(orbitH) * r);

      // Deux modes de visée selon la page :
      //  • _exactAim (Mon Avion) → visée DIRECTE exacte chaque frame : l'avion reste
      //    cloué pile au centre de l'ancre DOM, pivot central parfait, mouvement calme.
      //  • sinon (solo, multi, lobby, settings, stats…) → la cible est injectée dans
      //    le spring lent : mouvement smooth uniforme, même easing pour toutes ces pages.
      if (this._hangarOrbit && this._planeAnchor) {
        if (this._exactAim) {
          this._aimAtAnchor(camera);
        } else {
          this._updateAnchorTarget(camera);
          camera.lookAt(this._camLookX, this._camLookY, 0);
        }
      } else {
        camera.lookAt(this._camLookX, this._camLookY, 0);
      }

      if (modelRoot) {
        // Flottement lent et ample — deux sinusoïdes déphasées pour éviter la répétition
        modelRoot.rotation.z = Math.sin(t * 0.18) * 0.022 + Math.sin(t * 0.11) * 0.008;
        modelRoot.rotation.x = Math.sin(t * 0.13) * 0.014 + Math.sin(t * 0.29) * 0.006;
        modelRoot.position.y += (Math.sin(t * 0.22) * 0.04 - modelRoot.position.y) * 0.02;
      }
      if (propBone) propBone.rotation.y += 0.42;
      if (aileronL) aileronL.rotation.z =  Math.sin(t * 0.19) * 0.055;
      if (aileronR) aileronR.rotation.z = -Math.sin(t * 0.19) * 0.055;

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

  _showPreview(zoom = 'normal', anchor = true) {
    if (this._previewCanvas) this._previewCanvas.style.opacity = '1';
    // Réinitialise les vélocités spring pour éviter l'overshoot en cas de grande différence
    this._camVelRadius = 0;
    this._camVelLookX  = 0;
    this._camVelLookY  = 0;
    this._camVelHeight = 0;
    this._camLookYTarget  = -0.5;
    this._camHeightTarget = 0;
    if (zoom === 'hangar') {
      this._camRadiusTarget = 9.5;
      this._camHeightTarget = 2.2;   // vue plus haute, similaire à l'accueil
      this._hangarOrbit     = true;
      this._exactAim        = true;  // Mon Avion : visée directe exacte (_aimAtAnchor)
      // L'ancre DOM est posée par _showMyPlane() elle-même
    } else {
      this._exactAim = false;        // autres pages : visée smooth via spring
      let anchorLeft = '30%';
      if (zoom === 'settings') { this._camRadiusTarget = 6.0; anchorLeft = '42%'; }
      else if (zoom === 'close') { this._camRadiusTarget = 4.2; anchorLeft = '22%'; }
      else { this._camRadiusTarget = 6.5; anchorLeft = '46%'; } // normal
      if (anchor) {
        const anchorEl = el('div', { style:{
          position:'absolute', left: anchorLeft, right:'0', top:'5%', bottom:'5%',
          pointerEvents:'none',
        }});
        this._root.appendChild(anchorEl);
        this._planeAnchor = anchorEl;
        this._hangarOrbit = true;
      } else {
        // Page d'accueil : comportement classique lookAt fixe
        if (zoom === 'close')    this._camLookXTarget = -0.4;
        else if (zoom === 'settings') this._camLookXTarget = -1.6;
        else                          this._camLookXTarget = -3.0;
      }
    }
  }

  // Résout le point de visée (look) qui projette l'avion (origine monde) au centre
  // EXACT de l'ancre DOM, quelle que soit la résolution (le NDC cible vient du DOM
  // réel). Raffinement itératif type Newton : à chaque passe on projette l'avion avec
  // l'orientation courante, on mesure l'erreur NDC, puis on décale le point visé dans
  // le plan image (right/up) pour l'annuler. Converge en 4 passes même caméra plongeante.
  // Remplit et retourne this._tmpLook (vecteur 3D complet, z inclus).
  _solveAnchorLook(camera) {
    const planeC = this._tmpPlaneC || (this._tmpPlaneC = new THREE.Vector3());
    planeC.set(0, 0.1, 0);
    const look  = this._tmpLook  || (this._tmpLook  = new THREE.Vector3());
    look.copy(planeC); // départ : vise droit sur l'avion (centre écran)

    const a = this._planeAnchor.getBoundingClientRect();
    if (a.width === 0 || a.height === 0) return look;
    const nx =  ((a.left + a.width  / 2) / window.innerWidth)  * 2 - 1;
    const ny = -(((a.top + a.height / 2) / window.innerHeight) * 2 - 1);

    const up0   = this._tmpUp0   || (this._tmpUp0   = new THREE.Vector3(0, 1, 0));
    const fwd   = this._tmpFwd   || (this._tmpFwd   = new THREE.Vector3());
    const right = this._tmpRight || (this._tmpRight = new THREE.Vector3());
    const up    = this._tmpUp    || (this._tmpUp    = new THREE.Vector3());
    const proj  = this._tmpProj  || (this._tmpProj  = new THREE.Vector3());

    const tanHalf = Math.tan((camera.fov * Math.PI / 180) / 2);
    for (let i = 0; i < 4; i++) {
      camera.lookAt(look);
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      proj.copy(planeC).project(camera);
      const ex = nx - proj.x, ey = ny - proj.y;
      if (Math.abs(ex) < 0.0008 && Math.abs(ey) < 0.0008) break;
      fwd.copy(look).sub(camera.position);
      const dist = fwd.length(); fwd.normalize();
      right.crossVectors(fwd, up0).normalize();
      up.crossVectors(right, fwd).normalize();
      look.addScaledVector(right, -ex * dist * tanHalf * camera.aspect);
      look.addScaledVector(up,    -ey * dist * tanHalf);
    }
    return look;
  }

  // Mon Avion : visée DIRECTE exacte chaque frame → pivot central parfait et calme.
  _aimAtAnchor(camera) {
    camera.lookAt(this._solveAnchorLook(camera));
  }

  // Autres pages : injecte la cible dans le spring lent → mouvement smooth uniforme.
  _updateAnchorTarget(camera) {
    const look = this._solveAnchorLook(camera);
    this._camLookXTarget = look.x;
    this._camLookYTarget = look.y;
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
    this._setCurrentScreen(() => this._showMain());
    this._showPreview('close', false);

    // L'avion d'accueil = avion actif (avion #1 par défaut, ou celui sélectionné
    // dans un lobby). Couleur ET loadout cohérents avec cet avion.
    const homeIdx   = this._progression.activePlane;
    const homePlane = this._progression.getPlane(homeIdx);
    this._config.team = homePlane.color;
    this._syncPreviewPlane(homeIdx);

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
      borderRadius  : '8px',
      padding       : '28px 32px',
      boxShadow     : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
    }});

    panel.appendChild(buildLogo());

    const btnSolo     = mkBtn(t('solo'),     M.cream);
    const btnMulti    = mkBtn(t('multi'),    M.cream);
    const btnStats    = mkBtn(t('stats'), M.dimCream);
    const btnSettings = mkBtn(t('settings'), M.dimCream);

    btnSolo.addEventListener('click',     () => this._showSolo());
    btnMulti.addEventListener('click',    () => this._showMultiplayer());
    btnStats.addEventListener('click',    () => this._showStats());
    btnSettings.addEventListener('click', () => this._showSettings());

    [btnSolo, btnMulti, mkDivider(), btnStats, mkDivider(), btnSettings].forEach(b => panel.appendChild(b));
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
      borderRadius: '6px',
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
    this._setCurrentScreen(() => this._showSolo());
    this._showPreview('close');
    this._syncPreviewPlane();
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
    this._setCurrentScreen(() => this._showConfig());
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
      zIndex       : '3', width: '760px',
      background   : 'rgba(6,8,4,0.84)',
      border       : '1px solid #3a3020',
      borderRadius : '8px',
      padding      : '16px 28px',
      boxShadow    : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
    }});

    wrap.appendChild(mkSectionTitle(modeLabels[this._config.mode]));
    wrap.appendChild(mkDivider());

    // Corps : colonne gauche + séparateur + colonne droite (carte)
    const body = el('div', { style: { display: 'flex', gap: '32px', alignItems: 'flex-start' }});

    // ── Colonne gauche ───────────────────────────────────────────────────────
    const colL = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }});

    const prog = this._progression;
    const activeProg = prog.activePlane;
    this._config.team = prog.getPlane(activeProg).color;
    this._syncPreviewPlane(activeProg);

    // ── Description du mode ─────────────────────────────────────────────────
    const mInfo = tModeBullets(this._config.mode);
    if (mInfo) {
      colL.appendChild(mkDivider());
      colL.appendChild(mkLabel(t('descriptif')));
      mInfo.bullets.forEach(b => {
        const row = el('div', { style:{
          fontSize:'10px', letterSpacing:'1px', color:M.cream,
          lineHeight:'1.7', paddingLeft:'2px',
        }});
        row.textContent = b;
        colL.appendChild(row);
      });
      colL.appendChild(mkDivider());
      const noteEl = el('div', { style:{
        fontSize:'9px', letterSpacing:'1px', color:M.dimCream,
        fontStyle:'italic', lineHeight:'1.6', paddingLeft:'2px',
      }});
      noteEl.textContent = mInfo.note;
      colL.appendChild(noteEl);
    }

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
        expert  : t('expertDesc'),
      };
      const diffDesc = el('div', { style: { fontSize: '9px', letterSpacing: '2px', color: M.dimCream, marginTop: '2px' }});
      diffDesc.textContent = DIFF_LABELS[this._config.difficulty] ?? DIFF_LABELS.standard;
      colL.appendChild(mkChoiceGroup(
        [
          { value: 'easy',     label: t('easy'),     color: '#44aa44' },
          { value: 'standard', label: t('standard'), color: M.cream  },
          { value: 'hard',     label: t('hard'),     color: '#cc4422' },
          { value: 'expert',   label: 'EXPERT',      color: '#cc22aa' },
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
          { value: 30, label: '30' },
          { value: 40, label: '40' },
          { value: 60, label: '60' },
          { value: 100, label: '100' },
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
    // (Mon Avion accessible depuis le bloc profil de la topbar)
    wrap.appendChild(mkDivider());

    const btnRow = el('div', { style: { display: 'flex', gap: '12px' }});
    const btnBack  = mkBtn(t('back'),    M.dimCream);
    const btnStart = mkBtn(t('takeoff'), M.accent);
    btnStart.style.fontWeight = 'bold';
    btnBack.addEventListener('click',  () => this._showSolo());
    btnStart.addEventListener('click', () => {
      if (!this._config.pilotName?.trim()) {
        this._showMyPlane();
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
    this._setCurrentScreen(() => this._showMultiplayer());
    this._showPreview('close');
    this._syncPreviewPlane();
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
    this._setCurrentScreen(() => this._showHost());
    this._showPreview('close');
    this._syncPreviewPlane();
    const wrap = mkPanelLeft('380px');
    wrap.appendChild(mkSectionTitle(t('host')));
    wrap.appendChild(mkDivider());

    const code = this._generateRoomCode();

    wrap.appendChild(mkLabel(t('joinCode')));
    const codeRow = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }});
    const codeDisplay = el('div', { text: code, style: {
      flex: '1', fontSize: '30px', letterSpacing: '12px', color: M.cream,
      border: `1px solid ${M.border}`, borderRadius: '4px', padding: '10px 12px',
      background: M.panelMid, textAlign: 'center',
    }});
    const btnCopy = el('button', { text: '⎘', style: {
      background: M.panelMid, border: `1px solid ${M.border}`, borderRadius: '4px', color: M.cream,
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

    const btnLobby = mkBtn(t('openLobby'), M.accent);
    const btnBack  = mkBtn(t('back'),      M.dimCream);

    btnLobby.addEventListener('click', () => {
      if (!this._config.pilotName?.trim()) { this._showMyPlane(); return; }
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
    this._setCurrentScreen(() => this._showJoin());
    this._showPreview('close');
    this._syncPreviewPlane();
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

    // Couleur d'avion choisie dans le lobby (pas ici) — évite la redondance

    const errMsg = el('div', { text: '', style: { color: M.red, fontSize: '10px', letterSpacing: '2px', minHeight: '14px' }});
    wrap.appendChild(errMsg);

    const btnJoin = mkBtn(t('joinBtn'), M.accent);
    const btnBack = mkBtn(t('back'),   M.dimCream);

    btnJoin.addEventListener('click', () => {
      const code = codeInput.value.trim();
      if (!this._config.pilotName?.trim()) { this._showMyPlane(); return; }
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
    this._setCurrentScreen(() => this._showLobby());
    this._showPreview();
    this._camRadiusTarget = 10.0;
    this._camHeightTarget = 2.4;
    this._hangarOrbit     = true;
    this._syncPreviewPlane();

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
    const body = el('div', { style: { display: 'flex', gap: '24px', alignItems: 'stretch', flex: '1', minHeight: '0', overflow: 'hidden' }});

    // Helpers
    const lbl = (txt) => el('div', { text: txt, style: {
      fontSize: '9px', letterSpacing: '3px', color: M.dimCream, marginTop: '8px', marginBottom: '4px',
    }});
    const divider = () => el('div', { style: { height: '1px', background: M.border, margin: '7px 0' }});

    // ── Colonne gauche : avion + config hôte ──
    const leftCol = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }});

    leftCol.appendChild(lbl(t('gameMode')));

    // Bloc de description — même style que colonne gauche de _showConfig
    const modeDesc = el('div', { style: {
      display: 'flex', flexDirection: 'column', gap: '4px',
    }});
    const renderModeDesc = (mode) => {
      const info = tModeInfo(mode);
      modeDesc.innerHTML = '';
      info.lines.forEach(l => {
        const row = el('div', { style: {
          fontSize: '10px', letterSpacing: '1px', color: M.cream,
          lineHeight: '1.7', paddingLeft: '2px',
        }});
        row.textContent = '· ' + l;
        modeDesc.appendChild(row);
      });
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
        tdmAiSection.style.display      = v === 'tdm'  ? '' : 'none';
        ffaBotSection.style.display     = v === 'ffa'  ? '' : 'none';
        ffaBotDiffSection.style.display = (v === 'ffa' && (this._config.ffaBotCount ?? 0) > 0) ? '' : 'none';
        ffSection.style.display         = ffVisible(v) ? '' : 'none';
        refreshLobbyStats();
        renderPlayers();
        if (nm) nm.send('config_update', { mode: v });
      }
    );
    if (!isHost) { modeGroup.style.pointerEvents = 'none'; modeGroup.style.opacity = '0.45'; }
    leftCol.appendChild(modeGroup);
    leftCol.appendChild(el('div', { style: { height: '1px', background: M.border, margin: '10px 0 8px' }}));
    leftCol.appendChild(lbl(t('descriptif')));
    leftCol.appendChild(modeDesc);

    const optionsWrap = el('div', { style: { position: 'relative' } });
    leftCol.appendChild(optionsWrap);

    // Sélecteur de difficulté IA — visible uniquement en mode MISSION/SURVIE (host only)
    const diffSection = el('div', { style: { display: ['coop','survival'].includes(this._config.mode ?? 'coop') ? '' : 'none' }});
    diffSection.appendChild(lbl(t('aiDiff')));
    const diffChoices = mkChoiceGroup(
      [
        { value: 'easy',     label: t('easy')     },
        { value: 'standard', label: t('standard') },
        { value: 'hard',     label: t('hard')     },
        { value: 'expert',   label: 'EXPERT', color: '#cc22aa' },
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
      [{ value: 40, label: '40' }, { value: 60, label: '60' }, { value: 80, label: '80' }, { value: 120, label: '120' }],
      this._config.totalEnemies ?? 60,
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

    // Avions IA par équipe — Équipes (tdm) uniquement
    const tdmAiSection = el('div', { style: { display: this._config.mode === 'tdm' ? '' : 'none' }});
    tdmAiSection.appendChild(lbl(t('tdmAiCount')));
    const tdmAiChoices = mkChoiceGroup(
      [{ value: 0, label: t('tdmAiNone') }, { value: 2, label: '2' }, { value: 4, label: '4' }, { value: 6, label: '6' }],
      this._config.tdmAiCount ?? 0,
      v => { this._config.tdmAiCount = v; if (nm) nm.send('config_update', { tdmAiCount: v }); }
    );
    if (!isHost) { tdmAiChoices.style.pointerEvents = 'none'; tdmAiChoices.style.opacity = '0.45'; }
    tdmAiSection.appendChild(tdmAiChoices);
    optionsWrap.appendChild(tdmAiSection);

    // Bots IA — Versus (ffa) uniquement, hôte seulement
    let ffaBotDiffSection; // déclaré avant pour forward ref dans le callback
    const ffaBotSection = el('div', { style: { display: this._config.mode === 'ffa' ? '' : 'none' }});
    ffaBotSection.appendChild(lbl(t('ffaBotCount')));
    const ffaBotChoices = mkChoiceGroup(
      [{ value: 0, label: t('ffaBotNone') }, { value: 2, label: '2' }, { value: 4, label: '4' }, { value: 6, label: '6' }, { value: 8, label: '8' }],
      this._config.ffaBotCount ?? 0,
      v => {
        this._config.ffaBotCount = v;
        if (ffaBotDiffSection) ffaBotDiffSection.style.display = v > 0 ? '' : 'none';
        if (nm) nm.send('config_update', { ffaBotCount: v });
      }
    );
    if (!isHost) { ffaBotChoices.style.pointerEvents = 'none'; ffaBotChoices.style.opacity = '0.45'; }
    ffaBotSection.appendChild(ffaBotChoices);
    optionsWrap.appendChild(ffaBotSection);

    ffaBotDiffSection = el('div', { style: { display: (this._config.mode === 'ffa' && (this._config.ffaBotCount ?? 0) > 0) ? '' : 'none' }});
    ffaBotDiffSection.appendChild(lbl(t('ffaBotDiff')));
    const ffaBotDiffChoices = mkChoiceGroup(
      [
        { value: 'easy',     label: t('easy')     },
        { value: 'standard', label: t('standard') },
        { value: 'hard',     label: t('hard')     },
      ],
      this._config.ffaBotDiff ?? 'standard',
      v => { this._config.ffaBotDiff = v; if (nm) nm.send('config_update', { ffaBotDiff: v }); }
    );
    if (!isHost) { ffaBotDiffChoices.style.pointerEvents = 'none'; ffaBotDiffChoices.style.opacity = '0.45'; }
    ffaBotDiffSection.appendChild(ffaBotDiffChoices);
    optionsWrap.appendChild(ffaBotDiffSection);

    // Tir allié — masqué en FFA (pas d'alliés)
    const ffVisible = (v) => v !== 'ffa' && v !== 'freeflight';
    const ffSection = el('div', { style: { display: ffVisible(this._config.mode) ? '' : 'none' }});
    ffSection.appendChild(el('div', { style: { height: '1px', background: M.border, margin: '10px 0' }}));
    ffSection.appendChild(lbl(t('friendlyFire')));
    const ffGroup = mkChoiceGroup(
      [{ value: false, label: t('disabled') }, { value: true, label: t('enabled') }],
      this._config.friendlyFire ?? false,
      v => { this._config.friendlyFire = v; if (nm) nm.send('config_update', { friendlyFire: v }); }
    );
    if (!isHost) { ffGroup.style.pointerEvents = 'none'; ffGroup.style.opacity = '0.45'; }
    ffSection.appendChild(ffGroup);
    // ffSection intégré dans optionsWrap (hauteur fixe) pour éviter les sauts de layout
    optionsWrap.appendChild(ffSection);

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
      planeName: this._progression.getPlane(this._progression.activePlane).name,
      level: this._progression.level,
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
        }
        const pCol  = TEAM_COLORS[p.team]?.hex || M.dimCream;
        // Pastille couleur de l'avion (très petite) + niveau du joueur
        row.appendChild(el('span', { style: {
          display:'inline-block', width:'8px', height:'8px', borderRadius:'50%',
          background: pCol, flexShrink: '0',
        }}));
        const lvl = Number.isFinite(p.level) ? p.level : '?';
        row.appendChild(el('span', { text: `${t('lvlReqPrefix')} ${lvl}`, style: {
          color: M.yellow, fontSize: '9px', letterSpacing: '1px', flexShrink: '0', fontWeight: '600',
        }}));
        row.appendChild(el('span', { text: p.isReady ? '■' : '□', style: { color: p.isReady ? M.green : M.dimCream, fontSize: '12px', flexShrink: '0' }}));
        playerList.appendChild(row);
      });
    };
    renderPlayers();
    playerSection.appendChild(playerList);
    rightCol.appendChild(playerSection);

    // Statut de connexion (juste sous la liste, ne s'étire pas)
    const statusEl = el('div', { text: t('lobbyConnecting'), style: {
      color: M.dimCream, fontSize: '9px', letterSpacing: '1px',
      margin: '5px 0', flexShrink: '0',
    }});
    rightCol.appendChild(statusEl);

    // ── Section basse : carte + stats — collée en bas ────────────────────────
    this._config.maxPlayers = 8;
    const mapSection = el('div', { style: { flexShrink: '0' }});
    mapSection.appendChild(el('div', { style: { height: '1px', background: M.border, margin: '8px 0 4px' }}));
    mapSection.appendChild(lbl(t('map')));
    const lobbyMapCanvas = document.createElement('canvas');
    lobbyMapCanvas.width = 290; lobbyMapCanvas.height = 100;
    Object.assign(lobbyMapCanvas.style, {
      display: 'block',
      border: `1px solid ${M.border}`,
      marginBottom: '6px',
      width: '100%',
      boxSizing: 'border-box',
    });
    this._drawMapPreview(lobbyMapCanvas, this._config.map ?? 4);

    const mapGroup = mkChoiceGroup(
      [{ value: 4, label: t('mapShort_4') }, { value: 5, label: t('mapShort_5') }, { value: 1, label: t('mapShort_1') }],
      this._config.map ?? 4,
      v => { this._config.map = v; this._drawMapPreview(lobbyMapCanvas, v); refreshLobbyStats(); if (nm) nm.send('config_update', { map: v }); }
    );
    if (!isHost) { mapGroup.style.pointerEvents = 'none'; mapGroup.style.opacity = '0.45'; }
    mapSection.appendChild(lobbyMapCanvas);
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

    // (Mon Avion accessible depuis le bloc profil de la topbar)

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

    // Ancre DOM (visée smooth via spring, _updateAnchorTarget) — zone à droite du panneau
    const lobbyAnchor = el('div', { style:{
      position:'absolute', left:'60%', right:'0', top:'10%', bottom:'10%',
      pointerEvents:'none',
    }});
    this._root.appendChild(lobbyAnchor);
    this._planeAnchor = lobbyAnchor;

    // ── Réseau ──
    const launchMultiplayer = (network, config) => {
      // Slot déterministe : tri des IDs → chaque client calcule le même index
      const myId   = network?.id ?? 'local';
      const allIds = players.map(p => (p.id === 'local' ? myId : p.id)).sort();
      const playerSlot = Math.max(0, allIds.indexOf(myId));
      const remotePlayers = players.filter(p => p.id !== 'local' && p.id !== myId);
      // Réglages PARTAGÉS depuis l'hôte uniquement — on conserve l'identité locale
      // (pilotName / team / playerTeam), sinon tous les joueurs héritent du nom,
      // de la couleur et de l'équipe de l'hôte.
      const shared = {};
      for (const k of ['mode', 'map', 'maxPlayers', 'difficulty', 'totalEnemies', 'ffaTimeLimit', 'friendlyFire', 'tdmAiCount', 'ffaBotCount', 'ffaBotDiff']) {
        if (config[k] !== undefined) shared[k] = config[k];
      }
      this._config = {
        ...this._config, ...shared,
        networkManager: network, playerSlot, remotePlayers,
        playerCount: config.playerCount ?? players.length,
      };
      this._resolve(this._config);
      this.hide();
    };

    // Applique un patch de config reçu du serveur et met à jour l'UI en conséquence
    const applyConfigPatch = (patch) => {
      for (const k of ['mode', 'map', 'maxPlayers', 'difficulty', 'totalEnemies', 'ffaTimeLimit', 'friendlyFire', 'tdmAiCount', 'ffaBotCount', 'ffaBotDiff']) {
        if (patch[k] !== undefined) this._config[k] = patch[k];
      }
      if (patch.mode !== undefined) {
        modeGroup.setValue(patch.mode);
        renderModeDesc(patch.mode);
        teamSection.style.display       = patch.mode === 'tdm' ? '' : 'none';
        diffSection.style.display       = ['coop','survival'].includes(patch.mode) ? '' : 'none';
        enemyCountSection.style.display = patch.mode === 'coop' ? '' : 'none';
        timeLimitSection.style.display  = isCompetitive(patch.mode) ? '' : 'none';
        tdmAiSection.style.display      = patch.mode === 'tdm' ? '' : 'none';
        ffaBotSection.style.display     = patch.mode === 'ffa' ? '' : 'none';
        ffaBotDiffSection.style.display = (patch.mode === 'ffa' && (this._config.ffaBotCount ?? 0) > 0) ? '' : 'none';
        ffSection.style.display         = ffVisible(patch.mode) ? '' : 'none';
        refreshLobbyStats();
      }
      if (patch.difficulty   !== undefined) diffChoices.setValue(patch.difficulty);
      if (patch.totalEnemies !== undefined) enemyCountChoices.setValue(patch.totalEnemies);
      if (patch.ffaTimeLimit !== undefined) timeGroup.setValue(patch.ffaTimeLimit);
      if (patch.friendlyFire !== undefined) ffGroup.setValue(patch.friendlyFire);
      if (patch.map          !== undefined) { mapGroup.setValue(patch.map); this._drawMapPreview(lobbyMapCanvas, patch.map); refreshLobbyStats(); }
      if (patch.tdmAiCount   !== undefined) tdmAiChoices.setValue(patch.tdmAiCount);
      if (patch.ffaBotCount  !== undefined) { ffaBotChoices.setValue(patch.ffaBotCount); ffaBotDiffSection.style.display = (this._config.mode === 'ffa' && patch.ffaBotCount > 0) ? '' : 'none'; }
      if (patch.ffaBotDiff   !== undefined) ffaBotDiffChoices.setValue(patch.ffaBotDiff);
      renderPlayers();
    };

    const connectToServer = async () => {
      try {
        const { NetworkManager } = await import('./NetworkManager.js');
        nm = new NetworkManager();
        await nm.connect();

        if (isHost) {
          await nm.createRoom({ code, map: this._config.map, maxPlayers: 8, mode: this._config.mode, name: this._config.pilotName, team: this._config.team, level: self.level, tdmAiCount: this._config.tdmAiCount ?? 0 });
          statusEl.textContent = t('lobbyWaiting');
          statusEl.style.color = M.green;
        } else {
          // Retry si la salle n'existe pas encore (hôte en train de créer la partie)
          let res = null;
          const MAX_RETRIES = 10, RETRY_MS = 3000;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              res = await nm.joinRoom(code, { name: self.name, team: self.team, level: self.level });
              break; // succès
            } catch (err) {
              const msg = err?.message ?? String(err);
              const notFound = msg.includes('introuvable') || msg.includes('not found');
              if (!notFound || attempt >= MAX_RETRIES) throw err;
              statusEl.textContent = `Recherche de la salle ${code}… (${attempt + 1}/${MAX_RETRIES})`;
              statusEl.style.color = M.yellow;
              await new Promise(r => setTimeout(r, RETRY_MS));
            }
          }
          statusEl.textContent = `${t('lobbyConnected')} — ${code}`;
          statusEl.style.color = M.green;
          // Appliquer la config initiale reçue dans la réponse join_room
          if (res?.config) applyConfigPatch(res.config);
          if (res?.players) {
            res.players.forEach(p => { if (p.id !== nm.id) players.push({ ...p, isReady: false }); });
            renderPlayers();
          }
        }

        // Handlers enregistrés APRÈS join/create+res.players, comme avant.
        // Les messages arrivés pendant l'attente (ex. config_update de la race)
        // sont maintenant bufférisés par NetworkManager et rejoués ici.
        nm.on('player_joined',  ({ player })           => {
          players.push({ ...player, isReady: false }); renderPlayers();
          // L'hôte resynchronise le nouvel arrivant (config + couleur courante)
          if (isHost && nm) {
            nm.send('config_update', {
              mode: this._config.mode, map: this._config.map,
              difficulty: this._config.difficulty, totalEnemies: this._config.totalEnemies,
              ffaTimeLimit: this._config.ffaTimeLimit, friendlyFire: this._config.friendlyFire,
              tdmAiCount: this._config.tdmAiCount,
            });
            nm.send('player_plane', { plane: this._config.team, planeName: self.planeName, level: self.level });
          }
          // Diffuse aussi notre niveau (en cas d'absence côté serveur)
          if (nm) nm.send('player_level', { level: self.level });
        });
        nm.on('player_left',    ({ id })               => { const i = players.findIndex(p => p.id === id); if (i > -1) players.splice(i, 1); renderPlayers(); });
        nm.on('player_ready',   ({ id, ready })        => { const p = players.find(p => p.id === id); if (p) { p.isReady = ready; renderPlayers(); } });
        nm.on('player_plane',   ({ id, plane, planeName, level }) => { const p = players.find(p => p.id === id); if (p) { p.team = plane; if (planeName !== undefined) p.planeName = planeName; if (Number.isFinite(level)) p.level = level; renderPlayers(); } });
        nm.on('player_level',   ({ id, level })        => { const p = players.find(p => p.id === id); if (p && Number.isFinite(level)) { p.level = level; renderPlayers(); } });
        nm.on('player_team',    ({ id, playerTeam })   => { const p = players.find(p => p.id === id); if (p) { p.playerTeam = playerTeam; renderPlayers(); } });
        nm.on('config_update',  applyConfigPatch);
        nm.on('game_start',     ({ config })           => launchMultiplayer(nm, config));
        nm.on('return_lobby',   ()                     => this._showLobby());
        // L'hôte a quitté pendant qu'on est dans le lobby → retour à l'accueil.
        // (En partie, c'est Game.js qui gère ; le menu est alors masqué.)
        nm.on('host_left',      ()                     => {
          if (this._root && this._root.isConnected) { nm.disconnect(); this._showMain(); }
        });

        this._config.networkManager = nm;
      } catch {
        statusEl.textContent = t('lobbyServerDown');
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
    const returnFn = this._settingsReturn || (() => this._showMain());
    this._clear();
    this._showPreview('settings');
    this._syncPreviewPlane();
    // Panneau élargi pour tenir en 2×2 sans scroll
    const wrap = mkPanelLeft('min(820px, 88vw)');
    wrap.style.gap = '8px';

    // ── Titre ─────────────────────────────────────────────────────────────────
    const titleEl = mkSectionTitle(t('settings'));
    titleEl.style.cursor = 'default';
    wrap.appendChild(titleEl);
    wrap.appendChild(mkDivider());

    // ── Helpers ───────────────────────────────────────────────────────────────
    const mkCard = (labelText) => {
      const card = el('div', { style: {
        border: `1px solid ${M.border}44`, borderRadius: '6px',
        padding: '12px 14px', background: 'rgba(212,200,138,0.02)',
        display: 'flex', flexDirection: 'column', gap: '0',
      }});
      card.appendChild(el('div', { text: labelText, style: {
        fontSize: '8px', letterSpacing: '3px', color: M.dimCream,
        fontFamily: 'Rajdhani, sans-serif', fontWeight: '700',
        marginBottom: '8px', textTransform: 'uppercase',
      }}));
      return card;
    };

    const mkSecBtn = (label, onClick, danger = false) => {
      const b = el('button', { text: label, style: {
        padding: '6px 14px', background: 'transparent',
        border: `1px solid ${danger ? '#883322' : M.border}`, borderRadius: '4px',
        color: danger ? '#cc5533' : M.dimCream,
        fontFamily: 'Rajdhani, sans-serif', fontSize: '11px', letterSpacing: '2px',
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }});
      b.addEventListener('mouseover', () => { b.style.color = danger ? '#ee7755' : M.cream; b.style.borderColor = danger ? '#aa4422' : M.cream; if (danger) b.style.background = '#44110a18'; });
      b.addEventListener('mouseout',  () => { b.style.color = danger ? '#cc5533' : M.dimCream; b.style.borderColor = danger ? '#883322' : M.border; b.style.background = 'transparent'; });
      b.addEventListener('click', onClick);
      return b;
    };

    // ── GRILLE 2×2 ────────────────────────────────────────────────────────────
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }});

    // Cellule 1 — Audio
    const cardAudio = mkCard(t('audio'));
    cardAudio.appendChild(this._mkAudioSection(this._audio ?? null));
    grid.appendChild(cardAudio);

    // Cellule 2 — Affichage
    const GFX_MODES = [
      { value: 0, label: t('gfxHigh'), color: M.cream,   desc: t('gfxHighDesc') },
      { value: 1, label: t('gfxMed'),  color: '#ccaa33', desc: t('gfxMedDesc')  },
      { value: 2, label: t('gfxLow'),  color: '#dd6633', desc: t('gfxLowDesc')  },
    ];
    const curGfx  = parseInt(localStorage.getItem('lowGraphics') || '0', 10);
    const gfxDesc = el('div', { style: { fontSize: '9px', color: M.dimCream, letterSpacing: '1px', lineHeight: '1.5', marginTop: '6px', minHeight: '22px' }});
    gfxDesc.textContent = GFX_MODES.find(m => m.value === curGfx)?.desc ?? '';
    const cardGfx = mkCard(t('graphicsQuality'));
    cardGfx.appendChild(mkChoiceGroup(GFX_MODES.map(({ value, label, color }) => ({ value, label, color })), curGfx,
      v => { localStorage.setItem('lowGraphics', String(v)); gfxDesc.textContent = GFX_MODES.find(m => m.value === v)?.desc ?? ''; }));
    cardGfx.appendChild(gfxDesc);
    grid.appendChild(cardGfx);

    // Cellule 3 — Contrôles
    const CTRL_MODES = [
      { value: 'standard',  label: t('ctrlStd'), color: M.cream,   desc: t('ctrlStdDesc') },
      { value: 'simulator', label: t('ctrlSim'), color: '#88aacc', desc: t('ctrlSimDesc') },
    ];
    const curCtrl  = localStorage.getItem('ctrlMode') || 'standard';
    const ctrlDesc = el('div', { style: { fontSize: '9px', color: M.dimCream, letterSpacing: '1px', lineHeight: '1.5', marginTop: '6px', minHeight: '22px' }});
    ctrlDesc.textContent = CTRL_MODES.find(m => m.value === curCtrl)?.desc ?? '';
    const cardCtrl = mkCard(t('ctrlMode'));
    cardCtrl.appendChild(mkChoiceGroup(CTRL_MODES.map(({ value, label, color }) => ({ value, label, color })), curCtrl,
      v => { localStorage.setItem('ctrlMode', v); ctrlDesc.textContent = CTRL_MODES.find(m => m.value === v)?.desc ?? ''; }));
    cardCtrl.appendChild(ctrlDesc);
    const ctrlBtnSep = el('div', { style: { marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${M.border}44` }});
    ctrlBtnSep.appendChild(mkSecBtn(t('controls') || 'COMMANDES', () => this._showControls()));
    cardCtrl.appendChild(ctrlBtnSep);
    grid.appendChild(cardCtrl);

    // Cellule 4 — Sauvegarde
    const SAVE_KEYS = [
      'cielDeFeu_progression', 'cielDeFeu_tutorialDisabled',
      'pilotName', 'lang', 'ctrlMode', 'lowGraphics', 'audio_music', 'audio_sfx',
    ];
    const allSaveKeys = () => {
      const keys = [...SAVE_KEYS];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('stats_') && !keys.includes(k)) keys.push(k);
      }
      return keys;
    };
    const cardSave = mkCard('SAUVEGARDE');
    const saveHint = el('div', { text: t('exportDesc'), style: { fontSize: '9px', color: M.dimCream, letterSpacing: '1px', lineHeight: '1.5', opacity: '0.7', marginBottom: '8px' }});
    cardSave.appendChild(saveHint);
    const saveRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' }});
    saveRow.appendChild(mkSecBtn(t('exportSave') || '↓  EXPORTER', () => {
      const data = {};
      allSaveKeys().forEach(k => { const v = localStorage.getItem(k); if (v !== null) data[k] = v; });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `ciel-de-feu-save-${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    }));
    saveRow.appendChild(mkSecBtn(t('importSave') || '↑  IMPORTER', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json,application/json';
      input.addEventListener('change', () => {
        const file = input.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (typeof data !== 'object' || Array.isArray(data)) throw new Error();
            if (!confirm(t('importConfirm'))) return;
            Object.entries(data).forEach(([k, v]) => { if (typeof v === 'string') localStorage.setItem(k, v); });
            this._progression = new ProgressionSystem(); alert(t('importSuccess')); this._showSettings();
          } catch { alert(t('importError')); }
        };
        reader.readAsText(file);
      });
      input.click();
    }));
    cardSave.appendChild(saveRow);
    const resetSep = el('div', { style: { marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${M.border}44`, display: 'flex', justifyContent: 'flex-end' }});
    resetSep.appendChild(mkSecBtn(t('cheatReset'), () => {
      if (confirm(t('resetConfirm'))) {
        localStorage.removeItem('cielDeFeu_progression');
        this._progression = new ProgressionSystem(); this._showSettings();
      }
    }, true));
    cardSave.appendChild(resetSep);
    grid.appendChild(cardSave);

    wrap.appendChild(grid);

    // ── Panneau dev caché (pleine largeur, 5 clics sur le titre) ─────────────
    const devPanel = el('div', { style: { display: 'none', padding: '10px 14px', border: `1px dashed #553300`, borderRadius: '6px', background: '#0a0700' }});
    devPanel.appendChild(el('div', { text: '⚠  DEV PANEL', style: { fontSize: '8px', color: '#aa6633', letterSpacing: '3px', marginBottom: '8px' }}));
    const devRow = el('div', { style: { display: 'flex', gap: '8px' }});
    const mkDevBtn = (label, fn) => {
      const b = el('button', { text: label, style: { padding: '4px 10px', background: 'transparent', border: `1px solid #553300`, color: '#aa6633', fontFamily: 'Rajdhani, sans-serif', fontSize: '9px', letterSpacing: '1px', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.1s' }});
      b.addEventListener('click', fn);
      b.addEventListener('mouseover', () => { b.style.color = '#cc8844'; b.style.borderColor = '#cc8844'; });
      b.addEventListener('mouseout',  () => { b.style.color = '#aa6633'; b.style.borderColor = '#553300'; });
      return b;
    };
    devRow.appendChild(mkDevBtn(t('cheatLevels'), () => {
      const p = this._progression;
      for (let i = 0; i < 10; i++) { const xp = xpToNextLevel(p.level) - p.levelInfo.xpInLevel; p.addRewards(xp + 1, 0); }
      this._showSettings();
    }));
    devRow.appendChild(mkDevBtn(t('cheatCredits'), () => { this._progression.addRewards(0, 50000); this._showSettings(); }));
    devPanel.appendChild(devRow);
    wrap.appendChild(devPanel);

    let devClicks = 0, devTimer = 0;
    titleEl.addEventListener('click', () => {
      devClicks++;
      clearTimeout(devTimer);
      devTimer = setTimeout(() => { devClicks = 0; }, 3000);
      if (devClicks >= 5) { devPanel.style.display = devPanel.style.display === 'none' ? 'block' : 'none'; devClicks = 0; }
    });

    // ── Retour ─────────────────────────────────────────────────────────────────
    wrap.appendChild(mkDivider());
    const btnBack = mkBtn(t('back'), M.dimCream);
    btnBack.addEventListener('click', () => returnFn());
    wrap.appendChild(btnBack);
    this._root.appendChild(wrap);
  }

  // ── Page commandes (clavier + manette) ───────────────────────────────────
  _showControls() {
    this._clear();
    this._showPreview('settings');
    this._syncPreviewPlane();

    const wrap = el('div', { style: {
      position: 'absolute', inset: '0',
      background: 'rgba(4,4,3,0.97)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Rajdhani, sans-serif', color: M.cream,
    }});

    // Top bar
    const topBar = el('div', { style: {
      height: '54px', flexShrink: '0',
      background: 'rgba(6,6,5,0.98)',
      borderBottom: `1px solid ${M.border}`,
      display: 'flex', alignItems: 'stretch',
    }});
    const titleArea = el('div', { style: {
      flex: '1', display: 'flex', alignItems: 'center', gap: '14px', padding: '0 32px',
    }});
    const mkHLine = () => el('div', { style: { flex: '1', height: '1px', background: M.border }});
    const mkStar2 = () => el('div', { text: '✦', style: { color: M.accent, fontSize: '12px', flexShrink: '0' }});
    titleArea.appendChild(mkHLine()); titleArea.appendChild(mkStar2());
    titleArea.appendChild(el('div', { text: t('controls') || 'COMMANDES', style: {
      fontSize: '18px', fontWeight: '800', letterSpacing: '6px', flexShrink: '0',
    }}));
    titleArea.appendChild(mkStar2()); titleArea.appendChild(mkHLine());
    topBar.appendChild(titleArea);

    const backBtn = el('button', { text: t('backToSettings'), style: {
      padding: '0 26px', background: M.accentDim, border: 'none',
      borderLeft: `1px solid ${M.border}`,
      color: M.cream, fontFamily: 'Rajdhani, sans-serif',
      fontSize: '13px', letterSpacing: '3px', cursor: 'pointer',
      fontWeight: 'bold', flexShrink: '0', transition: 'background 0.1s',
    }});
    const backActive   = () => css(backBtn, { background: '#8a2200' });
    const backInactive = () => css(backBtn, { background: M.accentDim });
    backBtn.addEventListener('click',     () => this._showSettings());
    backBtn.addEventListener('mouseover', backActive);
    backBtn.addEventListener('mouseout',  backInactive);
    backBtn.addEventListener('touchstart', backActive,   { passive: true });
    backBtn.addEventListener('touchend',   backInactive, { passive: true });
    topBar.appendChild(backBtn);
    wrap.appendChild(topBar);

    // ── Mode tabs ──
    const TAB_KEYS = IS_MOBILE ? ['touch'] : ['std', 'sim', 'touch'];
    let ctrlTabMode = IS_MOBILE ? 'touch'
      : (localStorage.getItem('ctrlMode') === 'simulator' ? 'sim' : 'std');
    const tabBar = el('div', { style: {
      display: 'flex', flexShrink: '0',
      borderBottom: `1px solid ${M.border}`,
      background: 'rgba(8,8,6,0.95)',
    }});
    const refreshTabs = () => {
      tabBar.querySelectorAll('button').forEach((tb, i) => {
        const active = TAB_KEYS[i] === ctrlTabMode;
        Object.assign(tb.style, {
          background: active ? M.panelMid : 'transparent',
          borderBottom: active ? `2px solid ${M.accent}` : '2px solid transparent',
          color: active ? M.cream : M.dimCream,
          fontWeight: active ? '800' : '600',
        });
      });
    };
    const mkCtrlTab = (label, key) => {
      const b = el('button', { text: label, style: {
        padding: '12px 32px', background: key === ctrlTabMode ? M.panelMid : 'transparent',
        border: 'none', borderBottom: key === ctrlTabMode ? `2px solid ${M.accent}` : '2px solid transparent',
        color: key === ctrlTabMode ? M.cream : M.dimCream,
        fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', letterSpacing: '3px',
        fontWeight: key === ctrlTabMode ? '800' : '600', cursor: 'pointer', transition: 'all 0.15s',
      }});
      b.addEventListener('click', () => { ctrlTabMode = key; rebuildMain(); refreshTabs(); });
      return b;
    };
    if (!IS_MOBILE) {
      tabBar.appendChild(mkCtrlTab(t('ctrlStd') || 'STANDARD',   'std'));
      tabBar.appendChild(mkCtrlTab(t('ctrlSim') || 'SIMULATEUR', 'sim'));
    }
    tabBar.appendChild(mkCtrlTab(t('mobileCtrl') || 'TACTILE', 'touch'));
    wrap.appendChild(tabBar);

    // Two columns — clavier 60%, manette 40%
    let main = el('div', { style: { flex: '1', display: 'flex', overflow: 'hidden' }});

    const mkColumn = (titleKey, fallback, flex = '1') => {
      const panel = el('div', { style: {
        flex, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }});
      const hdr = el('div', { style: {
        padding: '16px 36px 14px', flexShrink: '0',
        borderBottom: `1px solid ${M.border}44`,
      }});
      hdr.appendChild(el('div', { text: t(titleKey) || fallback, style: {
        fontSize: '14px', letterSpacing: '4px', color: M.dimCream, fontWeight: '700',
      }}));
      panel.appendChild(hdr);
      const scroll = el('div', { style: { flex: '1', overflowY: 'auto', padding: '24px 36px' }});
      panel.appendChild(scroll);
      return { panel, scroll };
    };

    const rebuildMain = () => {
      main.remove();
      main = el('div', { style: { flex: '1', display: 'flex', overflow: 'hidden' }});
      if (ctrlTabMode === 'touch') {
        const { panel: mobilePanel, scroll: mobileScroll } = mkColumn('mobileCtrl', 'TACTILE', '1');
        mobileScroll.appendChild(this._buildMobileControlsPanel());
        mobileScroll.appendChild(this._buildMobileGyroPanel());
        main.appendChild(mobilePanel);
      } else {
        const { panel: kbPanel, scroll: kbScroll } = mkColumn('kbCtrl', 'CLAVIER', '3');
        kbScroll.appendChild(ctrlTabMode === 'sim' ? this._buildKeyboardSVGSim() : this._buildKeyboardSVG());
        main.appendChild(kbPanel);
        main.appendChild(el('div', { style: { width: '1px', background: M.border, flexShrink: '0' }}));
        const { panel: gpPanel, scroll: gpScroll } = mkColumn('xboxCtrl', 'MANETTE XBOX', '2');
        gpScroll.appendChild(this._buildGamepadSVG());
        main.appendChild(gpPanel);
      }
      wrap.appendChild(main);
    };
    rebuildMain();

    this._root.appendChild(wrap);
  }

  _buildMobileControlsPanel() {
    const wrap = el('div', { style: { maxWidth: '680px' }});

    // Tip
    const tipEl = el('div', { style: {
      fontSize: '10px', letterSpacing: '2px', color: M.dimCream,
      marginBottom: '28px', borderLeft: `3px solid ${M.border}`, paddingLeft: '12px',
    }});
    tipEl.textContent = t('mobileTip') || 'Disponible automatiquement sur appareil tactile';
    wrap.appendChild(tipEl);

    // Schéma SVG des contrôles mobiles
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 560 300');
    svg.style.cssText = 'width:100%;max-width:560px;display:block;margin-bottom:28px;';

    const mk = (tag, attrs, txt) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      if (txt) e.textContent = txt;
      svg.appendChild(e);
      return e;
    };

    const cream = '#d4c88a'; const dim = '#7a7060'; const red = '#cc3820';

    // Fond écran
    mk('rect', { x:10, y:10, width:540, height:280, rx:14,
      fill:'rgba(10,8,4,0.6)', stroke:'#3a3428', 'stroke-width':1.5 });

    // Zone gauche (joystick)
    mk('rect', { x:20, y:20, width:240, height:260, rx:8,
      fill:'rgba(255,255,255,0.03)', stroke:'#3a3428', 'stroke-width':1 });
    mk('text', { x:140, y:42, 'text-anchor':'middle', fill:dim,
      'font-size':9, 'letter-spacing':2, 'font-family':'Courier New' },
      '— ZONE GAUCHE —');

    // Joystick base
    mk('circle', { cx:140, cy:160, r:52, fill:'none',
      stroke: cream, 'stroke-opacity':0.25, 'stroke-width':1.5 });
    mk('circle', { cx:140, cy:160, r:52, fill:'rgba(212,200,138,0.05)' });
    // Knob décalé (illustration d'un virage droite+monter)
    mk('circle', { cx:162, cy:142, r:22, fill:'rgba(212,200,138,0.35)',
      stroke:cream, 'stroke-width':1.5 });
    // Flèches directionnelles
    const arrow = (x, y, dx, dy) => {
      const x2 = x + dx * 28, y2 = y + dy * 28;
      mk('line', { x1:x, y1:y, x2, y2, stroke:cream, 'stroke-opacity':0.3, 'stroke-width':1 });
      mk('polygon', {
        points:`${x2},${y2} ${x2 - dy*4 - dx*5},${y2 + dx*4 - dy*5} ${x2 + dy*4 - dx*5},${y2 - dx*4 - dy*5}`,
        fill:cream, 'fill-opacity':0.3,
      });
    };
    arrow(140, 160, 0, -1); arrow(140, 160, 0, 1);
    arrow(140, 160, -1, 0); arrow(140, 160, 1, 0);
    mk('text', { x:140, y:228, 'text-anchor':'middle', fill:cream,
      'font-size':10, 'letter-spacing':1, 'font-family':'Courier New' },
      t('mobileJoy') || 'Joystick gauche');

    // Zone droite
    mk('rect', { x:280, y:20, width:270, height:260, rx:8,
      fill:'rgba(255,255,255,0.03)', stroke:'#3a3428', 'stroke-width':1 });
    mk('text', { x:415, y:42, 'text-anchor':'middle', fill:dim,
      'font-size':9, 'letter-spacing':2, 'font-family':'Courier New' },
      '— ZONE DROITE —');

    // Bouton PAUSE (coin haut)
    mk('rect', { x:498, y:56, width:38, height:38, rx:6,
      fill:'rgba(10,8,4,0.6)', stroke:cream, 'stroke-opacity':0.6, 'stroke-width':1.2 });
    mk('text', { x:517, y:80, 'text-anchor':'middle', fill:cream, 'font-size':13 }, '❚❚');
    mk('text', { x:517, y:108, 'text-anchor':'middle', fill:dim,
      'font-size':8, 'letter-spacing':1, 'font-family':'Courier New' },
      t('mobilePause') || 'PAUSE');

    // Bouton MISSILE
    mk('circle', { cx:355, cy:138, r:22, fill:'rgba(10,8,4,0.6)',
      stroke:cream, 'stroke-opacity':0.7, 'stroke-width':1.2 });
    mk('text', { x:355, y:146, 'text-anchor':'middle', fill:cream, 'font-size':16 }, '🚀');
    mk('text', { x:355, y:174, 'text-anchor':'middle', fill:dim,
      'font-size':8, 'letter-spacing':1, 'font-family':'Courier New' },
      t('mobileMiss') || 'MISSILE');

    // Bouton LEURRE
    mk('circle', { cx:425, cy:210, r:18, fill:'rgba(10,8,4,0.6)',
      stroke:cream, 'stroke-opacity':0.7, 'stroke-width':1.2 });
    mk('text', { x:425, y:217, 'text-anchor':'middle', fill:cream, 'font-size':13 }, '✦');
    mk('text', { x:425, y:240, 'text-anchor':'middle', fill:dim,
      'font-size':8, 'letter-spacing':1, 'font-family':'Courier New' },
      t('mobileDecoy') || 'LEURRE');

    // Bouton GAZ (allongé)
    mk('rect', { x:480, y:152, width:42, height:80, rx:21,
      fill:'rgba(10,8,4,0.6)', stroke:cream, 'stroke-opacity':0.7, 'stroke-width':1.2 });
    mk('text', { x:501, y:188, 'text-anchor':'middle', fill:cream, 'font-size':14 }, '▲');
    mk('text', { x:501, y:202, 'text-anchor':'middle', fill:dim,
      'font-size':7, 'letter-spacing':2, 'font-family':'Courier New' }, 'GAZ');
    mk('text', { x:501, y:248, 'text-anchor':'middle', fill:dim,
      'font-size':8, 'letter-spacing':1, 'font-family':'Courier New' },
      t('mobileThr') || 'GAZ');

    // Bouton TIR (grand)
    mk('circle', { cx:375, cy:232, r:34, fill:'rgba(160,30,10,0.35)',
      stroke:red, 'stroke-opacity':0.8, 'stroke-width':1.5 });
    mk('text', { x:375, y:248, 'text-anchor':'middle', fill:cream, 'font-size':26 }, '🔥');
    mk('text', { x:375, y:278, 'text-anchor':'middle', fill:dim,
      'font-size':8, 'letter-spacing':1, 'font-family':'Courier New' },
      t('mobileFire') || 'TIR');

    wrap.appendChild(svg);

    // Tableau des actions
    const rows = [
      ['mobileJoy',    'mobileJoyDesc'],
      ['mobileFire',   'mobileFireDesc'],
      ['mobileThr',    'mobileThrDesc'],
      ['mobileMiss',   'mobileMissDesc'],
      ['mobileDecoy',  'mobileDecoyDesc'],
      ['mobilePause',  'mobilePauseDesc'],
    ];
    const table = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' }});
    rows.forEach(([nameKey, descKey]) => {
      const row = el('div', { style: {
        display: 'flex', gap: '12px', alignItems: 'center',
        padding: '6px 0', borderBottom: `1px solid ${M.border}44`,
      }});
      row.appendChild(el('div', { text: t(nameKey) || nameKey, style: {
        fontSize: '10px', letterSpacing: '2px', color: M.cream, fontFamily: 'Courier New',
        minWidth: '160px', flexShrink: '0',
      }}));
      row.appendChild(el('div', { text: t(descKey) || descKey, style: {
        fontSize: '10px', letterSpacing: '1px', color: M.dimCream, fontFamily: 'Courier New',
      }}));
      table.appendChild(row);
    });
    wrap.appendChild(table);
    return wrap;
  }

  _buildMobileGyroPanel() {
    const M2 = { cream:'#d4c88a', dim:'#8a8060', border:'#3a3020', panel:'rgba(10,8,4,0.5)' };
    const wrap = el('div', { style: { maxWidth: '500px', marginTop: '32px' }});

    const secLabel = (txt) => el('div', { text: txt, style: {
      fontSize: '11px', letterSpacing: '4px', color: M2.dim,
      fontFamily: 'Rajdhani, sans-serif', fontWeight: '700',
      borderBottom: `1px solid ${M2.border}`, paddingBottom: '8px', marginBottom: '16px',
    }});

    wrap.appendChild(secLabel(t('mobileCtrlMode')));

    // Toggle boutons
    const toggleRow = el('div', { style: { display: 'flex', gap: '12px', marginBottom: '20px' }});

    const mkModeBtn = (label, mode) => {
      const isActive = () => (localStorage.getItem('mobileCtrlMode') || 'joystick') === mode;
      const b = el('button', { text: label, style: {
        flex: '1', padding: '14px 0', borderRadius: '4px', cursor: 'pointer',
        border: `1px solid ${isActive() ? M2.cream : M2.border}`,
        background: isActive() ? 'rgba(212,200,138,0.1)' : 'transparent',
        color: isActive() ? M2.cream : M2.dim,
        fontFamily: '"Courier New",monospace', fontSize: '12px', letterSpacing: '3px',
        transition: 'all 0.15s',
      }});
      const refresh = () => {
        const active = isActive();
        b.style.border = `1px solid ${active ? M2.cream : M2.border}`;
        b.style.background = active ? 'rgba(212,200,138,0.1)' : 'transparent';
        b.style.color = active ? M2.cream : M2.dim;
      };
      b.addEventListener('click', () => {
        localStorage.setItem('mobileCtrlMode', mode);
        toggleRow.querySelectorAll('button').forEach(bt => bt.dispatchEvent(new Event('refresh')));
        gyroSect.style.display = mode === 'gyro' ? '' : 'none';
      });
      b.addEventListener('refresh', refresh);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); b.click(); }, { passive: false });
      return b;
    };

    toggleRow.appendChild(mkModeBtn(t('mobileJoystick'), 'joystick'));
    toggleRow.appendChild(mkModeBtn(t('mobileGyro'), 'gyro'));
    wrap.appendChild(toggleRow);

    const isGyro = (localStorage.getItem('mobileCtrlMode') || 'joystick') === 'gyro';
    const gyroSect = el('div', { style: { display: isGyro ? '' : 'none' }});

    gyroSect.appendChild(secLabel(t('gyroSensitivity')));

    const sliderRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }});
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0.3'; slider.max = '3.0'; slider.step = '0.1';
    slider.value = localStorage.getItem('mobileGyroSens') || '1.0';
    slider.style.cssText = `flex:1; accent-color:${M2.cream}; cursor:pointer;`;
    const sensVal = el('div', {
      text: Number(slider.value).toFixed(1) + '×',
      style: { fontFamily: '"Courier New",monospace', fontSize: '13px', color: M2.cream, minWidth: '36px', textAlign: 'right' },
    });
    slider.addEventListener('input', () => {
      localStorage.setItem('mobileGyroSens', slider.value);
      sensVal.textContent = Number(slider.value).toFixed(1) + '×';
    });
    sliderRow.appendChild(slider);
    sliderRow.appendChild(sensVal);
    gyroSect.appendChild(sliderRow);

    const gyroNote = el('div', { text: t('gyroCalibrateDesc'), style: {
      fontSize: '11px', color: M2.dim, fontFamily: 'Rajdhani, sans-serif',
      borderLeft: `3px solid ${M2.border}`, paddingLeft: '10px', lineHeight: '1.5',
    }});
    gyroSect.appendChild(gyroNote);
    wrap.appendChild(gyroSect);

    return wrap;
  }

  _buildKeyboardSVG() {
    const NS = 'http://www.w3.org/2000/svg';
    const KB = tCtrlKb();
    const spaceKey = getLang() === 'en' ? 'SPACE' : 'ESPACE';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 620 290');
    svg.style.cssText = 'width:100%;max-width:620px;display:block;';

    const mk = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      return e;
    };

    // h=44, gap=4 between rows
    const KEY_H = 44;
    const key = (x, y, w, label, sub, bg = M.panel, fg = M.cream) => {
      svg.appendChild(mk('rect', { x, y, width: w, height: KEY_H, rx: 5, fill: bg, stroke: M.border, 'stroke-width': 1.2 }));
      svg.appendChild(mk('rect', { x: x+1.5, y: y+1.5, width: w-3, height: KEY_H-3, rx: 4, fill: 'none', stroke: 'rgba(212,200,138,0.06)', 'stroke-width': 1 }));
      const fsz = label.length >= 6 ? 9 : label.length >= 4 ? 10 : label.length >= 3 ? 12 : 15;
      const mainY = sub ? y + 16 : y + 22;
      const tm = mk('text', { x: x + w/2, y: mainY, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Rajdhani,sans-serif', 'font-size': fsz, 'font-weight': 800, fill: fg });
      tm.textContent = label;
      svg.appendChild(tm);
      if (sub) {
        const sfg = (fg === M.accent) ? '#ee6644' : M.dimCream;
        const ts = mk('text', { x: x + w/2, y: y + 33, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-family': 'Rajdhani,sans-serif', 'font-size': 10, fill: sfg });
        ts.textContent = sub;
        svg.appendChild(ts);
      }
    };

    // Row 0 y=8: ESC + TAB
    key(0,   8, 51, 'ESC',   KB.esc);
    key(110, 8, 65, 'TAB',   KB.tab);

    // Row 1 y=56: SHIFT + Q W E  R F G H V C
    key(0,   56, 79, 'SHIFT', KB.shift);
    key(83,  56, 51, 'Q',     KB.q);
    key(138, 56, 51, 'W',     KB.w);
    key(193, 56, 51, 'E',     KB.e);
    key(274, 56, 51, 'R',     KB.r);
    key(329, 56, 51, 'F',     KB.f, '#261a08', M.yellow);
    key(384, 56, 51, 'G',     KB.g, '#0e1e0e', M.green);
    key(439, 56, 51, 'H',     KB.h, M.panel,   M.dimCream);
    key(494, 56, 51, 'V',     KB.v);
    key(549, 56, 51, 'C',     KB.c);

    // Row 2 y=104: CTRL + A S D
    key(0,   104, 79, 'CTRL',  KB.ctrl);
    key(83,  104, 51, 'A',     KB.a);
    key(138, 104, 51, 'S',     KB.s);
    key(193, 104, 51, 'D',     KB.d);

    // Row 3 y=152: ESPACE
    key(83, 152, 226, spaceKey, KB.space, '#2a1008', M.accent);

    // Separator
    svg.appendChild(mk('line', { x1: 0, y1: 208, x2: 620, y2: 208, stroke: M.border, 'stroke-width': '0.6' }));

    // Notes (12px)
    const note = (y, str, color = M.dimCream) => {
      const tn = mk('text', { x: 0, y, 'text-anchor': 'start', 'dominant-baseline': 'middle',
        'font-family': 'Rajdhani,sans-serif', 'font-size': 12, fill: color });
      tn.textContent = str;
      svg.appendChild(tn);
    };
    note(224, KB.noteMouse);
    note(244, KB.noteClick);
    note(266, KB.noteTurbo, M.yellow);
    note(286, KB.noteDebug, '#4a4030');

    return svg;
  }

  _buildKeyboardSVGSim() {
    const NS = 'http://www.w3.org/2000/svg';
    const KB = tCtrlKb();
    const spaceKey = getLang() === 'en' ? 'SPACE' : 'ESPACE';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 620 290');
    svg.style.cssText = 'width:100%;max-width:620px;display:block;';

    const mk = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      return e;
    };

    const KEY_H = 44;
    const key = (x, y, w, label, sub, bg = M.panel, fg = M.cream) => {
      svg.appendChild(mk('rect', { x, y, width: w, height: KEY_H, rx: 5, fill: bg, stroke: M.border, 'stroke-width': 1.2 }));
      svg.appendChild(mk('rect', { x: x+1.5, y: y+1.5, width: w-3, height: KEY_H-3, rx: 4, fill: 'none', stroke: 'rgba(212,200,138,0.06)', 'stroke-width': 1 }));
      const fsz = label.length >= 6 ? 9 : label.length >= 4 ? 10 : label.length >= 3 ? 12 : 15;
      const mainY = sub ? y + 16 : y + 22;
      const tm = mk('text', { x: x + w/2, y: mainY, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Rajdhani,sans-serif', 'font-size': fsz, 'font-weight': 800, fill: fg });
      tm.textContent = label;
      svg.appendChild(tm);
      if (sub) {
        const sfg = (fg === M.accent) ? '#ee6644' : M.dimCream;
        const ts = mk('text', { x: x + w/2, y: y + 33, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-family': 'Rajdhani,sans-serif', 'font-size': 10, fill: sfg });
        ts.textContent = sub;
        svg.appendChild(ts);
      }
    };

    // Row 0 y=8: ESC + TAB
    key(0,   8, 51, 'ESC',   KB.esc);
    key(110, 8, 65, 'TAB',   KB.tab);

    // Row 1 y=56: SHIFT + Q W E  R F G H V C  (same as standard)
    key(0,   56, 79, 'SHIFT', KB.shift);
    key(83,  56, 51, 'Q',     KB.q);
    key(138, 56, 51, 'W',     KB.simW);
    key(193, 56, 51, 'E',     KB.e);
    key(274, 56, 51, 'R',     KB.r);
    key(329, 56, 51, 'F',     KB.f, '#261a08', M.yellow);
    key(384, 56, 51, 'G',     KB.g, '#0e1e0e', M.green);
    key(439, 56, 51, 'H',     KB.h, M.panel,   M.dimCream);
    key(494, 56, 51, 'V',     KB.v);
    key(549, 56, 51, 'C',     KB.c);

    // Row 2 y=104: CTRL + A S D
    key(0,   104, 79, 'CTRL',  KB.ctrl);
    key(83,  104, 51, 'A',     KB.simA);
    key(138, 104, 51, 'S',     KB.simS);
    key(193, 104, 51, 'D',     KB.simD);

    // Row 3 y=152: ESPACE
    key(83, 152, 226, spaceKey, KB.space, '#2a1008', M.accent);

    // Separator
    svg.appendChild(mk('line', { x1: 0, y1: 208, x2: 620, y2: 208, stroke: M.border, 'stroke-width': '0.6' }));

    const note = (y, str, color = M.dimCream) => {
      const tn = mk('text', { x: 0, y, 'text-anchor': 'start', 'dominant-baseline': 'middle',
        'font-family': 'Rajdhani,sans-serif', 'font-size': 12, fill: color });
      tn.textContent = str;
      svg.appendChild(tn);
    };
    note(224, KB.noteSimRoll);
    note(244, KB.noteSimPitch);
    note(266, KB.noteClick);
    note(286, KB.noteDebug, '#4a4030');

    return svg;
  }

  _buildGamepadSVG() {
    const NS = 'http://www.w3.org/2000/svg';

    const mk = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      return e;
    };
    const mkTxt = (x, y, str, size = 11, weight = 700, color = M.dimCream) => {
      const tt = mk('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Rajdhani,sans-serif', 'font-size': size, 'font-weight': weight, fill: color });
      tt.textContent = str;
      return tt;
    };

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 460 275');
    svg.style.cssText = 'width:100%;max-width:460px;display:block;';

    // ── Silhouette Xbox controller ────────────────────────────────────────
    // Path trace : shoulder/trigger top → right arc → right grip → waist bottom
    //              → left grip → left arc → back to top. Forme caractéristique Xbox.
    const BODY = 'M 110,62 L 162,57 L 167,74 L 293,74 L 298,57 L 350,62 ' +
      'C 378,68 398,88 400,112 L 398,138 C 396,155 386,168 372,174 ' +
      'L 360,190 C 358,210 355,232 354,248 ' +
      'C 350,265 333,273 310,268 C 288,262 278,244 276,222 L 270,198 ' +
      'L 190,198 L 184,222 C 182,244 172,262 150,268 ' +
      'C 127,273 110,265 106,248 C 105,232 102,210 100,190 ' +
      'L 88,174 C 74,168 64,155 62,138 L 60,112 C 62,88 82,68 110,62 Z';
    svg.appendChild(mk('path', { d: BODY, fill: M.panel, stroke: M.border, 'stroke-width': 2 }));
    // Bevel intérieur subtil
    svg.appendChild(mk('path', { d: BODY, fill: 'none', stroke: 'rgba(212,200,138,0.05)', 'stroke-width': 4,
      transform: 'translate(0,0) scale(0.976,0.976) translate(5.5,3.2)' }));

    // LT / RT Triggers — trapèzes au-dessus du corps
    svg.appendChild(mk('path', {
      d: 'M 108,62 L 163,57 L 160,40 L 98,42 Z',
      fill: M.panelMid, stroke: M.border, 'stroke-width': 1.5,
    }));
    svg.appendChild(mkTxt(130, 51, 'LT', 12, 800, M.cream));

    svg.appendChild(mk('path', {
      d: 'M 297,57 L 352,62 L 362,40 L 300,40 Z',
      fill: M.panelMid, stroke: M.border, 'stroke-width': 1.5,
    }));
    svg.appendChild(mkTxt(330, 51, 'RT', 12, 800, M.cream));

    // LB / RB Bumpers
    svg.appendChild(mk('rect', { x: 97,  y: 66, width: 68, height: 14, rx: 3, fill: M.bg, stroke: M.border, 'stroke-width': 1.2 }));
    svg.appendChild(mkTxt(131, 73, 'LB', 10, 700));
    svg.appendChild(mk('rect', { x: 295, y: 66, width: 68, height: 14, rx: 3, fill: M.bg, stroke: M.border, 'stroke-width': 1.2 }));
    svg.appendChild(mkTxt(329, 73, 'RB', 10, 700));

    // Left stick (haut-gauche du corps)
    svg.appendChild(mk('circle', { cx: 157, cy: 130, r: 25, fill: M.bg,      stroke: M.border, 'stroke-width': 1.8 }));
    svg.appendChild(mk('circle', { cx: 157, cy: 130, r: 10, fill: '#2a2514', stroke: M.border, 'stroke-width': 1 }));
    svg.appendChild(mkTxt(157, 131, 'L3', 9));

    // Right stick (bas-droit du corps)
    svg.appendChild(mk('circle', { cx: 292, cy: 158, r: 25, fill: M.bg,      stroke: M.border, 'stroke-width': 1.8 }));
    svg.appendChild(mk('circle', { cx: 292, cy: 158, r: 10, fill: '#2a2514', stroke: M.border, 'stroke-width': 1 }));
    svg.appendChild(mkTxt(292, 159, 'R3', 9));

    // D-pad (bas-gauche)
    svg.appendChild(mk('rect', { x: 128, y: 155, width: 14, height: 42, rx: 3, fill: M.bg, stroke: M.border, 'stroke-width': 1.2 }));
    svg.appendChild(mk('rect', { x: 114, y: 169, width: 42, height: 14, rx: 3, fill: M.bg, stroke: M.border, 'stroke-width': 1.2 }));

    // ABXY (haut-droit) — Y haut, B droite, X gauche, A bas
    const mkAbxy = (cx, cy, lbl, bgFill, borderCol) => {
      const g = document.createElementNS(NS, 'g');
      g.appendChild(mk('circle', { cx, cy, r: 15, fill: bgFill, stroke: borderCol, 'stroke-width': 1.8 }));
      const tt = mk('text', { x: cx, y: cy + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Rajdhani,sans-serif', 'font-size': 12, 'font-weight': 900, fill: 'rgba(212,200,138,0.95)' });
      tt.textContent = lbl;
      g.appendChild(tt);
      return g;
    };
    svg.appendChild(mkAbxy(318, 112, 'Y', '#282508', M.yellow));
    svg.appendChild(mkAbxy(337, 130, 'B', '#280a0a', '#cc4444'));
    svg.appendChild(mkAbxy(299, 130, 'X', '#0a1428', '#2255cc'));
    svg.appendChild(mkAbxy(318, 148, 'A', '#0a2814', '#22aa44'));

    // Boutons centraux SEL / MNU
    svg.appendChild(mk('rect', { x: 196, y: 104, width: 20, height: 12, rx: 3, fill: M.bg, stroke: M.border, 'stroke-width': 1 }));
    svg.appendChild(mkTxt(206, 110, 'SEL', 8));
    svg.appendChild(mk('rect', { x: 244, y: 104, width: 20, height: 12, rx: 3, fill: M.bg, stroke: M.border, 'stroke-width': 1 }));
    svg.appendChild(mkTxt(254, 110, 'MNU', 8));
    // Bouton Xbox centre
    svg.appendChild(mk('circle', { cx: 230, cy: 107, r: 9,  fill: '#1a1810', stroke: M.border, 'stroke-width': 1.2 }));
    svg.appendChild(mk('circle', { cx: 230, cy: 107, r: 4,  fill: M.border, stroke: 'none' }));

    // ── Légende ──────────────────────────────────────────────────────────
    const legend = el('div', { style: {
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: '0px 16px', padding: '18px 0 0',
    }});

    const mkLegendRow = (btn, action, actColor = M.cream) => {
      const row = el('div', { style: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0',
        borderBottom: `1px solid ${M.border}44`,
      }});
      const chip = el('span', { text: btn, style: {
        padding: '2px 8px', background: M.panelMid,
        border: `1px solid ${M.border}`, borderRadius: '4px',
        fontFamily: 'Rajdhani, sans-serif', fontSize: '12px',
        fontWeight: '700', letterSpacing: '1px', color: M.dimCream,
        flexShrink: '0', whiteSpace: 'nowrap',
      }});
      const act = el('span', { text: action, style: {
        fontFamily: 'Rajdhani, sans-serif', fontSize: '12px',
        color: actColor, letterSpacing: '0.3px',
      }});
      row.appendChild(chip);
      row.appendChild(act);
      return row;
    };

    tCtrlGp().forEach(([btn, action, color]) => {
      const c = color === 'yellow' ? M.yellow : color;
      legend.appendChild(mkLegendRow(btn, action, c));
    });

    const container = el('div', { style: { display: 'flex', flexDirection: 'column' }});
    container.appendChild(svg);
    container.appendChild(legend);
    return container;
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
        { key: 'expert',   color: '#cc22aa', label: 'EXPERT'      },
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
      const DIFF_LABELS = { easy: t('easy'), standard: t('standard'), hard: t('hard') };
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
        desc  : t('mapDesc_1'),
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
        desc  : t('mapDesc_2'),
        sky   : ['#080c18', '#10203a'],
        water : '#0e2840', low: '#2a3a50', forest: '#304858', rock: '#5a5a70', snow: '#e8eaf0',
        peaks : [[0.42,0.30,0.12],[0.65,0.25,0.09],[0.25,0.45,0.10],[0.72,0.55,0.08],[0.38,0.68,0.07],[0.60,0.70,0.06]],
        lakes : [[0.50,0.50,0.05],[0.28,0.60,0.03],[0.68,0.40,0.03]],
      },
      3: {
        name  : t('mapName_3'),
        desc  : t('mapDesc_3'),
        sky   : ['#100808', '#281410'],
        water : '#1a3060', low: '#304820', forest: '#3a5a18', rock: '#786040', snow: '#c8b890',
        peaks : [[0.30,0.28,0.06],[0.72,0.60,0.05]],
        lakes : [[0.52,0.45,0.10],[0.25,0.58,0.07],[0.70,0.30,0.06],[0.40,0.75,0.05]],
      },
      99: {
        name  : t('mapName_99'),
        desc  : t('mapDesc_99'),
        sky   : ['#060804', '#0a0e08'],
        water : '#0e1812', low: '#0a100a', forest: '#0c120c', rock: '#141210', snow: '#1e1c18',
        peaks : [], lakes : [],
      },
      5: {
        name  : t('mapName_5'),
        desc  : t('mapDesc_5'),
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
        desc  : t('mapDesc_4'),
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
      ctx.font = 'bold 11px Rajdhani';
      ctx.textAlign = 'center';
      ctx.fillText(t('mapInDev'), W/2, H/2 - 8);
      ctx.font = '8px Rajdhani';
      ctx.fillStyle = '#2a2018';
      ctx.fillText(t('mapComingSoon'), W/2, H/2 + 10);
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

  // Sync le modèle preview avec l'avion actif (couleur + missiles). À appeler
  // après _showPreview() dans chaque écran qui affiche le fond 3D.
  _syncPreviewPlane(planeIdx) {
    const idx = planeIdx ?? this._progression.activePlane;
    const plane = this._progression.getPlane(idx);
    const tc = TEAM_COLORS[plane.color] ?? TEAM_COLORS.blanc;
    this._onPreviewModelLoaded = (m) => this._attachPreviewMissiles(m, idx);
    if (this._loadPreviewModel && this._currentPreviewPath !== tc.path) {
      this._loadPreviewModel(tc.path);
    } else if (this._previewModelRoot) {
      this._attachPreviewMissiles(this._previewModelRoot, idx);
    }
  }

  // ── Topbar persistante : profil + boutons utilitaires ─────────────────────
  _buildProfileBar() {
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      position      : 'fixed',
      top           : '0', left: '0', right: '0',
      zIndex        : '2000',
      height        : '52px',
      padding       : '0 20px',
      display       : 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap           : '24px',
      background    : 'rgba(8,8,6,0.92)',
      borderBottom  : `1px solid ${M.border}`,
      fontFamily    : 'Rajdhani, sans-serif',
      color         : M.cream,
      backdropFilter: 'blur(6px)',
      pointerEvents : 'none',
    });

    // Bloc profil (gauche) — cliquable : ouvre Mon Avion depuis n'importe quel écran
    const left = document.createElement('div');
    Object.assign(left.style, {
      display: 'flex', alignItems: 'center', gap: '18px', flex: '0 0 auto',
      pointerEvents: 'auto', cursor: 'pointer',
      padding: '6px 10px', margin: '0 -10px',
      borderRadius: '5px',
      border: '1px solid transparent',
      transition: 'all 0.15s',
      position: 'relative',
    });
    left.title = t('myPlane') || 'Mon avion';
    left.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span class="pb-plane-icon" style="font-size:13px;color:${M.yellow}55;transition:color 0.15s;">✈</span>
          <span class="pb-name" style="font-size:14px;letter-spacing:2px;color:${M.cream};font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;"></span>
          <span class="pb-lvl" style="font-size:12px;letter-spacing:2px;color:${M.yellow};font-weight:700;white-space:nowrap;"></span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:180px;height:5px;background:rgba(212,200,138,0.14);border-radius:2px;overflow:hidden;">
            <div class="pb-xp" style="height:100%;width:0%;background:linear-gradient(90deg,${M.yellow},${M.cream});transition:width 0.4s;"></div>
          </div>
          <span class="pb-xpnum" style="font-size:9px;letter-spacing:1.2px;color:${M.dimCream};white-space:nowrap;"></span>
        </div>
      </div>
      <div style="height:30px;width:1px;background:${M.border}77;"></div>
      <div style="display:flex;flex-direction:column;gap:1px;line-height:1.1;">
        <span style="font-size:8px;letter-spacing:2px;color:${M.dimCream};">${t('creditsLabel')}</span>
        <span class="pb-cred" style="font-size:15px;letter-spacing:1.5px;color:${M.yellow};font-weight:700;white-space:nowrap;"></span>
      </div>
    `;
    left.addEventListener('mouseover', () => {
      left.style.background = 'rgba(212,200,138,0.06)';
      left.style.borderColor = `${M.yellow}88`;
      const icon = left.querySelector('.pb-plane-icon');
      if (icon) icon.style.color = M.yellow;
    });
    left.addEventListener('mouseout', () => {
      left.style.background = 'transparent';
      left.style.borderColor = 'transparent';
      const icon = left.querySelector('.pb-plane-icon');
      if (icon) icon.style.color = `${M.yellow}55`;
    });
    left.addEventListener('click', () => {
      // Ouvre Mon Avion. _myPlaneReturn est tenu à jour par chaque _show* via _setCurrentScreen
      this._showMyPlane();
    });

    // Boutons utilitaires (droite)
    const right = document.createElement('div');
    Object.assign(right.style, {
      display: 'flex', alignItems: 'center', gap: '10px', flexShrink: '0',
    });

    const mkUtilBtn = (label, title, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title || '';
      Object.assign(b.style, {
        pointerEvents: 'auto',
        background   : 'rgba(8,8,6,0.6)',
        border       : `1px solid ${M.border}`,
        color        : M.dimCream,
        fontFamily   : 'Rajdhani, sans-serif',
        fontSize     : '12px',
        letterSpacing: '2px',
        fontWeight   : '600',
        padding      : '7px 14px',
        cursor       : 'pointer',
        transition   : 'all 0.15s',
        borderRadius : '4px',
        minWidth     : '40px',
      });
      b.addEventListener('mouseover', () => { b.style.color = M.cream; b.style.borderColor = M.cream; });
      b.addEventListener('mouseout',  () => { b.style.color = M.dimCream; b.style.borderColor = M.border; });
      b.addEventListener('click', onClick);
      return b;
    };

    const langBtn = mkUtilBtn(getLang() === 'fr' ? 'EN' : 'FR', '', () => {
      const next = getLang() === 'fr' ? 'en' : 'fr';
      setLang(next);
      location.reload();
    });
    const gearBtn = mkUtilBtn('⚙', t('settings'), () => this._showSettings());
    gearBtn.style.fontSize = '16px';
    gearBtn.style.padding = '4px 12px';

    right.appendChild(langBtn);
    right.appendChild(gearBtn);

    // ── Sélecteur d'avion actif — inline après les crédits ──────────────────
    const planeSep = document.createElement('div');
    planeSep.style.cssText = `height:30px;width:1px;background:${M.border}77;flex-shrink:0;`;

    const planeSelWrap = document.createElement('div');
    Object.assign(planeSelWrap.style, {
      position: 'relative', display: 'flex', alignItems: 'center',
      pointerEvents: 'auto', flexShrink: '0',
    });
    planeSelWrap.addEventListener('click', e => e.stopPropagation());

    const planeBtn = document.createElement('button');
    Object.assign(planeBtn.style, {
      background   : 'transparent',
      border       : `1px solid ${M.border}`,
      color        : M.cream,
      fontFamily   : 'Rajdhani, sans-serif',
      fontSize     : '11px', letterSpacing: '2px', fontWeight: '700',
      padding      : '5px 10px', cursor: 'pointer', borderRadius: '4px',
      display      : 'flex', alignItems: 'center', gap: '6px',
      transition   : 'all 0.15s', whiteSpace: 'nowrap',
    });
    planeBtn.addEventListener('mouseover', () => { planeBtn.style.borderColor = M.yellow; planeBtn.style.color = M.yellow; });
    planeBtn.addEventListener('mouseout',  () => { planeBtn.style.borderColor = M.border; planeBtn.style.color = M.cream; });

    const planeDropdown = document.createElement('div');
    Object.assign(planeDropdown.style, {
      position: 'absolute', top: 'calc(100% + 6px)', left: '0',
      background: 'rgba(8,8,6,0.97)', border: `1px solid ${M.border}`,
      borderRadius: '6px', minWidth: '200px', display: 'none',
      flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      zIndex: '2100',
    });

    const closePlaneDropdown = () => { planeDropdown.style.display = 'none'; };

    planeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = planeDropdown.style.display === 'flex';
      if (isOpen) { closePlaneDropdown(); return; }
      planeDropdown.innerHTML = '';
      const prog = this._progression;
      for (let i = 0; i < 3; i++) {
        const planeData = prog?.getPlane(i);
        const isActive  = prog?.activePlane === i;
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 16px', cursor: 'pointer',
          background: isActive ? `${M.yellow}18` : 'transparent',
          borderLeft: isActive ? `3px solid ${M.yellow}` : '3px solid transparent',
          transition: 'background 0.1s',
        });
        row.addEventListener('mouseover', () => { if (!isActive) row.style.background = 'rgba(212,200,138,0.06)'; });
        row.addEventListener('mouseout',  () => { if (!isActive) row.style.background = 'transparent'; });
        const icon = document.createElement('span');
        icon.textContent = '✈';
        icon.style.cssText = `font-size:14px;color:${isActive ? M.yellow : M.dimCream};flex-shrink:0;`;
        const nameEl = document.createElement('span');
        nameEl.textContent = (planeData?.name || `AVION ${i + 1}`).toUpperCase();
        nameEl.style.cssText = `font-size:12px;letter-spacing:2px;font-weight:${isActive ? '700' : '500'};color:${isActive ? M.yellow : M.cream};font-family:Rajdhani,sans-serif;flex:1;`;
        const editBtn = document.createElement('button');
        editBtn.textContent = '✎';
        editBtn.title = 'Renommer';
        editBtn.style.cssText = `background:transparent;border:none;color:${M.dimCream};cursor:pointer;font-size:13px;padding:0 4px;opacity:0.6;transition:opacity 0.15s;`;
        editBtn.addEventListener('mouseover', () => editBtn.style.opacity = '1');
        editBtn.addEventListener('mouseout',  () => editBtn.style.opacity = '0.6');
        editBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const inp = document.createElement('input');
          inp.value = planeData?.name || '';
          inp.style.cssText = `background:rgba(30,30,20,0.95);border:1px solid ${M.yellow};color:${M.yellow};font-family:Rajdhani,sans-serif;font-size:12px;letter-spacing:2px;padding:2px 6px;border-radius:3px;width:120px;outline:none;`;
          nameEl.replaceWith(inp);
          editBtn.style.display = 'none';
          inp.focus(); inp.select();
          const commit = () => {
            const val = inp.value.trim().toUpperCase().slice(0, 20) || planeData?.name;
            prog?.renamePlane(i, val);
            this._refreshProfileBar();
            this._myPlaneReturn?.();
            closePlaneDropdown();
          };
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') closePlaneDropdown(); });
          inp.addEventListener('blur', commit);
        });
        row.appendChild(icon); row.appendChild(nameEl); row.appendChild(editBtn);
        row.addEventListener('click', () => {
          prog?.setActivePlane(i);
          closePlaneDropdown();
          this._refreshProfileBar();
          // Rafraîchit la page courante (config, multi, etc.) et synchronise le preview
          this._syncPreviewPlane?.(i);
          this._myPlaneReturn?.();
        });
        planeDropdown.appendChild(row);
        if (i < 2) {
          const sep = document.createElement('div');
          sep.style.cssText = `height:1px;background:${M.border}55;margin:0 10px;`;
          planeDropdown.appendChild(sep);
        }
      }
      planeDropdown.style.display = 'flex';
    });

    document.addEventListener('click', closePlaneDropdown);

    // Badge point rouge positionné en haut à droite du bouton avion
    const newDot = document.createElement('span');
    newDot.className = 'pb-badge';
    Object.assign(newDot.style, {
      display      : 'none',
      position     : 'absolute',
      top          : '-4px',
      right        : '-4px',
      width        : '9px',
      height       : '9px',
      borderRadius : '50%',
      background   : M.accent,
      boxShadow    : `0 0 6px ${M.accent}`,
      pointerEvents: 'none',
    });
    planeSelWrap.appendChild(planeBtn);
    planeSelWrap.appendChild(planeDropdown);
    planeSelWrap.appendChild(newDot);

    // Injecter le sélecteur dans le bloc gauche, juste après les crédits
    left.appendChild(planeSep);
    left.appendChild(planeSelWrap);

    bar.appendChild(left);
    bar.appendChild(right);
    document.body.appendChild(bar);
    this._profileBar       = bar;
    this._profileLangBtn   = langBtn;
    this._planeSelectorBtn = planeBtn;
    this._unlockBtn        = null;
    this._refreshProfileBar();
  }

  _refreshProfileBar() {
    const bar = this._profileBar;
    if (!bar || !this._progression) return;
    const prog = this._progression;
    const { level, xpInLevel } = prog.levelInfo;
    const xpNext = xpToNextLevel(level);
    const xpPct  = xpNext < Infinity ? Math.min(100, (xpInLevel / xpNext) * 100) : 100;
    const name   = (this._config?.pilotName || t('pilotPlaceh') || 'PILOTE').toString().toUpperCase();
    const credFmt = prog.credits.toLocaleString('fr-FR').replace(/ | /g, ' ');
    const xpStr  = xpNext < Infinity
      ? `${Math.round(xpInLevel).toLocaleString('fr-FR')} / ${xpNext.toLocaleString('fr-FR')} XP`
      : 'XP MAX';
    bar.querySelector('.pb-name').textContent  = name;
    bar.querySelector('.pb-lvl').textContent   = `${t('lvlReqPrefix')} ${level}`;
    bar.querySelector('.pb-xp').style.width    = `${xpPct}%`;
    bar.querySelector('.pb-xpnum').textContent = xpStr.replace(/ | /g, ' ');
    bar.querySelector('.pb-cred').textContent  = `✦ ${credFmt}`;
    // Point rouge sur le sélecteur d'avion si nouvelles options débloquées
    const badge = bar.querySelector('.pb-badge');
    const n = prog.newOptionCount?.() ?? 0;
    if (badge) badge.style.display = n > 0 ? 'block' : 'none';
    if (this._profileLangBtn) this._profileLangBtn.textContent = getLang() === 'fr' ? 'EN' : 'FR';
    if (this._planeSelectorBtn && this._progression) {
      const idx  = this._progression.activePlane;
      const name = (this._progression.getPlane(idx)?.name || `AVION ${idx + 1}`).toUpperCase();
      this._planeSelectorBtn.innerHTML = '';
      const icon = document.createElement('span'); icon.textContent = '✈'; icon.style.color = M.yellow;
      const lbl  = document.createElement('span'); lbl.textContent = name;
      const arr  = document.createElement('span'); arr.textContent = '▾'; arr.style.cssText = `font-size:10px;color:${M.dimCream};`;
      this._planeSelectorBtn.appendChild(icon);
      this._planeSelectorBtn.appendChild(lbl);
      this._planeSelectorBtn.appendChild(arr);
    }
  }

  // Mémorise l'écran courant pour que le bouton retour de Mon Avion y revienne
  // et pour que le bouton retour des Paramètres (accessible depuis la topbar) revienne ici aussi
  _setCurrentScreen(fn) { this._myPlaneReturn = fn; this._settingsReturn = fn; }

  _showProfileBar(visible = true) {
    if (this._profileBar) this._profileBar.style.display = visible ? 'flex' : 'none';
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────────
  _clear() {
    this._hangarOrbit          = false;
    this._planeAnchor          = null;
    this._useViewOffset        = false;
    this._onPreviewModelLoaded = null;
    (this._previewMissileMeshes || []).forEach(m => m.parent?.remove(m));
    this._previewMissileMeshes = [];
    const children = Array.from(this._root.children);
    children.forEach(c => {
      // Garder : scanlines (div), canvas 3D preview
      if (c === this._previewCanvas) return;
      if (c.style.background?.includes('repeating-linear-gradient')) return;
      c.remove();
    });
    // Barre de profil rafraîchie et visible sur chaque écran
    this._refreshProfileBar();
    this._showProfileBar(true);
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

  // Attache des missiles visuels au modèle de prévisualisation selon le loadout
  // ── Sons mécaniques — contexte audio partagé ─────────────────────────────
  _uiAudioCtx() {
    this._uiCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (this._uiCtx.state === 'suspended') this._uiCtx.resume();
    return this._uiCtx;
  }

  // Survol d'un élément — clic mécanique très discret
  _playHoverSound() {
    try {
      const ctx = this._uiAudioCtx();
      const now = ctx.currentTime;
      // Petit transient bande étroite — bouton physique léger
      const len = Math.floor(ctx.sampleRate * 0.018);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 5;
      const g   = ctx.createGain(); g.gain.setValueAtTime(0.09, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(now);
    } catch (_) {}
  }

  // Sélection / équipement — commutateur mécanique
  _playEquipSound(_slotKey) {
    try {
      const ctx = this._uiAudioCtx();
      const now = ctx.currentTime;
      const noise = (dur, freq, q, vol, delay = 0) => {
        const len = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * dur * 0.4));
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
        const g   = ctx.createGain(); g.gain.setValueAtTime(vol, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(now + delay);
      };
      // Impact initial : fréquence moyenne — interrupteur qui s'enclenche
      noise(0.022, 1800, 4.0, 0.30);
      // Queue métallique courte
      noise(0.035, 600,  2.5, 0.18, 0.018);
    } catch (_) {}
  }

  // Achat confirmé — verrouillage mécanique satisfaisant
  _playBuySound() {
    try {
      const ctx = this._uiAudioCtx();
      const now = ctx.currentTime;
      const noise = (dur, freq, q, vol, delay = 0) => {
        const len = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * dur * 0.3));
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
        const g   = ctx.createGain(); g.gain.setValueAtTime(vol, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(now + delay);
      };
      // Clunk grave — loquet qui s'enclenche
      noise(0.055, 140,  2.0, 0.70);
      // Impact métallique moyen — corps du mécanisme
      noise(0.035, 520,  3.0, 0.45, 0.020);
      // Résonance haute courte — confirmation
      noise(0.025, 2400, 6.0, 0.22, 0.040);
      // Tonalité brève de validation avionique (deux tons)
      const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 880;
      const g1   = ctx.createGain(); g1.gain.setValueAtTime(0, now + 0.06); g1.gain.linearRampToValueAtTime(0.12, now + 0.075); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc1.connect(g1); g1.connect(ctx.destination); osc1.start(now + 0.06); osc1.stop(now + 0.14);
      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 1320;
      const g2   = ctx.createGain(); g2.gain.setValueAtTime(0, now + 0.11); g2.gain.linearRampToValueAtTime(0.10, now + 0.125); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc2.connect(g2); g2.connect(ctx.destination); osc2.start(now + 0.11); osc2.stop(now + 0.19);
    } catch (_) {}
  }

  // Montée de niveau — récompense avionique
  _playLevelUpSound() {
    try {
      const ctx = this._uiAudioCtx();
      const now = ctx.currentTime;
      // Trois tonalités montantes — confirmation militaire
      [[660, 0.00], [880, 0.10], [1100, 0.20]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
        const g   = ctx.createGain();
        g.gain.setValueAtTime(0, now + delay);
        g.gain.linearRampToValueAtTime(0.18, now + delay + 0.015);
        g.gain.setValueAtTime(0.18, now + delay + 0.055);
        g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
        osc.connect(g); g.connect(ctx.destination); osc.start(now + delay); osc.stop(now + delay + 0.13);
      });
      // Bruit de fond sourd — relâchement de pression
      const len = Math.floor(ctx.sampleRate * 0.18);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      const g   = ctx.createGain(); g.gain.setValueAtTime(0.15, now + 0.25); g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      src.connect(lp); lp.connect(g); g.connect(ctx.destination); src.start(now + 0.25);
    } catch (_) {}
  }

  _attachPreviewMissiles(model, planeIdx) {
    (this._previewMissileMeshes || []).forEach(m => m.parent?.remove(m));
    this._previewMissileMeshes = [];

    const loadout = this._progression.getLoadout(planeIdx ?? this._progression.activePlane);

    // slots : indices d'emplacement X sur CHAQUE aile (permet l'entrelacement AA/AG)
    const spawnMissiles = (slots, path, offsetY, rx, ry, rz) => {
      if (!slots.length) return;
      new GLTFLoader().load(path, (gltf) => {
        if (!model.parent) return;
        const src = gltf.scene;
        src.scale.setScalar(0.25);
        src.rotation.set(rx, ry, rz); // orientation native du GLB
        src.updateMatrixWorld(true);
        const invScale   = 1 / (model.scale.x || 1);
        const srcScale   = src.scale.x;
        const TARGET_LEN = 0.85;
        const box2 = new THREE.Box3().setFromObject(src);
        const size2 = new THREE.Vector3(); box2.getSize(size2);
        const rawLen = Math.max(size2.x, size2.y, size2.z) || 1;
        const localScale = (TARGET_LEN / rawLen) * invScale * srcScale;
        for (let w = 0; w < 2; w++) {
          for (const slot of slots) {
            const m = src.clone();
            const side = w === 0 ? -1 : 1;
            m.position.set(side * (0.7 + slot * 0.42) * invScale, offsetY * invScale, 0.1 * invScale);
            m.scale.setScalar(localScale);
            model.add(m);
            this._previewMissileMeshes.push(m);
          }
        }
      }, undefined, () => {});
    };

    const aaCount = loadout.missiles_aa && loadout.missiles_aa !== 'none'
      ? parseInt(loadout.missiles_aa.replace('aa', '')) || 0 : 0;
    const agCount = loadout.missiles_ag && loadout.missiles_ag !== 'none'
      ? parseInt(loadout.missiles_ag.replace('ag', '')) || 0 : 0;

    // Entrelace les emplacements : AA, AG, AA, AG… le long de l'aile (pas d'empilement)
    const { aaSlots, agSlots } = interleaveSlots(aaCount, agCount);
    //                                                                 rx ry              rz
    spawnMissiles(aaSlots, '/Missiles/low_poly_advanced_missile_Missile1.glb', -0.18, 0, -Math.PI / 2 + 0.26, 0);
    spawnMissiles(agSlots, '/Missiles/game_ready_low_poly_r-77_Missile2.glb',  -0.18, 0, -Math.PI / 2,        0);
  }

  // ── MON AVION ─────────────────────────────────────────────────────────────
  _showMyPlane() {
    if (!this._inMyPlane) {
      this._myPlanePrevReturn = this._myPlaneReturn;
    }
    this._inMyPlane = true;
    this._setCurrentScreen(() => this._showMyPlane());
    this._showPreview('hangar');

    this._clear();
    this._showPreview('hangar');

    const prog = this._progression;

    const { level } = prog;

    const CAT_COLORS = {
      propulsion:'#6f9cff', canons:'#ff8d4d', missiles_cat:'#ff6b8a',
      defense:'#e0a84a', logistics:'#bcdb4f', equipements:'#d99bff',
    };
    // Descriptions des slots — via i18n pour support FR/EN
    const slotDesc = (key) => t(`slotDesc_${key}`) || '';

    const selectedSlot = prog.activePlane;
    this._syncPreviewPlane(selectedSlot);

    let activeSlotKey  = null; // slot ouvert dans la barre du bas
    let activeCatKey   = null;
    let infoOptId      = null; // option épinglée affichée dans le panneau d'info

    const liveStats = (previewSlotKey = null, previewOptId = null) => {
      const base = { ...prog.getLoadout(selectedSlot) };
      if (previewSlotKey) base[previewSlotKey] = previewOptId;
      return computeStats(loadoutToUpgradeIds(base));
    };

    // Classifie automatiquement le type d'avion selon le build
    const classifyBuild = () => {
      const s   = liveStats();
      const ids = loadoutToUpgradeIds(prog.getLoadout(selectedSlot));
      const hasAG = ids.includes('missile_ag');
      const sp = s.speed, mn = s.maneuverability, hp = s.health, wp = s.weaponry, df = s.defense, ms = s.missiles;
      if (hasAG || ms >= 4)          return { name:t('buildMissile'),      sub:t('buildMissileSub'),      col:'#ff8d4d' };
      if (hp >= 150 || df >= 115)    return { name:t('buildDefensive'),    sub:t('buildDefensiveSub'),    col:'#e0a84a' };
      if (wp >= 125 && sp <= 100)    return { name:t('buildHeavy'),        sub:t('buildHeavySub'),        col:'#cc6644' };
      if (sp >= 112 && mn >= 108 && hp <= 115) return { name:t('buildInterceptorL'), sub:t('buildInterceptorLSub'), col:'#6f9cff' };
      return { name:t('buildGeneral'), sub:t('buildGeneralSub'), col:'#bcdb4f' };
    };

    // ── WRAP ─────────────────────────────────────────────────────────────────
    // Décalé de 52px pour laisser la topbar globale visible
    const wrap = el('div', { style:{
      position:'fixed', top:'52px', left:'0', right:'0', bottom:'0', zIndex:'5', pointerEvents:'none',
      opacity:'0', transition:'opacity 0.25s ease-out',
      fontFamily:'Rajdhani, sans-serif', color:M.cream,
    }});

    // Overlay gauche
    wrap.appendChild(el('div', { style:{
      position:'absolute', top:'0', left:'0', bottom:'0', width:'72%',
      background:'rgba(4,4,3,0.75)', pointerEvents:'none',
    }}));

    // Ancre de cadrage de l'avion — fenêtre vide en haut à droite (colonne 72→100%,
    // sous la topbar). _aimAtAnchor() mesure son centre chaque frame pour viser l'avion
    // dessus. Invisible ; sert uniquement de repère géométrique robuste à la résolution.
    const planeAnchor = el('div', { style:{
      position:'absolute', left:'72%', right:'0', top:'50px', bottom:'67%',
      pointerEvents:'none',
    }});
    wrap.appendChild(planeAnchor);
    this._planeAnchor = planeAnchor;

    // ── TOP BAR ──────────────────────────────────────────────────────────────
    const topBar = el('div', { style:{
      position:'absolute', top:'0', left:'0', right:'0', height:'50px',
      background:'rgba(6,6,5,0.97)', borderBottom:`1px solid ${M.border}`,
      display:'flex', alignItems:'center', pointerEvents:'all',
    }});

    const refreshTabs = () => {
      this._refreshProfileBar();
    };

    // Champ nom du pilote — juste après les onglets d'avion
    const pilotWrap = el('div', { style:{
      display:'flex', alignItems:'center', gap:'8px', padding:'0 14px',
      borderLeft:`1px solid ${M.border}44`, borderRight:`1px solid ${M.border}44`, height:'100%',
    }});
    const pilotLbl = el('span');
    Object.assign(pilotLbl.style, { fontSize:'8px', letterSpacing:'2px', color:M.dimCream, whiteSpace:'nowrap' });
    pilotLbl.textContent = t('pilotPlaceh') || 'PILOTE';
    const pilotInp = mkInput('', this._config.pilotName || '');
    Object.assign(pilotInp.style, { width:'130px', fontSize:'11px', padding:'4px 8px', letterSpacing:'2px' });
    pilotInp.addEventListener('input', () => {
      const v = pilotInp.value.toUpperCase().slice(0, 12);
      pilotInp.value = v;
      this._config.pilotName = v;
      localStorage.setItem('pilotName', v);
      this._refreshProfileBar();
    });
    pilotWrap.appendChild(pilotLbl);
    pilotWrap.appendChild(pilotInp);
    topBar.appendChild(pilotWrap);

    topBar.appendChild(el('div', { style:{ flex:'1' }}));

    // Niveau/XP/crédits sont maintenant affichés dans la topbar globale.
    // refreshCredits rafraîchit la topbar après un achat.
    const refreshCredits = () => { this._refreshProfileBar(); };

    const btnBack = el('button', { text:t('back'), style:{
      padding:'8px 16px', background:M.accentDim,
      border:`1px solid ${M.accent}55`, color:M.cream,
      fontFamily:'Rajdhani, sans-serif', fontSize:'10px', letterSpacing:'3px', cursor:'pointer',
      height:'100%', fontWeight:'bold',
      borderTop:'none', borderBottom:'none', borderRight:'none',
    }});
    btnBack.addEventListener('click', () => {
      this._hangarOrbit = false;
      this._planeAnchor = null;
      this._inMyPlane = false;
      wrap.style.opacity = '0';
      const ret = this._myPlanePrevReturn || (() => this._showMain());
      setTimeout(() => ret(), 230);
    });
    btnBack.addEventListener('mouseover', () => btnBack.style.background = M.accent);
    btnBack.addEventListener('mouseout',  () => btnBack.style.background = M.accentDim);

    // Section droite — positionnée absolument pour s'aligner avec le rightPanel (28% de large)
    const rightSection = el('div', { style:{
      position:'absolute', left:'72%', right:'0', top:'0', height:'50px',
      display:'flex', alignItems:'stretch',
      borderLeft:`1px solid ${M.border}44`,
    }});

    // Type d'avion — flex:1, label au-dessus, nom + sous-titre sur la même ligne
    const typeWrap = el('div', { style:{
      flex:'1', display:'flex', flexDirection:'column', justifyContent:'center',
      padding:'0 16px', overflow:'hidden',
    }});
    const typeSubLbl = el('div', { style:{ fontSize:'8px', letterSpacing:'2px', color:M.dimCream, whiteSpace:'nowrap' }});
    typeSubLbl.textContent = t('buildTypeLabel') || 'TYPE';
    const nameRow = el('div', { style:{ display:'flex', alignItems:'baseline', gap:'8px', overflow:'hidden' }});
    const typeNameEl = el('div', { style:{ fontSize:'13px', fontWeight:'800', letterSpacing:'1px', whiteSpace:'nowrap', flexShrink:'0' }});
    const typeSepEl  = el('div', { style:{ fontSize:'10px', color:M.dimCream, flexShrink:'0' }});
    typeSepEl.textContent = '·';
    const typeSubEl  = el('div', { style:{ fontSize:'9px', letterSpacing:'0.5px', color:M.dimCream, fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }});
    nameRow.appendChild(typeNameEl);
    nameRow.appendChild(typeSepEl);
    nameRow.appendChild(typeSubEl);
    typeWrap.appendChild(typeSubLbl);
    typeWrap.appendChild(nameRow);
    rightSection.appendChild(typeWrap);
    rightSection.appendChild(btnBack);
    topBar.appendChild(rightSection);
    wrap.appendChild(topBar);

    // ── BARRE DE DÉTAIL (bas gauche, 72% large) ───────────────────────────────
    const DETAIL_H = 186;
    const detailBar = el('div', { style:{
      position:'absolute', bottom:'0', left:'0', width:'72%', height:`${DETAIL_H}px`,
      background:'rgba(7,7,6,0.98)', borderTop:`2px solid ${M.border}`,
      borderRight:`1px solid ${M.border}`,
      display:'none', alignItems:'stretch', gap:'0', padding:'0',
      pointerEvents:'all', overflow:'hidden',
    }});
    wrap.appendChild(detailBar);

    const closeDetail = () => {
      detailBar.style.display = 'none';
      tableArea.style.bottom = '0';
      activeSlotKey = null; activeCatKey = null; infoOptId = null;
      renderTable();
    };

    let newInSlot = new Set(); // optIds nouvellement débloqués pour le slot ouvert
    const openDetail = (slotKey, catKey) => {
      activeSlotKey = slotKey; activeCatKey = catKey;
      infoOptId = prog.getLoadout(selectedSlot)[slotKey]; // option épinglée = équipée
      // Capturer les nouveautés AVANT de marquer le slot comme vu
      newInSlot = new Set(prog.getNewOptions().filter(o => o.slotKey === slotKey).map(o => o.optId));
      prog.markSlotSeen(slotKey);
      detailBar.style.display = 'flex';
      tableArea.style.bottom  = `${DETAIL_H}px`;
      renderDetailBar();
      renderTable(); // re-highlight + retire le badge NEW du slot consulté
    };

    // Référence vers la colonne d'info, mise à jour au survol/clic
    let _infoCol = null;
    const renderInfo = (opt) => {
      if (!_infoCol || !opt) return;
      const catColor   = CAT_COLORS[activeCatKey] ?? M.accent;
      const isUnlocked = level >= opt.levelReq;
      const isEquipped = prog.getLoadout(selectedSlot)[activeSlotKey] === opt.id;
      _infoCol.innerHTML = '';

      // Ligne titre : nom + statut
      const head = el('div', { style:{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }});
      head.appendChild(el('div', { text: tEquip(opt.name), style:{
        fontSize:'15px', fontWeight:'700', color: isUnlocked ? catColor : M.dimCream, letterSpacing:'0.5px',
      }}));
      if (opt.levelReq > 1) {
        head.appendChild(el('div', { text:`${t('lvlReqPrefix')} ${opt.levelReq}`, style:{
          fontSize:'10px', fontWeight:'700', letterSpacing:'1px',
          padding:'2px 7px', borderRadius:'4px',
          color: isUnlocked ? '#0a0a08' : '#fff',
          background: isUnlocked ? M.yellow : '#cc4433',
        }}));
      }
      if (isEquipped) {
        head.appendChild(el('div', { text:t('equippedBadge'), style:{
          fontSize:'10px', fontWeight:'700', letterSpacing:'1px', color:'#0a0a08',
          padding:'2px 7px', borderRadius:'4px', background:catColor,
        }}));
      } else if (!isUnlocked) {
        head.appendChild(el('div', { text:t('lockedBadge'), style:{
          fontSize:'10px', fontWeight:'700', letterSpacing:'1px', color:'#ff8877',
        }}));
      }
      _infoCol.appendChild(head);

      // Description du slot
      _infoCol.appendChild(el('div', { text: slotDesc(activeSlotKey), style:{
        fontSize:'11px', lineHeight:'1.4', color:M.dimCream, marginBottom:'8px',
      }}));

      // Pros / cons
      const pc = el('div', { style:{ display:'flex', gap:'18px', flexWrap:'wrap' }});
      const prosCol = el('div', { style:{ display:'flex', flexDirection:'column', gap:'2px' }});
      const consCol = el('div', { style:{ display:'flex', flexDirection:'column', gap:'2px' }});
      (opt.pros ?? []).forEach(p => prosCol.appendChild(el('div', { text:`▲ ${tEquip(p)}`, style:{ fontSize:'11px', color:'#7fe07f', fontWeight:'600' }})));
      (opt.cons ?? []).forEach(c => consCol.appendChild(el('div', { text:`▼ ${tEquip(c)}`, style:{ fontSize:'11px', color:'#ff8877', fontWeight:'600' }})));
      if (!(opt.pros?.length) && !(opt.cons?.length)) {
        prosCol.appendChild(el('div', { text:t('baseConfigDesc'), style:{ fontSize:'11px', color:M.dimCream }}));
      }
      pc.appendChild(prosCol); pc.appendChild(consCol);
      _infoCol.appendChild(pc);
    };

    const renderDetailBar = () => {
      if (!activeSlotKey) return;
      detailBar.innerHTML = '';
      const catColor  = CAT_COLORS[activeCatKey] ?? M.accent;
      const catObj    = EQUIPMENT_CATALOG[activeCatKey];
      const slot      = catObj?.slots[activeSlotKey];
      if (!slot) return;
      const loadout   = prog.getLoadout(selectedSlot);

      // Colonne titre du slot
      const titleCol = el('div', { style:{
        minWidth:'190px', flexShrink:'0', padding:'14px 16px',
        borderRight:`1px solid ${M.border}`,
        display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px',
        background:`${catColor}10`,
      }});
      titleCol.appendChild(el('span', { text: tEquip(catObj.label), style:{ fontSize:'9px', letterSpacing:'2px', color:M.dimCream }}));
      titleCol.appendChild(el('div', { text: tEquip(slot.label), style:{ fontSize:'15px', letterSpacing:'1px', color:catColor, fontWeight:'700', lineHeight:'1.1' }}));
      const closeBtn = el('button', { text:t('closeBtn'), style:{
        marginTop:'8px', background:'transparent', border:`1px solid ${M.border}66`,
        color:M.dimCream, padding:'5px 8px', cursor:'pointer', alignSelf:'flex-start',
        fontFamily:'Rajdhani, sans-serif', fontSize:'10px', letterSpacing:'1px', borderRadius:'4px',
      }});
      closeBtn.addEventListener('click', closeDetail);
      titleCol.appendChild(closeBtn);
      detailBar.appendChild(titleCol);

      // Options en cercles
      const optsScroll = el('div', { style:{
        flexShrink:'0', display:'flex', alignItems:'center', gap:'16px',
        padding:'0 18px', height:'100%', overflowX:'auto', maxWidth:'46%',
        borderRight:`1px solid ${M.border}66`,
      }});

      const CZ = 54;

      // ── Dialog d'achat ───────────────────────────────────────────────────
      const showBuyDialog = (opt, cost) => {
        const overlay = el('div', { style:{
          position:'fixed', inset:'0', background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:'9999',
        }});
        const box = el('div', { style:{
          background:'#0e0d09', border:`1px solid ${M.border}`,
          borderRadius:'8px',
          padding:'28px 32px', minWidth:'300px', maxWidth:'380px',
          fontFamily:'Courier New, monospace',
        }});
        const canAfford = prog.credits >= cost;
        // Description : on récupère la desc du premier upgrade associé
        const upgradeDesc = opt.upgrades?.length
          ? (UPGRADES[opt.upgrades[0]]?.desc ?? '')
          : '';
        box.appendChild(el('div', { text: t('buyTitle'), style:{
          fontSize:'11px', letterSpacing:'3px', color:M.dimCream, marginBottom:'14px',
        }}));
        // Titre = label du slot (nom réel de l'amélioration), sous-titre = variante
        box.appendChild(el('div', { text: tEquip(slot.label), style:{
          fontSize:'17px', fontWeight:'700', color: catColor, letterSpacing:'1px', marginBottom:'2px',
        }}));
        box.appendChild(el('div', { text: tEquip(opt.name), style:{
          fontSize:'11px', color:M.dimCream, letterSpacing:'0.5px', marginBottom:'12px',
        }}));
        if (upgradeDesc) {
          box.appendChild(el('div', { text: tEquip(upgradeDesc), style:{
            fontSize:'10px', color:M.dimCream+'bb', lineHeight:'1.5',
            marginBottom:'14px', borderLeft:`2px solid ${catColor}55`, paddingLeft:'8px',
          }}));
        }
        const rows = [
          [t('buyCost'),   `${cost.toLocaleString()} ✦`],
          [t('buyHave'),   `${prog.credits.toLocaleString()} ✦`],
        ];
        rows.forEach(([label, val]) => {
          const row = el('div', { style:{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }});
          row.appendChild(el('span', { text:label, style:{ fontSize:'12px', color:M.dimCream }}));
          row.appendChild(el('span', { text:val, style:{
            fontSize:'12px', fontWeight:'700',
            color: label === t('buyCost') ? M.yellow : canAfford ? '#7fe07f' : '#ff6655',
          }}));
          box.appendChild(row);
        });
        if (!canAfford) {
          box.appendChild(el('div', { text: t('buyNoCredits'), style:{
            fontSize:'11px', color:'#ff6655', letterSpacing:'1px',
            marginTop:'10px', marginBottom:'4px', fontWeight:'700',
          }}));
        }
        const btns = el('div', { style:{ display:'flex', gap:'12px', marginTop:'20px' }});
        if (canAfford) {
          const yes = el('button', { text: t('buyYes'), style:{
            flex:'1', padding:'9px', background:catColor, color:'#0a0a08',
            fontFamily:'Rajdhani, sans-serif', fontSize:'13px', fontWeight:'700',
            letterSpacing:'1.5px', border:'none', borderRadius:'4px', cursor:'pointer',
          }});
          yes.addEventListener('click', () => {
            if (prog.buyOption(activeSlotKey, opt.id, cost)) {
              overlay.remove();
              this._playBuySound();
              prog.setLoadoutItem(selectedSlot, activeSlotKey, opt.id);
              if (this._previewModelRoot) this._attachPreviewMissiles(this._previewModelRoot, selectedSlot);
              renderDetailBar(); renderTable(); renderStatBars();
              refreshCredits();
            }
          });
          btns.appendChild(yes);
        }
        const no = el('button', { text: t('buyNo'), style:{
          flex:'1', padding:'9px', background:'transparent',
          border:`1px solid ${M.border}`, borderRadius:'4px', color:M.dimCream,
          fontFamily:'Rajdhani, sans-serif', fontSize:'13px', letterSpacing:'1.5px', cursor:'pointer',
        }});
        no.addEventListener('click', () => overlay.remove());
        btns.appendChild(no);
        box.appendChild(btns);
        overlay.appendChild(box);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
      };

      // ── Cas spécial : défense active (UI 2 niveaux) ──────────────────────────
      if (activeSlotKey === 'active_defense') {
        const parseAd = id => {
          if (!id || id === 'none') return { type:'none', level:0 };
          const p = id.split('_');
          if (p[0] === 'shield') return { type:`shield_${p[1]}`, level:parseInt(p[2]) };
          return { type:p[0], level:parseInt(p[1]) };
        };
        const buildAdId = (type, level) => type === 'none' ? 'none' : `${type}_${level}`;
        const currentParsed = parseAd(loadout[activeSlotKey] ?? 'none');
        let selType  = currentParsed.type;
        let selLevel = currentParsed.level;

        const AD_TYPES = [
          { key:'none',         label:t('adNone'),          icon:'○' },
          { key:'leurres',      label:t('adLeurres'),       icon:'◉' },
          { key:'ecm',          label:t('adEcmLabel'),      icon:'⊡' },
          { key:'shield_front', label:t('adShieldFrontSh'), icon:'◭' },
          { key:'shield_rear',  label:t('adShieldRearSh'),  icon:'◬' },
          { key:'shield_full',  label:t('adShield360Sh'),   icon:'⊙' },
        ];

        const adWrap = el('div', { style:{
          flex:'1', display:'flex', flexDirection:'row', alignItems:'center',
          padding:'0 18px', gap:'8px', flexWrap:'wrap',
        }});

        // Section type
        const typeRow = el('div', { style:{
          display:'flex', alignItems:'center', gap:'6px', flexShrink:'0',
        }});

        // Séparateur vertical
        const adSep = el('div', { style:{
          width:'1px', height:'28px', background:`${catColor}40`, flexShrink:'0', alignSelf:'center',
        }});

        // Section niveau
        const levelRow = el('div', { style:{
          display:'flex', alignItems:'center', gap:'6px', flexShrink:'0',
        }});

        const renderAd = () => {
          typeRow.innerHTML = '';
          typeRow.appendChild(el('span', { text:'TYPE :', style:{
            fontSize:'9px', letterSpacing:'1.5px', color:catColor, marginRight:'2px', flexShrink:'0',
          }}));
          AD_TYPES.forEach(({ key, label, icon }) => {
            const isSel      = selType === key;
            const levelOneId = key === 'none' ? 'none' : `${key}_1`;
            const levelOneOpt = slot.options.find(o => o.id === levelOneId);
            const isUnlocked = key === 'none' || (levelOneOpt && level >= levelOneOpt.levelReq);
            const btn = el('div', { style:{
              padding:'4px 8px', borderRadius:'4px', cursor:'pointer', fontSize:'10px',
              border:`1px solid ${isSel ? catColor : (isUnlocked ? `${catColor}55` : '#553322')}`,
              background: isSel ? `${catColor}30` : 'transparent',
              color: isSel ? catColor : (isUnlocked ? M.cream : '#8a6a4a'),
              display:'flex', alignItems:'center', gap:'4px', transition:'all 0.1s',
              opacity: isUnlocked ? '1' : '0.5', whiteSpace:'nowrap',
            }});
            btn.appendChild(el('span', { text:icon, style:{ fontSize:'13px' }}));
            btn.appendChild(el('span', { text:label }));
            btn.addEventListener('click', () => {
              if (!isUnlocked) return;
              if (key === 'none') {
                selType = 'none'; selLevel = 0;
                prog.setLoadoutItem(selectedSlot, activeSlotKey, 'none');
              } else if (key !== selType) {
                // Passer au type choisi au niveau I
                const opt1 = slot.options.find(o => o.id === `${key}_1`);
                if (!opt1) return;
                const isFree1  = opt1.levelReq <= 1 && opt1.upgrades.length === 0;
                const isOwned1 = isFree1 || prog.ownsOption(activeSlotKey, opt1.id);
                if (!isOwned1) {
                  const cost1 = OPTION_COSTS[`active_defense:${opt1.id}`] ?? 0;
                  showBuyDialog(opt1, cost1);
                  return;
                }
                selType = key; selLevel = 1;
                prog.setLoadoutItem(selectedSlot, activeSlotKey, `${key}_1`);
              }
              renderAd();
              renderTable(); renderStatBars();
              renderInfo(slot.options.find(o => o.id === (loadout[activeSlotKey] ?? 'none')) ?? slot.options[0]);
            });
            btn.addEventListener('mouseover', () => {
              this._playHoverSound();
              if (levelOneOpt) { renderInfo(levelOneOpt); renderStatBars(activeSlotKey, levelOneOpt.id); }
            });
            btn.addEventListener('mouseout', () => {
              const cur = slot.options.find(o => o.id === (loadout[activeSlotKey] ?? 'none')) ?? slot.options[0];
              renderInfo(cur);
              renderStatBars();
            });
            typeRow.appendChild(btn);
          });

          // Section niveau (masquée si type === none)
          levelRow.innerHTML = '';
          adSep.style.display = selType !== 'none' ? 'block' : 'none';
          if (selType !== 'none') {
            levelRow.appendChild(el('span', { text:'NIV :', style:{
              fontSize:'9px', letterSpacing:'1.5px', color:catColor, marginRight:'2px', flexShrink:'0',
            }}));
            [1, 2, 3].forEach(lv => {
              const optId  = buildAdId(selType, lv);
              const opt    = slot.options.find(o => o.id === optId);
              if (!opt) return;
              const isSel2     = selLevel === lv;
              const isUnlocked2 = level >= opt.levelReq;
              const isFree2    = opt.levelReq <= 1 && opt.upgrades.length === 0;
              const isOwned2   = isFree2 || prog.ownsOption(activeSlotKey, opt.id);
              const optCost2   = OPTION_COSTS[`active_defense:${opt.id}`] ?? 0;
              const ROMAN      = ['', 'I', 'II', 'III'];
              const btn2 = el('div', { style:{
                padding:'5px 14px', borderRadius:'4px', cursor:'pointer', fontSize:'12px',
                fontWeight: isSel2 ? '700' : '500',
                border:`1px solid ${isSel2 ? catColor : (isUnlocked2 ? `${catColor}55` : '#553322')}`,
                background: isSel2 ? `${catColor}30` : 'transparent',
                color: isSel2 ? catColor : (isUnlocked2 ? (isOwned2 ? M.cream : M.yellow) : '#8a6a4a'),
                transition:'all 0.1s', position:'relative',
              }});
              btn2.textContent = ROMAN[lv];
              if (!isOwned2 && isUnlocked2 && optCost2 > 0) {
                const badge = el('div', { text:`${(optCost2/1000).toFixed(0)}k✦`, style:{
                  position:'absolute', top:'-8px', right:'-6px',
                  background:'#1a1700', color:M.yellow, fontWeight:'800',
                  fontSize:'7px', padding:'1px 3px', borderRadius:'3px',
                  border:`1px solid ${M.yellow}66`, whiteSpace:'nowrap',
                }});
                btn2.appendChild(badge);
              }
              btn2.addEventListener('click', () => {
                if (!isUnlocked2) { renderInfo(opt); return; }
                if (!isOwned2) { showBuyDialog(opt, optCost2); return; }
                selLevel = lv;
                prog.setLoadoutItem(selectedSlot, activeSlotKey, optId);
                if (this._previewModelRoot) this._attachPreviewMissiles(this._previewModelRoot, selectedSlot);
                renderAd(); renderTable(); renderStatBars();
                renderInfo(opt);
              });
              btn2.addEventListener('mouseover', () => {
                this._playHoverSound();
                renderInfo(opt); renderStatBars(activeSlotKey, opt.id);
              });
              btn2.addEventListener('mouseout', () => {
                const cur = slot.options.find(o => o.id === (loadout[activeSlotKey] ?? 'none')) ?? slot.options[0];
                renderInfo(cur); renderStatBars();
              });
              levelRow.appendChild(btn2);
            });
          }
        };

        adWrap.appendChild(typeRow);
        adWrap.appendChild(adSep);
        adWrap.appendChild(levelRow);
        optsScroll.appendChild(adWrap);
        detailBar.appendChild(optsScroll);

        _infoCol = el('div', { style:{
          flex:'1', minWidth:'0', padding:'14px 18px', overflowY:'auto',
          display:'flex', flexDirection:'column', justifyContent:'center',
        }});
        detailBar.appendChild(_infoCol);
        const pinnedAd = slot.options.find(o => o.id === (loadout[activeSlotKey] ?? 'none')) ?? slot.options[0];
        renderAd();
        renderInfo(pinnedAd);
        return;
      }

      slot.options.forEach(opt => {
        const isEquipped = loadout[activeSlotKey] === opt.id;
        const isUnlocked = level >= opt.levelReq;
        const isFree     = opt.levelReq <= 1 && opt.upgrades.length === 0;
        const isOwned    = isFree || prog.ownsOption(activeSlotKey, opt.id);
        const optCost    = OPTION_COSTS[`${activeSlotKey}:${opt.id}`] ?? 0;

        // Couleurs selon état
        let borderCol, bgCol, textCol;
        if (isEquipped)         { borderCol = catColor;        bgCol = `${catColor}33`;          textCol = catColor;    }
        else if (!isUnlocked)   { borderCol = '#553322';       bgCol = 'rgba(14,11,8,0.9)';      textCol = '#8a6a4a';   }
        else if (!isOwned)      { borderCol = M.yellow+'88';   bgCol = 'rgba(20,18,10,0.95)';    textCol = M.yellow;    }
        else                    { borderCol = M.border+'aa';   bgCol = 'rgba(22,20,15,0.95)';    textCol = M.cream;     }

        const item = el('div', { style:{
          display:'flex', flexDirection:'column', alignItems:'center', gap:'5px',
          cursor:'pointer', minWidth:`${CZ}px`, flexShrink:'0',
        }});

        const circleWrap = el('div', { style:{ position:'relative', width:`${CZ}px`, height:`${CZ}px` }});
        const circle = el('div', { style:{
          width:`${CZ}px`, height:`${CZ}px`, borderRadius:'50%',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: !isUnlocked ? '16px' : '22px', transition:'all 0.1s',
          border:`2px solid ${borderCol}`, background:bgCol, color:textCol,
        }});
        if (!isUnlocked)       circle.textContent = '⊘';
        else if (!isOwned)     circle.textContent = '✦';   // achetable
        else                   circle.textContent = opt.icon ?? '○';
        circleWrap.appendChild(circle);

        if (isEquipped) {
          const badge = el('div', { style:{
            position:'absolute', top:'-4px', right:'-4px',
            width:'18px', height:'18px', borderRadius:'50%',
            background:catColor, color:'#000', fontWeight:'900',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px',
            border:'2px solid rgba(7,7,6,0.95)',
          }});
          badge.textContent = '✓';
          circleWrap.appendChild(badge);
        } else if (!isOwned && isUnlocked && optCost > 0) {
          // Badge coût
          const cb = el('div', { text:`${(optCost/1000).toFixed(0)}k✦`, style:{
            position:'absolute', bottom:'-6px', left:'50%', transform:'translateX(-50%)',
            background:'#1a1700', color:M.yellow, fontWeight:'800',
            fontSize:'7px', letterSpacing:'0.5px', padding:'1px 4px', borderRadius:'4px',
            border:`1px solid ${M.yellow}66`, whiteSpace:'nowrap',
          }});
          circleWrap.appendChild(cb);
        } else if (newInSlot.has(opt.id)) {
          const nb = el('div', { text:t('newBadge'), style:{
            position:'absolute', top:'-6px', left:'50%', transform:'translateX(-50%)',
            background:'#ff4466', color:'#fff', fontWeight:'800',
            fontSize:'7px', letterSpacing:'0.5px', padding:'1px 4px', borderRadius:'4px',
            border:'1px solid rgba(7,7,6,0.95)', whiteSpace:'nowrap',
          }});
          circleWrap.appendChild(nb);
        }
        item.appendChild(circleWrap);
        item.appendChild(el('div', { text: tEquip(opt.name), style:{
          fontSize:'10px', color: isEquipped ? catColor : isOwned ? M.cream : isUnlocked ? M.yellow : '#9a7a5a',
          textAlign:'center', letterSpacing:'0.3px', maxWidth:'68px', lineHeight:'1.2',
          fontWeight: isEquipped ? '700' : '500',
        }}));
        item.appendChild(el('div', { text: opt.levelReq > 1 ? `${t('lvlReqPrefix')} ${opt.levelReq}` : t('baseTier'), style:{
          fontSize:'9px', fontWeight:'700', letterSpacing:'0.5px',
          color: opt.levelReq > 1 ? (isUnlocked ? M.yellow : '#cc6644') : M.dimCream+'88',
        }}));

        item.addEventListener('click', () => {
          infoOptId = opt.id;
          if (!isUnlocked) {
            renderInfo(opt); renderStatBars(activeSlotKey, opt.id);
          } else if (!isOwned) {
            showBuyDialog(opt, optCost);
          } else {
            this._playEquipSound(activeSlotKey);
            prog.setLoadoutItem(selectedSlot, activeSlotKey, opt.id);
            if (this._previewModelRoot) this._attachPreviewMissiles(this._previewModelRoot, selectedSlot);
            renderDetailBar(); renderTable(); renderStatBars();
          }
        });
        item.addEventListener('mouseover', () => {
          if (!isEquipped) {
            circle.style.borderColor = `${catColor}cc`;
            circle.style.background  = `${catColor}1c`;
          }
          this._playHoverSound();
          renderInfo(opt);
          renderStatBars(activeSlotKey, opt.id);
        });
        item.addEventListener('mouseout', () => {
          if (!isEquipped) {
            circle.style.borderColor = borderCol;
            circle.style.background  = bgCol;
          }
          const pinned = slot.options.find(o => o.id === infoOptId);
          renderInfo(pinned ?? slot.options[0]);
          const pinnedOwned = pinned && (pinned.levelReq <= 1 && pinned.upgrades.length === 0 || prog.ownsOption(activeSlotKey, pinned.id));
          if (pinned && !pinnedOwned && loadout[activeSlotKey] !== pinned.id) renderStatBars(activeSlotKey, pinned.id);
          else renderStatBars();
        });

        optsScroll.appendChild(item);
      });
      detailBar.appendChild(optsScroll);

      // Colonne d'information (description + niveau + pros/cons)
      _infoCol = el('div', { style:{
        flex:'1', minWidth:'0', padding:'14px 18px', overflowY:'auto',
        display:'flex', flexDirection:'column', justifyContent:'center',
      }});
      detailBar.appendChild(_infoCol);
      const pinned = slot.options.find(o => o.id === infoOptId) ?? slot.options[0];
      renderInfo(pinned);
    };

    // ── TABLEAU CENTRAL (72% gauche) ─────────────────────────────────────────
    const tableArea = el('div', { style:{
      position:'absolute', top:'50px', left:'0', right:'28%', bottom:'0',
      overflowY:'auto', pointerEvents:'all',
    }});
    tableArea.classList.add('menu-panel');

    const CIRCLE_SIZE = 'clamp(28px, 3.2vw, 42px)';
    const COLS = Object.keys(EQUIPMENT_CATALOG).length;

    const renderTable = () => {
      tableArea.innerHTML = '';
      const loadout = prog.getLoadout(selectedSlot);

      // En-têtes de colonnes
      const headerRow = el('div', { style:{
        display:'grid', gridTemplateColumns:`repeat(${COLS}, 1fr)`,
        borderBottom:`1px solid ${M.border}`, position:'sticky', top:'0',
        background:'rgba(5,5,4,0.98)', zIndex:'2',
      }});
      Object.entries(EQUIPMENT_CATALOG).forEach(([catKey, cat]) => {
        const cc  = CAT_COLORS[catKey] ?? M.accent;
        const hdr = el('div', { style:{
          padding:'clamp(7px, 1vw, 12px)', borderRight:`1px solid ${M.border}44`,
          display:'flex', alignItems:'center', gap:'clamp(3px, 0.5vw, 6px)', overflow:'hidden',
        }});
        hdr.appendChild(el('span', { text: cat.icon, style:{ fontSize:'clamp(11px, 1.3vw, 16px)', color:cc, flexShrink:'0' }}));
        hdr.appendChild(el('span', { text: tEquip(cat.label), style:{
          fontSize:'clamp(7px, 0.85vw, 11px)', letterSpacing:'clamp(0.5px, 0.15vw, 2px)',
          fontWeight:'700', color:cc, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}));
        const catNew = prog.getNewOptions().filter(o => o.catKey === catKey).length;
        if (catNew > 0) {
          hdr.appendChild(el('span', { text:`${catNew}`, style:{
            marginLeft:'auto', background:'#ff4466', color:'#fff', fontWeight:'800',
            fontSize:'9px', borderRadius:'50%', minWidth:'16px', height:'16px', flexShrink:'0',
            display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px',
          }}));
        }
        headerRow.appendChild(hdr);
      });
      tableArea.appendChild(headerRow);

      // Lignes de slots
      const catEntries = Object.entries(EQUIPMENT_CATALOG);
      const maxSlots   = Math.max(...catEntries.map(([, cat]) => Object.keys(cat.slots).length));

      for (let rowIdx = 0; rowIdx < maxSlots; rowIdx++) {
        const row = el('div', { style:{
          display:'grid', gridTemplateColumns:`repeat(${COLS}, 1fr)`,
          borderBottom:`1px solid ${M.border}22`,
        }});

        catEntries.forEach(([catKey, cat]) => {
          const cc       = CAT_COLORS[catKey] ?? M.accent;
          const slotEntries = Object.entries(cat.slots);
          const cell     = el('div', { style:{
            padding:'clamp(6px, 0.8vw, 11px) clamp(6px, 0.9vw, 13px)',
            borderRight:`1px solid ${M.border}22`,
            minHeight:'clamp(54px, 6vw, 72px)', display:'flex', alignItems:'center',
            gap:'clamp(5px, 0.7vw, 11px)',
          }});

          if (rowIdx < slotEntries.length) {
            const [slotKey, slot] = slotEntries[rowIdx];
            const equippedOpt = slot.options.find(o => o.id === (loadout[slotKey] ?? slot.options[0].id));
            const isActive    = activeSlotKey === slotKey && activeCatKey === catKey;
            const isUnlocked  = equippedOpt ? level >= equippedOpt.levelReq : true;
            // Slot verrouillé : aucune option non-basique accessible au niveau actuel
            const hasAnyUpgrade = slot.options.some(o => (o.levelReq > 1 || o.upgrades.length > 0) && level >= o.levelReq);
            const isLocked = !hasAnyUpgrade;

            cell.style.cursor     = 'pointer';
            cell.style.background = isActive ? `${cc}12` : 'transparent';
            cell.style.transition = 'background 0.1s';

            // Cercle mini
            const circleWrap = el('div', { style:{ position:'relative', width:CIRCLE_SIZE, height:CIRCLE_SIZE, flexShrink:'0' }});
            const circle = el('div', { style:{
              width:CIRCLE_SIZE, height:CIRCLE_SIZE, borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'clamp(12px, 1.5vw, 17px)',
              border: isActive ? `2px solid ${cc}` : isLocked ? `1px solid ${M.border}55` : `2px solid ${cc}66`,
              background: isActive ? `${cc}2a` : isLocked ? 'transparent' : `${cc}14`,
              color: isLocked ? M.dimCream : cc,
              opacity: isLocked ? '0.38' : '1',
              transition:'all 0.1s',
            }});
            circle.textContent = equippedOpt?.icon ?? '○';
            circleWrap.appendChild(circle);
            cell.appendChild(circleWrap);

            // Labels
            const labels = el('div', { style:{ minWidth:'0', overflow:'hidden', opacity: isLocked ? '0.38' : '1' }});
            labels.appendChild(el('div', { text: tEquip(slot.label), style:{
              fontSize:'clamp(6px, 0.7vw, 9px)', letterSpacing:'clamp(0.5px, 0.12vw, 1.5px)',
              color:M.dimCream, marginBottom:'3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}));
            labels.appendChild(el('div', { text: equippedOpt ? tEquip(equippedOpt.name) : '—', style:{
              fontSize:'clamp(9px, 1.0vw, 13px)', fontWeight:'700', color: isActive ? cc : M.cream,
              letterSpacing:'0.3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}));
            cell.appendChild(labels);

            // Badge NEW si le slot contient des options débloquées non consultées
            if (prog.slotHasNew(slotKey)) {
              labels.appendChild(el('div', { text:t('newSlotBadge'), style:{
                fontSize:'8px', fontWeight:'800', letterSpacing:'0.5px',
                color:'#ff4466', marginTop:'3px',
              }}));
            }

            // Flèche d'ouverture
            const arrow = el('div', { text: isActive ? '▲' : '▼', style:{
              marginLeft:'auto', fontSize:'11px', color:cc+'aa', flexShrink:'0',
            }});
            cell.appendChild(arrow);

            cell.addEventListener('click', () => {
              if (isActive) closeDetail();
              else openDetail(slotKey, catKey);
            });
            cell.addEventListener('mouseover', () => { if (!isActive) cell.style.background = `${cc}0a`; });
            cell.addEventListener('mouseout',  () => { if (!isActive) cell.style.background = 'transparent'; });
          }

          row.appendChild(cell);
        });

        tableArea.appendChild(row);
      }
    };

    wrap.appendChild(tableArea);

    // ── PANEL DROIT (28%) — avion 3D + identité + stats ──────────────────────
    const rightPanel = el('div', { style:{
      position:'absolute', top:'50px', right:'0', bottom:'0', width:'28%',
      display:'flex', flexDirection:'column', pointerEvents:'none',
    }});

    // Zone avion (transparent, ~38% hauteur — plus petite pour laisser place aux stats)
    rightPanel.appendChild(el('div', { style:{ flex:'0 0 38%' }}));

    // Panel identité + stats
    const statsPanel = el('div', { style:{
      flex:'1', background:'rgba(5,4,3,0.90)', borderTop:`1px solid ${M.border}`,
      borderLeft:`1px solid ${M.border}`, padding:'14px 18px 14px 18px',
      overflowY:'auto', overflowX:'hidden', pointerEvents:'all', display:'flex', flexDirection:'column', gap:'9px',
    }});

    const renderSummary = () => {
      const b = classifyBuild();
      typeNameEl.textContent = b.name;
      typeNameEl.style.color = b.col;
      typeSubEl.textContent  = b.sub;
    };

    // Identité : pastilles couleur
    const identityEl = el('div', { style:{ paddingBottom:'10px', borderBottom:`1px solid ${M.border}` }});
    const identityRow = el('div', { style:{ display:'flex', alignItems:'center', gap:'8px' }});
    const cr = el('div', { style:{ display:'flex', gap:'4px', flexShrink:'0' }});
    Object.entries(TEAM_COLORS).forEach(([key, tc]) => {
      const cb = el('button', { style:{
        width:'22px', height:'22px', borderRadius:'4px',
        border: prog.getPlane(selectedSlot).color === key ? '2px solid #fff' : `1px solid ${M.border}44`,
        background:tc.hex, cursor:'pointer',
      }});
      cb.addEventListener('click', () => {
        prog.setPlaneColor(selectedSlot, key);
        this._syncPreviewPlane(selectedSlot);
        refreshTabs(); refreshIdentity();
      });
      cr.appendChild(cb);
    });
    identityRow.appendChild(cr);
    identityEl.appendChild(identityRow);
    statsPanel.appendChild(identityEl);

    const refreshIdentity = () => {
      const plane = prog.getPlane(selectedSlot);
      cr.querySelectorAll('button').forEach((cb, i) => {
        const key = Object.keys(TEAM_COLORS)[i];
        cb.style.border = plane.color === key ? '2px solid #fff' : `1px solid ${M.border}44`;
      });
    };

    // Barres de stats
    const statBarsEl = el('div', { style:{ flex:'1' }});
    statsPanel.appendChild(statBarsEl);

    const statDefs = [
      { key:'speed',           label:t('statSpeed'),    maxVal:150, col:'#5588ff' },
      { key:'maneuverability', label:t('statManeuver'), maxVal:150, col:'#88ddff' },
      { key:'health',          label:t('statHealth'),   maxVal:200, col:'#55cc55' },
      { key:'weaponry',        label:t('statWeaponry'), maxVal:180, col:'#ff7733' },
      { key:'defense',         label:t('statDefense'),  maxVal:160, col:'#cc8833' },
      { key:'logistics',       label:t('statLogistics'),maxVal:160, col:'#aacc44' },
      { key:'fuel',            label:t('statFuel'),     maxVal:200, col:'#ddaa33' },
      { key:'ammo',            label:t('statAmmo'),     maxVal:200, col:'#aaccff' },
    ];

    const renderStatBars = (previewSlotKey = null, previewOptId = null) => {
      statBarsEl.innerHTML = '';
      const base = liveStats();
      const disp = previewSlotKey ? liveStats(previewSlotKey, previewOptId) : base;
      const isPreview = previewSlotKey !== null;
      if (!isPreview) renderSummary();

      statDefs.forEach(sd => {
        const baseValRaw = base[sd.key] ?? 100;
        const dispValRaw = disp[sd.key] ?? 100;
        // Plafonne les valeurs affichées au maximum visuel défini
        const baseVal = Math.min(baseValRaw, sd.maxVal);
        const dispVal = Math.min(dispValRaw, sd.maxVal);
        const diff    = Math.round(dispVal - baseVal);
        const pct     = Math.min(100, Math.max(0, (dispVal / sd.maxVal) * 100));
        const pctBase = Math.min(100, Math.max(0, (baseVal / sd.maxVal) * 100));

        const row = el('div', { style:{ marginBottom:'7px' }});
        const top = el('div', { style:{
          display:'flex', justifyContent:'space-between', alignItems:'baseline',
          fontSize:'10px', letterSpacing:'1px', marginBottom:'4px',
        }});
        top.appendChild(el('span', { text: sd.label, style:{ color:M.dimCream, fontWeight:'600' }}));
        const valWrap = el('span', { style:{ display:'flex', gap:'6px', alignItems:'baseline' }});
        if (isPreview && diff !== 0) {
          valWrap.appendChild(el('span', { text: String(Math.round(baseVal)), style:{ color:M.dimCream, fontSize:'11px' }}));
          valWrap.appendChild(el('span', { text:'→', style:{ color:M.dimCream, fontSize:'10px' }}));
        }
        valWrap.appendChild(el('span', { text: String(Math.round(dispVal)), style:{
          color: isPreview && diff !== 0 ? (diff > 0 ? '#7fe07f' : '#ff8877') : M.cream,
          fontWeight:'700', fontSize:'13px',
        }}));
        if (isPreview && diff !== 0) {
          valWrap.appendChild(el('span', { text:`(${diff > 0 ? '+' : ''}${diff})`, style:{
            fontSize:'10px', fontWeight:'700',
            color: diff > 0 ? '#7fe07f' : '#ff8877',
          }}));
        }
        top.appendChild(valWrap);
        row.appendChild(top);

        const bg = el('div', { style:{ background:'#1a1810', height:'7px', borderRadius:'3px', overflow:'hidden', position:'relative' }});
        if (isPreview && diff !== 0) {
          const lo = Math.min(pct, pctBase);
          bg.appendChild(el('div', { style:{ position:'absolute', left:'0', width:`${lo}%`, height:'100%', background: sd.col+'88' }}));
          bg.appendChild(el('div', { style:{ position:'absolute', left:`${lo}%`, width:`${Math.abs(pct-pctBase)}%`, height:'100%', background: diff>0?'#7fe07f':'#ff8877' }}));
        } else {
          bg.appendChild(el('div', { style:{ background:sd.col, width:`${pct}%`, height:'100%' }}));
        }
        row.appendChild(bg);
        statBarsEl.appendChild(row);
      });
    };

    rightPanel.appendChild(statsPanel);
    wrap.appendChild(rightPanel);

    // ── INIT ─────────────────────────────────────────────────────────────────
    this._root.appendChild(wrap);
    requestAnimationFrame(() => { wrap.style.opacity = '1'; });
    refreshTabs(); renderTable(); renderStatBars();
  }

  // ── STATISTIQUES ──────────────────────────────────────────────────────────
  _showStats() {
    this._clear();
    this._setCurrentScreen(() => this._showStats());
    this._showPreview('settings');
    this._syncPreviewPlane();

    const prog = this._progression;
    const s    = prog.stats;

    const wrap = mkPanelLeft('680px');
    wrap.appendChild(mkSectionTitle(t('stats')));
    wrap.appendChild(mkDivider());

    const cols = el('div', { style:{ display:'flex', gap:'28px', alignItems:'flex-start' }});
    const colL = el('div', { style:{ flex:'1', minWidth:'0' }});
    const colR = el('div', { style:{ flex:'1', minWidth:'0' }});

    const mkStatRow = (label, value, color = M.cream) => {
      const row = el('div', { style:{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'5px 0', borderBottom:`1px solid ${M.border}`,
      }});
      row.appendChild(el('span', { text:label, style:{ color:M.dimCream, fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase' }}));
      row.appendChild(el('span', { text:String(value), style:{ color, fontSize:'13px', letterSpacing:'2px', fontWeight:'bold' }}));
      return row;
    };

    const { level, xpInLevel } = prog.levelInfo;
    const xpNext = xpToNextLevel(level);
    const diffs = [t('diffEasy'), t('diffNormal'), t('diffHard'), t('diffExpert')];

    // Colonne gauche
    colL.appendChild(mkLabel(t('sectionGlobal')));
    colL.appendChild(mkStatRow(t('statLevelLabel'), level, M.accent));
    colL.appendChild(mkStatRow(t('statXpTotal'), prog.totalXp.toLocaleString(), M.yellow));
    colL.appendChild(mkStatRow(t('statCredits'), prog.credits.toLocaleString(), M.yellow));
    colL.appendChild(mkStatRow(t('gamesPlayed'), s.totalGames));
    colL.appendChild(mkStatRow(t('kills'), s.totalKills, M.green));
    colL.appendChild(mkStatRow(t('deaths'), s.totalDeaths, M.red));
    colL.appendChild(mkStatRow(t('statKD'), prog.kd(s.totalKills, s.totalDeaths), M.cream));
    const flightHours = Math.floor(s.flightTimeSec / 3600);
    const flightMin   = Math.floor((s.flightTimeSec % 3600) / 60);
    colL.appendChild(mkStatRow(t('flightTime'), `${flightHours}h ${flightMin}min`));
    colL.appendChild(mkStatRow(t('statDistance'), Math.round(s.distanceKm).toLocaleString()));

    colL.appendChild(mkDivider());
    colL.appendChild(mkLabel(t('statsSurvival')));
    colL.appendChild(mkStatRow(t('bestWave'), s.survival.bestWave, M.yellow));
    colL.appendChild(mkStatRow(t('statMaxDiff'), diffs[s.survival.maxDiff ?? 0] ?? diffs[0]));
    const sMin = Math.floor(s.survival.timeSec / 60);
    colL.appendChild(mkStatRow(t('statSurvTime'), `${sMin} min`));

    // Colonne droite
    colR.appendChild(mkLabel(t('mission')));
    colR.appendChild(mkStatRow(t('statVictories'), s.mission.victories, M.green));
    colR.appendChild(mkStatRow(t('statMaxDiff'), diffs[s.mission.maxDiff ?? 0] ?? diffs[0]));
    colR.appendChild(mkStatRow(t('statMaxKills'), s.mission.maxKills, M.yellow));
    const mMin = Math.floor(s.mission.timeSec / 60);
    colR.appendChild(mkStatRow(t('statTotalTime'), `${mMin} min`));

    colR.appendChild(mkDivider());
    colR.appendChild(mkLabel(t('sectionVersus')));
    colR.appendChild(mkStatRow(t('statVictories'), s.versus.wins, M.green));
    colR.appendChild(mkStatRow(t('statLosses'), s.versus.losses, M.red));
    colR.appendChild(mkStatRow(t('kills'), s.versus.kills));
    colR.appendChild(mkStatRow(t('deaths'), s.versus.deaths));
    colR.appendChild(mkStatRow(t('statRatio'), prog.kd(s.versus.kills, s.versus.deaths)));

    colR.appendChild(mkDivider());
    colR.appendChild(mkLabel(t('sectionTeams')));
    colR.appendChild(mkStatRow(t('statVictories'), s.teams.wins, M.green));
    colR.appendChild(mkStatRow(t('statLosses'), s.teams.losses, M.red));
    colR.appendChild(mkStatRow(t('kills'), s.teams.kills));
    colR.appendChild(mkStatRow(t('deaths'), s.teams.deaths));
    colR.appendChild(mkStatRow(t('statAssists'), s.teams.assists));
    colR.appendChild(mkStatRow(t('statRatio'), prog.kd(s.teams.kills, s.teams.deaths)));

    cols.appendChild(colL); cols.appendChild(colR);
    wrap.appendChild(cols);
    wrap.appendChild(mkDivider());

    const btnBack = mkBtn(t('back'), M.dimCream);
    btnBack.addEventListener('click', () => this._showMain());
    wrap.appendChild(btnBack);
    this._root.appendChild(wrap);
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
export { ProgressionSystem };



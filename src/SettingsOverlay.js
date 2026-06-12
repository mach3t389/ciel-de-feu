import { t, getLang, setLang } from './i18n.js';
import { showBugReport } from './BugReport.js';
import { IS_MOBILE } from './MobileControls.js';

// ── Palette identique à Menu.js ──────────────────────────────────────────────
const M = {
  bg      : '#080806',
  cream   : '#d4c88a',
  dimCream: '#7a7050',
  border  : '#3a3020',
  accent  : '#cc3300',
};

const el = (tag, { text, style, placeholder, type } = {}) => {
  const d = document.createElement(tag);
  if (text !== undefined) d.textContent = text;
  if (placeholder)        d.placeholder = placeholder;
  if (type)               d.type = type;
  if (style) Object.assign(d.style, style);
  return d;
};

function mkPanel() {
  const isMob = window.innerWidth < 700;
  return el('div', { style: {
    width          : `min(820px, 100%)`,
    background     : 'rgba(6,8,4,0.97)',
    border         : `1px solid ${M.border}`,
    borderRadius   : '8px',
    padding        : isMob ? '18px 16px' : '28px 32px',
    boxShadow      : 'inset 0 0 30px rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.4)',
    display        : 'flex',
    flexDirection  : 'column',
    gap            : '8px',
    boxSizing      : 'border-box',
    flexShrink     : '0',
    margin         : 'auto',
    alignSelf      : 'center',
  }});
}

function mkBtn(label, color = M.dimCream) {
  const b = el('button', { text: label, style: {
    background    : 'transparent',
    border        : `1px solid ${color}`,
    borderRadius  : '4px',
    color,
    fontFamily    : 'Rajdhani, sans-serif',
    fontSize      : '14px',
    letterSpacing : '3px',
    padding       : '13px 24px',
    cursor        : 'pointer',
    textTransform : 'uppercase',
    transition    : 'background 0.15s, color 0.15s',
    width         : '100%',
    boxSizing     : 'border-box',
    textAlign     : 'left',
    outline       : 'none',
  }});
  const on  = () => { b.style.background = color;        b.style.color = M.bg; };
  const off = () => { b.style.background = 'transparent'; b.style.color = color; };
  b.addEventListener('mouseover',   on);  b.addEventListener('mouseout',    off);
  b.addEventListener('focus',       on);  b.addEventListener('blur',        off);
  b.addEventListener('touchstart',  on,  { passive: true });
  b.addEventListener('touchend',    off, { passive: true });
  b.addEventListener('touchcancel', off, { passive: true });
  return b;
}

function mkSectionTitle(text) {
  const wrap = el('div', { style: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }});
  const line = () => el('div', { style: { flex:'1', height:'1px', background: M.border }});
  const star = el('div', { text:'✦', style: { color: M.accent, fontSize:'10px', flexShrink:'0' }});
  wrap.appendChild(line());
  wrap.appendChild(star);
  wrap.appendChild(el('div', { text, style: { color: M.cream, fontSize:'15px', fontWeight:'bold', letterSpacing:'5px', flexShrink:'0' }}));
  wrap.appendChild(star.cloneNode(true));
  wrap.appendChild(line());
  return wrap;
}

function mkDivider() {
  return el('div', { style: { width:'100%', height:'1px', background: M.border, margin:'8px 0' }});
}

function mkCard(labelText) {
  const card = el('div', { style: {
    border        : `1px solid ${M.border}44`,
    borderRadius  : '6px',
    padding       : '12px 14px',
    background    : 'rgba(212,200,138,0.02)',
    display       : 'flex',
    flexDirection : 'column',
    gap           : '0',
  }});
  card.appendChild(el('div', { text: labelText, style: {
    fontSize    : '8px',
    letterSpacing: '3px',
    color       : M.dimCream,
    fontFamily  : 'Rajdhani, sans-serif',
    fontWeight  : '700',
    marginBottom: '8px',
    textTransform: 'uppercase',
  }}));
  return card;
}

function mkChoiceGroup(options, defaultVal, onChange) {
  const container = el('div', { style: { display:'flex', gap:'8px', flexWrap:'wrap', width:'100%' }});
  let active = defaultVal;
  const btns = [];
  options.forEach(({ value, label, color }) => {
    const b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = label;
    const col = color || M.cream;
    b.style.setProperty('--cb-color',  col);
    b.style.setProperty('--cb-border', col);
    b.style.setProperty('--cb-fill',   col);
    b.style.setProperty('--cb-hover',  `${col}22`);
    const setActive = () => b.setAttribute('data-active', value === active ? '1' : '0');
    setActive();
    btns.push({ value, setActive });
    b.addEventListener('click', () => {
      if (active === value) return;
      active = value;
      btns.forEach(x => x.setActive());
      onChange(value);
    });
    container.appendChild(b);
  });
  container.setValue = (v) => { active = v; btns.forEach(x => x.setActive()); };
  return container;
}

function mkAudioSection(audioRef) {
  const frag = document.createDocumentFragment();
  const mkSliderRow = (label, storageKey, baseVol, busKey) => {
    const initVal = parseFloat(localStorage.getItem(storageKey) ?? '1');
    const row = el('div', { style: { display:'flex', flexDirection:'column', gap:'6px', marginBottom:'12px' }});
    const top = el('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center' }});
    top.appendChild(el('span', { text: label, style: { color: M.dimCream, fontSize:'11px', letterSpacing:'2px' }}));
    const valLabel = el('span', { text: Math.round(initVal * 100) + '%', style: { color: M.cream, fontSize:'11px', letterSpacing:'2px', minWidth:'36px', textAlign:'right' }});
    top.appendChild(valLabel); row.appendChild(top);
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100';
    slider.value = Math.round(initVal * 100);
    Object.assign(slider.style, { width:'100%', accentColor: M.cream, cursor:'pointer', background:'transparent' });
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value) / 100;
      valLabel.textContent = slider.value + '%';
      localStorage.setItem(storageKey, v);
      if (audioRef?._bus?.[busKey])
        audioRef._bus[busKey].gain.setTargetAtTime(baseVol * v, audioRef._ctx.currentTime, 0.05);
    });
    row.appendChild(slider);
    return row;
  };
  frag.appendChild(mkSliderRow(t('musicVol'), 'audio_music', 0.38, 'ambient'));
  frag.appendChild(mkSliderRow(t('sfxVol'),   'audio_sfx',   0.55, 'sfx'));
  return frag;
}

// ── Fonction principale exportée ──────────────────────────────────────────────
//  onBack          : function() — appelée par le bouton Retour
//  audioRef        : AudioManager instance (peut être null)
//  onShowControls  : function() — ouvre la page Commandes
//  extraCards      : tableau de nœuds DOM à ajouter après les 4 cartes de base
//  bugContextFn    : function() → context pour le bug report
export function showSettingsOverlay({ onBack, audioRef = null, onShowControls = null, extraCards = [], bugContextFn = null } = {}) {
  // Ferme une éventuelle instance précédente
  document.getElementById('__settings-overlay')?.remove();

  const backdrop = el('div', { style: {
    position      : 'fixed', inset: '0',
    overflowY     : 'auto',
    background    : 'rgba(0,0,0,0.88)',
    fontFamily    : 'Rajdhani, sans-serif',
    color         : M.cream,
    zIndex        : '800',
    display       : 'flex',
    justifyContent: 'center',
  }});
  backdrop.id = '__settings-overlay';

  const panel = mkPanel();
  backdrop.appendChild(panel);

  // ── Titre ──
  panel.appendChild(mkSectionTitle(t('settings')));
  panel.appendChild(mkDivider());

  // ── Grille 2×2 ──
  const isMob = window.innerWidth < 700;
  const grid = el('div', { style: {
    display             : 'grid',
    gridTemplateColumns : isMob ? '1fr' : '1fr 1fr',
    gap                 : '10px',
    marginBottom        : '8px',
  }});

  // Carte 1 — Audio
  const cardAudio = mkCard(t('audio'));
  cardAudio.appendChild(mkAudioSection(audioRef));
  grid.appendChild(cardAudio);

  // Carte 2 — Affichage
  const GFX_MODES = [
    { value: 0, label: t('gfxHigh'), color: M.cream,    desc: t('gfxHighDesc') },
    { value: 1, label: t('gfxMed'),  color: '#ccaa33',  desc: t('gfxMedDesc')  },
    { value: 2, label: t('gfxLow'),  color: '#dd6633',  desc: t('gfxLowDesc')  },
  ];
  const curGfx  = parseInt(localStorage.getItem('lowGraphics') || '0', 10);
  const gfxDesc = el('div', { style: { fontSize:'9px', color: M.dimCream, letterSpacing:'1px', lineHeight:'1.5', marginTop:'6px', minHeight:'22px' }});
  gfxDesc.textContent = GFX_MODES.find(m => m.value === curGfx)?.desc ?? '';
  const cardGfx = mkCard(t('graphicsQuality'));
  cardGfx.appendChild(mkChoiceGroup(GFX_MODES.map(({ value, label, color }) => ({ value, label, color })), curGfx,
    v => { localStorage.setItem('lowGraphics', String(v)); gfxDesc.textContent = GFX_MODES.find(m => m.value === v)?.desc ?? ''; }));
  cardGfx.appendChild(gfxDesc);
  grid.appendChild(cardGfx);

  // Carte 3 — Contrôles
  const CTRL_MODES = [
    { value: 'standard',  label: t('ctrlStd'), color: M.cream,    desc: t('ctrlStdDesc') },
    { value: 'simulator', label: t('ctrlSim'), color: '#88aacc',  desc: t('ctrlSimDesc') },
  ];
  const curCtrl  = localStorage.getItem('ctrlMode') || 'standard';
  const ctrlDesc = el('div', { style: { fontSize:'9px', color: M.dimCream, letterSpacing:'1px', lineHeight:'1.5', marginTop:'6px', minHeight:'22px' }});
  ctrlDesc.textContent = CTRL_MODES.find(m => m.value === curCtrl)?.desc ?? '';
  const cardCtrl = mkCard(t('ctrlMode'));
  cardCtrl.appendChild(mkChoiceGroup(CTRL_MODES.map(({ value, label, color }) => ({ value, label, color })), curCtrl,
    v => { localStorage.setItem('ctrlMode', v); ctrlDesc.textContent = CTRL_MODES.find(m => m.value === v)?.desc ?? ''; }));
  cardCtrl.appendChild(ctrlDesc);
  if (onShowControls) {
    const sep = el('div', { style: { marginTop:'10px', paddingTop:'8px', borderTop:`1px solid ${M.border}44` }});
    const btnCtrl = el('button', { text: t('controls') || 'COMMANDES', style: {
      padding:'6px 14px', background:'transparent',
      border:`1px solid ${M.border}`, borderRadius:'4px',
      color: M.dimCream, fontFamily:'Rajdhani, sans-serif',
      fontSize:'11px', letterSpacing:'2px', cursor:'pointer',
      transition:'all 0.15s', whiteSpace:'nowrap',
    }});
    btnCtrl.addEventListener('mouseover', () => { btnCtrl.style.color = M.cream; btnCtrl.style.borderColor = M.cream; });
    btnCtrl.addEventListener('mouseout',  () => { btnCtrl.style.color = M.dimCream; btnCtrl.style.borderColor = M.border; });
    btnCtrl.addEventListener('click', (e) => { e.stopPropagation(); onShowControls(); });
    sep.appendChild(btnCtrl);
    cardCtrl.appendChild(sep);
  }
  grid.appendChild(cardCtrl);

  // Carte 4 — Langue (+ Scoreboard mobile)
  const cardLang = mkCard(t('lang'));
  const langGroup = mkChoiceGroup(
    [{ value:'fr', label: t('langFR'), color: M.cream }, { value:'en', label: t('langEN'), color: M.cream }],
    getLang(),
    code => {
      if (getLang() === code) return;
      setLang(code);
      // Rafraîchit le panneau dans la même langue
      backdrop.remove();
      showSettingsOverlay({ onBack, audioRef, onShowControls, extraCards, bugContextFn });
    }
  );
  cardLang.appendChild(langGroup);
  if (IS_MOBILE) {
    const mSep = el('div', { style: { marginTop:'10px', paddingTop:'8px', borderTop:`1px solid ${M.border}44` }});
    const btnSb = el('button', { text: t('scoreboardTitle'), style: {
      padding:'6px 14px', background:'transparent',
      border:`1px solid ${M.border}`, borderRadius:'4px',
      color: M.dimCream, fontFamily:'Rajdhani, sans-serif',
      fontSize:'11px', letterSpacing:'2px', cursor:'pointer',
      transition:'all 0.15s',
    }});
    btnSb.addEventListener('mouseover', () => { btnSb.style.color = M.cream; btnSb.style.borderColor = M.cream; });
    btnSb.addEventListener('mouseout',  () => { btnSb.style.color = M.dimCream; btnSb.style.borderColor = M.border; });
    // showScoreboard est dans l'UI — on dispatche un événement custom
    btnSb.addEventListener('click', () => window.dispatchEvent(new CustomEvent('showScoreboardMobile')));
    mSep.appendChild(btnSb);
    cardLang.appendChild(mSep);
  }
  grid.appendChild(cardLang);

  // ── Cartes supplémentaires (Menu.js peut en passer) ──
  extraCards.forEach(card => grid.appendChild(card));

  panel.appendChild(grid);

  // ── Retour ──
  panel.appendChild(mkDivider());
  const btnBack = mkBtn(t('back'), M.dimCream);
  btnBack.addEventListener('click', (e) => {
    e.stopPropagation();
    backdrop.remove();
    if (onBack) onBack();
  });
  panel.appendChild(btnBack);

  // ── Bug report ──
  const btnBug = el('button', { text: t('reportBug'), style: {
    background: 'transparent', border: 'none', color: '#4a3828',
    fontFamily: 'Rajdhani, sans-serif', fontSize: '11px', letterSpacing: '2px',
    padding: '8px 0', cursor: 'pointer', textTransform: 'uppercase',
    width: '100%', textAlign: 'left', transition: 'color 0.12s', marginTop: '4px',
  }});
  btnBug.addEventListener('mouseover',  () => { btnBug.style.color = '#7a6040'; });
  btnBug.addEventListener('mouseout',   () => { btnBug.style.color = '#4a3828'; });
  btnBug.addEventListener('touchstart', () => { btnBug.style.color = '#7a6040'; }, { passive: true });
  btnBug.addEventListener('touchend',   () => { btnBug.style.color = '#4a3828'; }, { passive: true });
  btnBug.addEventListener('click', () => showBugReport(bugContextFn));
  panel.appendChild(btnBug);

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.querySelector('button')?.focus());

  return { close: () => backdrop.remove() };
}

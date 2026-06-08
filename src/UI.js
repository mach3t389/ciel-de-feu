import * as THREE from 'three';
import { AudioManager } from './AudioManager.js';
import { t, tCtrlLines, getLang, setLang } from './i18n.js';

// ── Palette WW2 cockpit ────────────────────────────────────────────────────────
const C = {
  cream    : '#d4c88a',
  dimCream : '#8a8060',
  panelDark: '#0a0a06',
  panelMid : '#14120c',
  bezelHi  : '#6a6050',
  bezelLo  : '#2a2418',
  zoneGreen: '#2a5a18',
  zoneOrange:'#7a4010',
  zoneRed  : '#6a1010',
  needleHi : '#f0e0a0',
  needleLo : '#a09050',
  tickMajor: '#d4c88a',
  tickMinor: '#4a4030',
  rivetHi  : '#9a8a60',
  rivetLo  : '#2a2418',
  // Fond gris uniforme pour tous les overlays (pause, crash, victoire, scoreboard)
  menuBackdrop : 'rgba(10,11,13,0.66)',
};

export class UI {
  constructor() {
    this._deadShown      = false;
    this._deadOverlay    = null;
    this._onRespawn      = null;
    this._onMenu         = null;   // retour menu/lobby (sinon reload page)
    this._onReplay       = null;   // recommence la même partie (solo)
    this._survivalMode   = false;
    this._hitMarkerTimer     = 0;
    this._playerHitTimer     = 0;
    this._muzzleFlashTimer   = 0;
    this._refuelCompleteTimer= 0;
    this._reticleX           = window.innerWidth  / 2;
    this._reticleY           = window.innerHeight / 2;
    // Alertes ressources basses
    this._alertFuelTimer     = 0;
    this._alertHealthTimer   = 0;
    this._alertFuelEl        = null;
    this._alertHealthEl      = null;
    this._audioRef           = null;
    // Timer de match (Versus / Équipes)
    this._timerEl            = null;
    this._root = this._build();
    document.body.appendChild(this._root);
  }

  // Injecte la référence AudioManager (appelé depuis Game.js après init)
  setAudio(audioManager) { this._audioRef = audioManager; }

  // Active/masque le timer de match et initialise la valeur
  setMatchTimer(totalSeconds) {
    if (!this._timerEl) return;
    if (totalSeconds > 0) {
      this._timerEl.style.display = '';
      this._updateTimerDisplay(totalSeconds);
    } else {
      this._timerEl.style.display = 'none';
    }
  }

  // Appelé chaque frame par Game.js avec le temps restant (secondes)
  updateMatchTimer(secondsLeft) {
    if (!this._timerEl || this._timerEl.style.display === 'none') return;
    this._updateTimerDisplay(secondsLeft);
    // Rouge + pulsation quand < 30 s
    const urgent = secondsLeft <= 30;
    this._timerEl.style.color  = urgent ? '#ff4422' : '#d4c88a';
    this._timerEl.style.border = urgent ? '1px solid #cc2200' : '1px solid #3a3020';
    this._timerEl.style.textShadow = urgent
      ? '0 0 12px rgba(255,68,34,0.7)'
      : '0 0 8px rgba(212,200,138,0.4)';
  }

  _updateTimerDisplay(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    this._timerEl.textContent = `${mm}:${ss}`;
  }

  setRespawnCallback(fn) { this._onRespawn = fn; }
  setEndCallbacks({ onMenu = null, onReplay = null } = {}) {
    this._onMenu   = onMenu;
    this._onReplay = onReplay;
  }

  _ensureRefuelEl() {
    if (this._refuelEl) return;
    this._refuelEl = document.createElement('div');
    Object.assign(this._refuelEl.style, {
      position     : 'absolute',
      top          : '50%',
      left         : '50%',
      transform    : 'translate(-50%, -50%)',
      color        : '#44ff88',
      fontFamily   : '"Courier New", monospace',
      fontSize     : '15px',
      letterSpacing: '4px',
      textTransform: 'uppercase',
      pointerEvents: 'none',
      zIndex       : '200',
      textShadow   : '0 0 10px rgba(0,255,100,0.7)',
      background   : 'rgba(0,20,0,0.55)',
      border       : '1px solid rgba(0,255,100,0.4)',
      padding      : '8px 20px',
      display      : 'none',
    });
    this._root.appendChild(this._refuelEl);
  }

  showRefueling(active) {
    // Ne pas écraser le message "terminé" si le timer tourne encore
    if (this._refuelCompleteTimer > 0) return;
    this._ensureRefuelEl();
    if (active) this._refuelEl.textContent = '▲ RAVITAILLEMENT EN COURS ▲';
    this._refuelEl.style.display = active ? 'block' : 'none';
  }

  showHitMarker()   { this._hitMarkerTimer  = 0.22; }
  showPlayerHit()   { this._playerHitTimer  = 0.45; }
  showMuzzleFlash() { this._muzzleFlashTimer = 0.07; }

  showRefuelComplete() {
    this._ensureRefuelEl();
    this._refuelEl.textContent = '✓ RAVITAILLEMENT TERMINÉ';
    this._refuelEl.style.display = 'block';
    this._refuelCompleteTimer = 3.0;
  }

  clearRefuelMessage() {
    if (this._refuelCompleteTimer > 0) {
      this._refuelCompleteTimer = 0;
      if (this._refuelEl) this._refuelEl.style.display = 'none';
    }
  }

  showPause(visible, onQuit = null, onResume = null, onRespawn = null, isSurvival = null) {
    if (!this._pauseOverlay) {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position      : 'fixed', inset: '0',
        display       : 'flex', flexDirection: 'column',
        alignItems    : 'center', justifyContent: 'center',
        background    : C.menuBackdrop,
        fontFamily    : '"Courier New",monospace',
        color         : C.cream,
        pointerEvents : 'none',
        zIndex        : '500',
      });

      const title = document.createElement('div');
      title.textContent = t('pauseTitle');
      title.style.cssText = `font-size:48px;font-weight:bold;letter-spacing:12px;opacity:0.9;margin-bottom:8px;`;

      const divider = document.createElement('div');
      divider.style.cssText = `width:120px;height:1px;background:${C.dimCream};opacity:0.2;margin-bottom:20px;`;

      // Boutons pause — taille identique, style cockpit uniforme
      const mkPBtn = (label, col, primary = false) => {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
          background   : primary ? `rgba(212,200,138,0.08)` : 'transparent',
          border       : `1px solid ${col}`,
          color        : col,
          fontFamily   : '"Courier New",monospace',
          fontSize     : '12px',
          letterSpacing: '4px',
          padding      : '11px 0',
          width        : '240px',
          textAlign    : 'center',
          cursor       : 'pointer',
          pointerEvents: 'all',
          transition   : 'background 0.15s, color 0.15s',
          outline      : 'none',
          marginBottom : '8px',
          display      : 'block',
        });
        b.addEventListener('mouseover', () => { b.style.background = col; b.style.color = '#0a0a06'; });
        b.addEventListener('mouseout',  () => { b.style.background = primary ? `rgba(212,200,138,0.08)` : 'transparent'; b.style.color = col; });
        return b;
      };

      const btnResume = mkPBtn(t('resume'), C.cream, true);
      btnResume.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._pauseResumeCb) this._pauseResumeCb();
      });

      const btnRespawn = mkPBtn(t('respawnBtn'), C.dimCream);
      btnRespawn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._pauseIsSurvival) {
          if (this._pauseQuitCb) this._pauseQuitCb();
        } else {
          if (this._pauseRespawnCb) this._pauseRespawnCb();
        }
      });
      this._btnPauseRespawn = btnRespawn;

      const btnSettings = mkPBtn(t('settingsBtn'), C.dimCream);
      btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showPauseSettings();
      });

      const btnMenu = mkPBtn(t('mainMenu'), C.dimCream);
      btnMenu.style.marginTop = '4px';
      btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._pauseQuitCb) this._pauseQuitCb();
      });

      wrap.appendChild(title);
      wrap.appendChild(divider);
      wrap.appendChild(btnResume);
      wrap.appendChild(btnRespawn);
      wrap.appendChild(btnSettings);
      wrap.appendChild(btnMenu);
      document.body.appendChild(wrap);
      this._pauseOverlay = wrap;
    }
    if (onQuit    !== null) this._pauseQuitCb    = onQuit;
    if (onResume  !== null) this._pauseResumeCb  = onResume;
    if (onRespawn !== null) this._pauseRespawnCb = onRespawn;
    if (isSurvival !== null) {
      this._pauseIsSurvival = isSurvival;
      if (this._btnPauseRespawn) {
        this._btnPauseRespawn.textContent = isSurvival ? t('endGameBtn') : t('respawnBtn');
        const col = isSurvival ? '#cc4444' : C.dimCream;
        this._btnPauseRespawn.style.color  = col;
        this._btnPauseRespawn.style.border = `1px solid ${col}`;
      }
    }
    this._updatePauseScheme?.();
    this._pauseOverlay.style.display = visible ? 'flex' : 'none';
    // Auto-focus le bouton Reprendre pour la navigation clavier/manette
    if (visible) requestAnimationFrame(() => {
      this._pauseOverlay?.querySelector('button')?.focus();
    });
  }

  _showPauseSettings() {
    // Toujours reconstruire pour refléter l'état courant (lang, gfx, ctrl)
    if (this._pauseSettingsOverlay) {
      this._pauseSettingsOverlay.remove();
      this._pauseSettingsOverlay = null;
    }

    if (!this._pauseSettingsOverlay) {
      this._pauseSettingsLang = getLang();
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position: 'fixed', inset: '0',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)',
        fontFamily: '"Courier New",monospace',
        color: C.cream, zIndex: '502',
      });

      const mkSBtn = (label, col) => {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
          background: 'transparent', border: `1px solid ${col}`,
          color: col, fontFamily: '"Courier New",monospace',
          fontSize: '11px', letterSpacing: '3px',
          padding: '8px 24px', cursor: 'pointer', outline: 'none',
          pointerEvents: 'all', transition: 'background 0.15s, color 0.15s',
          marginBottom: '8px',
        });
        b.addEventListener('mouseover', () => { b.style.background = col; b.style.color = '#0a0a06'; });
        b.addEventListener('mouseout',  () => { b.style.background = 'transparent'; b.style.color = col; });
        return b;
      };

      const title = document.createElement('div');
      title.textContent = t('settings');
      title.style.cssText = `font-size:32px;font-weight:bold;letter-spacing:8px;margin-bottom:8px;`;
      const divider = document.createElement('div');
      divider.style.cssText = `width:200px;height:1px;background:${C.dimCream};opacity:0.2;margin-bottom:22px;`;

      const secLabel = (txt) => {
        const d = document.createElement('div');
        d.textContent = txt;
        d.style.cssText = `font-size:9px;letter-spacing:3px;color:${C.dimCream};margin-bottom:8px;`;
        return d;
      };

      wrap.appendChild(title);
      wrap.appendChild(divider);

      // ── Audio ──────────────────────────────────────────────────────────────
      wrap.appendChild(secLabel(t('audio')));

      const mkSlider = (label, storageKey, baseVol, busKey) => {
        const box = document.createElement('div');
        Object.assign(box.style, { display:'flex', flexDirection:'column', gap:'6px', marginBottom:'14px', width:'300px' });
        const top = document.createElement('div');
        Object.assign(top.style, { display:'flex', justifyContent:'space-between' });
        const lbl = document.createElement('span');
        lbl.textContent = label;
        lbl.style.cssText = `font-size:10px;letter-spacing:2px;color:${C.dimCream};`;
        const pct = document.createElement('span');
        const initVal = parseFloat(localStorage.getItem(storageKey) ?? '1');
        pct.textContent = Math.round(initVal * 100) + '%';
        pct.style.cssText = `font-size:10px;letter-spacing:2px;color:${C.cream};min-width:36px;text-align:right;`;
        top.appendChild(lbl); top.appendChild(pct); box.appendChild(top);
        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = '0'; slider.max = '100';
        slider.value = Math.round(initVal * 100);
        Object.assign(slider.style, { width:'100%', accentColor: C.cream, cursor:'pointer', background:'transparent' });
        slider.addEventListener('input', () => {
          const v = parseInt(slider.value) / 100;
          pct.textContent = slider.value + '%';
          localStorage.setItem(storageKey, v);
          if (this._audioRef?._bus?.[busKey]) {
            this._audioRef._bus[busKey].gain.setTargetAtTime(baseVol * v, this._audioRef._ctx.currentTime, 0.05);
          }
        });
        box.appendChild(slider);
        return box;
      };

      wrap.appendChild(mkSlider(t('musicVol'), 'audio_music', 0.38, 'ambient'));
      wrap.appendChild(mkSlider(t('sfxVol'),   'audio_sfx',   0.55, 'sfx'));

      const sep = document.createElement('div');
      sep.style.cssText = `width:300px;height:1px;background:${C.dimCream};opacity:0.15;margin-bottom:18px;`;
      wrap.appendChild(sep);

      // ── Qualité graphique ─────────────────────────────────────────────────
      wrap.appendChild(secLabel(t('graphicsQuality')));

      const gfxModes = [
        { value: 0, label: t('gfxHigh'), desc: t('gfxHighDesc') },
        { value: 1, label: t('gfxMed'),  desc: t('gfxMedDesc')  },
        { value: 2, label: t('gfxLow'),  desc: t('gfxLowDesc')  },
      ];
      const curGfx = parseInt(localStorage.getItem('lowGraphics') || '0', 10);
      const gfxDesc = document.createElement('div');
      gfxDesc.style.cssText = `font-size:9px;letter-spacing:1px;color:${C.dimCream};line-height:1.6;
        max-width:320px;text-align:center;margin-top:6px;margin-bottom:18px;min-height:14px;`;
      gfxDesc.textContent = gfxModes.find(m => m.value === curGfx)?.desc ?? '';

      const gfxRow = document.createElement('div');
      gfxRow.style.cssText = 'display:flex;gap:8px;width:300px;margin-bottom:4px;';
      gfxModes.forEach(({ value, label, desc }) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.className = 'choice-btn';
        b.style.setProperty('--cb-color',  C.cream);
        b.style.setProperty('--cb-border', C.dimCream);
        b.style.setProperty('--cb-fill',   C.cream);
        b.style.setProperty('--cb-hover',  `${C.cream}22`);
        b.setAttribute('data-active', value === curGfx ? '1' : '0');
        b.addEventListener('click', () => {
          gfxRow.querySelectorAll('.choice-btn').forEach(btn => btn.setAttribute('data-active', '0'));
          b.setAttribute('data-active', '1');
          gfxDesc.textContent = desc;
          this._gfxRef?.(value);
        });
        gfxRow.appendChild(b);
      });
      wrap.appendChild(gfxRow);
      wrap.appendChild(gfxDesc);

      const sep1b = document.createElement('div');
      sep1b.style.cssText = `width:300px;height:1px;background:${C.dimCream};opacity:0.15;margin-bottom:18px;`;
      wrap.appendChild(sep1b);

      // ── Mode de contrôle ──────────────────────────────────────────────────
      wrap.appendChild(secLabel(t('ctrlMode')));

      const ctrlModes = [
        { value: 'standard',  label: t('ctrlStd'), desc: t('ctrlStdDesc') },
        { value: 'simulator', label: t('ctrlSim'), desc: t('ctrlSimDesc') },
      ];
      const ctrlDesc = document.createElement('div');
      ctrlDesc.style.cssText = `font-size:9px;letter-spacing:1px;color:${C.dimCream};line-height:1.6;
        max-width:320px;text-align:center;margin-top:6px;margin-bottom:18px;min-height:14px;`;
      const curCtrl = localStorage.getItem('ctrlMode') || 'standard';
      ctrlDesc.textContent = ctrlModes.find(m => m.value === curCtrl)?.desc ?? '';

      const ctrlRow = document.createElement('div');
      ctrlRow.style.cssText = 'display:flex;gap:8px;width:280px;margin-bottom:4px;';
      ctrlModes.forEach(({ value, label, desc }) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.className = 'choice-btn';
        b.style.setProperty('--cb-color',  C.cream);
        b.style.setProperty('--cb-border', C.dimCream);
        b.style.setProperty('--cb-fill',   C.cream);
        b.style.setProperty('--cb-hover',  `${C.cream}22`);
        b.setAttribute('data-active', value === curCtrl ? '1' : '0');
        b.addEventListener('click', () => {
          localStorage.setItem('ctrlMode', value);
          ctrlRow.querySelectorAll('.choice-btn').forEach(btn => btn.setAttribute('data-active', '0'));
          b.setAttribute('data-active', '1');
          ctrlDesc.textContent = desc;
        });
        ctrlRow.appendChild(b);
      });
      wrap.appendChild(ctrlRow);
      wrap.appendChild(ctrlDesc);

      // ── Langue ────────────────────────────────────────────────────────────
      const sep2 = document.createElement('div');
      sep2.style.cssText = `width:300px;height:1px;background:${C.dimCream};opacity:0.15;margin-bottom:18px;`;
      wrap.appendChild(sep2);
      wrap.appendChild(secLabel(t('lang')));

      const langRow = document.createElement('div');
      langRow.style.cssText = 'display:flex;gap:8px;width:280px;margin-bottom:18px;';

      [{ code: 'fr', label: t('langFR') }, { code: 'en', label: t('langEN') }].forEach(({ code, label }) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.className = 'choice-btn';
        b.style.setProperty('--cb-color',  C.cream);
        b.style.setProperty('--cb-border', C.dimCream);
        b.style.setProperty('--cb-fill',   C.cream);
        b.style.setProperty('--cb-hover',  `${C.cream}22`);
        b.setAttribute('data-active', getLang() === code ? '1' : '0');
        b.addEventListener('click', () => {
          if (getLang() === code) return;
          setLang(code);
          // Reconstruction du panel pour appliquer la nouvelle langue
          this._pauseSettingsOverlay?.remove();
          this._pauseSettingsOverlay = null;
          this._showPauseSettings();
        });
        langRow.appendChild(b);
      });
      wrap.appendChild(langRow);

      // ── Retour ────────────────────────────────────────────────────────────
      const btnBack = mkSBtn(t('back'), C.dimCream);
      btnBack.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.style.display = 'none';
        requestAnimationFrame(() => this._pauseOverlay?.querySelectorAll('button')?.[0]?.focus());
      });
      wrap.appendChild(btnBack);

      document.body.appendChild(wrap);
      this._pauseSettingsOverlay = wrap;
    }
    this._pauseSettingsOverlay.style.display = 'flex';
    requestAnimationFrame(() =>
      this._pauseSettingsOverlay?.querySelector('button')?.focus()
    );
  }

  // Overlay ESC pour le multijoueur — même présentation que le menu pause solo
  // (le jeu continue derrière : pas de gel, mais réapparition possible)
  showEscMenu(visible, onQuit = null, onRespawn = null, onResume = null) {
    if (onQuit    !== null) this._escQuitCb    = onQuit;
    if (onRespawn !== null) this._escRespawnCb = onRespawn;
    if (onResume  !== null) this._escResumeCb  = onResume;

    if (!this._escOverlay) {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position      : 'fixed', inset: '0',
        display       : 'flex', flexDirection: 'column',
        alignItems    : 'center', justifyContent: 'center',
        background    : C.menuBackdrop,
        fontFamily    : '"Courier New",monospace',
        color         : C.cream,
        pointerEvents : 'none',
        zIndex        : '500',
      });

      const title = document.createElement('div');
      title.textContent = t('pauseTitle');
      title.style.cssText = `font-size:48px;font-weight:bold;letter-spacing:12px;opacity:0.9;margin-bottom:8px;`;

      const note = document.createElement('div');
      note.textContent = t('gameGoesOn');
      note.style.cssText = 'font-size:9px;letter-spacing:3px;color:#7a7050;margin-bottom:18px;';

      const divider = document.createElement('div');
      divider.style.cssText = `width:120px;height:1px;background:${C.dimCream};opacity:0.2;margin-bottom:20px;`;

      // Même style de bouton que le menu pause (mkPBtn)
      const mkPBtn = (label, col, primary = false) => {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
          background   : primary ? `rgba(212,200,138,0.08)` : 'transparent',
          border       : `1px solid ${col}`,
          color        : col,
          fontFamily   : '"Courier New",monospace',
          fontSize     : '12px',
          letterSpacing: '4px',
          padding      : '11px 0',
          width        : '240px',
          textAlign    : 'center',
          cursor       : 'pointer',
          pointerEvents: 'all',
          transition   : 'background 0.15s, color 0.15s',
          outline      : 'none',
          marginBottom : '8px',
          display      : 'block',
        });
        b.addEventListener('mouseover', () => { b.style.background = col; b.style.color = '#0a0a06'; });
        b.addEventListener('mouseout',  () => { b.style.background = primary ? `rgba(212,200,138,0.08)` : 'transparent'; b.style.color = col; });
        return b;
      };

      const btnResume = mkPBtn(t('resume'), C.cream, true);
      btnResume.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._escResumeCb) this._escResumeCb();   // resync Game + re-lock souris
        else this.showEscMenu(false);
      });

      const btnRespawn = mkPBtn(t('respawnBtn'), C.dimCream);
      btnRespawn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._escRespawnCb) this._escRespawnCb();
      });

      const btnSettings = mkPBtn(t('settingsBtn'), C.dimCream);
      btnSettings.addEventListener('click', (e) => { e.stopPropagation(); this._showPauseSettings(); });

      const btnMenu = mkPBtn(t('mainMenu'), C.dimCream);
      btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._escQuitCb) this._escQuitCb();
      });

      wrap.appendChild(title);
      wrap.appendChild(note);
      wrap.appendChild(divider);
      wrap.appendChild(btnResume);
      wrap.appendChild(btnRespawn);
      wrap.appendChild(btnSettings);
      wrap.appendChild(btnMenu);
      document.body.appendChild(wrap);
      this._escOverlay = wrap;
    }
    this._escOverlay.style.display = visible ? 'flex' : 'none';
    if (visible) requestAnimationFrame(() => this._escOverlay?.querySelector('button')?.focus());
  }

  setReticlePosition(x, y) {
    this._reticleX = x;
    this._reticleY = y;
  }

  update(player, enemies = [], camera = null, stats = null, basePos = null, extra = {}) {
    this._drawSpeedDial(player.speed);
    this._drawAltDial(player.altitude);
    const hideMarkers = false;
    this._drawHeadingStrip(player.heading, hideMarkers ? [] : enemies, hideMarkers ? null : player);
    this._drawFuelDial(player.fuel);
    this._drawDamageDial(player.health);
    this._drawAmmo(player.ammo);
    const groundTargets = extra.groundTargets || [];
    const enemyBase     = extra.enemyBase || null;
    const villages      = extra.villages || [];
    const skipSlow      = extra.skipSlow ?? false;
    this._leadSpeed     = extra.leadSpeed || 950;
    if (stats && extra.survivalWave != null) stats.survivalWave = extra.survivalWave;
    const active = enemies.filter(e => !e.isDead && e.mesh);
    if (!skipSlow) {
      if ((active.length || groundTargets.length || enemyBase || villages.length) && camera) {
        this._drawRadar(active, player, groundTargets, enemyBase, villages);
      }
    }
    // Marqueurs redessinés chaque frame pour éviter le sautillement
    if (camera && !player.isDead) {
      if (!hideMarkers) {
        if (active.length || basePos || groundTargets.length || villages.length) {
          this._drawWorldMarkers(active, player, camera, basePos, groundTargets, villages);
        } else if (this._worldCanvas) {
          this._worldCanvas.getContext('2d').clearRect(0, 0, this._worldCanvas.width, this._worldCanvas.height);
        }
      } else if (this._worldCanvas) {
        this._worldCanvas.getContext('2d').clearRect(0, 0, this._worldCanvas.width, this._worldCanvas.height);
      }
    } else if (!camera && this._worldCanvas) {
      this._worldCanvas.getContext('2d').clearRect(0, 0, this._worldCanvas.width, this._worldCanvas.height);
    }
    this._drawHitMarker();
    this._updateEngineStatus(player);
    this._updateAlerts(player, extra.delta ?? 0.016);
    if (stats) this._updateScoreboard(stats);
    if (player.isDead && !this._deadShown && !this._survivalMode) {
      this._deadShown = true;
      this._showDead(this._onRespawn, { rows: this._scoreboardProvider?.() });
    }
  }

  // ── Alertes ressources critiques (carburant / santé) ──────────────────────
  _mkAlertEl(key, color) {
    const d = document.createElement('div');
    d.textContent = t(key);
    Object.assign(d.style, {
      color,
      fontFamily   : '"Courier New",monospace',
      fontSize     : '12px',
      letterSpacing: '4px',
      background   : 'rgba(10,4,4,0.80)',
      border       : `1px solid ${color}`,
      borderRadius : '2px',
      padding      : '5px 20px',
      pointerEvents: 'none',
      display      : 'none',
      opacity      : '0',
      transition   : 'opacity 0.15s',
      whiteSpace   : 'nowrap',
    });
    return d;
  }

  _updateAlerts(player, delta) {
    const LOW_FUEL   = 20;   // % — seuil alerte carburant
    const LOW_HEALTH = 30;   // HP — seuil alerte santé
    const BEEP_INTERVAL_FUEL   = 1.8;
    const BEEP_INTERVAL_HEALTH = 1.2;

    // ── Carburant ──
    const fuelLow = player.fuel < LOW_FUEL && player.engineOn !== false;
    if (fuelLow) {
      this._alertFuelTimer -= delta;
      const blink = Math.sin(Date.now() * 0.006) > 0;
      this._alertFuelEl.style.display = 'block';
      this._alertFuelEl.style.opacity = blink ? '1' : '0';
      if (this._alertFuelTimer <= 0) {
        this._alertFuelTimer = BEEP_INTERVAL_FUEL;
        this._audioRef?.playLowWarning('fuel');
      }
    } else {
      this._alertFuelEl.style.display = 'none';
      this._alertFuelTimer = 0;
    }

    // ── Santé ──
    const healthLow = player.health < LOW_HEALTH && !player.isDead;
    if (healthLow) {
      this._alertHealthTimer -= delta;
      const blink = Math.sin(Date.now() * 0.008) > 0;
      this._alertHealthEl.style.display = 'block';
      this._alertHealthEl.style.opacity = blink ? '1' : '0';
      if (this._alertHealthTimer <= 0) {
        this._alertHealthTimer = BEEP_INTERVAL_HEALTH;
        this._audioRef?.playLowWarning('health');
      }
    } else {
      this._alertHealthEl.style.display = 'none';
      this._alertHealthTimer = 0;
    }
  }

  // ── Construction du HUD ────────────────────────────────────────────────────
  _build() {
    const root = document.createElement('div');
    Object.assign(root.style, {
      position: 'fixed', inset: '0',
      pointerEvents: 'none', userSelect: 'none',
      fontFamily: "'Courier New', Courier, monospace",
    });

    // Mire gérée par Game.js (sprite Three.js au-dessus des balles)

    // Cadrans principaux bas-gauche et bas-droite
    this._speedCanvas = this._mkCanvas(160, 160);
    this._altCanvas   = this._mkCanvas(160, 160);
    this._place(this._speedCanvas, { bottom:'20px', left:'20px' }, root);
    this._place(this._altCanvas,   { bottom:'20px', right:'20px' }, root);

    // Cadrans secondaires (fuel + dommages) centrés au-dessus du ruban de cap
    this._fuelCanvas = this._mkCanvas(110, 110);
    this._dmgCanvas  = this._mkCanvas(110, 110);
    this._place(this._fuelCanvas, { bottom:'100px', left:'calc(50% - 135px)' }, root);
    this._place(this._dmgCanvas,  { bottom:'100px', left:'calc(50% + 25px)' }, root);

    // Ruban de cap (bas-centre)
    this._headCanvas = this._mkCanvas(300, 54);
    this._place(this._headCanvas, {
      bottom:'26px', left:'50%', transform:'translateX(-50%)',
    }, root);

    // Radar (coin inférieur droit, au-dessus du cadran altitude)
    this._radarCanvas = this._mkCanvas(130, 130);
    this._place(this._radarCanvas, { bottom:'200px', right:'20px' }, root);

    // Canvas plein écran pour marqueurs monde + flèches hors-écran
    this._worldCanvas = document.createElement('canvas');
    this._worldCanvas.width  = window.innerWidth;
    this._worldCanvas.height = window.innerHeight;
    Object.assign(this._worldCanvas.style, { position:'absolute', inset:'0' });
    root.insertBefore(this._worldCanvas, root.firstChild);
    window.addEventListener('resize', () => {
      this._worldCanvas.width  = window.innerWidth;
      this._worldCanvas.height = window.innerHeight;
    });

    // Compteur de munitions (haut-droite, ancré à la bordure)
    this._ammoWrap = this._buildAmmoWrap();
    root.appendChild(this._ammoWrap);

    // Aide touches (haut-gauche, ancré à la bordure)
    root.appendChild(this._buildKeys());

    // ── Colonne centre-haut : scoreboard → timer → panneau mission → moteur ──
    // Tous dans un flex-column pour empêcher tout chevauchement.
    this._topCenter = document.createElement('div');
    Object.assign(this._topCenter.style, {
      position      : 'absolute',
      top           : '14px',
      left          : '50%',
      transform     : 'translateX(-50%)',
      display       : 'flex',
      flexDirection : 'column',
      alignItems    : 'center',
      gap           : '4px',
      pointerEvents : 'none',
      zIndex        : '200',
    });
    root.appendChild(this._topCenter);

    // Scoreboard (enfant du conteneur central, pas de position propre)
    this._topCenter.appendChild(this._buildScoreboard());

    // Compteur de vague persistant (survie uniquement)
    this._waveTopEl = document.createElement('div');
    Object.assign(this._waveTopEl.style, {
      fontFamily   : '"Courier New",monospace',
      fontSize     : '14px', letterSpacing: '4px', fontWeight: 'bold',
      color        : '#d4c88a',
      background   : 'rgba(8,8,4,0.78)',
      border       : '1px solid #4a4030', borderRadius: '3px',
      padding      : '4px 18px',
      display      : 'none', pointerEvents: 'none', whiteSpace: 'nowrap',
      boxShadow    : 'inset 0 0 10px rgba(0,0,0,0.7)',
    });
    this._topCenter.appendChild(this._waveTopEl);

    // Timer de match (caché par défaut, s'affiche sous le scoreboard)
    this._timerEl = document.createElement('div');
    Object.assign(this._timerEl.style, {
      fontFamily   : '"Courier New",monospace',
      fontSize     : '16px',
      letterSpacing: '5px',
      fontWeight   : 'bold',
      color        : '#d4c88a',
      background   : 'rgba(6,6,4,0.72)',
      border       : '1px solid #3a3020',
      borderRadius : '2px',
      padding      : '4px 18px 3px',
      pointerEvents: 'none',
      display      : 'none',
      textShadow   : '0 0 8px rgba(212,200,138,0.4)',
      whiteSpace   : 'nowrap',
    });
    this._topCenter.appendChild(this._timerEl);

    // Panneau mission (caché par défaut, s'affiche sous le timer)
    this._missionPanel = this._buildMissionPanel();
    this._topCenter.appendChild(this._missionPanel);

    // Alertes ressources basses — intégrées dans le flux flex pour éviter tout overlap
    this._alertFuelEl   = this._mkAlertEl('alertFuel',   '#ff9900');
    this._alertHealthEl = this._mkAlertEl('alertHealth', '#ff3333');
    this._topCenter.appendChild(this._alertFuelEl);
    this._topCenter.appendChild(this._alertHealthEl);

    // Indicateur moteur coupé / posé (sous le panneau mission)
    this._engineStatus = document.createElement('div');
    Object.assign(this._engineStatus.style, {
      fontFamily   : '"Courier New",monospace',
      fontSize     : '13px',
      letterSpacing: '4px',
      fontWeight   : 'bold',
      padding      : '5px 18px',
      border       : '1.5px solid',
      borderRadius : '2px',
      display      : 'none',
      pointerEvents: 'none',
      whiteSpace   : 'nowrap',
    });
    this._topCenter.appendChild(this._engineStatus);

    // Dessins initiaux
    this._drawSpeedDial(0);
    this._drawAltDial(0);
    this._drawHeadingStrip(0);
    this._drawFuelDial(100);
    this._drawDamageDial(100);
    this._drawAmmo(200);

    return root;
  }

  _mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  _place(el, pos, parent) {
    Object.assign(el.style, { position:'absolute', ...pos });
    parent.appendChild(el);
  }

  // ── Cadran vitesse ─────────────────────────────────────────────────────────
  _drawSpeedDial(speed) {
    const ticks = [];
    for (let v = 0; v <= 120; v += 10) ticks.push({ v, major: v % 20 === 0 });
    this._drawDial(this._speedCanvas, {
      value : speed,
      max   : 120,
      ticks,
      label : t('speedLabel'),
      unit  : 'km/h',
      zones : [
        { from:0,       to:30/120,  color:'#4a1008' },
        { from:30/120,  to:80/120,  color:'#1a3a10' },
        { from:80/120,  to:1,       color:'#5a3a08' },
      ],
    });
  }

  // ── Cadran altitude ────────────────────────────────────────────────────────
  _drawAltDial(alt) {
    const ticks = [];
    for (let v = 0; v <= 1000; v += 100) ticks.push({ v, major: v % 200 === 0 });
    this._drawDial(this._altCanvas, {
      value : alt,
      max   : 1000,
      ticks,
      label : t('altLabel'),
      unit  : 'm',
      zones : [
        { from:0,      to:0.05,  color:'#4a1008' },
        { from:0.05,   to:0.9,   color:'#0e2030' },
        { from:0.9,    to:1,     color:'#302050' },
      ],
    });
  }

  // ── Cadran carburant ───────────────────────────────────────────────────────
  _drawFuelDial(fuel) {
    const c = this._fuelCanvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const cx = W/2, cy = H/2;
    const outerR = W/2-3, faceR = outerR-7, arcR = faceR-10;
    ctx.clearRect(0,0,W,H);

    const sA = Math.PI*0.75, eA = Math.PI*2.25, sw = eA-sA;

    this._bezel(ctx, cx, cy, outerR, faceR);
    this._face(ctx, cx, cy, faceR);

    // zones
    this._arc(ctx, cx, cy, arcR, sA, sA+0.18*sw, C.zoneRed,   8);
    this._arc(ctx, cx, cy, arcR, sA+0.18*sw, eA, C.zoneGreen, 8);

    // repères E 1/4 1/2 3/4 F
    const fl = [{r:0,t:'E'},{r:0.25,t:'¼'},{r:0.5,t:'½'},{r:0.75,t:'¾'},{r:1,t:'F'}];
    for (const {r,t} of fl) {
      const a = sA + r*sw;
      this._tick(ctx, cx, cy, arcR, a, 14, 1.5, t==='E'?'#c84040':C.cream);
      const lr = arcR-24;
      ctx.fillStyle = t==='E' ? '#c84040' : C.cream;
      ctx.font = '8px "Courier New",monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t, cx+Math.cos(a)*lr, cy+Math.sin(a)*lr);
    }
    // petites graduations
    for (let i=1;i<20;i++) {
      if ([0,5,10,15,20].includes(i)) continue;
      const a = sA+(i/20)*sw;
      this._tick(ctx, cx, cy, arcR, a, 6, 0.7, C.tickMinor);
    }

    this._needle(ctx, cx, cy, sA + Math.min(1,fuel/100)*sw, arcR-12, 1.8);
    this._cap(ctx, cx, cy, 5);
    this._iconJerryCan(ctx, cx, cy+24);
  }

  // ── Cadran dommages ────────────────────────────────────────────────────────
  _drawDamageDial(health) {
    const c = this._dmgCanvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const cx = W/2, cy = H/2;
    const outerR = W/2-3, faceR = outerR-7, arcR = faceR-10;
    ctx.clearRect(0,0,W,H);

    const sA = Math.PI*0.75, eA = Math.PI*2.25, sw = eA-sA;

    this._bezel(ctx, cx, cy, outerR, faceR);
    this._face(ctx, cx, cy, faceR);

    // zones OK → CRIT (sA=OK, eA=CRIT)
    this._arc(ctx, cx, cy, arcR, sA,          sA+0.33*sw, C.zoneGreen,  8);
    this._arc(ctx, cx, cy, arcR, sA+0.33*sw,  sA+0.66*sw, C.zoneOrange, 8);
    this._arc(ctx, cx, cy, arcR, sA+0.66*sw,  eA,         C.zoneRed,    8);

    const dl = [{r:0,t:'OK',col:'#5ab430'},{r:0.5,t:'DMG',col:'#c87820'},{r:1,t:'CRIT',col:'#c84040'}];
    for (const {r,t,col} of dl) {
      const a = sA+r*sw;
      this._tick(ctx, cx, cy, arcR, a, 14, 1.5, col);
      const lr = arcR-24;
      ctx.fillStyle = col;
      ctx.font = '7px "Courier New",monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(t, cx+Math.cos(a)*lr, cy+Math.sin(a)*lr);
    }

    // aiguille : 100 HP → sA (OK), 0 HP → eA (CRIT)
    const ratio = 1 - Math.min(1, Math.max(0, health/100));
    this._needle(ctx, cx, cy, sA+ratio*sw, arcR-12, 1.8);
    this._cap(ctx, cx, cy, 5);
    this._iconWrench(ctx, cx, cy+24);
  }

  // ── Ruban de cap ───────────────────────────────────────────────────────────
  _drawHeadingStrip(headDeg, enemies = [], player = null) {
    const canvas = this._headCanvas;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    // fond panneau
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#201e14'); bg.addColorStop(1,'#0e0c08');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(0,0,W,H,4); ctx.fill();
    ctx.strokeStyle='#5a5040'; ctx.lineWidth=1.5; ctx.stroke();

    const PX_PER_DEG = W / 60;   // 60° visibles
    const LABELS = {0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SO',270:'O',315:'NO'};

    // Itérer sur les degrés fixes (multiples de 5) dans la plage visible
    // et calculer leur position en pixels par rapport au cap courant (float).
    const firstDeg = Math.floor((headDeg - 35) / 5) * 5;
    const lastDeg  = Math.ceil ((headDeg + 35) / 5) * 5;
    const y0 = H - 5;

    for (let d = firstDeg; d <= lastDeg; d += 5) {
      const deg    = ((d % 360) + 360) % 360;   // normalisé 0-359
      const x      = W/2 + (d - headDeg) * PX_PER_DEG;
      if (x < -10 || x > W + 10) continue;

      const isCard = deg % 45 === 0;
      const isMed  = deg % 10 === 0;
      const tickH  = isCard ? 20 : isMed ? 13 : 7;

      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 - tickH);
      ctx.strokeStyle = isCard ? C.cream : isMed ? '#6a6040' : '#3a3828';
      ctx.lineWidth   = isCard ? 1.8 : 0.8;
      ctx.stroke();

      if (LABELS[deg]) {
        ctx.fillStyle = C.cream;
        ctx.font = 'bold 11px "Courier New",monospace';
        ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.fillText(LABELS[deg], x, y0 - tickH - 2);
      } else if (isMed) {
        ctx.fillStyle = C.dimCream;
        ctx.font = '8px "Courier New",monospace';
        ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.fillText(deg, x, y0 - tickH - 1);
      }
    }

    // curseur central (triangle vers le bas)
    ctx.beginPath();
    ctx.moveTo(W/2, H-2);
    ctx.lineTo(W/2-7, H-14);
    ctx.lineTo(W/2+7, H-14);
    ctx.closePath();
    ctx.fillStyle = '#e8d090';
    ctx.fill();

    // boîte de lecture du cap
    const boxW=46, boxH=17;
    ctx.fillStyle='#060604';
    ctx.fillRect(W/2-boxW/2, 3, boxW, boxH);
    ctx.strokeStyle='#5a5040'; ctx.lineWidth=1;
    ctx.strokeRect(W/2-boxW/2, 3, boxW, boxH);
    ctx.fillStyle = C.cream;
    ctx.font = 'bold 11px "Courier New",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(Math.round(headDeg).toString().padStart(3,'0')+'°', W/2, 3+boxH/2);

    // ── Marqueurs ennemis sur le compas ─────────────────────────────────────
    if (enemies.length && player) {
      const sorted = [...enemies].sort((a,b) =>
        a.position.distanceTo(player.position) - b.position.distanceTo(player.position)
      );
      for (let i = 0; i < sorted.length; i++) {
        const e = sorted[i];
        const dx = e.position.x - player.position.x;
        const dz = e.position.z - player.position.z;
        const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
        let delta = bearing - headDeg;
        while (delta >  180) delta -= 360;
        while (delta < -180) delta += 360;
        const mx = W/2 + delta * PX_PER_DEG;
        if (mx < 4 || mx > W - 4) continue;

        const isClosest = i === 0;
        const col = isClosest ? '#ff3322' : '#cc3322';
        const dy = e.position.y - player.position.y;
        const altSym = dy > 30 ? '▲' : dy < -30 ? '▼' : '■';

        ctx.save();
        if (!isClosest) ctx.globalAlpha = 0.35;

        // Trait vertical sur le ruban (absent pour non-closest)
        if (isClosest) {
          ctx.beginPath();
          ctx.moveTo(mx, 22); ctx.lineTo(mx, y0 - 4);
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        // Triangle de marqueur en bas du ruban
        const triSz = isClosest ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(mx,        y0 + 2);
        ctx.lineTo(mx - triSz, y0 - triSz * 2);
        ctx.lineTo(mx + triSz, y0 - triSz * 2);
        ctx.closePath();
        ctx.fillStyle = col; ctx.fill();

        // Symbole d'altitude (seulement pour le plus proche)
        if (isClosest) {
          ctx.fillStyle = col;
          ctx.font = '9px "Courier New",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(altSym, mx, 22);
        }

        ctx.restore();
      }
    }
  }

  // ── Radar circulaire ──────────────────────────────────────────────────────
  _drawRadar(enemies, player, groundTargets = [], enemyBase = null, villages = []) {
    const c = this._radarCanvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const cx = W/2, cy = H/2;
    const R = 50;
    const SCALE = R / 1800;
    const hRad0 = player.heading * Math.PI / 180;
    const toRadar = (wx, wz) => {
      const dx = wx - player.position.x, dz = wz - player.position.z;
      return {
        x: cx + (dx * Math.cos(hRad0) + dz * Math.sin(hRad0)) * SCALE,
        y: cy - (dx * Math.sin(hRad0) - dz * Math.cos(hRad0)) * SCALE,
      };
    };

    ctx.clearRect(0,0,W,H);

    // Cadre bezel
    this._bezel(ctx, cx, cy, R+8, R+2);

    // Face sombre
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
    const bg = ctx.createRadialGradient(cx, cy-R*0.3, 0, cx, cy, R);
    bg.addColorStop(0,'#111208'); bg.addColorStop(1,'#060604');
    ctx.fillStyle = bg; ctx.fill();

    // Clip dans le cercle
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();

    // Anneaux de distance
    for (const f of [0.33, 0.67, 1.0]) {
      ctx.beginPath(); ctx.arc(cx, cy, R*f, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(80,70,30,0.35)'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    // Croix
    ctx.beginPath();
    ctx.moveTo(cx-R,cy); ctx.lineTo(cx+R,cy);
    ctx.moveTo(cx,cy-R); ctx.lineTo(cx,cy+R);
    ctx.strokeStyle = 'rgba(80,70,30,0.2)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Ligne avant (cap du joueur = haut)
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-R);
    ctx.strokeStyle = 'rgba(200,180,80,0.25)'; ctx.lineWidth = 1; ctx.stroke();

    // Ennemis
    const hRad = player.heading * Math.PI / 180;
    const sorted = [...enemies].sort((a,b) =>
      a.position.distanceTo(player.position) - b.position.distanceTo(player.position)
    );
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const dx = e.position.x - player.position.x;
      const dz = e.position.z - player.position.z;
      // Rotation vers espace radar (avant joueur = haut écran)
      const rx =  dx * Math.cos(hRad) + dz * Math.sin(hRad);
      const rz =  dx * Math.sin(hRad) - dz * Math.cos(hRad);
      const ex = cx + rx * SCALE;
      const ey = cy - rz * SCALE;
      const isClosest = i === 0;
      const dotR = isClosest ? 4 : 2.5;
      const col  = isClosest ? '#ff5030' : '#c08840';

      ctx.beginPath(); ctx.arc(ex, ey, dotR, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();

      // Indicateur altitude
      const dy = e.position.y - player.position.y;
      if (Math.abs(dy) > 30) {
        ctx.fillStyle = col;
        ctx.font = '8px "Courier New",monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(dy > 0 ? '↑' : '↓', ex + dotR + 2, ey);
      }
    }

    // Villages (petites flèches triangulaires crème)
    for (const v of villages) {
      const p = toRadar(v.x, v.z);
      const inR = Math.hypot(p.x - cx, p.y - cy) < R;
      if (!inR) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(4, 3); ctx.lineTo(0, 1); ctx.lineTo(-4, 3);
      ctx.closePath();
      ctx.fillStyle = 'rgba(212,200,138,0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,200,138,0.85)';
      ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    }

    // Cibles au sol ennemies (petits carrés orange, opacité selon distance)
    for (const g of groundTargets) {
      const p = toRadar(g.pos.x, g.pos.z);
      if (Math.hypot(p.x - cx, p.y - cy) > R) continue;
      const gDist = Math.hypot(g.pos.x - player.position.x, g.pos.z - player.position.z);
      const gAlpha = Math.max(0.15, Math.min(1.0, 1.0 - (gDist - 500) / 1800));
      ctx.globalAlpha = gAlpha;
      ctx.fillStyle = '#ff8c1a';
      ctx.fillRect(p.x - 1.8, p.y - 1.8, 3.6, 3.6);
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();

    // Direction de la base ennemie (losange crème, clampé au bord du radar)
    if (enemyBase) {
      let p = toRadar(enemyBase.x, enemyBase.z);
      const d = Math.hypot(p.x - cx, p.y - cy);
      const clamped = d > R - 3;
      if (clamped) { const s = (R - 3) / d; p = { x: cx + (p.x-cx)*s, y: cy + (p.y-cy)*s }; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.moveTo(0,-4); ctx.lineTo(4,0); ctx.lineTo(0,4); ctx.lineTo(-4,0); ctx.closePath();
      ctx.fillStyle = '#d4c88a'; ctx.fill();
      ctx.restore();
    }

    // Point joueur (par-dessus le clip)
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI*2);
    ctx.fillStyle = C.cream; ctx.fill();

    // Label RADAR
    ctx.fillStyle = C.dimCream;
    ctx.font = '7px "Courier New",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(t('radarLabel'), cx, H - 4);
  }

  // Point d'interception balistique : où viser pour toucher une cible mobile
  _leadPoint(playerPos, enemy, bulletSpeed) {
    const v = enemy.velocity || { x: 0, y: 0, z: 0 };
    // Position prédite à l'instant présent si dispo (joueur distant interpolé),
    // sinon position courante (IA locale) → la mire vise où la cible SERA
    const ep = enemy.aimPosition || enemy.position;
    let t = ep.distanceTo(playerPos) / bulletSpeed;
    for (let k = 0; k < 4; k++) {
      const fx = ep.x + v.x * t, fy = ep.y + v.y * t, fz = ep.z + v.z * t;
      const d = Math.hypot(fx - playerPos.x, fy - playerPos.y, fz - playerPos.z);
      t = d / bulletSpeed;
    }
    const lead = ep.clone();
    lead.x += v.x * t; lead.y += v.y * t; lead.z += v.z * t;
    return lead;
  }

  // ── Marqueurs monde + flèches hors-écran ──────────────────────────────────
  _drawWorldMarkers(enemies, player, camera, basePos = null, groundTargets = [], villages = []) {
    const c = this._worldCanvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0,0,W,H);

    // ── Cibles au sol ennemies (carrés, taille avion) ────────────────────────
    for (const g of groundTargets) {
      const gp = g.pos.clone(); gp.y += 5;
      const ndc = gp.clone().project(camera);
      if (ndc.z >= 1.0) continue;
      const sx = ( ndc.x * 0.5 + 0.5) * W;
      const sy = (-ndc.y * 0.5 + 0.5) * H;
      if (sx < 6 || sx > W-6 || sy < 6 || sy > H-6) continue;

      const gDist = g.pos.distanceTo(player.position);
      const alpha = Math.max(0.08, Math.min(0.9, 1.0 - (gDist - 200) / 1400));

      const s = g.kind === 'mg' ? 11 : 9;
      const col = g.kind === 'mg' ? '#ff8c1a' : '#d2691e';
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.rect(sx - s, sy - s, s*2, s*2);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      if (g.kind === 'mg') {
        ctx.font = '9px "Courier New",monospace';
        ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('AA', sx, sy - s - 2);
      }
      ctx.restore();
    }

    // ── Losange BASE (vert ravitaillement, pulse) ──────────────────────────
    if (basePos) {
      const bp = basePos.clone(); bp.y += 8;
      const ndc = bp.clone().project(camera);
      const sx = ( ndc.x * 0.5 + 0.5) * W;
      const sy = (-ndc.y * 0.5 + 0.5) * H;
      const inFront  = ndc.z < 1.0;
      const onScreen = inFront && sx > 10 && sx < W-10 && sy > 10 && sy < H-10;
      const dist = basePos.distanceTo(player.position);
      const distStr = dist < 1000 ? Math.round(dist) + ' m' : (dist/1000).toFixed(1) + ' km';
      const col = '#44ff88';
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.004);

      if (onScreen) {
        const dh = 13;
        // Halo pulsé
        ctx.save();
        ctx.globalAlpha = pulse * 0.35;
        ctx.beginPath();
        ctx.moveTo(sx, sy - dh*2 - 6); ctx.lineTo(sx + dh + 6, sy - dh);
        ctx.lineTo(sx, sy + 6);        ctx.lineTo(sx - dh - 6, sy - dh);
        ctx.closePath();
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
        // Losange principal
        ctx.beginPath();
        ctx.moveTo(sx, sy - dh*2); ctx.lineTo(sx + dh, sy - dh);
        ctx.lineTo(sx, sy);        ctx.lineTo(sx - dh, sy - dh);
        ctx.closePath();
        ctx.fillStyle = 'rgba(40,200,100,0.22)'; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
        // Texte
        ctx.font = 'bold 11px "Courier New",monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const tw = Math.max(ctx.measureText('✚ BASE').width, ctx.measureText(distStr).width);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(sx - tw/2 - 5, sy - dh*2 - 36, tw + 10, 32);
        ctx.fillStyle = col;
        ctx.fillText('✚ BASE', sx, sy - dh*2 - 19);
        ctx.font = '10px "Courier New",monospace';
        ctx.fillText(distStr, sx, sy - dh*2 - 6);
      } else {
        const angle = inFront
          ? Math.atan2(sy - H/2, sx - W/2)
          : Math.atan2(-(sy - H/2), -(sx - W/2));
        const { ex, ey } = this._clampToEdge(sx, sy, W, H, 28, inFront);
        // Losange pulsé (distinct des flèches avion)
        ctx.save();
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.translate(ex, ey);
        const hs3 = 7;
        ctx.fillStyle = col;
        ctx.fillRect(-hs3, -hs3, hs3*2, hs3*2);
        ctx.fillStyle = col;
        ctx.font = 'bold 10px "Courier New",monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('✚ BASE', 0, -26);
        ctx.font = '9px "Courier New",monospace';
        ctx.fillText(distStr, 0, -14);
        ctx.restore();
      }
    }

    // ── Carrés VILLAGES ENNEMIS (rouge, sans label) ───────────────────────
    const enemyVillages = villages.slice(1);
    for (const v of enemyVillages) {
      // Disparaît si toutes les défenses du village sont éliminées
      const hasDefenses = groundTargets.some(g =>
        !g.isDead && Math.hypot(g.pos.x - v.x, g.pos.z - v.z) < 200
      );
      if (!hasDefenses) continue;

      const vp = new THREE.Vector3(v.x, (v.y ?? 0) + 8, v.z);
      const ndc = vp.clone().project(camera);
      const sx = ( ndc.x * 0.5 + 0.5) * W;
      const sy = (-ndc.y * 0.5 + 0.5) * H;
      const inFront  = ndc.z < 1.0;
      const onScreen = inFront && sx > 10 && sx < W-10 && sy > 10 && sy < H-10;
      // Pâlit quand le joueur est proche
      const vDist = vp.distanceTo(player.position);
      const vAlpha = THREE.MathUtils.clamp((vDist - 80) / 300, 0.08, 1.0);
      const col = '#cc4433';
      const hs = 7;

      if (onScreen) {
        ctx.save();
        ctx.globalAlpha = vAlpha;
        ctx.translate(sx, sy);
        ctx.fillStyle = 'rgba(180,40,20,0.2)';
        ctx.fillRect(-hs, -hs, hs*2, hs*2);
        ctx.strokeStyle = col; ctx.lineWidth = 1.8;
        ctx.strokeRect(-hs, -hs, hs*2, hs*2);
        ctx.restore();
      } else {
        // Carré orienté (distinct des flèches avion)
        const angle = inFront
          ? Math.atan2(sy - H/2, sx - W/2)
          : Math.atan2(-(sy - H/2), -(sx - W/2));
        const { ex, ey } = this._clampToEdge(sx, sy, W, H, 28, inFront);
        const hs2 = 6;
        ctx.save();
        ctx.globalAlpha = vAlpha;
        ctx.translate(ex, ey);
        ctx.strokeStyle = col; ctx.lineWidth = 1.8;
        ctx.strokeRect(-hs2, -hs2, hs2*2, hs2*2);
        ctx.restore();
      }
    }

    const sorted = [...enemies].sort((a,b) =>
      a.position.distanceTo(player.position) - b.position.distanceTo(player.position)
    );

    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const isAlly    = e.isEnemy === false; // RemotePlayer allié
      const isClosest = i === 0 && !isAlly;

      // Position lissée du marqueur : les ennemis lointains ne mettent leur IA à
      // jour qu'1 frame sur 12 → leur position « saute ». On interpole vers la
      // position réelle pour un marqueur fluide (snap si saut énorme = respawn).
      if (!e._mkPos) e._mkPos = e.position.clone();
      else if (e._mkPos.distanceToSquared(e.position) > 90000) e._mkPos.copy(e.position);
      else e._mkPos.lerp(e.position, 0.25);

      // Marqueur centré sur l'avion lui-même : la pointe basse du losange
      // tombe exactement sur le point d'impact → viser le marqueur = toucher.
      const above = e._mkPos.clone();
      const ndc = above.clone().project(camera);
      const sx = ( ndc.x * 0.5 + 0.5) * W;
      const sy = (-ndc.y * 0.5 + 0.5) * H;
      const inFront = ndc.z < 1.0;
      const onScreen = inFront && sx > 10 && sx < W-10 && sy > 10 && sy < H-10;

      const dist = e.position.distanceTo(player.position);
      const distStr = dist < 1000
        ? Math.round(dist) + ' m'
        : (dist/1000).toFixed(1) + ' km';

      ctx.save();

      if (isAlly) {
        // ── Allié : simple chevron vert discret ─────────────────────────────
        ctx.globalAlpha = 0.55;
        const col = '#33cc66';
        if (onScreen) {
          const dh = 5;
          ctx.beginPath();
          ctx.moveTo(sx - dh, sy - dh); ctx.lineTo(sx, sy - dh*2); ctx.lineTo(sx + dh, sy - dh);
          ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
          if (dist < 400) {
            ctx.font = '9px "Courier New",monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillStyle = col;
            ctx.fillText(distStr, sx, sy - dh*2 - 4);
          }
        } else {
          const angle = inFront
            ? Math.atan2(sy - H/2, sx - W/2)
            : Math.atan2(-(sy - H/2), -(sx - W/2));
          const { ex, ey } = this._clampToEdge(sx, sy, W, H, 28, inFront);
          this._drawEdgeArrow(ctx, ex, ey, angle, col, false);
        }
        ctx.restore();
        continue;
      }

      // ── Ennemi : marqueur rouge complet ─────────────────────────────────
      const col = isClosest ? '#ff3322' : '#cc3322';

      if (onScreen) {
        const dh = 7;
        ctx.beginPath();
        ctx.moveTo(sx,      sy - dh*2);
        ctx.lineTo(sx + dh, sy - dh);
        ctx.lineTo(sx,      sy);
        ctx.lineTo(sx - dh, sy - dh);
        ctx.closePath();
        ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        ctx.stroke();

        // Label distance uniquement pour le plus proche
        if (isClosest) {
          ctx.font = '11px "Courier New",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          const tw = ctx.measureText(distStr).width;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(sx - tw/2 - 3, sy - dh*2 - 18, tw + 6, 14);
          ctx.fillStyle = col;
          ctx.fillText(distStr, sx, sy - dh*2 - 6);
        }

        // ── Indicateur de visée : où tirer pour toucher une cible mobile ──
        // Relié au losange par une ligne fine → pas de confusion sur la cible.
        // Pour une cible lente le cercle reste sur l'avion ; il dévie quand elle file.
        if (dist < 1100 && this._leadSpeed) {
          const lead = this._leadPoint(player.position, e, this._leadSpeed);
          const lndc = lead.clone().project(camera);
          if (lndc.z < 1.0) {
            const lx = ( lndc.x * 0.5 + 0.5) * W;
            const ly = (-lndc.y * 0.5 + 0.5) * H;
            const lr = 7;
            ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff4433'; ctx.lineWidth = 2; ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(lx - lr - 3, ly); ctx.lineTo(lx - lr + 2, ly);
            ctx.moveTo(lx + lr - 2, ly); ctx.lineTo(lx + lr + 3, ly);
            ctx.moveTo(lx, ly - lr - 3); ctx.lineTo(lx, ly - lr + 2);
            ctx.moveTo(lx, ly + lr - 2); ctx.lineTo(lx, ly + lr + 3);
            ctx.stroke();
          }
        }

      } else {
        // Flèche sur le bord de l'écran
        const angle = inFront
          ? Math.atan2(sy - H/2, sx - W/2)
          : Math.atan2(-(sy - H/2), -(sx - W/2));
        const { ex, ey } = this._clampToEdge(sx, sy, W, H, 28, inFront);
        this._drawEdgeArrow(ctx, ex, ey, angle, col, isClosest);

        if (isClosest) {
          ctx.save();
          ctx.translate(ex, ey);
          ctx.fillStyle = col;
          ctx.font = '9px "Courier New",monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(distStr, 0, -14);
          ctx.restore();
        }
      }

      ctx.restore();
    }
  }

  _drawHitMarker() {
    const dt = 1 / 60;
    const c   = this._worldCanvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const cx  = this._reticleX;
    const cy  = this._reticleY;

    // ── Vignette rouge quand le joueur est touché ─────────────────────────────
    if (this._playerHitTimer > 0) {
      this._playerHitTimer -= dt;
      const a = Math.min(1, this._playerHitTimer / 0.25) * 0.30;
      const grad = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.72);
      grad.addColorStop(0, 'rgba(180,0,0,0)');
      grad.addColorStop(1, `rgba(200,0,0,${a})`);
      ctx.save(); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    // muzzle flash géré en 3D dans Game.js (sprite dans la scène)
    if (this._muzzleFlashTimer > 0) this._muzzleFlashTimer -= dt;

    // Décompte du timer "terminé" (l'élément DOM est géré dans showRefuelComplete)
    if (this._refuelCompleteTimer > 0) {
      this._refuelCompleteTimer -= dt;
      if (this._refuelCompleteTimer <= 0 && this._refuelEl) {
        this._refuelEl.style.display = 'none';
      }
    }

    // ── Marqueur de hit ennemi (X sur la mire) ────────────────────────────────
    if (this._hitMarkerTimer <= 0) return;
    this._hitMarkerTimer -= dt;
    const alpha = Math.min(1, this._hitMarkerTimer / 0.12);
    const arm = 10, gap = 4;
    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.strokeStyle = '#ff4422';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - gap, cy - gap); ctx.lineTo(cx - gap - arm, cy - gap - arm);
    ctx.moveTo(cx + gap, cy - gap); ctx.lineTo(cx + gap + arm, cy - gap - arm);
    ctx.moveTo(cx - gap, cy + gap); ctx.lineTo(cx - gap - arm, cy + gap + arm);
    ctx.moveTo(cx + gap, cy + gap); ctx.lineTo(cx + gap + arm, cy + gap + arm);
    ctx.stroke();
    ctx.restore();
  }

  _clampToEdge(sx, sy, W, H, margin, inFront) {
    const cx = W/2, cy = H/2;
    let dx = sx - cx, dy = sy - cy;
    if (!inFront) { dx = -dx; dy = -dy; }
    const scaleX = dx !== 0 ? (W/2 - margin) / Math.abs(dx) : Infinity;
    const scaleY = dy !== 0 ? (H/2 - margin) / Math.abs(dy) : Infinity;
    const s = Math.min(scaleX, scaleY);
    return { ex: cx + dx*s, ey: cy + dy*s };
  }

  _drawEdgeArrow(ctx, x, y, angle, color, large = false) {
    const sz = large ? 11 : 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo( sz,  0);
    ctx.lineTo(-sz, -sz*0.6);
    ctx.lineTo(-sz*0.4, 0);
    ctx.lineTo(-sz,  sz*0.6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.82;
    ctx.fill();
    ctx.restore();
  }

  // ── Compteur de munitions ─────────────────────────────────────────────────
  _buildAmmoWrap() {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position:'absolute', top:'20px', right:'20px',
      background:'rgba(8,8,4,0.78)',
      border:'1px solid #4a4030',
      borderRadius:'3px',
      padding:'6px 12px',
      boxShadow:'inset 0 0 10px rgba(0,0,0,0.7)',
    });
    const lbl = document.createElement('div');
    lbl.textContent = t('ammoLabel');
    lbl.style.cssText = 'font-size:8px;letter-spacing:2px;color:#6a6040;margin-bottom:4px;font-family:"Courier New",monospace;';
    this._ammoCanvas = this._mkCanvas(126, 38);
    wrap.appendChild(lbl);
    wrap.appendChild(this._ammoCanvas);
    return wrap;
  }

  _drawAmmo(ammo) {
    const canvas = this._ammoCanvas;
    const ctx    = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    const digits = Math.max(0, Math.round(ammo)).toString().padStart(3,'0');
    const dW = W/3;

    for (let i=0;i<3;i++) {
      const x = i*dW;
      // slot
      const bg = ctx.createLinearGradient(x,0,x,H);
      bg.addColorStop(0,'#1a1a10'); bg.addColorStop(0.5,'#080806'); bg.addColorStop(1,'#1a1a10');
      ctx.fillStyle = bg;
      ctx.fillRect(x+2,0,dW-4,H);
      // bordure slot
      ctx.strokeStyle='#3a3020'; ctx.lineWidth=1;
      ctx.strokeRect(x+2,0,dW-4,H);
      // séparateur mécanique (ligne en haut et bas)
      ctx.fillStyle='#2a2010';
      ctx.fillRect(x+2,0,dW-4,3);
      ctx.fillRect(x+2,H-3,dW-4,3);
      // chiffre
      const col = ammo<20 ? '#d04040' : ammo<50 ? '#c87820' : C.cream;
      ctx.fillStyle = col;
      ctx.font = `bold ${Math.round(H*0.7)}px "Courier New",monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(digits[i], x+dW/2, H/2+1);
      // reflet
      ctx.fillStyle='rgba(255,255,200,0.04)';
      ctx.fillRect(x+2,3,dW-4,(H-6)/2);
    }
  }

  // ── Cadran générique (vitesse / altitude) ─────────────────────────────────
  _drawDial(canvas, cfg) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;
    const outerR = W/2-3, faceR = outerR-8, arcR = faceR-14;
    ctx.clearRect(0,0,W,H);

    const sA = Math.PI*0.75, eA = Math.PI*2.25, sw = eA-sA;

    this._bezel(ctx, cx, cy, outerR, faceR);
    this._face(ctx, cx, cy, faceR);

    // zones colorées
    for (const z of (cfg.zones||[])) {
      this._arc(ctx, cx, cy, arcR, sA+z.from*sw, sA+z.to*sw, z.color, 10);
    }

    // ticks
    for (const {v,major} of cfg.ticks) {
      const ratio = v / cfg.max;
      const angle = sA + ratio*sw;
      const len   = major ? 16 : 9;
      this._tick(ctx, cx, cy, arcR, angle, len, major?1.8:0.8, major?C.tickMajor:C.tickMinor);
      if (major) {
        const lr = arcR - 28;
        ctx.fillStyle = C.cream;
        ctx.font = '10px "Courier New",monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(v, cx+Math.cos(angle)*lr, cy+Math.sin(angle)*lr);
      }
    }

    // aiguille
    const ratio = Math.min(1, Math.max(0, cfg.value/cfg.max));
    this._needle(ctx, cx, cy, sA+ratio*sw, arcR-18, 2.5);

    // centre
    this._cap(ctx, cx, cy, 8);

    // valeur numérique uniquement (pas de label texte)
    ctx.fillStyle = C.cream;
    ctx.font = 'bold 13px "Courier New",monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(Math.round(cfg.value)+' '+cfg.unit, cx, cy+42);
  }

  // ── Primitives graphiques ─────────────────────────────────────────────────
  _bezel(ctx, cx, cy, outerR, innerR) {
    // anneau métal brossé
    ctx.beginPath();
    ctx.arc(cx,cy,outerR,0,Math.PI*2);
    const g = ctx.createLinearGradient(cx-outerR,cy-outerR,cx+outerR,cy+outerR);
    g.addColorStop(0,  C.bezelHi);
    g.addColorStop(0.3,'#3a3428');
    g.addColorStop(0.7,'#282018');
    g.addColorStop(1,  '#5a5040');
    ctx.fillStyle=g; ctx.fill();

    // reflet haut-gauche
    ctx.beginPath();
    ctx.arc(cx,cy,(outerR+innerR)/2, Math.PI*1.05, Math.PI*1.65);
    ctx.strokeStyle='rgba(255,255,200,0.12)';
    ctx.lineWidth=outerR-innerR; ctx.stroke();

    // ombre intérieure
    const sg = ctx.createRadialGradient(cx,cy,innerR*0.9,cx,cy,outerR);
    sg.addColorStop(0,'transparent'); sg.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.beginPath(); ctx.arc(cx,cy,outerR,0,Math.PI*2);
    ctx.arc(cx,cy,innerR,0,Math.PI*2,true);
    ctx.fillStyle=sg; ctx.fill('evenodd');

    // rivets aux 4 coins
    const rR=(outerR+innerR)/2;
    for (let i=0;i<4;i++) {
      const a=i*Math.PI/2+Math.PI/4;
      const rx=cx+Math.cos(a)*rR, ry=cy+Math.sin(a)*rR;
      ctx.beginPath(); ctx.arc(rx,ry,2.5,0,Math.PI*2);
      const rg=ctx.createRadialGradient(rx-0.6,ry-0.6,0,rx,ry,2.5);
      rg.addColorStop(0,C.rivetHi); rg.addColorStop(1,C.rivetLo);
      ctx.fillStyle=rg; ctx.fill();
    }
  }

  _face(ctx, cx, cy, faceR) {
    ctx.beginPath(); ctx.arc(cx,cy,faceR,0,Math.PI*2);
    const fg=ctx.createRadialGradient(cx,cy-faceR*0.25,0,cx,cy,faceR);
    fg.addColorStop(0,'#1c1c12'); fg.addColorStop(1,'#080806');
    ctx.fillStyle=fg; ctx.fill();
  }

  _arc(ctx, cx, cy, r, a1, a2, color, lw) {
    ctx.beginPath(); ctx.arc(cx,cy,r,a1,a2);
    ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.lineCap='butt'; ctx.stroke();
  }

  _tick(ctx, cx, cy, arcR, angle, len, lw, color) {
    const inner=arcR-len, outer=arcR-1;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(angle)*inner, cy+Math.sin(angle)*inner);
    ctx.lineTo(cx+Math.cos(angle)*outer, cy+Math.sin(angle)*outer);
    ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.lineCap='round'; ctx.stroke();
  }

  _needle(ctx, cx, cy, angle, length, width) {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle);
    // contrepoids
    ctx.beginPath(); ctx.moveTo(-width*2,0); ctx.lineTo(-width*7,0);
    ctx.strokeStyle='#3a3020'; ctx.lineWidth=width*2; ctx.lineCap='round'; ctx.stroke();
    // corps aiguille
    ctx.beginPath(); ctx.moveTo(-width*2,0); ctx.lineTo(length,0);
    const ng=ctx.createLinearGradient(0,-width,0,width);
    ng.addColorStop(0,C.needleHi); ng.addColorStop(0.5,'#d4c880'); ng.addColorStop(1,C.needleLo);
    ctx.strokeStyle=ng; ctx.lineWidth=width; ctx.lineCap='round'; ctx.stroke();
    ctx.restore();
  }

  _cap(ctx, cx, cy, r) {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    const g=ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,0,cx,cy,r);
    g.addColorStop(0,'#7a6a40'); g.addColorStop(1,'#2a2010');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='#4a4020'; ctx.lineWidth=0.8; ctx.stroke();
  }

  // ── Icônes cadrans ────────────────────────────────────────────────────────

  // Pompe à essence (gas station pump)
  // Jerrycan (bec diagonal haut-gauche, poignée slot, croix sur corps)
  _iconJerryCan(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx + 1, cy);
    ctx.scale(0.72, 0.72);
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';

    // ── Bec verseur diagonal (haut-gauche, ~50°) ──────────────────────────
    ctx.save();
    ctx.translate(-6, -12);
    ctx.rotate(-Math.PI * 0.42);
    ctx.fillStyle = C.dimCream;
    ctx.beginPath();
    ctx.roundRect(-2.2, -7, 4.4, 8, 1.5);
    ctx.fill();
    ctx.restore();

    // collerette du bec
    ctx.fillStyle = C.dimCream;
    ctx.beginPath();
    ctx.roundRect(-9, -12, 5, 3, 1);
    ctx.fill();

    // ── Corps principal ────────────────────────────────────────────────────
    ctx.fillStyle = C.dimCream;
    ctx.beginPath();
    ctx.moveTo(-8,  -9);
    ctx.lineTo(-8,   9);
    ctx.quadraticCurveTo(-8, 11, -6, 11);
    ctx.lineTo( 6,  11);
    ctx.quadraticCurveTo( 8, 11,  8,  9);
    ctx.lineTo( 8,  -9);
    ctx.quadraticCurveTo( 8,-11,  6,-11);
    ctx.lineTo(-4, -11);
    ctx.quadraticCurveTo(-8,-11, -8, -9);
    ctx.closePath();
    ctx.fill();

    // ── Poignée slot (haut, vers la droite) ───────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(0, -10, 6, 3, 1);
    ctx.fill();

    // ── Cadre intérieur + croix X ─────────────────────────────────────────
    const fx = -5, fy = -4, fw = 10, fh = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.48)';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx,    fy);    ctx.lineTo(fx+fw, fy+fh);
    ctx.moveTo(fx+fw, fy);    ctx.lineTo(fx,    fy+fh);
    ctx.stroke();

    ctx.restore();
  }

  // Clé plate double (double open-end wrench) — deux fourches, manche diagonal
  _iconWrench(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI * 0.25); // 45°
    ctx.fillStyle = C.dimCream;
    ctx.lineJoin  = 'round';

    const BG = '#080806';
    const HW = 2.0;  // demi-largeur du manche
    const HH = 4.5;  // demi-hauteur tête
    const HW2 = 4.2; // demi-largeur tête
    const JW = 2.2;  // demi-largeur encoche (ouverture mâchoire)
    const JD = 4;    // profondeur encoche

    // ── Manche ────────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.roundRect(-HW, -8.5, HW*2, 17, 1);
    ctx.fill();

    // ── Tête haute (fourche ouverte vers le haut) ─────────────────────────
    ctx.beginPath();
    ctx.ellipse(0, -10, HW2, HH, 0, 0, Math.PI*2);
    ctx.fill();
    // encoche (ouverture vers le haut)
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.rect(-JW, -10 - HH, JW*2, JD + 1);
    ctx.fill();
    ctx.fillStyle = C.dimCream;

    // ── Tête basse (fourche ouverte vers le bas) ───────────────────────────
    ctx.beginPath();
    ctx.ellipse(0, 10, HW2, HH, 0, 0, Math.PI*2);
    ctx.fill();
    // encoche (ouverture vers le bas)
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.rect(-JW, 10 + HH - JD, JW*2, JD + 1);
    ctx.fill();

    ctx.restore();
  }

  // ── Scoreboard (haut-centre) — désormais réservé au score d'équipe TDM ─────
  // Le score individuel kills/deaths vit dans le tableau central (TAB / Select).
  _buildScoreboard() {
    const el = document.createElement('div');
    this._topScoreboardEl = el;
    Object.assign(el.style, {
      background : 'rgba(8,8,4,0.78)',
      border     : '1px solid #4a4030',
      borderRadius: '3px',
      padding    : '6px 20px',
      display    : 'none',   // masqué par défaut (affiché seulement en TDM)
      gap        : '28px',
      fontFamily : '"Courier New",monospace',
      boxShadow  : 'inset 0 0 10px rgba(0,0,0,0.7)',
      whiteSpace : 'nowrap',
    });

    const makeCol = (label, id) => {
      const col = document.createElement('div');
      col.style.cssText = 'text-align:center;';
      const lbl = document.createElement('div');
      lbl.textContent = label;
      lbl.style.cssText = 'font-size:8px;letter-spacing:2px;color:#6a6040;margin-bottom:2px;';
      const val = document.createElement('div');
      val.id = id;
      val.textContent = '0';
      val.style.cssText = 'font-size:18px;font-weight:bold;letter-spacing:1px;color:#d4c88a;';
      col.appendChild(lbl);
      col.appendChild(val);
      return { col, lbl };
    };

    // ── Colonnes normales (solo / coop / survie) ───────────────────────────
    this._normalScoreGroup = document.createElement('div');
    this._normalScoreGroup.style.cssText = 'display:flex;gap:28px;align-items:flex-end;';

    this._normalScoreGroup.appendChild(makeCol(t('eliminations'), 'score-kills').col);
    const sep = document.createElement('div');
    sep.textContent = '/';
    sep.style.cssText = 'font-size:18px;color:#4a4030;padding-bottom:2px;';
    this._normalScoreGroup.appendChild(sep);
    const deathsCol = makeCol(t('morts'), 'score-deaths');
    this._scoreDeathsLabel = deathsCol.lbl;
    this._normalScoreGroup.appendChild(deathsCol.col);
    el.appendChild(this._normalScoreGroup);

    // ── Colonnes TDM (cachées par défaut) ─────────────────────────────────
    this._tdmScoreGroup = document.createElement('div');
    this._tdmScoreGroup.style.cssText = 'display:none;gap:0;align-items:center;';

    // Colonne gauche : notre équipe
    this._tdmMyCol = document.createElement('div');
    this._tdmMyCol.style.cssText = 'text-align:center;padding:0 16px 0 4px;';

    this._tdmMyDot = document.createElement('div');  // pastille couleur équipe
    this._tdmMyDot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#2266cc;margin:0 auto 3px;box-shadow:0 0 6px currentColor;';

    this._tdmMyLbl = document.createElement('div');
    this._tdmMyLbl.textContent = t('myTeamLabel');
    this._tdmMyLbl.style.cssText = 'font-size:7px;letter-spacing:2px;color:#6a6040;margin-bottom:2px;white-space:nowrap;';

    this._tdmMyVal = document.createElement('div');
    this._tdmMyVal.id = 'score-tdm-mine';
    this._tdmMyVal.textContent = '0';
    this._tdmMyVal.style.cssText = 'font-size:26px;font-weight:bold;letter-spacing:1px;color:#4499ff;';

    this._tdmMyCol.appendChild(this._tdmMyDot);
    this._tdmMyCol.appendChild(this._tdmMyLbl);
    this._tdmMyCol.appendChild(this._tdmMyVal);

    // Séparateur VS
    const vsSep = document.createElement('div');
    vsSep.textContent = 'VS';
    vsSep.style.cssText = 'font-size:10px;font-weight:bold;letter-spacing:3px;color:#4a4030;padding:0 8px 4px;';

    // Colonne droite : adversaires
    this._tdmOppCol = document.createElement('div');
    this._tdmOppCol.style.cssText = 'text-align:center;padding:0 4px 0 16px;';

    const tdmOppLbl = document.createElement('div');
    tdmOppLbl.textContent = t('oppTeamLabel');
    tdmOppLbl.style.cssText = 'font-size:7px;letter-spacing:2px;color:#6a6040;margin-bottom:2px;margin-top:11px;white-space:nowrap;';

    this._tdmOppVal = document.createElement('div');
    this._tdmOppVal.id = 'score-tdm-opp';
    this._tdmOppVal.textContent = '0';
    this._tdmOppVal.style.cssText = 'font-size:26px;font-weight:bold;letter-spacing:1px;color:#7a6a5a;';

    this._tdmOppCol.appendChild(tdmOppLbl);
    this._tdmOppCol.appendChild(this._tdmOppVal);

    this._tdmScoreGroup.appendChild(this._tdmMyCol);
    this._tdmScoreGroup.appendChild(vsSep);
    this._tdmScoreGroup.appendChild(this._tdmOppCol);
    el.appendChild(this._tdmScoreGroup);

    return el;
  }

  // Active l'affichage TDM : playerTeam = 'team1' | 'team2'
  setTDMMode(enabled, playerTeam = 'team1') {
    // Le bandeau haut n'affiche plus que le score d'équipe TDM (sinon masqué)
    if (this._topScoreboardEl) this._topScoreboardEl.style.display = enabled ? 'flex' : 'none';
    if (this._normalScoreGroup) this._normalScoreGroup.style.display = 'none';
    if (this._tdmScoreGroup)    this._tdmScoreGroup.style.display    = enabled ? 'flex' : 'none';
    if (!enabled) return;

    // Couleur selon l'équipe : team1 = bleu, team2 = rouge
    const col   = playerTeam === 'team2' ? '#ff4444' : '#4499ff';
    const dot   = playerTeam === 'team2' ? '#cc2222' : '#2266cc';
    const glow  = playerTeam === 'team2' ? 'rgba(204,34,34,0.55)' : 'rgba(34,102,204,0.55)';
    const label = playerTeam === 'team2' ? t('team2Label') : t('team1Label');

    if (this._tdmMyDot) {
      this._tdmMyDot.style.background  = dot;
      this._tdmMyDot.style.boxShadow   = `0 0 6px ${glow}`;
    }
    if (this._tdmMyVal)  this._tdmMyVal.style.color = col;
    if (this._tdmMyLbl)  {
      // Sur deux lignes : "NOTRE ÉQUIPE" au-dessus, label "ÉQUIPE 1/2" en micro
      this._tdmMyLbl.innerHTML =
        `<span style="color:${col};font-size:6px;letter-spacing:3px;">${label}</span><br>` +
        `<span>${t('myTeamLabel')}</span>`;
    }
  }

  setTDMScore(mine, opp) {
    const m = document.getElementById('score-tdm-mine');
    const o = document.getElementById('score-tdm-opp');
    if (m) m.textContent = mine;
    if (o) o.textContent = opp;
  }

  _updateScoreboard(stats) {
    // Le score individuel est désormais dans le tableau central (TAB / Select).
    // Ici on ne gère plus que le compteur de vague persistant en survie.
    if (this._survivalMode && this._waveTopEl) {
      this._waveTopEl.textContent = `${t('waveLabel')} ${stats.survivalWave ?? 0}`;
    }
  }

  // ── Tableau des scores central (TAB / Select) ─────────────────────────────
  // rows : [{ name, kills, deaths, isLocal, isDead }]
  // HTML réutilisable (scoreboard en jeu ET écrans de fin de partie)
  _scoreboardHTML(rows) {
    const head =
      `<div style="display:flex;font-size:8px;letter-spacing:1px;color:#6a6040;border-bottom:1px solid #3a3020;padding-bottom:5px;margin-bottom:5px;">` +
      `<span style="flex:1;padding-right:12px;">${t('playerCol')}</span>` +
      `<span style="width:104px;text-align:center;">${t('elimCol')}</span>` +
      `<span style="width:72px;text-align:center;">${t('deathCol')}</span></div>`;
    const sorted = [...rows].sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths));
    const body = sorted.map(r => {
      const col   = r.isLocal ? '#9ef060' : (r.isDead ? '#7a6a5a' : '#d4c88a');
      const op    = r.isDead ? '0.5' : '1';
      const star  = r.isLocal ? '▸ ' : '';
      const name  = (star + (r.name || '?')).slice(0, 16);
      return `<div style="display:flex;align-items:center;font-size:12px;letter-spacing:1px;color:${col};opacity:${op};padding:3px 0;">` +
        `<span style="flex:1;padding-right:12px;white-space:nowrap;overflow:hidden;">${name}</span>` +
        `<span style="width:104px;text-align:center;font-weight:bold;">${r.kills}</span>` +
        `<span style="width:72px;text-align:center;">${r.deaths}</span></div>`;
    }).join('');
    return head + body;
  }

  showScoreboard(visible) {
    this._scoreboardVisible = visible;
    if (!this._scoreboardOverlay) {
      // Plein écran avec fond gris uniforme (cohérent avec pause / crash)
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position: 'fixed', inset: '0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.menuBackdrop,
        fontFamily: '"Courier New",monospace',
        pointerEvents: 'none', zIndex: '450',
      });
      const panel = document.createElement('div');
      panel.style.cssText = `background:rgba(11,12,10,0.92);border:1px solid #4a4030;border-radius:4px;` +
        `box-shadow:0 10px 50px rgba(0,0,0,0.7);padding:18px 26px;min-width:400px;`;
      const title = document.createElement('div');
      title.textContent = t('scoreboardTitle');
      title.style.cssText = 'font-size:12px;letter-spacing:5px;color:#d4c88a;text-align:center;margin-bottom:12px;';
      panel.appendChild(title);
      this._scoreboardRows = document.createElement('div');
      panel.appendChild(this._scoreboardRows);
      wrap.appendChild(panel);
      document.body.appendChild(wrap);
      this._scoreboardOverlay = wrap;
    }
    this._scoreboardOverlay.style.display = visible ? 'flex' : 'none';
  }

  updateScoreboardData(rows) {
    if (!this._scoreboardVisible || !this._scoreboardRows) return;
    this._scoreboardRows.innerHTML = this._scoreboardHTML(rows);
  }

  // ── Aide touches (haut-gauche) ────────────────────────────────────────────
  _updateEngineStatus(player) {
    if (!this._engineStatus) return;
    if (player.isLanded) {
      this._engineStatus.style.display = 'block';
      this._engineStatus.textContent = t('engineLanded');
      this._engineStatus.style.color = '#a0d880';
      this._engineStatus.style.borderColor = '#4a8030';
      this._engineStatus.style.background = 'rgba(0,20,0,0.72)';
    } else if (!player.engineOn) {
      this._engineStatus.style.display = 'block';
      this._engineStatus.textContent = t('engineOff');
      this._engineStatus.style.color = '#f0a040';
      this._engineStatus.style.borderColor = '#904010';
      this._engineStatus.style.background = 'rgba(20,8,0,0.80)';
    } else {
      this._engineStatus.style.display = 'none';
    }
  }

  _buildKeys() {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position:'absolute', top:'20px', left:'20px',
      fontFamily:'"Courier New",monospace',
      pointerEvents:'none',
    });

    // Indication réduite (toujours visible)
    const hint = document.createElement('div');
    hint.textContent = t('helpHint');
    Object.assign(hint.style, {
      fontSize:'9px', letterSpacing:'3px', color:'#d4c88a',
      background:'rgba(8,8,4,0.75)',
      border:'1px solid #5a5030', borderRadius:'2px',
      padding:'4px 10px', display:'block',
    });
    wrap.appendChild(hint);

    // Panel détaillé (caché par défaut)
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background:'rgba(8,8,4,0.82)',
      border:'1px solid #3a3020', borderRadius:'3px',
      padding:'8px 14px', marginTop:'6px',
      fontSize:'11px', lineHeight:'1.9',
      color:'#8a8060',
      boxShadow:'inset 0 0 10px rgba(0,0,0,0.7)',
      display:'none',
    });
    panel.innerHTML = tCtrlLines().map(line => {
      if (line.startsWith('—')) {
        return `<div style="font-size:9px;letter-spacing:2px;color:#6a6040;margin:6px 0 3px;">${line}</div>`;
      }
      if (line.startsWith('F3') || line.startsWith('F4') || line.startsWith('I ')) {
        return `<div style="color:#88aa66;">${line}</div>`;
      }
      return `<div style="color:#d4c88a;">${line}</div>`;
    }).join('');
    wrap.appendChild(panel);

    let open = false;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        open = !open;
        panel.style.display = open ? 'block' : 'none';
        hint.style.display  = open ? 'none'  : 'block';
      }
    });

    return wrap;
  }

  // ── Panneau mission (restants / actifs / tourelles) ─────────────────────────
  _buildMissionPanel() {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      background : 'rgba(8,8,4,0.72)',
      border     : '1px solid #3a3020',
      borderRadius: '3px',
      padding    : '4px 16px',
      display    : 'none',
      fontFamily : '"Courier New",monospace',
      boxShadow  : 'inset 0 0 8px rgba(0,0,0,0.6)',
      whiteSpace : 'nowrap',
    });
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:20px;align-items:center;';
    const cols = [
      { label: t('missionRemaining'), id: 'mission-remaining' },
      { label: t('missionActive'),    id: 'mission-active'    },
      { label: t('missionTurrets'),   id: 'mission-turrets'   },
      { label: t('missionArmor'),     id: 'mission-armor'     },
    ];
    for (const r of cols) {
      const sep = cols.indexOf(r) > 0 ? (() => {
        const d = document.createElement('div');
        d.textContent = '|';
        d.style.cssText = 'font-size:10px;color:#3a3020;';
        return d;
      })() : null;
      if (sep) row.appendChild(sep);
      const col = document.createElement('div');
      col.style.cssText = 'text-align:center;';
      const lbl = document.createElement('div');
      lbl.textContent = r.label;
      lbl.style.cssText = 'font-size:7px;letter-spacing:2px;color:#6a6040;margin-bottom:1px;';
      const val = document.createElement('div');
      val.id = r.id;
      val.textContent = '—';
      val.style.cssText = 'font-size:13px;font-weight:bold;letter-spacing:1px;color:#d4c88a;';
      col.appendChild(lbl); col.appendChild(val);
      row.appendChild(col);
    }
    wrap.appendChild(row);
    return wrap;
  }

  updateMissionHUD(remaining, active, turrets, armor = 0) {
    if (!this._missionPanel) return;
    this._missionPanel.style.display = 'block';
    const r = document.getElementById('mission-remaining');
    const a = document.getElementById('mission-active');
    const t = document.getElementById('mission-turrets');
    const v = document.getElementById('mission-armor');
    if (r) { r.textContent = remaining; r.style.color = remaining === 0 ? '#80e840' : '#d4c88a'; }
    if (a) a.textContent = active;
    if (t) { t.textContent = turrets; t.style.color = turrets === 0 ? '#80e840' : '#d4c88a'; }
    if (v) { v.textContent = armor;   v.style.color = armor   === 0 ? '#80e840' : '#d4c88a'; }
  }

  showVictory(stats, onReplay, onMenu, rows = null) {
    if (this._victoryOverlay) return;
    // Cacher le menu pause s'il est visible
    if (this._pauseOverlay) this._pauseOverlay.style.display = 'none';

    const overlay = document.createElement('div');
    this._victoryOverlay = overlay;
    Object.assign(overlay.style, {
      position:'fixed', inset:'0',
      background: C.menuBackdrop,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'"Courier New",monospace',
      color:C.cream, pointerEvents:'none',
      zIndex:'800',
    });

    // Même carte opaque que l'écran de mort — uniformité visuelle
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(11,10,9,0.95);
      border: 1px solid rgba(122,232,48,0.45);
      border-radius: 6px;
      padding: 38px 64px 34px;
      display: flex; flex-direction: column; align-items: center;
      box-shadow: 0 14px 70px rgba(0,0,0,0.82);
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = t('victoryTitle');
    titleEl.style.cssText = 'font-size:52px;font-weight:bold;letter-spacing:10px;color:#9ef060;text-shadow:0 0 22px rgba(80,200,40,0.55);margin-bottom:10px;';

    const sub = document.createElement('div');
    sub.textContent = t('victoryZone');
    sub.style.cssText = 'font-size:12px;color:#9bbf86;letter-spacing:4px;margin-bottom:22px;';

    const statsEl = document.createElement('div');
    statsEl.style.cssText = 'margin-bottom:26px;text-align:center;';
    statsEl.innerHTML = `
      <div style="font-size:9px;letter-spacing:3px;color:#5a7040;margin-bottom:6px;">${t('missionResults')}</div>
      <div style="font-size:20px;letter-spacing:2px;">
        <span style="color:#7ae830;">✈ ${stats?.kills ?? 0} ${t('eliminations')}</span>
        <span style="color:#3a4030;margin:0 14px;">/</span>
        <span style="color:#c04040;">✖ ${stats?.deaths ?? 0} ${t('morts')}</span>
      </div>`;

    card.appendChild(titleEl);
    card.appendChild(sub);
    card.appendChild(statsEl);
    if (rows && rows.length) card.appendChild(this._mkEndScoreboard(rows));

    if (onReplay) {
      const btnReplay = this._mkEndButton(t('retry'), '#7a9050', '#a8c878');
      btnReplay.addEventListener('click', () => { overlay.remove(); this._victoryOverlay = null; onReplay(); });
      card.appendChild(btnReplay);
    }

    const btnMenu = this._mkEndButton(t('mainMenu'), '#6a5040', '#a88a78');
    btnMenu.style.marginBottom = '0';
    btnMenu.addEventListener('click', () => { if (onMenu) onMenu(); });
    card.appendChild(btnMenu);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // Bouton d'écran de fin — taille uniforme (couleur seule différencie le principal)
  _mkEndButton(label, borderColor, textColor) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      pointerEvents: 'auto',
      background   : 'transparent',
      border       : `1.5px solid ${borderColor}`,
      color        : textColor,
      fontFamily   : '"Courier New",monospace',
      fontSize     : '14px',
      letterSpacing: '3px',
      padding      : '12px 32px',
      cursor       : 'pointer',
      marginBottom : '12px',
      minWidth     : '240px',
      textAlign    : 'center',
      transition   : 'background 0.2s, color 0.2s',
    });
    b.addEventListener('mouseenter', () => { b.style.background = borderColor; b.style.color = '#0a0a06'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; b.style.color = textColor; });
    return b;
  }

  // Mini tableau des scores intégré aux écrans de fin
  _mkEndScoreboard(rows) {
    const box = document.createElement('div');
    box.style.cssText = 'min-width:360px;margin-bottom:24px;border-top:1px solid #3a3020;padding-top:14px;';
    box.innerHTML = this._scoreboardHTML(rows);
    return box;
  }

  _showDead(onRespawn, opts = {}) {
    if (this._deadOverlay) return;
    if (this._pauseOverlay) this._pauseOverlay.style.display = 'none';
    const {
      noRedBg  = false,
      title    = t('crashTitle'),
      subtitle = t('crashSub'),
      onMenu   = this._onMenu || (() => location.reload()),
      onReplay = null,
      rows     = null,
    } = opts;

    const overlay = document.createElement('div');
    this._deadOverlay = overlay;
    Object.assign(overlay.style, {
      position:'fixed', inset:'0',
      background: C.menuBackdrop,   // fond gris uniforme (cohérent avec pause / victoire)
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'"Courier New",monospace',
      color:C.cream, pointerEvents:'none',
      zIndex: '800',
    });

    // Carré opaque et lisible : titre, sous-titre ET boutons à l'intérieur
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(11,10,9,0.95);
      border: 1px solid ${noRedBg ? 'rgba(212,200,138,0.30)' : 'rgba(150,55,55,0.55)'};
      border-radius: 6px;
      padding: 38px 64px 34px;
      display: flex; flex-direction: column; align-items: center;
      box-shadow: 0 14px 70px rgba(0,0,0,0.82);
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = `font-size:52px;font-weight:bold;letter-spacing:10px;color:#eccfa6;${noRedBg ? '' : 'text-shadow:0 0 20px rgba(180,60,50,0.55);'}margin-bottom:10px;`;

    const sub = document.createElement('div');
    sub.textContent = subtitle;
    sub.style.cssText = 'font-size:12px;color:#c2a791;letter-spacing:4px;margin-bottom:26px;';

    card.appendChild(titleEl);
    card.appendChild(sub);
    if (rows && rows.length) card.appendChild(this._mkEndScoreboard(rows));

    const mkDeadBtn = (label, borderColor, textColor) => this._mkEndButton(label, borderColor, textColor);

    if (onRespawn) {
      const btnRespawn = mkDeadBtn(t('respawnBtn'), '#d4c88a', '#d4c88a');
      btnRespawn.addEventListener('click', () => {
        overlay.remove();
        this._deadOverlay = null;
        this._deadShown   = false;
        onRespawn();
      });
      card.appendChild(btnRespawn);
    }

    if (onReplay) {
      const btnReplay = mkDeadBtn(t('retry'), '#7a9050', '#a8c878');
      btnReplay.addEventListener('click', () => {
        overlay.remove();
        this._deadOverlay = null;
        this._deadShown   = false;
        onReplay();
      });
      card.appendChild(btnReplay);
    }

    const btnMenu = mkDeadBtn(t('mainMenu'), '#6a5040', '#a88a78');
    btnMenu.style.marginBottom = '0';
    btnMenu.addEventListener('click', () => {
      overlay.remove();
      this._deadOverlay = null;
      onMenu();
    });
    card.appendChild(btnMenu);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // Écran de fin de partie survie — même mise en page que CRASH mais sans fond rouge
  showSurvivalEnd(onQuit) {
    if (this._pauseOverlay) this._pauseOverlay.style.display = 'none';
    this._showDead(null, {
      noRedBg  : true,
      title    : t('gameOver'),
      subtitle : t('gameDone'),
      onMenu   : onQuit,
      rows     : this._scoreboardProvider?.(),
    });
  }

  setSurvivalMode(v) {
    this._survivalMode = v;
    // Label de vague persistant en haut, exclusif au mode survie
    if (this._waveTopEl) this._waveTopEl.style.display = v ? 'block' : 'none';
  }

  // ── Indicateur de manche — supprimé, intégré dans le scoreboard ──────────
  _updateSurvivalWaveBar(wave) { /* no-op — le scoreboard affiche la manche */ }

  _updateSurvivalWaveBar_OLD(wave) {
    if (!this._survivalWaveBar) {
      this._survivalWaveBar = document.createElement('div');
      Object.assign(this._survivalWaveBar.style, {
        position   : 'fixed', top: '14px', left: '50%',
        transform  : 'translateX(-50%)',
        fontFamily : '"Courier New",monospace',
        fontSize   : '10px',
        letterSpacing: '4px',
        color      : '#d4c88a',
        background : 'rgba(6,8,4,0.55)',
        border     : '1px solid rgba(212,200,138,0.20)',
        padding    : '4px 16px',
        borderRadius: '2px',
        pointerEvents: 'none',
        zIndex     : '500',
        textAlign  : 'center',
      });
      document.body.appendChild(this._survivalWaveBar);
    }
    this._survivalWaveBar.textContent = `MANCHE ${wave}`;
  }

  // ── Bannière vague survie ────────────────────────────────────────────────
  showSurvivalWave(wave, count) {
    if (!this._survivalBanner) {
      this._survivalBanner = document.createElement('div');
      Object.assign(this._survivalBanner.style, {
        position: 'fixed', top: '18%', left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: '"Courier New",monospace',
        textAlign: 'center',
        pointerEvents: 'none', zIndex: '600',
        transition: 'opacity 0.4s',
      });
      const waveTitle = document.createElement('div');
      waveTitle.style.cssText = 'font-size:28px;letter-spacing:8px;color:#d4c88a;text-shadow:0 0 20px rgba(212,200,138,0.8);';
      this._survivalBannerTitle = waveTitle;
      const waveCount = document.createElement('div');
      waveCount.style.cssText = 'font-size:13px;letter-spacing:4px;color:#a09050;margin-top:4px;';
      this._survivalBannerCount = waveCount;
      this._survivalBanner.appendChild(waveTitle);
      this._survivalBanner.appendChild(waveCount);
      document.body.appendChild(this._survivalBanner);
    }
    clearTimeout(this._survivalBannerTimer);
    this._survivalBannerTitle.textContent = `${t('waveLabel')} ${wave}`;
    this._survivalBannerCount.textContent = `${count} ${t('enemies')}`;
    this._survivalBanner.style.opacity = '1';
  }

  updateSurvivalAlive(count) {
    if (!this._survivalBannerCount) return;
    this._survivalBannerCount.textContent = `${count} ${count <= 1 ? t('enemy') : t('enemies')}`;
    if (this._survivalBanner) this._survivalBanner.style.opacity = '1';
  }

  // ── Compte à rebours entre vagues ────────────────────────────────────────
  showSurvivalCountdown(secs) {
    // Masquer le compteur d'ennemis dès que le compte à rebours commence
    if (secs > 0 && this._survivalBanner) {
      clearTimeout(this._survivalBannerTimer);
      this._survivalBanner.style.opacity = '0';
    }
    if (!this._survivalCdEl) {
      this._survivalCdEl = document.createElement('div');
      Object.assign(this._survivalCdEl.style, {
        position: 'fixed', top: '30%', left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: '"Courier New",monospace',
        textAlign: 'center',
        pointerEvents: 'none', zIndex: '600',
      });
      document.body.appendChild(this._survivalCdEl);
    }
    if (secs > 0) {
      this._survivalCdEl.innerHTML =
        `<div style="font-size:14px;letter-spacing:5px;color:#ffffff;margin-bottom:4px;">${t('nextWaveIn')}</div>` +
        `<div style="font-size:52px;font-weight:bold;letter-spacing:4px;color:#d4c88a;">${secs}</div>`;
      this._survivalCdEl.style.display = 'block';
    } else {
      this._survivalCdEl.style.display = 'none';
    }
  }

  // ── Bannière mode spectateur (survie multijoueur) ────────────────────────
  showSpectatorBanner(visible) {
    if (!this._spectatorEl) {
      this._spectatorEl = document.createElement('div');
      Object.assign(this._spectatorEl.style, {
        position    : 'fixed',
        top         : '42%',
        left        : '50%',
        transform   : 'translate(-50%, -50%)',
        fontFamily  : '"Courier New",monospace',
        textAlign   : 'center',
        pointerEvents: 'none',
        zIndex      : '601',
        transition  : 'opacity 0.4s',
      });
      this._spectatorEl.innerHTML =
        `<div style="font-size:22px;letter-spacing:8px;color:#d4c88a;` +
        `text-shadow:0 0 18px rgba(212,200,138,0.55);">${t('spectatorMode')}</div>` +
        `<div style="font-size:11px;letter-spacing:4px;color:#a09050;margin-top:8px;">` +
        `${t('respawnNextWave')}</div>`;
      document.body.appendChild(this._spectatorEl);
    }
    this._spectatorEl.style.opacity = visible ? '1' : '0';
    // Retirer du DOM après la transition de sortie
    if (!visible) {
      clearTimeout(this._spectatorHideTimer);
      this._spectatorHideTimer = setTimeout(() => {
        if (this._spectatorEl) this._spectatorEl.style.display = 'none';
      }, 450);
    } else {
      this._spectatorEl.style.display = 'block';
    }
  }

  // ── Notifications joueurs (arrivée / départ) — pile en haut-centre ─────────
  showPlayerNotice(text, color = '#d4c88a') {
    if (!this._noticeStack) {
      this._noticeStack = document.createElement('div');
      Object.assign(this._noticeStack.style, {
        position: 'fixed', top: '64px', left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        fontFamily: '"Courier New",monospace',
        pointerEvents: 'none', zIndex: '650',
      });
      document.body.appendChild(this._noticeStack);
    }
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      background: 'rgba(8,8,6,0.82)',
      border: `1px solid ${color}`,
      color,
      fontSize: '11px', letterSpacing: '3px',
      padding: '7px 18px', borderRadius: '2px',
      opacity: '0', transition: 'opacity 0.3s',
      whiteSpace: 'nowrap',
    });
    this._noticeStack.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 350);
    }, 4000);
  }

  // ── Écran de fin survie ───────────────────────────────────────────────────
  showSurvivalGameOver(wavesCleared, kills, onQuit, onReplay = null, rows = null) {
    if (this._survivalGameOverShown) return;
    this._survivalGameOverShown = true;
    if (this._pauseOverlay)   this._pauseOverlay.style.display = 'none';
    if (this._survivalBanner)  { this._survivalBanner.style.opacity = '0'; }
    if (this._survivalCdEl)    { this._survivalCdEl.style.display  = 'none'; }

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: C.menuBackdrop,   // fond gris uniforme
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Courier New",monospace',
      color: C.cream, pointerEvents: 'none',
      zIndex: '800',
    });

    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(11,10,9,0.95);
      border: 1px solid rgba(150,55,55,0.55);
      border-radius: 6px;
      padding: 38px 64px 34px;
      display: flex; flex-direction: column; align-items: center;
      box-shadow: 0 14px 70px rgba(0,0,0,0.82);
    `;

    const title = document.createElement('div');
    title.textContent = t('gameOver');
    title.style.cssText = 'font-size:42px;font-weight:bold;letter-spacing:8px;color:#eccfa6;text-shadow:0 0 20px rgba(180,60,50,0.55);margin-bottom:8px;';

    const sub = document.createElement('div');
    sub.textContent = t('crashSub');
    sub.style.cssText = 'font-size:11px;color:#c2a791;letter-spacing:4px;margin-bottom:28px;';

    const scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'margin-bottom:30px;text-align:center;line-height:2.0;';
    scoreEl.innerHTML =
      `<div style="font-size:9px;letter-spacing:4px;color:#8a6a5a;margin-bottom:8px;">${t('survivalResults')}</div>` +
      `<div style="font-size:22px;letter-spacing:2px;color:#d4c88a;">` +
        `${t('wavesCleared')} &nbsp;<span style="color:#e0c060;font-size:32px;">${wavesCleared}</span>` +
      `</div>` +
      `<div style="font-size:16px;letter-spacing:2px;color:#a09050;margin-top:6px;">` +
        `${kills} ${t('eliminations')}` +
      `</div>`;

    const mkBtn = (label, bc, tc) => this._mkEndButton(label, bc, tc);

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(scoreEl);
    if (rows && rows.length) card.appendChild(this._mkEndScoreboard(rows));

    if (onReplay) {
      const btnRetry = mkBtn(t('retry'), '#7a9050', '#a8c878');
      btnRetry.addEventListener('click', () => { overlay.remove(); onReplay(); });
      card.appendChild(btnRetry);
    }

    const btnMenu = mkBtn(t('mainMenu'), '#8a6040', '#d4a870');
    btnMenu.style.marginBottom = '0';
    btnMenu.addEventListener('click', () => { overlay.remove(); if (onQuit) onQuit(); });
    card.appendChild(btnMenu);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }
}

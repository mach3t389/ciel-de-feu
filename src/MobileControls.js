// Contrôles tactiles pour mobile — joystick virtuel + boutons d'action
// Injecte les entrées directement dans le Player (touchTurn/touchPitch + keys)

import { t } from './i18n.js';

export const IS_MOBILE =
  ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
  !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const C = '#d4c88a';   // crème WW2
const R = 'rgba(212,200,138,';

export class MobileControls {
  constructor(container, player, callbacks = {}) {
    this._player    = player;
    this._callbacks = callbacks;  // { onPause }
    this._joyId     = null;
    this._baseX     = 0;
    this._baseY     = 0;
    this._radius    = 62;

    // Gyroscope
    this._gyroMode        = localStorage.getItem('mobileCtrlMode') === 'gyro';
    this._gyroSensitivity = parseFloat(localStorage.getItem('mobileGyroSens') || '1.0');
    this._calibBeta       = 0;
    this._calibGamma      = 0;
    this._smoothTurn      = 0;
    this._smoothPitch     = 0;
    this._gyroHandler     = null;

    this._overlay = null;
    this._build(container);
    this._bind();
    if (this._gyroMode) this._startGyro();
  }

  // ── Construction du DOM ────────────────────────────────────────────────────
  _build(container) {
    const ov = this._el('div', `
      position:fixed;
      top: env(safe-area-inset-top, 0px);
      left: env(safe-area-inset-left, 0px);
      right: env(safe-area-inset-right, 0px);
      bottom: env(safe-area-inset-bottom, 0px);
      pointer-events:none;
      z-index:500;
      user-select:none; -webkit-user-select:none;
      touch-action:none;
    `);

    // ── Zone gauche : joystick ─────────────────────────────────────────────
    const leftZone = this._el('div', `
      position:absolute; left:0; bottom:0;
      width:48%; height:60%;
      pointer-events:auto;
    `);

    this._joyBase = this._el('div', `
      position:absolute;
      width:130px; height:130px;
      border-radius:50%;
      border:2px solid ${R}0.35);
      background:rgba(0,0,0,0.22);
      box-shadow:0 0 18px rgba(0,0,0,0.4);
      transform:translate(-50%,-50%);
      display:none; pointer-events:none;
    `);

    this._joyKnob = this._el('div', `
      position:absolute;
      width:54px; height:54px;
      border-radius:50%;
      background:${R}0.45);
      border:2px solid ${R}0.85);
      box-shadow:0 2px 10px rgba(0,0,0,0.5);
      transform:translate(-50%,-50%);
      display:none; pointer-events:none;
    `);

    leftZone.appendChild(this._joyBase);
    leftZone.appendChild(this._joyKnob);
    this._leftZone = leftZone;

    // ── Boutons droite ─────────────────────────────────────────────────────
    const btnStyle = (extra) => `
      position:absolute;
      border-radius:50%;
      border:2px solid ${R}0.7);
      background:rgba(10,8,4,0.45);
      color:${C};
      font-family:'Courier New',monospace;
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto; touch-action:none;
      user-select:none; -webkit-user-select:none;
      -webkit-tap-highlight-color:transparent;
      ${extra}
    `;

    // Tir — grand bouton bas droite
    this._fireBtn = this._el('div',
      btnStyle(`right:22px; bottom:56px; width:82px; height:82px;
        border-color:rgba(200,60,30,0.8);
        background:rgba(160,30,10,0.38);
        font-size:28px;`),
      '🔥');

    // Gaz — bouton haut allongé
    this._thrBtn = this._el('div', `
      position:absolute; right:120px; bottom:36px;
      width:58px; height:114px;
      border-radius:29px;
      border:2px solid ${R}0.65);
      background:rgba(10,8,4,0.45);
      color:${C};
      font-family:'Courier New',monospace;
      font-size:9px; letter-spacing:1px;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center; gap:5px;
      pointer-events:auto; touch-action:none;
      user-select:none; -webkit-user-select:none;
      -webkit-tap-highlight-color:transparent;
    `, '');
    this._thrBtn.innerHTML =
      `<span style="font-size:20px">▲</span><span style="font-size:8px;letter-spacing:2px">${t('mobileThrLbl')}</span>`;

    // Missile — bouton moyen
    this._missBtn = this._el('div',
      btnStyle(`right:120px; bottom:168px; width:56px; height:56px; font-size:20px;`),
      '🚀');

    // Leurre — bouton petit
    this._decoyBtn = this._el('div',
      btnStyle(`right:22px; bottom:152px; width:48px; height:48px; font-size:16px;`),
      '✦');

    // Pause — coin haut-droit
    this._pauseBtn = this._el('div', `
      position:absolute; top:12px; right:12px;
      width:46px; height:46px;
      border-radius:8px;
      border:1px solid ${R}0.45);
      background:rgba(10,8,4,0.5);
      color:${C};
      font-family:'Courier New',monospace;
      font-size:13px;
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto; touch-action:none;
      -webkit-tap-highlight-color:transparent;
    `, '❚❚');

    ov.appendChild(leftZone);
    ov.appendChild(this._fireBtn);
    ov.appendChild(this._thrBtn);
    ov.appendChild(this._missBtn);
    ov.appendChild(this._decoyBtn);
    ov.appendChild(this._pauseBtn);
    container.appendChild(ov);
    this._overlay = ov;
  }

  _el(tag, style, text = '') {
    const d = document.createElement(tag);
    d.style.cssText = style;
    if (text) d.textContent = text;
    return d;
  }

  // ── Événements tactiles ────────────────────────────────────────────────────
  _bind() {
    const p = this._player;

    // -- Joystick ----------------------------------------------------------------
    this._leftZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._joyId !== null) return;
      const t = e.changedTouches[0];
      this._joyId = t.identifier;
      const r = this._leftZone.getBoundingClientRect();
      this._baseX = t.clientX - r.left;
      this._baseY = t.clientY - r.top;
      this._joyBase.style.left    = this._baseX + 'px';
      this._joyBase.style.top     = this._baseY + 'px';
      this._joyBase.style.display = 'block';
      this._joyKnob.style.left    = this._baseX + 'px';
      this._joyKnob.style.top     = this._baseY + 'px';
      this._joyKnob.style.display = 'block';
    }, { passive: false });

    this._leftZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joyId) continue;
        const r    = this._leftZone.getBoundingClientRect();
        const dx   = (t.clientX - r.left) - this._baseX;
        const dy   = (t.clientY - r.top)  - this._baseY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, this._radius);
        const angle   = Math.atan2(dy, dx);
        const cx = Math.cos(angle) * clamped;
        const cy = Math.sin(angle) * clamped;
        p._touchTurn  = cx / this._radius;
        p._touchPitch = cy / this._radius;
        this._joyKnob.style.left = (this._baseX + cx) + 'px';
        this._joyKnob.style.top  = (this._baseY + cy) + 'px';
      }
    }, { passive: false });

    const joyEnd = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joyId) continue;
        this._joyId = null;
        p._touchTurn  = 0;
        p._touchPitch = 0;
        this._joyBase.style.display = 'none';
        this._joyKnob.style.display = 'none';
      }
    };
    this._leftZone.addEventListener('touchend',    joyEnd, { passive: false });
    this._leftZone.addEventListener('touchcancel', joyEnd, { passive: false });

    // -- Tir -------------------------------------------------------------------
    this._onTouch(this._fireBtn,
      () => { p._mouseFireDown = true; p._mouseFireLatch = true; p.keys.space = true;
               this._fireBtn.style.background = 'rgba(200,50,10,0.6)'; },
      () => { p._mouseFireDown = false; p.keys.space = false;
               this._fireBtn.style.background = 'rgba(160,30,10,0.38)'; });

    // -- Gaz -------------------------------------------------------------------
    this._onTouch(this._thrBtn,
      () => { p.keys.shift = true;  this._thrBtn.style.background = 'rgba(30,80,10,0.55)'; },
      () => { p.keys.shift = false; this._thrBtn.style.background = 'rgba(10,8,4,0.45)'; });

    // -- Missile ---------------------------------------------------------------
    this._missBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      p.onFireMissile?.();
      this._missBtn.style.opacity = '0.6';
      setTimeout(() => { this._missBtn.style.opacity = '1'; }, 180);
    }, { passive: false });

    // -- Leurre ----------------------------------------------------------------
    this._decoyBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      p.onDeployDecoy?.();
      this._decoyBtn.style.opacity = '0.6';
      setTimeout(() => { this._decoyBtn.style.opacity = '1'; }, 180);
    }, { passive: false });

    // -- Pause -----------------------------------------------------------------
    this._pauseBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._callbacks.onPause?.();
    }, { passive: false });

    // -- Orientation / resize : reset le joystick pour éviter désync --------
    this._onOrient = () => this.reset();
    window.addEventListener('orientationchange', this._onOrient);
    window.addEventListener('resize', this._onOrient);
  }

  // ── Gyroscope ──────────────────────────────────────────────────────────────

  get gyroMode()        { return this._gyroMode; }
  get gyroSensitivity() { return this._gyroSensitivity; }

  async setMode(mode) {
    if (mode === 'gyro') {
      const ok = await this._requestGyroPermission();
      if (!ok) return false;
      this._gyroMode = true;
      this._startGyro();
      // Masquer le joystick visuel
      this._leftZone.style.display = 'none';
    } else {
      this._gyroMode = false;
      this._stopGyro();
      this._leftZone.style.display = '';
    }
    localStorage.setItem('mobileCtrlMode', mode);
    return true;
  }

  async _requestGyroPermission() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        return res === 'granted';
      } catch (_) { return false; }
    }
    return true; // Android — pas besoin de permission
  }

  calibrate() {
    // La prochaine mesure gyro devient le zéro
    this._pendingCalib = true;
  }

  setSensitivity(v) {
    this._gyroSensitivity = Math.max(0.3, Math.min(3.0, v));
    localStorage.setItem('mobileGyroSens', String(this._gyroSensitivity));
  }

  _startGyro() {
    if (this._gyroHandler) return;
    this._leftZone.style.display = 'none';
    this._pendingCalib = true;
    this._gyroHandler = (e) => {
      const beta  = e.beta  ?? 0;   // inclinaison avant/arrière −180..180
      const gamma = e.gamma ?? 0;   // inclinaison gauche/droite −90..90

      if (this._pendingCalib) {
        this._calibBeta  = beta;
        this._calibGamma = gamma;
        this._pendingCalib = false;
      }

      let dGamma = gamma - this._calibGamma;
      let dBeta  = beta  - this._calibBeta;

      // Clamp à ±45° puis normalise vers −1..1
      const rawTurn  =  Math.max(-1, Math.min(1, dGamma / 45)) * this._gyroSensitivity;
      const rawPitch =  Math.max(-1, Math.min(1, dBeta  / 35)) * this._gyroSensitivity;

      // Lissage exponentiel (α = 0.25) pour atténuer les tremblements
      const α = 0.25;
      this._smoothTurn  = α * rawTurn  + (1 - α) * this._smoothTurn;
      this._smoothPitch = α * rawPitch + (1 - α) * this._smoothPitch;

      this._player._touchTurn  = Math.max(-1, Math.min(1, this._smoothTurn));
      this._player._touchPitch = Math.max(-1, Math.min(1, this._smoothPitch));
    };
    window.addEventListener('deviceorientation', this._gyroHandler, true);
  }

  _stopGyro() {
    if (!this._gyroHandler) return;
    window.removeEventListener('deviceorientation', this._gyroHandler, true);
    this._gyroHandler = null;
    this._player._touchTurn  = 0;
    this._player._touchPitch = 0;
    this._smoothTurn  = 0;
    this._smoothPitch = 0;
    this._leftZone.style.display = '';
  }

  // Helper : touchstart/end/cancel pour un bouton
  _onTouch(btn, onDown, onUp) {
    btn.addEventListener('touchstart',  (e) => { e.preventDefault(); onDown(); }, { passive: false });
    btn.addEventListener('touchend',    (e) => { e.preventDefault(); onUp();   }, { passive: false });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); onUp();   }, { passive: false });
  }

  setVisible(v) {
    if (this._overlay) this._overlay.style.display = v ? '' : 'none';
  }

  // Réinitialise les entrées (ex : quand le jeu est mis en pause)
  reset() {
    const p = this._player;
    this._joyId = null;
    p._touchTurn  = 0;
    p._touchPitch = 0;
    p._mouseFireDown = false;
    p.keys.space = false;
    p.keys.shift = false;
    this._joyBase.style.display = 'none';
    this._joyKnob.style.display = 'none';
    this._fireBtn.style.background  = 'rgba(160,30,10,0.38)';
    this._thrBtn.style.background   = 'rgba(10,8,4,0.45)';
    // Gyro : réinitialise le lissage mais garde le gyro actif
    this._smoothTurn  = 0;
    this._smoothPitch = 0;
  }

  destroy() {
    this._stopGyro();
    window.removeEventListener('orientationchange', this._onOrient);
    window.removeEventListener('resize', this._onOrient);
    this.reset();
    this._overlay?.remove();
    this._overlay = null;
  }
}

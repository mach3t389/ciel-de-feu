// Curseur militaire animé : réticule + anneau avec lag
// Utilisé uniquement dans le menu principal

export class CursorFX {
  constructor() {
    this._canvas  = null;
    this._ctx     = null;
    this._animId  = null;
    this._mx = window.innerWidth  / 2;
    this._my = window.innerHeight / 2;
    this._rx = this._mx;  // position anneau (avec lag)
    this._ry = this._my;
    this._ringSize     = 14;
    this._ringTarget   = 14;
    this._ringRotation = 0;
    this._hovered      = false;
    this._alpha        = 0;  // fondu d'entrée
  }

  start() {
    // Masquer le curseur système
    document.body.style.cursor = 'none';

    this._canvas = document.createElement('canvas');
    Object.assign(this._canvas.style, {
      position     : 'fixed',
      inset        : '0',
      width        : '100%',
      height       : '100%',
      pointerEvents: 'none',
      zIndex       : '9999',
    });
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
    this._ctx = this._canvas.getContext('2d');
    document.body.appendChild(this._canvas);

    // Suivi souris exact
    this._onMove = (e) => { this._mx = e.clientX; this._my = e.clientY; };
    window.addEventListener('mousemove', this._onMove);

    // Détection hover sur éléments interactifs
    this._onOver = (e) => { if (e.target.closest('button,a,input')) this._setHover(true);  };
    this._onOut  = (e) => { if (e.target.closest('button,a,input')) this._setHover(false); };
    window.addEventListener('mouseover', this._onOver);
    window.addEventListener('mouseout',  this._onOut);

    // Resize
    this._onResize = () => {
      this._canvas.width  = window.innerWidth;
      this._canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', this._onResize);

    this._loop();
  }

  stop() {
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
    if (this._canvas) { this._canvas.remove(); this._canvas = null; }
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseover', this._onOver);
    window.removeEventListener('mouseout',  this._onOut);
    window.removeEventListener('resize',    this._onResize);
  }

  _setHover(on) {
    this._hovered    = on;
    this._ringTarget = on ? 26 : 14;
  }

  _loop() {
    this._animId = requestAnimationFrame(() => this._loop());
    if (!this._ctx) return;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    // Fondu d'entrée
    this._alpha = Math.min(1, this._alpha + 0.04);

    // Lerp anneau vers la souris
    this._rx += (this._mx - this._rx) * 0.11;
    this._ry += (this._my - this._ry) * 0.11;
    this._ringSize += (this._ringTarget - this._ringSize) * 0.16;

    // Rotation lente de l'anneau
    this._ringRotation += this._hovered ? 0.025 : 0.008;

    const a  = this._alpha;
    const cx = this._rx,  cy = this._ry;
    const r  = this._ringSize;
    const dotX = this._mx, dotY = this._my;

    ctx.save();
    ctx.globalAlpha = a;

    // ── Anneau extérieur avec 4 gaps (style viseur) ──────────────────────────
    const gap  = 0.32; // demi-angle du gap en radians
    const segs = 4;
    const segAngle = (Math.PI * 2) / segs;
    const baseRot = this._ringRotation;

    ctx.lineWidth   = 1.4;
    ctx.strokeStyle = this._hovered ? '#ff9944' : '#e8eeff';
    ctx.shadowColor = this._hovered ? '#ff7700' : '#e8eeff';
    ctx.shadowBlur  = this._hovered ? 10 : 5;

    for (let i = 0; i < segs; i++) {
      const start = baseRot + i * segAngle + gap;
      const end   = baseRot + (i + 1) * segAngle - gap;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.stroke();
    }

    // ── Ticks extérieurs aux 4 axes (N/S/E/O) ────────────────────────────────
    ctx.lineWidth   = 1.2;
    ctx.strokeStyle = this._hovered ? '#ff9944' : '#e8eeff';
    ctx.shadowBlur  = 3;
    const tickGap = 5, tickLen = this._hovered ? 9 : 6;
    for (let i = 0; i < 4; i++) {
      const angle = baseRot * 0.3 + i * (Math.PI / 2); // rotation très lente des ticks
      const ix1 = cx + Math.cos(angle) * (r + tickGap);
      const iy1 = cy + Math.sin(angle) * (r + tickGap);
      const ix2 = cx + Math.cos(angle) * (r + tickGap + tickLen);
      const iy2 = cy + Math.sin(angle) * (r + tickGap + tickLen);
      ctx.beginPath();
      ctx.moveTo(ix1, iy1);
      ctx.lineTo(ix2, iy2);
      ctx.stroke();
    }

    // ── Dot central (position exacte de la souris) ───────────────────────────
    ctx.shadowBlur  = 8;
    ctx.shadowColor = this._hovered ? '#ff7700' : '#e8eeff';
    ctx.fillStyle   = this._hovered ? '#ff9944' : '#e8eeff';
    ctx.beginPath();
    ctx.arc(dotX, dotY, this._hovered ? 2.5 : 2, 0, Math.PI * 2);
    ctx.fill();

    // Micro-croix centrale
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = this._hovered ? 'rgba(255,153,68,0.5)' : 'rgba(212,200,138,0.45)';
    ctx.lineWidth   = 0.8;
    const cl = 5;
    ctx.beginPath();
    ctx.moveTo(dotX - cl, dotY); ctx.lineTo(dotX + cl, dotY);
    ctx.moveTo(dotX, dotY - cl); ctx.lineTo(dotX, dotY + cl);
    ctx.stroke();

    ctx.restore();
  }
}

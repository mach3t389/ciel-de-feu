import { t } from './i18n.js';

const CREAM   = '#d4c88a';
const DIM      = '#7a7050';
const PANEL    = '#1a180f';
const BORDER   = '#3a3020';

let _activeOverlay = null;

export const isBugReportOpen = () => _activeOverlay !== null;
export const closeBugReport  = () => { if (_activeOverlay) { _activeOverlay.remove(); _activeOverlay = null; } };

export function showBugReport(contextFn = null) {
  if (_activeOverlay) { _activeOverlay.remove(); _activeOverlay = null; return; }

  const wrap = document.createElement('div');
  _activeOverlay = wrap;
  Object.assign(wrap.style, {
    position: 'fixed', inset: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.88)',
    fontFamily: 'Rajdhani, sans-serif',
    color: CREAM, zIndex: '99999',
    pointerEvents: 'auto', cursor: 'auto',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    background: PANEL, border: `1px solid ${BORDER}`,
    borderRadius: '6px', width: 'min(440px,92vw)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  });

  // ── Header ──
  const hdr = document.createElement('div');
  Object.assign(hdr.style, {
    background: '#0c0b08', borderBottom: `1px solid ${BORDER}`,
    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px',
  });
  const hr = () => { const d = document.createElement('div'); Object.assign(d.style, { flex: '1', height: '1px', background: BORDER }); return d; };
  const star = document.createElement('span'); star.textContent = '✦'; star.style.cssText = 'color:#cc3300;font-size:10px;flex-shrink:0;';
  const ttl = document.createElement('div'); ttl.textContent = t('bugReportTitle');
  ttl.style.cssText = `font-size:15px;font-weight:800;letter-spacing:5px;color:${CREAM};white-space:nowrap;`;
  const star2 = star.cloneNode(true);
  hdr.appendChild(hr()); hdr.appendChild(star); hdr.appendChild(ttl); hdr.appendChild(star2); hdr.appendChild(hr());
  box.appendChild(hdr);

  // ── Corps ──
  const body = document.createElement('div');
  body.style.cssText = 'padding:20px;display:flex;flex-direction:column;gap:10px;';

  const mkLabel = (text) => {
    const l = document.createElement('div');
    l.textContent = text;
    l.style.cssText = `font-size:10px;letter-spacing:2px;color:${DIM};text-transform:uppercase;margin-bottom:2px;`;
    return l;
  };

  const mkTextarea = (placeholder, rows) => {
    const ta = document.createElement('textarea');
    ta.placeholder = placeholder;
    ta.rows = rows;
    Object.assign(ta.style, {
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`,
      borderRadius: '3px', color: CREAM,
      fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', lineHeight: '1.5',
      padding: '8px 10px', resize: 'vertical', width: '100%', boxSizing: 'border-box',
    });
    ta.addEventListener('focus', () => { ta.style.borderColor = CREAM; });
    ta.addEventListener('blur',  () => { ta.style.borderColor = BORDER; });
    return ta;
  };

  body.appendChild(mkLabel(t('bugDesc')));
  const taDesc = mkTextarea(t('bugDescPh'), 4);
  body.appendChild(taDesc);

  body.appendChild(mkLabel(t('bugSteps')));
  const taSteps = mkTextarea(t('bugStepsPh'), 3);
  body.appendChild(taSteps);

  const errEl = document.createElement('div');
  errEl.style.cssText = `font-size:11px;color:#cc4444;letter-spacing:1px;min-height:16px;`;
  body.appendChild(errEl);

  // ── Boutons ──
  const btnRow = document.createElement('div');
  btnRow.style.cssText = `display:flex;gap:8px;justify-content:flex-end;`;

  const mkBtn = (label, primary) => {
    const b = document.createElement('button');
    b.textContent = label;
    const col = primary ? CREAM : DIM;
    Object.assign(b.style, {
      background    : primary ? 'rgba(212,200,138,0.10)' : 'transparent',
      border        : `1px solid ${primary ? CREAM : BORDER}`,
      borderRadius  : '4px', color: col,
      fontFamily    : 'Rajdhani, sans-serif', fontSize: '12px',
      fontWeight    : '700', letterSpacing: '2px', textTransform: 'uppercase',
      padding       : '9px 20px', cursor: 'pointer',
      transition    : 'background 0.12s, color 0.12s',
    });
    const on  = () => { b.style.background = col; b.style.color = '#0a0a06'; };
    const off = () => { b.style.background = primary ? 'rgba(212,200,138,0.10)' : 'transparent'; b.style.color = col; };
    b.addEventListener('mouseover', on); b.addEventListener('mouseout', off);
    b.addEventListener('touchstart', on, { passive: true }); b.addEventListener('touchend', off, { passive: true });
    return b;
  };

  const close = () => { wrap.remove(); _activeOverlay = null; };

  const btnCancel = mkBtn(t('back'), false);
  btnCancel.addEventListener('click', (e) => { e.stopPropagation(); close(); });

  const btnSend = mkBtn(t('bugSend'), true);
  btnSend.addEventListener('click', async (e) => {
    e.stopPropagation();
    const desc = taDesc.value.trim();
    if (!desc) { errEl.textContent = t('bugRequired'); return; }
    errEl.textContent = '';
    btnSend.textContent = t('bugSending');
    btnSend.disabled = true;

    const ctx = contextFn?.() ?? {};
    const _dpr  = window.devicePixelRatio || 1;
    const _phys = `${Math.round(window.screen.width * _dpr)}×${Math.round(window.screen.height * _dpr)}`;
    const _vp   = `${window.innerWidth}×${window.innerHeight}`;

    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          steps: taSteps.value.trim(),
          mode: ctx.mode ? String(ctx.mode) : '',
          map: ctx.map !== undefined ? (t(`mapName_${ctx.map}`) || String(ctx.map)) : '',
          wave: ctx.wave !== undefined ? String(ctx.wave) : '',
          screen: `${_phys} (DPR ${_dpr}) · viewport ${_vp}`,
          userAgent: navigator.userAgent,
        }),
      });
      if (res.ok) {
        btnSend.textContent = t('bugSent');
        btnSend.style.color = '#88cc44';
        setTimeout(close, 2000);
      } else { throw new Error(res.status); }
    } catch (_) {
      btnSend.textContent = t('bugError');
      btnSend.style.color = '#cc4444';
      btnSend.disabled = false;
    }
  });

  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnSend);
  body.appendChild(btnRow);
  box.appendChild(body);
  wrap.appendChild(box);
  document.body.appendChild(wrap);
  setTimeout(() => taDesc.focus(), 50);
}

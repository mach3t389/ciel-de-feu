import { t } from './i18n.js';

export class LoadingScreen {
  constructor(mapName) {
    if (!mapName) mapName = t('loading');
    const root = document.createElement('div');
    Object.assign(root.style, {
      position  : 'fixed', inset: '0',
      background: 'rgba(4,6,3,0.97)',
      display   : 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Courier New", Courier, monospace',
      color     : '#d4c88a',
      zIndex    : '2000',
      transition: 'opacity 0.4s ease',
    });

    const scanlines = document.createElement('div');
    Object.assign(scanlines.style, {
      position      : 'absolute', inset: '0', pointerEvents: 'none',
      background    : 'repeating-linear-gradient(0deg,rgba(0,0,0,0.08) 0px,rgba(0,0,0,0.08) 1px,transparent 1px,transparent 3px)',
    });
    root.appendChild(scanlines);

    const icon = document.createElement('div');
    icon.textContent = '✈';
    Object.assign(icon.style, {
      fontSize: '26px', opacity: '0.55', marginBottom: '24px',
      transform: 'scaleX(-1)',
    });
    root.appendChild(icon);

    const name = document.createElement('div');
    name.textContent = mapName;
    Object.assign(name.style, {
      fontSize: '17px', letterSpacing: '8px', fontWeight: 'bold',
      marginBottom: '6px', opacity: '0.9', textTransform: 'uppercase',
    });
    root.appendChild(name);

    const sub = document.createElement('div');
    sub.textContent = t('loading');
    Object.assign(sub.style, {
      fontSize: '9px', letterSpacing: '4px', color: '#5a5438',
      marginBottom: '36px',
    });
    root.appendChild(sub);

    const barWrap = document.createElement('div');
    Object.assign(barWrap.style, {
      width: '300px', height: '3px',
      background: '#12100a', border: '1px solid #2a2418',
    });

    const bar = document.createElement('div');
    Object.assign(bar.style, {
      height: '100%', width: '0%',
      background: '#d4c88a',
      transition: 'width 0.35s ease',
    });
    barWrap.appendChild(bar);
    root.appendChild(barWrap);

    const pct = document.createElement('div');
    pct.textContent = '0 %';
    Object.assign(pct.style, {
      fontSize: '10px', letterSpacing: '3px', color: '#5a5438',
      marginTop: '12px',
    });
    root.appendChild(pct);

    this._root = root;
    this._bar  = bar;
    this._pct  = pct;
    document.body.appendChild(root);
  }

  setProgress(p) {
    p = Math.max(0, Math.min(100, Math.round(p)));
    this._bar.style.width = p + '%';
    this._pct.textContent = p + ' %';
  }

  hide() {
    this._root.style.opacity = '0';
    setTimeout(() => this._root.remove(), 420);
  }
}

// ── AudioManager — sons via fichiers WAV + synthèse pour effets ponctuels ─────

export class AudioManager {
  constructor() {
    this._ctx          = null;
    this._master       = null;
    this._bus          = {};
    this._engine       = null;   // nodes moteur joueur
    this._enemies      = new Map();
    this._groundRoll   = null;
    this._menuMusic    = { node: null, gain: null };
    this._gunshotCd    = 0;
    this._buffers      = {};     // cache des AudioBuffers décodés
    this._loadPromises = {};     // évite les chargements en double
  }

  static BASE_MUSIC  = 0.55;
  static BASE_SFX    = 0.55;
  static BASE_ENGINE = 0.32;
  static BASE_ENEMY  = 0.70;

  // ── Init ──────────────────────────────────────────────────────────────────
  init() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this._ctx.state === 'suspended') this._ctx.resume();

    this._master = this._ctx.createGain();
    this._master.gain.value = 0.88;
    this._master.connect(this._ctx.destination);

    const mkBus = (vol) => {
      const g = this._ctx.createGain();
      g.gain.value = vol;
      g.connect(this._master);
      return g;
    };
    const sv = AudioManager.getSFXVolume();
    this._bus.engine  = mkBus(AudioManager.BASE_ENGINE * sv);
    this._bus.sfx     = mkBus(AudioManager.BASE_SFX    * sv);
    this._bus.enemy   = mkBus(AudioManager.BASE_ENEMY  * sv);
    this._bus.ambient = mkBus(AudioManager.BASE_MUSIC   * AudioManager.getMusicVolume());

    // Suspendre l'audio quand l'onglet est en arrière-plan
    this._visibilityHandler = () => {
      if (!this._ctx) return;
      if (document.hidden) {
        this._ctx.suspend().catch(() => {});
      } else {
        this._ctx.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    // Pré-charger les samples critiques en arrière-plan
    this._preload('/sfx/Moteur_avion.wav',        'engine');
    this._preload('/sfx/Musique_Menu.wav',         'menuMusic');
    this._preload('/sfx/Balles_manquantes.wav',    'noAmmo');
    for (let i = 1; i <= 5; i++) {
      this._preload(`/sfx/Dommage_avion_${i}.wav`, `hit${i}`);
    }
  }

  get ready() { return !!this._ctx; }

  // ── Persistance volumes ───────────────────────────────────────────────────
  static getMusicVolume() { return parseFloat(localStorage.getItem('audio_music') ?? '1'); }
  static getSFXVolume()   { return parseFloat(localStorage.getItem('audio_sfx')   ?? '1'); }

  setMusicVolume(v) {
    v = Math.max(0, Math.min(1, v));
    localStorage.setItem('audio_music', v);
    if (this._bus.ambient) this._bus.ambient.gain.setTargetAtTime(AudioManager.BASE_MUSIC * v, this._ctx.currentTime, 0.05);
  }

  setSFXVolume(v) {
    v = Math.max(0, Math.min(1, v));
    localStorage.setItem('audio_sfx', v);
    const t = this._ctx?.currentTime ?? 0;
    if (this._bus.sfx)    this._bus.sfx.gain.setTargetAtTime(AudioManager.BASE_SFX    * v, t, 0.05);
    if (this._bus.engine) this._bus.engine.gain.setTargetAtTime(AudioManager.BASE_ENGINE * v, t, 0.05);
    if (this._bus.enemy)  this._bus.enemy.gain.setTargetAtTime(AudioManager.BASE_ENEMY  * v, t, 0.05);
  }

  // ── Chargement de fichiers audio ──────────────────────────────────────────
  async _preload(url, key) {
    if (this._buffers[key]) return;
    if (this._loadPromises[key]) return this._loadPromises[key];
    this._loadPromises[key] = fetch(url)
      .then(r => r.arrayBuffer())
      .then(ab => this._ctx.decodeAudioData(ab))
      .then(buf => { this._buffers[key] = buf; })
      .catch(() => {}); // fichier manquant → silence, pas d'erreur fatale
    return this._loadPromises[key];
  }

  // Joue un buffer ponctuel (one-shot) sur un bus donné
  _playBuf(key, bus, { rate = 1, vol = 1, when = 0 } = {}) {
    const buf = this._buffers[key];
    if (!buf || !this._ctx) return null;
    const src = this._ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this._ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(bus);
    src.start(when || this._ctx.currentTime);
    return src;
  }

  // ── MOTEUR JOUEUR ─────────────────────────────────────────────────────────
  startEngine() {
    if (!this._ctx || this._engine) return;

    if (this._buffers.engine) {
      this._startEngineFromBuffer();
    } else {
      // Buffer pas encore chargé → attendre puis démarrer
      this._preload('/sfx/Moteur_avion.wav', 'engine').then(() => {
        if (!this._engine) this._startEngineFromBuffer();
      });
    }
  }

  _startEngineFromBuffer() {
    if (!this._ctx || !this._buffers.engine) return;
    const ctx = this._ctx;

    const src = ctx.createBufferSource();
    src.buffer = this._buffers.engine;
    src.loop   = true;
    src.playbackRate.value = 0.72; // ralenti = moteur au ralenti

    // Léger filtre passe-bas pour adoucir les harmoniques hautes
    const lpf = ctx.createBiquadFilter();
    lpf.type  = 'lowpass';
    lpf.frequency.value = 3200;
    lpf.Q.value = 0.6;

    const envGain = ctx.createGain();
    envGain.gain.value = 0.3;

    src.connect(lpf);
    lpf.connect(envGain);
    envGain.connect(this._bus.engine);
    src.start();

    this._engine = { src, lpf, envGain };
  }

  // Appelé chaque frame — speed en km/h
  updateEngine(speed, maxSpeed, engineOn) {
    if (!this._engine) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;
    const n   = Math.min(1, speed / maxSpeed); // 0 = arrêt, 1 = plein gaz

    // Vitesse de lecture : 0.72 (ralenti) → 1.30 (plein régime)
    const rate = engineOn ? (0.72 + n * 0.58) : 0.60;
    this._engine.src.playbackRate.setTargetAtTime(rate, t, 0.25);

    // Volume : silencieux moteur coupé, plein au régime max
    const vol = engineOn ? (0.30 + n * 0.70) : 0.05;
    this._engine.envGain.gain.setTargetAtTime(vol, t, 0.30);

    // Filtre s'ouvre légèrement avec le régime — plafonné pour éviter le sifflement
    if (this._engine.lpf) {
      this._engine.lpf.frequency.setTargetAtTime(1800 + n * 900, t, 0.20);
    }
  }

  stopEngine() {
    if (!this._engine) return;
    const t = this._ctx.currentTime;
    this._engine.envGain.gain.linearRampToValueAtTime(0, t + 1.5);
    const e = this._engine;
    this._engine = null;
    setTimeout(() => { try { e.src.stop(); } catch(ex) {} }, 1700);
  }

  pauseEngine(muted) {
    if (!this._bus.engine) return;
    const t  = this._ctx?.currentTime ?? 0;
    const sv = AudioManager.getSFXVolume();
    this._bus.engine.gain.linearRampToValueAtTime(muted ? 0 : AudioManager.BASE_ENGINE * sv, t + 0.02);
    this._bus.enemy.gain.linearRampToValueAtTime(muted ? 0 : AudioManager.BASE_ENEMY  * sv, t + 0.02);
  }

  // ── MOTEURS ENNEMIS (spatialisés, variantes de pitch) ────────────────────
  updateEnemyEngine(enemy, pos, speed, maxSpeed, listenerPos) {
    if (!this._ctx || !this._buffers.engine) return;
    const ctx = this._ctx;

    if (!this._enemies.has(enemy)) {
      const src = ctx.createBufferSource();
      src.buffer = this._buffers.engine;
      src.loop   = true;
      // Variation de pitch par ennemi — toujours plus aigu que le joueur
      const pitchVar = 1.30 + Math.random() * 0.25; // 1.30 – 1.55
      src.playbackRate.value = pitchVar * 0.90;

      const lpf = ctx.createBiquadFilter();
      lpf.type  = 'lowpass';
      lpf.frequency.value = 2800;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      const panner = ctx.createPanner();
      panner.panningModel  = 'HRTF';
      panner.distanceModel = 'exponential';
      panner.refDistance   = 150;
      panner.maxDistance   = 3000;
      panner.rolloffFactor = 2.2;

      src.connect(lpf);
      lpf.connect(gain);
      gain.connect(panner);
      panner.connect(this._bus.enemy);
      src.start();

      this._enemies.set(enemy, { src, lpf, gain, panner, pitchVar });
    }

    const e = this._enemies.get(enemy);
    const t = ctx.currentTime;
    const n = Math.min(1, speed / maxSpeed);

    // Vitesse de lecture selon régime + variation individuelle
    e.src.playbackRate.setTargetAtTime(e.pitchVar * (0.90 + n * 0.50), t, 0.25);
    e.lpf.frequency.setTargetAtTime(2200 + n * 2800, t, 0.20);
    e.gain.gain.setTargetAtTime(0.4 + n * 0.6, t, 0.30);

    // Spatialisation 3D
    const set3 = (node, x, y, z) => {
      if (node.positionX) {
        node.positionX.setTargetAtTime(x, t, 0.05);
        node.positionY.setTargetAtTime(y, t, 0.05);
        node.positionZ.setTargetAtTime(z, t, 0.05);
      } else {
        node.setPosition(x, y, z);
      }
    };
    set3(e.panner, pos.x, pos.y, pos.z);

    const L = ctx.listener;
    if (L.positionX) {
      L.positionX.setTargetAtTime(listenerPos.x, t, 0.05);
      L.positionY.setTargetAtTime(listenerPos.y, t, 0.05);
      L.positionZ.setTargetAtTime(listenerPos.z, t, 0.05);
    } else {
      L.setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
    }
  }

  removeEnemyEngine(enemy) {
    const e = this._enemies.get(enemy);
    if (!e) return;
    const t = this._ctx.currentTime;
    e.gain.gain.linearRampToValueAtTime(0, t + 0.4);
    const src = e.src;
    setTimeout(() => { try { src.stop(); } catch(ex) {} }, 500);
    this._enemies.delete(enemy);
  }

  // ── TIR JOUEUR (synthèse) ─────────────────────────────────────────────────
  playGunshot() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;

    const len  = Math.floor(ctx.sampleRate * 0.10);
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.055));
    }

    // Couche grave — punch lourd
    const srcLo  = ctx.createBufferSource(); srcLo.buffer = buf;
    const bpLo   = ctx.createBiquadFilter();
    bpLo.type    = 'bandpass';
    bpLo.frequency.value = 120;
    bpLo.Q.value = 1.8;
    const eLo = ctx.createGain();
    eLo.gain.setValueAtTime(3.2, t);
    eLo.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    srcLo.connect(bpLo); bpLo.connect(eLo); eLo.connect(this._bus.sfx);

    // Couche sub — corps ultra-grave
    const srcSub  = ctx.createBufferSource(); srcSub.buffer = buf;
    const lpSub   = ctx.createBiquadFilter();
    lpSub.type    = 'lowpass';
    lpSub.frequency.value = 55;
    const eSub = ctx.createGain();
    eSub.gain.setValueAtTime(2.0, t);
    eSub.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    srcSub.connect(lpSub); lpSub.connect(eSub); eSub.connect(this._bus.sfx);

    // Couche métallique — résonance claquante courte (ping de balle)
    const srcMet  = ctx.createBufferSource(); srcMet.buffer = buf;
    const bpMet   = ctx.createBiquadFilter();
    bpMet.type    = 'bandpass';
    bpMet.frequency.value = 3200;
    bpMet.Q.value = 14;
    const eMet = ctx.createGain();
    eMet.gain.setValueAtTime(0.9, t);
    eMet.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
    srcMet.connect(bpMet); bpMet.connect(eMet); eMet.connect(this._bus.sfx);

    srcLo.start(t); srcSub.start(t); srcMet.start(t);
  }

  // ── TIR ENNEMI (synthèse) ─────────────────────────────────────────────────
  playEnemyGunshot() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;

    const len  = Math.floor(ctx.sampleRate * 0.09);
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.045));
    }

    // Couche grave atténuée
    const srcLo = ctx.createBufferSource(); srcLo.buffer = buf;
    const bpLo  = ctx.createBiquadFilter();
    bpLo.type   = 'bandpass'; bpLo.frequency.value = 100; bpLo.Q.value = 1.5;
    const eLo = ctx.createGain();
    eLo.gain.setValueAtTime(1.0, t);
    eLo.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    srcLo.connect(bpLo); bpLo.connect(eLo); eLo.connect(this._bus.sfx);

    // Ping métallique plus doux
    const srcMet = ctx.createBufferSource(); srcMet.buffer = buf;
    const bpMet  = ctx.createBiquadFilter();
    bpMet.type   = 'bandpass'; bpMet.frequency.value = 2600; bpMet.Q.value = 10;
    const eMet = ctx.createGain();
    eMet.gain.setValueAtTime(0.30, t);
    eMet.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    srcMet.connect(bpMet); bpMet.connect(eMet); eMet.connect(this._bus.sfx);

    srcLo.start(t); srcMet.start(t);
  }

  // ── IMPACT SUR CIBLE (synthèse) ───────────────────────────────────────────
  playImpact(type = 'plane') {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;

    if (type === 'plane') {
      const dur = 0.13;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
      }
      const src  = ctx.createBufferSource(); src.buffer = buf;
      const src2 = ctx.createBufferSource(); src2.buffer = buf;
      const bpLo = ctx.createBiquadFilter(); bpLo.type = 'bandpass'; bpLo.frequency.value = 220; bpLo.Q.value = 3.5;
      const bpHi = ctx.createBiquadFilter(); bpHi.type = 'bandpass'; bpHi.frequency.value = 2800; bpHi.Q.value = 5.0;
      const eLo = ctx.createGain(); eLo.gain.setValueAtTime(0.30, t); eLo.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
      const eHi = ctx.createGain(); eHi.gain.setValueAtTime(0.14, t); eHi.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      src.connect(bpLo);  bpLo.connect(eLo);  eLo.connect(this._bus.sfx);
      src2.connect(bpHi); bpHi.connect(eHi);  eHi.connect(this._bus.sfx);
      src.start(t); src2.start(t);
    } else {
      const dur = type === 'ground' ? 0.22 : 0.18;
      const fc  = type === 'ground' ? 85   : 140;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * dur * 0.38));
      }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = 2.0;
      const env = ctx.createGain(); env.gain.setValueAtTime(1.0, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp); bp.connect(env); env.connect(this._bus.sfx);
      src.start(t);
    }
  }

  // ── DÉGÂTS REÇUS : sample aléatoire parmi les 5 variants ────────────────
  playPlayerHit() {
    if (!this._ctx) return;

    // Choisir un sample aléatoire parmi ceux disponibles
    const available = [];
    for (let i = 1; i <= 5; i++) {
      if (this._buffers[`hit${i}`]) available.push(`hit${i}`);
    }

    if (available.length > 0) {
      const key = available[Math.floor(Math.random() * available.length)];
      this._playBuf(key, this._bus.sfx, { vol: 0.35 });
    } else {
      // Fallback synthèse si les samples ne sont pas encore chargés
      this.playImpact('plane');
      const ctx = this._ctx;
      const t   = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type  = 'square';
      osc.frequency.setValueAtTime(760, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.15);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.14, t);
      env.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.connect(env); env.connect(this._bus.sfx);
      osc.start(t); osc.stop(t + 0.16);
    }
  }

  // ── EXPLOSION ─────────────────────────────────────────────────────────────
  playExplosion(size = 1) {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;

    const mkNoise = (dur) => {
      const len  = Math.floor(ctx.sampleRate * dur);
      const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    };

    // ── Couche 1 : BOOM sub-grave — le choc d'air
    const bufBoom = mkNoise(0.7);
    const srcBoom = ctx.createBufferSource(); srcBoom.buffer = bufBoom;
    const lpBoom  = ctx.createBiquadFilter(); lpBoom.type = 'lowpass'; lpBoom.frequency.value = 120; lpBoom.Q.value = 0.6;
    const eBoom   = ctx.createGain();
    eBoom.gain.setValueAtTime(0, t);
    eBoom.gain.linearRampToValueAtTime(2.0 * size, t + 0.025); // attaque adoucie
    eBoom.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    srcBoom.connect(lpBoom); lpBoom.connect(eBoom); eBoom.connect(this._bus.sfx);

    // ── Couche 2 : MID chaleureux — la déflagration (moins agressif)
    const bufCrk = mkNoise(0.5);
    const srcCrk = ctx.createBufferSource(); srcCrk.buffer = bufCrk;
    const bpCrk  = ctx.createBiquadFilter(); bpCrk.type = 'bandpass'; bpCrk.frequency.value = 520; bpCrk.Q.value = 0.5;
    const eCrk   = ctx.createGain();
    eCrk.gain.setValueAtTime(0, t);
    eCrk.gain.linearRampToValueAtTime(1.1 * size, t + 0.018); // attaque progressive
    eCrk.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    srcCrk.connect(bpCrk); bpCrk.connect(eCrk); eCrk.connect(this._bus.sfx);

    // ── Couche 3 : DEBRIS métalliques — tôle arrachée (résonance atténuée)
    const bufDeb = mkNoise(1.0);
    const srcDeb = ctx.createBufferSource(); srcDeb.buffer = bufDeb;
    const bpDeb  = ctx.createBiquadFilter(); bpDeb.type = 'bandpass'; bpDeb.frequency.value = 1800; bpDeb.Q.value = 1.8;
    const eDeb   = ctx.createGain();
    eDeb.gain.setValueAtTime(0, t + 0.03);
    eDeb.gain.linearRampToValueAtTime(0.32 * size, t + 0.06);
    eDeb.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    srcDeb.connect(bpDeb); bpDeb.connect(eDeb); eDeb.connect(this._bus.sfx);

    // ── Couche 4 : WHOOSH — souffle de l'explosion qui s'étend
    const bufWh = mkNoise(1.0);
    const srcWh = ctx.createBufferSource(); srcWh.buffer = bufWh;
    const lpWh  = ctx.createBiquadFilter(); lpWh.type = 'lowpass';
    lpWh.frequency.setValueAtTime(250, t);
    lpWh.frequency.linearRampToValueAtTime(1800, t + 0.15);
    lpWh.frequency.exponentialRampToValueAtTime(80, t + 0.85);
    const eWh = ctx.createGain();
    eWh.gain.setValueAtTime(0, t);
    eWh.gain.linearRampToValueAtTime(1.2 * size, t + 0.12);
    eWh.gain.exponentialRampToValueAtTime(0.001, t + 0.90);
    srcWh.connect(lpWh); lpWh.connect(eWh); eWh.connect(this._bus.sfx);

    srcBoom.start(t); srcCrk.start(t); srcDeb.start(t + 0.02); srcWh.start(t);
  }

  // ── RAVITAILLEMENT ────────────────────────────────────────────────────────
  playRefuelTick() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = 680;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.10, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(env); env.connect(this._bus.sfx);
    osc.start(t); osc.stop(t + 0.07);
  }

  // ── ROULEMENT AU SOL ──────────────────────────────────────────────────────
  updateGroundRoll(speed, maxSpeed) {
    if (!this._ctx) return;
    if (!this._groundRoll) this._initGroundRoll();
    const norm = Math.min(1, speed / maxSpeed);
    const t    = this._ctx.currentTime;
    this._groundRoll.gain.gain.setTargetAtTime(norm * 0.32, t, 0.10);
    this._groundRoll.filter.frequency.setTargetAtTime(55 + norm * 190, t, 0.10);
  }

  _initGroundRoll() {
    const ctx  = this._ctx;
    const len  = ctx.sampleRate * 2;
    const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src    = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 70; filter.Q.value = 1.8;
    const gain   = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(this._bus.sfx);
    src.start();
    this._groundRoll = { src, filter, gain };
  }

  stopGroundRoll() {
    if (!this._groundRoll) return;
    this._groundRoll.gain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + 0.25);
  }

  // ── MUSIQUE DU MENU — fichier Musique_Menu.wav en boucle ─────────────────
  startMenuMusic() {
    if (!this._ctx || this._menuMusic.node) return;

    const _start = () => {
      if (!this._buffers.menuMusic || !this._ctx || this._menuMusic.node) return;
      const src = this._ctx.createBufferSource();
      src.buffer = this._buffers.menuMusic;
      src.loop   = true;

      const fadeGain = this._ctx.createGain();
      fadeGain.gain.setValueAtTime(0, this._ctx.currentTime);
      fadeGain.gain.linearRampToValueAtTime(1.0, this._ctx.currentTime + 2.5);

      src.connect(fadeGain);
      fadeGain.connect(this._bus.ambient);
      src.start();

      this._menuMusic = { node: src, gain: fadeGain };
    };

    if (this._buffers.menuMusic) {
      _start();
    } else {
      this._preload('/sfx/Musique_Menu.wav', 'menuMusic').then(_start);
    }
  }

  stopMenuMusic() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    if (this._menuMusic.gain) {
      this._menuMusic.gain.gain.cancelScheduledValues(t);
      this._menuMusic.gain.gain.linearRampToValueAtTime(0, t + 0.8);
    }
    const node = this._menuMusic.node;
    if (node) setTimeout(() => { try { node.stop(); } catch(e) {} }, 900);
    this._menuMusic = { node: null, gain: null };

    // Couper aussi le bus ambient pour éviter tout résidu
    this._bus.ambient?.gain.cancelScheduledValues(t);
    this._bus.ambient?.gain.linearRampToValueAtTime(0, t + 0.8);
  }

  // ── BALLES MANQUANTES ────────────────────────────────────────────────────
  playNoAmmo() {
    if (!this._ctx) return;
    if (this._buffers.noAmmo) {
      this._playBuf('noAmmo', this._bus.sfx, { vol: 0.9 });
    }
  }

  // ── ALERTE BASSE RESSOURCE ────────────────────────────────────────────────
  playLowWarning(type = 'fuel') {
    if (!this._ctx) return;
    const ctx  = this._ctx;
    const t    = ctx.currentTime;
    const freq = type === 'fuel' ? 440 : 520;
    const osc  = ctx.createOscillator();
    osc.type   = 'sine';
    osc.frequency.value = freq;
    const env  = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.08, t + 0.05);
    env.gain.linearRampToValueAtTime(0.06, t + 0.15);
    env.gain.linearRampToValueAtTime(0,    t + 0.28);
    osc.connect(env); env.connect(this._bus.sfx);
    osc.start(t); osc.stop(t + 0.3);
  }

  // ── DÉPLOIEMENT LEURRES (chaff/flare) ────────────────────────────────────
  playDecoy() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const t   = ctx.currentTime;
    // Rafale de claquements métalliques courts (cartouches éjectées)
    const bursts = 5;
    for (let i = 0; i < bursts; i++) {
      const delay = i * 0.045 + Math.random() * 0.015;
      const dur   = 0.055;
      const len   = Math.floor(ctx.sampleRate * dur);
      const buf   = ctx.createBuffer(1, len, ctx.sampleRate);
      const data  = buf.getChannelData(0);
      for (let j = 0; j < len; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.007));
      }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const hp  = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2800 + Math.random() * 1200;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.28 + Math.random() * 0.18, t + delay);
      env.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      src.connect(hp); hp.connect(env); env.connect(this._bus.sfx);
      src.start(t + delay);
    }
    // Bruit de fond bref (air expulsé)
    const wlen = Math.floor(ctx.sampleRate * 0.18);
    const wbuf = ctx.createBuffer(1, wlen, ctx.sampleRate);
    const wd   = wbuf.getChannelData(0);
    for (let j = 0; j < wlen; j++) wd[j] = Math.random() * 2 - 1;
    const wsrc = ctx.createBufferSource(); wsrc.buffer = wbuf;
    const wlp  = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 600;
    const wenv = ctx.createGain();
    wenv.gain.setValueAtTime(0.12, t);
    wenv.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    wsrc.connect(wlp); wlp.connect(wenv); wenv.connect(this._bus.sfx);
    wsrc.start(t);
  }

  // ── Nettoyage ─────────────────────────────────────────────────────────────
  dispose() {
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    this.stopMenuMusic();
    if (this._engine) {
      try { this._engine.src.stop(); } catch(e) {}
      this._engine = null;
    }
    if (this._groundRoll) {
      try { this._groundRoll.src.stop(); } catch(e) {}
      this._groundRoll = null;
    }
    this._enemies.forEach(nodes => { try { nodes.src.stop(); } catch(e) {} });
    this._enemies.clear();
    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
    }
  }

  // ── ALARME LOCK MISSILE ENNEMI ────────────────────────────────────────────
  playMissileLock() {
    if (!this._ctx) return;
    const now = this._ctx.currentTime;
    if (this._lastLockBeep && now - this._lastLockBeep < 0.38) return;
    this._lastLockBeep = now;
    const ctx = this._ctx;
    const t   = ctx.currentTime;
    // Ping radar court : impulsion sinusoïdale 660 Hz, attaque dure, decay net
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = 660;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.18, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(env); env.connect(this._bus.sfx);
    osc.start(t); osc.stop(t + 0.15);
  }

  // ── MISSILE ENNEMI EN VOL ─────────────────────────────────────────────────
  playMissileIncoming() {
    if (!this._ctx) return;
    const now = this._ctx.currentTime;
    if (this._lastIncoming && now - this._lastIncoming < 2.2) return;
    this._lastIncoming = now;
    const ctx = this._ctx;
    const t   = ctx.currentTime;
    // Trois impulsions courtes montantes — urgence RWR sans effet cartoon
    for (let i = 0; i < 3; i++) {
      const d   = t + i * 0.18;
      const osc = ctx.createOscillator();
      osc.type  = 'triangle';
      osc.frequency.setValueAtTime(520 + i * 60, d);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, d);
      env.gain.linearRampToValueAtTime(0.16, d + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, d + 0.13);
      osc.connect(env); env.connect(this._bus.sfx);
      osc.start(d); osc.stop(d + 0.14);
    }
  }
}

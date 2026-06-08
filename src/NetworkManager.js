// Client WebSocket pour le multijoueur
// Protocole : messages JSON { type, payload }

export class NetworkManager {
  constructor(url = null) {
    this._url      = url || this._defaultUrl();
    this._ws       = null;
    this._handlers = new Map();
    this._pending  = new Map(); // type → { resolve, reject }
    this.id        = null;      // id attribué par le serveur
    this.connected = false;
  }

  _defaultUrl() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    return isLocal ? 'ws://localhost:8080' : `wss://${host}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this._ws = new WebSocket(this._url);
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);

      this._ws.addEventListener('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });
      this._ws.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      this._ws.addEventListener('message', (e) => this._onMessage(e));
      this._ws.addEventListener('close',   ()  => {
        this.connected = false;
        this._emit('disconnected', {});
      });
    });
  }

  disconnect() {
    if (this._ws) { this._ws.close(); this._ws = null; }
  }

  createRoom(config) {
    return this._request('create_room', { config });
  }

  joinRoom(code, playerInfo) {
    return this._request('join_room', { code, playerInfo });
  }

  send(type, payload = {}) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    this._ws.send(JSON.stringify({ type, payload }));
  }

  // Enregistre un handler pour les messages entrants
  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, []);
    this._handlers.get(type).push(handler);
  }

  off(type, handler) {
    if (!this._handlers.has(type)) return;
    const arr = this._handlers.get(type).filter(h => h !== handler);
    this._handlers.set(type, arr);
  }

  once(type, handler) {
    const wrapper = (payload) => { this.off(type, wrapper); handler(payload); };
    this.on(type, wrapper);
  }

  // ── Interne ────────────────────────────────────────────────────────────────
  _request(type, payload) {
    return new Promise((resolve, reject) => {
      const reqId = `${type}_${Date.now()}`;
      this._pending.set(type, { resolve, reject });
      this.send(type, { ...payload, _reqId: reqId });
      setTimeout(() => {
        if (this._pending.has(type)) {
          this._pending.delete(type);
          reject(new Error(`timeout: ${type}`));
        }
      }, 8000);
    });
  }

  _onMessage(e) {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    const { type, payload } = msg;

    // Réponse à une requête en attente
    if (this._pending.has(type)) {
      const { resolve } = this._pending.get(type);
      this._pending.delete(type);
      resolve(payload);
      return;
    }

    // Attribution d'ID
    if (type === 'welcome') { this.id = payload.id; return; }

    this._emit(type, payload);
  }

  _emit(type, payload) {
    const handlers = this._handlers.get(type) || [];
    handlers.forEach(h => { try { h(payload); } catch (e) { console.error(e); } });
  }
}

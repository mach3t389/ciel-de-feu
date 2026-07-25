// Client WebSocket (signaling lobby) + WebRTC P2P (trafic de partie) pour le multijoueur
// Protocole : messages JSON { type, payload }

import { PeerNetwork } from './PeerConnection.js';

// Messages haute fréquence exclus des logs de diagnostic (sinon spam)
const NOISY = new Set(['player_update', 'bullet_fired', 'score_update']);

// Trafic de partie : relayé en P2P via l'hôte une fois le DataChannel ouvert
// (au lieu de repasser par le serveur de signaling). Le reste (lobby, contrôle
// de salon, signaling WebRTC) reste sur la WS.
const P2P_TYPES = new Set([
  'player_update', 'bullet_fired', 'player_hit', 'enemy_killed',
  'player_respawn', 'score_update', 'bot_state', 'survival_wave_config',
  'enemy_bullet', 'mission_state', 'force_end_game', 'missile_fired',
]);

// Avec l'ancien relais server.js, le serveur tamponnait l'id de l'expéditeur sur
// ces messages (room.broadcast('player_update', { id: clientId, ... })) — les
// appelants (MultiplayerManager) n'ont jamais eu besoin de l'inclure eux-mêmes.
// En P2P le relais (hôte) ne fait que retransmettre le payload tel quel, donc il
// faut désormais l'ajouter ici, côté expéditeur.
const SELF_ID_FIELD = {
  player_update: 'id', bullet_fired: 'id', player_respawn: 'id', score_update: 'id',
  player_hit: 'shooterId',
};

export class NetworkManager {
  constructor(url = null) {
    this._url      = url || this._defaultUrl();
    this._ws       = null;
    this._handlers = new Map();
    this._pending  = new Map(); // type → { resolve, reject }
    this.id        = null;      // id attribué par le serveur
    this.connected = false;
    this.peerNetwork = null;
    this._explicitDisconnect = false;
    this._reconnectAttempts  = 0;
  }

  _defaultUrl() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    // Même origine que le front dans tous les cas — servi par `vercel dev` en
    // local (front Vite + api/ws.js sur le même port) et par Vercel en prod.
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/api/ws`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this._ws = new WebSocket(this._url);
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);

      this._ws.addEventListener('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this._reconnectAttempts = 0;
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
        if (!this._explicitDisconnect) this._scheduleReconnect();
      });
    });
  }

  _scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this._reconnectAttempts, 15000);
    this._reconnectAttempts++;
    setTimeout(() => {
      if (this._explicitDisconnect) return;
      this.connect()
        .then(() => this._emit('reconnected', {}))
        .catch(() => this._scheduleReconnect());
    }, delay);
  }

  disconnect() {
    this._explicitDisconnect = true;
    if (this.peerNetwork) { this.peerNetwork.closeAll(); this.peerNetwork = null; }
    if (this._ws) { this._ws.close(); this._ws = null; }
  }

  async createRoom(config) {
    const result = await this._request('create_room', { config });
    this.peerNetwork = new PeerNetwork(this, 'host');
    return result;
  }

  async joinRoom(code, playerInfo) {
    const result = await this._request('join_room', { code, playerInfo });
    const host = result.players?.find(p => p.isHost);
    this.peerNetwork = new PeerNetwork(this, 'guest', host?.id);
    return result;
  }

  // Attend que le DataChannel P2P soit ouvert (immédiat côté hôte, attend
  // l'ouverture côté invité) — utilisé pour gater le début de partie.
  waitForPeerReady() {
    return this.peerNetwork ? this.peerNetwork.waitUntilReady() : Promise.resolve();
  }

  send(type, payload = {}) {
    const idField = SELF_ID_FIELD[type];
    if (idField && payload[idField] === undefined) payload = { ...payload, [idField]: this.id };
    if (P2P_TYPES.has(type) && this.peerNetwork?.ready) {
      this.peerNetwork.send(type, payload);
      return;
    }
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      if (!NOISY.has(type)) console.warn('[NET send IGNORÉ — non connecté]', type, 'readyState=', this._ws?.readyState);
      return;
    }
    if (!NOISY.has(type)) console.log('[NET send]', type, payload);
    // Certains payloads (ex. start_game) reprennent tout _config par spread, qui
    // contient networkManager lui-même — sans ce filtre, le PeerNetwork qu'il
    // référence en interne (this.nm) rend la structure circulaire pour JSON.stringify.
    this._ws.send(JSON.stringify({ type, payload }, (key, value) => (key === 'networkManager' ? undefined : value)));
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
    if (!NOISY.has(type)) console.log('[NET recv]', type, payload);

    // Réponse à une requête en attente
    if (this._pending.has(type)) {
      const { resolve } = this._pending.get(type);
      this._pending.delete(type);
      resolve(payload);
      return;
    }

    // Erreur serveur : rejeter toute requête en attente (ex. salle introuvable lors d'un joinRoom)
    if (type === 'error' && this._pending.size > 0) {
      for (const [, { reject }] of this._pending) reject(new Error(payload?.message ?? 'server error'));
      this._pending.clear();
      return;
    }

    // Attribution d'ID
    if (type === 'welcome') { this.id = payload.id; return; }

    this._dispatch(type, payload);
  }

  // Point d'entrée commun WS (signaling) + DataChannel P2P (PeerConnection.js)
  _dispatch(type, payload) {
    const handlers = this._handlers.get(type);
    if (!handlers || handlers.length === 0) {
      console.warn('[NET recv SANS handler]', type);
    }
    this._emit(type, payload);
  }

  _emit(type, payload) {
    const handlers = this._handlers.get(type) || [];
    handlers.forEach(h => { try { h(payload); } catch (e) { console.error(e); } });
  }
}

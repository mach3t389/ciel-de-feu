// Relais P2P WebRTC pour le trafic de partie (remplace le relais server.js).
// Topologie étoile : les invités se connectent uniquement à l'hôte, qui relaie
// aux autres invités — même sémantique que Room.broadcast() côté serveur.

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export class PeerNetwork {
  constructor(nm, role, hostId = null) {
    this.nm          = nm;
    this.role        = role; // 'host' | 'guest'
    this.hostId      = hostId;
    this.connections = new Map(); // peerId → RTCPeerConnection
    this.channels    = new Map(); // peerId → RTCDataChannel
    this.ready       = role === 'host'; // l'hôte relaie au fur et à mesure des connexions
    this._readyResolvers = [];
    this._closed = false; // true seulement après un closeAll() explicite (déconnexion volontaire)
    this._reconnectAttempts = 0;

    if (role === 'host') {
      nm.on('webrtc_offer', (p) => this._onOffer(p));
    } else {
      nm.on('webrtc_answer', (p) => this._onAnswer(p));
      this._connectToHost();
    }
    nm.on('webrtc_ice', (p) => this._onIce(p));
  }

  waitUntilReady() {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve) => this._readyResolvers.push(resolve));
  }

  _markReady() {
    if (this.ready) return;
    this.ready = true;
    this._readyResolvers.forEach((r) => r());
    this._readyResolvers = [];
  }

  async _connectToHost() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const dc = pc.createDataChannel('game');
    this.connections.set(this.hostId, pc);
    this._attachChannel(this.hostId, dc, pc);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.nm.send('webrtc_ice', { to: this.hostId, from: this.nm.id, data: e.candidate });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.nm.send('webrtc_offer', { to: this.hostId, from: this.nm.id, data: offer });
  }

  // Reconnexion avec backoff exponentiel après une coupure P2P inattendue (aléa
  // réseau, changement de réseau, etc.) — sans ça la partie restait figée en
  // silence pour le reste du match dès qu'un canal se fermait vraiment.
  _scheduleReconnect() {
    if (this._closed || this.role !== 'guest') return;
    const delay = Math.min(1000 * 2 ** this._reconnectAttempts, 15000);
    this._reconnectAttempts++;
    setTimeout(() => {
      if (this._closed) return;
      this._connectToHost();
    }, delay);
  }

  async _onOffer({ from, data }) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.connections.set(from, pc);
    pc.ondatachannel = (e) => this._attachChannel(from, e.channel, pc);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.nm.send('webrtc_ice', { to: from, from: this.nm.id, data: e.candidate });
    };
    await pc.setRemoteDescription(data);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.nm.send('webrtc_answer', { to: from, from: this.nm.id, data: answer });
  }

  async _onAnswer({ from, data }) {
    const pc = this.connections.get(from);
    if (pc) await pc.setRemoteDescription(data);
  }

  async _onIce({ from, data }) {
    const pc = this.connections.get(from);
    if (!pc || !data) return;
    try { await pc.addIceCandidate(data); } catch (e) { console.warn('[P2P] candidat ICE rejeté', e); }
  }

  _attachChannel(peerId, dc, pc) {
    dc.onopen = () => {
      this.channels.set(peerId, dc);
      if (this.role === 'guest') { this._reconnectAttempts = 0; this._markReady(); }
    };
    dc.onclose = () => {
      this.channels.delete(peerId);
      this.connections.delete(peerId);
      pc?.close();
      // Ne PAS traiter la fermeture du DataChannel comme "l'hôte a quitté" — un
      // aléa réseau P2P transitoire peut fermer le canal sans que l'hôte soit
      // réellement parti. Le vrai signal host_left vient du signaling (api/ws.js
      // le diffuse quand la WS de l'hôte se ferme), c'est la seule source fiable.
      // Côté invité, on tente en revanche de rétablir le canal — sinon la partie
      // restait figée en silence pour de bon dès qu'une coupure survenait.
      if (this.role === 'guest') { this.ready = false; this._scheduleReconnect(); }
    };
    dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.nm._dispatch(msg.type, msg.payload);
      // L'hôte relaie aux autres invités, comme Room.broadcast(type, payload, excludeId) côté serveur.
      if (this.role === 'host') {
        this.channels.forEach((otherDc, otherId) => {
          if (otherId !== peerId && otherDc.readyState === 'open') otherDc.send(e.data);
        });
      }
    };
  }

  send(type, payload) {
    const raw = JSON.stringify({ type, payload });
    if (this.role === 'guest') {
      const dc = this.channels.get(this.hostId);
      if (dc && dc.readyState === 'open') dc.send(raw);
      return;
    }
    this.channels.forEach((dc) => { if (dc.readyState === 'open') dc.send(raw); });
  }

  closeAll() {
    this._closed = true; // empêche toute reconnexion — déconnexion volontaire
    this.connections.forEach((pc) => pc.close());
    this.connections.clear();
    this.channels.clear();
  }
}

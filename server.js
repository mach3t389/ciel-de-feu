// Serveur WebSocket multijoueur
// Démarrage : node server.js
// Requiert : npm install ws

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT  = process.env.PORT || 8080;
const wss   = new WebSocketServer({ port: PORT });
const rooms = new Map(); // code → Room

let clientCount = 0;

class Room {
  constructor(code, config, hostId) {
    this.code      = code;
    this.config    = config;
    this.hostId    = hostId;
    this.players   = new Map(); // id → { ws, info }
    this.started   = false;
    this.createdAt = Date.now();
  }

  broadcast(type, payload, excludeId = null) {
    this.players.forEach(({ ws }, id) => {
      if (id !== excludeId && ws.readyState === 1) {
        ws.send(JSON.stringify({ type, payload }));
      }
    });
  }

  broadcastAll(type, payload) {
    this.broadcast(type, payload, null);
  }
}

function send(ws, type, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, payload }));
}

wss.on('connection', (ws) => {
  const clientId = `p${++clientCount}_${randomUUID().slice(0, 6)}`;
  ws._id   = clientId;
  ws._room = null;

  send(ws, 'welcome', { id: clientId });
  console.log(`[+] ${clientId} connecté`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload } = msg;

    switch (type) {

      // ── Créer une salle ────────────────────────────────────────────────────
      case 'create_room': {
        const code = payload.config?.code || generateCode();
        if (rooms.has(code)) { rooms.delete(code); } // remplace si déjà existant
        const room = new Room(code, payload.config || {}, clientId);
        room.players.set(clientId, { ws, info: { id: clientId, name: payload.config?.name || 'HOST', team: payload.config?.team || 'jaune', isHost: true, isReady: false }});
        rooms.set(code, room);
        ws._room = code;
        send(ws, 'create_room', { code, config: room.config });
        console.log(`[R] Salle créée: ${code} par ${clientId}`);
        break;
      }

      // ── Rejoindre une salle ────────────────────────────────────────────────
      case 'join_room': {
        const { code, playerInfo } = payload;
        const room = rooms.get(code);
        if (!room) { send(ws, 'error', { message: `Salle ${code} introuvable` }); return; }
        if (room.started) { send(ws, 'error', { message: 'Partie déjà commencée' }); return; }
        if (room.players.size >= (room.config.maxPlayers || 16)) { send(ws, 'error', { message: 'Salle pleine' }); return; }

        const info = { id: clientId, name: playerInfo?.name || 'JOUEUR', team: playerInfo?.team || 'jaune', isHost: false, isReady: false };
        room.players.set(clientId, { ws, info });
        ws._room = code;

        // Envoyer la liste des joueurs existants au nouveau
        const existingPlayers = Array.from(room.players.values())
          .filter(p => p.info.id !== clientId)
          .map(p => p.info);
        send(ws, 'join_room', { players: existingPlayers, config: room.config });

        // Notifier les autres
        room.broadcast('player_joined', { player: info }, clientId);
        console.log(`[R] ${clientId} a rejoint la salle ${code}`);
        break;
      }

      // ── État joueur (position/rotation/etc.) ─────────────────────────────
      case 'player_update': {
        const room = rooms.get(ws._room);
        if (!room) return;
        room.broadcast('player_update', { id: clientId, state: payload.state }, clientId);
        break;
      }

      // ── Tir ──────────────────────────────────────────────────────────────
      case 'bullet_fired': {
        const room = rooms.get(ws._room);
        if (!room) return;
        room.broadcast('bullet_fired', { id: clientId, position: payload.position, quaternion: payload.quaternion }, clientId);
        break;
      }

      // ── Touché ────────────────────────────────────────────────────────────
      case 'player_hit': {
        const room = rooms.get(ws._room);
        if (!room) return;
        room.broadcastAll('player_hit', { targetId: payload.targetId, damage: payload.damage, shooterId: clientId });
        break;
      }

      // ── Ennemi abattu ─────────────────────────────────────────────────────
      case 'enemy_killed': {
        const room = rooms.get(ws._room);
        if (!room) return;
        room.broadcast('enemy_killed', { netId: payload.netId }, clientId);
        break;
      }

      // ── Réapparition ──────────────────────────────────────────────────────
      case 'player_respawn': {
        const room = rooms.get(ws._room);
        if (!room) return;
        room.broadcast('player_respawn', { id: clientId, position: payload.position }, clientId);
        break;
      }

      // ── Chargement terminé ───────────────────────────────────────────────
      case 'player_loaded': {
        const room = rooms.get(ws._room);
        if (!room) return;
        const p = room.players.get(clientId);
        if (p) p.info.loaded = true;
        const total       = room.players.size;
        const loadedCount = Array.from(room.players.values()).filter(({ info }) => info.loaded).length;
        room.broadcastAll('player_load_progress', { loaded: loadedCount, total });
        if (loadedCount >= total) room.broadcastAll('all_players_loaded', {});
        break;
      }

      // ── Prêt ──────────────────────────────────────────────────────────────
      case 'player_ready': {
        const room = rooms.get(ws._room);
        if (!room) return;
        const p = room.players.get(clientId);
        if (p) p.info.isReady = payload.ready;
        room.broadcast('player_ready', { id: clientId, ready: payload.ready }, clientId);
        break;
      }

      // ── Couleur d'avion (lobby) ───────────────────────────────────────────
      case 'player_plane': {
        const room = rooms.get(ws._room);
        if (!room) return;
        const p = room.players.get(clientId);
        if (p) p.info.team = payload.plane;
        room.broadcast('player_plane', { id: clientId, plane: payload.plane }, clientId);
        break;
      }

      // ── Équipe TDM (lobby) ────────────────────────────────────────────────
      case 'player_team': {
        const room = rooms.get(ws._room);
        if (!room) return;
        const p = room.players.get(clientId);
        if (p) p.info.playerTeam = payload.playerTeam;
        room.broadcast('player_team', { id: clientId, playerTeam: payload.playerTeam }, clientId);
        break;
      }

      // ── Mise à jour config par l'hôte ────────────────────────────────────
      case 'config_update': {
        const room = rooms.get(ws._room);
        if (!room || room.hostId !== clientId) return;
        Object.assign(room.config, payload);
        room.broadcast('config_update', payload, clientId);
        break;
      }

      // ── Lancer la partie (hôte uniquement) ────────────────────────────────
      case 'start_game': {
        const room = rooms.get(ws._room);
        if (!room || room.hostId !== clientId) return;
        room.started = true;
        room.broadcast('game_start', { config: payload.config || room.config }, clientId);
        console.log(`[R] Partie lancée: ${room.code}`);
        break;
      }

      // ── Score / kill ──────────────────────────────────────────────────────
      case 'score_update': {
        const room = rooms.get(ws._room);
        if (!room) return;
        room.broadcastAll('score_update', { id: clientId, ...payload });
        break;
      }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws._room);
    if (room) {
      room.players.delete(clientId);
      room.broadcast('player_left', { id: clientId });
      // Supprimer la salle si vide
      if (room.players.size === 0) {
        rooms.delete(ws._room);
        console.log(`[R] Salle supprimée: ${ws._room}`);
      } else if (room.hostId === clientId) {
        // Transférer le rôle d'hôte au premier joueur restant
        const [newHostId, newHostEntry] = room.players.entries().next().value;
        room.hostId = newHostId;
        newHostEntry.info.isHost = true;
        room.broadcastAll('host_changed', { newHostId });
      }
    }
    console.log(`[-] ${clientId} déconnecté`);
  });
});

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

// Version des messages gérés — sert à vérifier que le déploiement est à jour.
const PROTOCOL = 'v2-lobby-sync'; // config_update / player_plane / player_team / score_update
console.log(`Serveur WebSocket démarré sur le port ${PORT} — protocole ${PROTOCOL}`);
console.log('Messages lobby gérés : create_room, join_room, config_update, player_plane, player_team, player_ready, score_update');

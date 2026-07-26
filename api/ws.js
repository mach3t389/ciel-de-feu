// Signaling multijoueur — Function Vercel (Fluid Compute)
// Gère uniquement le lobby (création/join de salon, config, ready, signaling
// WebRTC). Le trafic de partie (position, tirs, dégâts...) passe en P2P via
// PeerConnection.js une fois le DataChannel hôte↔invité ouvert — voir
// docs/multiplayer.md pour l'architecture complète.
//
// L'état des salons vit dans Redis (pas en mémoire du process) car plusieurs
// instances de cette Function peuvent tourner en parallèle. Chaque instance ne
// garde en mémoire que SES propres connexions WebSocket locales ; pour joindre
// un client tenu par une autre instance, on publie sur son canal Redis dédié.

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';

// L'intégration Marketplace Vercel provisionne KV_REST_API_URL/TOKEN (convention
// Vercel KV) plutôt que UPSTASH_REDIS_REST_URL/TOKEN attendus par Redis.fromEnv().
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});
const ROOM_TTL = 6 * 60 * 60; // secondes — nettoyage auto des salons abandonnés

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Ciel de Feu — signaling en ligne\n');
});
const wss = new WebSocketServer({ server: httpServer });

const localSockets = new Map(); // clientId → ws (connexions tenues par CETTE instance)
const localSubs    = new Map(); // clientId → abonnement Upstash (à fermer à la déconnexion)

let clientCount = 0;

function send(ws, type, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, payload }));
}

// Livre un message à un client, qu'il soit tenu par cette instance ou une autre.
async function deliver(clientId, type, payload) {
  const local = localSockets.get(clientId);
  if (local) { send(local, type, payload); return; }
  await redis.publish(`client:${clientId}`, JSON.stringify({ type, payload }));
}

async function getRoom(code) {
  return await redis.get(`room:${code}`);
}

async function saveRoom(code, room) {
  await redis.set(`room:${code}`, room, { ex: ROOM_TTL });
}

async function deleteRoom(code) {
  await redis.del(`room:${code}`);
}

async function broadcastRoom(room, type, payload, excludeId = null) {
  await Promise.all(
    Object.keys(room.players)
      .filter((id) => id !== excludeId)
      .map((id) => deliver(id, type, payload))
  );
}

async function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (await getRoom(code));
  return code;
}

wss.on('connection', (ws) => {
  const clientId = `p${++clientCount}_${randomUUID().slice(0, 6)}`;
  ws._id   = clientId;
  ws._room = null;
  localSockets.set(clientId, ws);

  const sub = redis.subscribe([`client:${clientId}`]);
  sub.on('message', ({ message }) => {
    try {
      const { type, payload } = JSON.parse(message);
      send(ws, type, payload);
    } catch { /* message malformé — ignoré */ }
  });
  localSubs.set(clientId, sub);

  send(ws, 'welcome', { id: clientId });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload } = msg;

    switch (type) {

      // ── Signaling WebRTC (ciblé vers un joueur précis) ─────────────────────
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice': {
        if (payload?.to) await deliver(payload.to, type, payload);
        break;
      }

      // ── Créer une salle ────────────────────────────────────────────────────
      case 'create_room': {
        const code = payload.config?.code || await generateCode();
        const room = {
          code, hostId: clientId, started: false, createdAt: Date.now(),
          config: payload.config || {},
          players: {
            [clientId]: { id: clientId, name: payload.config?.name || 'HOST', team: payload.config?.team || 'jaune', level: payload.config?.level, prestigeLevel: payload.config?.prestigeLevel, isHost: true, isReady: false },
          },
        };
        await saveRoom(code, room);
        ws._room = code;
        send(ws, 'create_room', { code, config: room.config });
        break;
      }

      // ── Rejoindre une salle ────────────────────────────────────────────────
      case 'join_room': {
        const { code, playerInfo } = payload;
        const room = await getRoom(code);
        if (!room) { send(ws, 'error', { message: `Salle ${code} introuvable` }); return; }
        if (room.started) { send(ws, 'error', { message: 'Partie déjà commencée' }); return; }
        const playerCount = Object.keys(room.players).length;
        if (playerCount >= (room.config.maxPlayers || 16)) { send(ws, 'error', { message: 'Salle pleine' }); return; }

        const info = { id: clientId, name: playerInfo?.name || 'JOUEUR', team: playerInfo?.team || 'jaune', level: playerInfo?.level, prestigeLevel: playerInfo?.prestigeLevel, isHost: false, isReady: false };
        room.players[clientId] = info;
        await saveRoom(code, room);
        ws._room = code;

        const existingPlayers = Object.values(room.players).filter((p) => p.id !== clientId);
        send(ws, 'join_room', { players: existingPlayers, config: room.config });
        await broadcastRoom(room, 'player_joined', { player: info }, clientId);
        break;
      }

      // ── Chargement terminé (gate all_players_loaded — voir main.js) ────────
      case 'player_loaded': {
        const room = await getRoom(ws._room);
        if (!room) return;
        const p = room.players[clientId];
        if (p) p.loaded = true;
        await saveRoom(ws._room, room);
        const total       = Object.keys(room.players).length;
        const loadedCount = Object.values(room.players).filter((p) => p.loaded).length;
        await broadcastRoom(room, 'player_load_progress', { loaded: loadedCount, total });
        if (loadedCount >= total) await broadcastRoom(room, 'all_players_loaded', {});
        break;
      }

      // ── Prêt / avion / niveau / équipe (lobby) ──────────────────────────────
      case 'player_ready': {
        const room = await getRoom(ws._room);
        if (!room) return;
        if (room.players[clientId]) room.players[clientId].isReady = payload.ready;
        await saveRoom(ws._room, room);
        await broadcastRoom(room, 'player_ready', { id: clientId, ready: payload.ready }, clientId);
        break;
      }
      case 'player_plane': {
        const room = await getRoom(ws._room);
        if (!room) return;
        if (room.players[clientId]) room.players[clientId].team = payload.plane;
        await saveRoom(ws._room, room);
        await broadcastRoom(room, 'player_plane', { id: clientId, plane: payload.plane }, clientId);
        break;
      }
      case 'player_level': {
        const room = await getRoom(ws._room);
        if (!room) return;
        if (room.players[clientId]) { room.players[clientId].level = payload.level; room.players[clientId].prestigeLevel = payload.prestigeLevel; }
        await saveRoom(ws._room, room);
        await broadcastRoom(room, 'player_level', { id: clientId, level: payload.level, prestigeLevel: payload.prestigeLevel }, clientId);
        break;
      }
      case 'player_team': {
        const room = await getRoom(ws._room);
        if (!room) return;
        if (room.players[clientId]) room.players[clientId].playerTeam = payload.playerTeam;
        await saveRoom(ws._room, room);
        await broadcastRoom(room, 'player_team', { id: clientId, playerTeam: payload.playerTeam }, clientId);
        break;
      }

      // ── Config / lancement (hôte uniquement) ────────────────────────────────
      case 'config_update': {
        const room = await getRoom(ws._room);
        if (!room || room.hostId !== clientId) return;
        Object.assign(room.config, payload);
        await saveRoom(ws._room, room);
        await broadcastRoom(room, 'config_update', payload, clientId);
        break;
      }
      case 'start_game': {
        const room = await getRoom(ws._room);
        if (!room || room.hostId !== clientId) return;
        room.started = true;
        await saveRoom(ws._room, room);
        await broadcastRoom(room, 'game_start', { config: payload.config || room.config }, clientId);
        break;
      }

      // ── L'hôte renvoie tout le monde au lobby (même salon) ──────────────────
      // Remet started à false pour que le prochain create_room/join_room du même
      // code (envoyé côté client juste après) fonctionne sans délai. Marque aussi
      // ws._returningToLobby (en mémoire, PAS en Redis) : la déconnexion WS de
      // l'hôte qui suit presque aussitôt (game.destroy() → disconnect()) ne doit
      // PAS déclencher le host_left/suppression de salle habituel — l'hôte va se
      // reconnecter sous peu avec le même code (voir ws.on('close')). Le flag est
      // posé de façon SYNCHRONE avant tout await : les frames WebSocket d'une même
      // connexion sont livrées dans l'ordre, donc ce handler 'message' démarre
      // forcément avant l'event 'close' qui suit — contrairement à un flag stocké
      // dans Redis, pas de course possible avec la latence des round-trips Upstash.
      case 'return_lobby': {
        ws._returningToLobby = true;
        const room = await getRoom(ws._room);
        if (!room || room.hostId !== clientId) { ws._returningToLobby = false; return; }
        room.started = false;
        await saveRoom(ws._room, room);
        await broadcastRoom(room, 'return_lobby', {}, clientId);
        break;
      }
    }
  });

  ws.on('close', async () => {
    localSockets.delete(clientId);
    localSubs.get(clientId)?.unsubscribe?.();
    localSubs.delete(clientId);

    const code = ws._room;
    if (!code) return;
    const room = await getRoom(code);
    if (!room) return;

    const wasHost = room.hostId === clientId;
    delete room.players[clientId];

    if (wasHost && ws._returningToLobby) {
      // Retour au lobby en cours : l'hôte va se reconnecter sous peu avec le même
      // code (create_room le remplacera alors intégralement) — ne pas casser la
      // salle ni prévenir les autres joueurs d'un faux départ de l'hôte.
      await saveRoom(code, room);
      return;
    }

    if (wasHost && Object.keys(room.players).length > 0) {
      await broadcastRoom(room, 'host_left', {});
      await deleteRoom(code);
    } else if (Object.keys(room.players).length === 0) {
      await deleteRoom(code);
    } else {
      await saveRoom(code, room);
      await broadcastRoom(room, 'player_left', { id: clientId });
    }
  });
});

export default httpServer;

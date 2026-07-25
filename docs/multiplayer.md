# Multijoueur

## Architecture

Le backend (`api/ws.js`, Function Vercel) ne gère que le **lobby** : création/join
de salon, config, ready, et le **signaling WebRTC** (échange offer/answer/ICE).
Une fois le salon rejoint, l'invité établit une connexion **WebRTC en P2P direct
avec l'hôte** (topologie étoile) ; tout le trafic de partie (position, tirs,
dégâts, bots, mission...) passe par ce DataChannel, l'hôte relayant aux autres
invités — le backend n'y participe plus du tout. Voir [src/PeerConnection.js](../src/PeerConnection.js).

Ce découpage existe parce que le trafic de partie est haute fréquence
(`player_update` à ~20 Hz par joueur) : le faire transiter par une Function
serverless + Redis (nécessaire pour relayer entre instances) exploserait les
quotas gratuits et ajouterait de la latence. Le lobby, lui, est à faible
fréquence et reste sur le signaling Vercel sans problème.

```
Client A (hôte)      api/ws.js (Vercel) + Redis      Client B (invité)
     │                          │                              │
     │── create_room ──────────►│                               │
     │◄─ room créé ─────────────│                               │
     │                          │◄──────────── join_room ───────│
     │                          │──── notifie l'hôte ──────────►│
     │                          │  (échange offer/answer/ICE)   │
     │◄═══════════════ WebRTC DataChannel (P2P direct) ════════►│
     │  player_update, bullet_fired, player_hit, bot_state...   │
```

L'état des salons (liste des joueurs, config, hôte, `started`) vit dans Redis
(Upstash, via le Marketplace Vercel) car plusieurs instances de la Function
peuvent tourner en parallèle — impossible de le garder en mémoire du process
comme le faisait l'ancien `server.js` sur Railway.

**Limite connue** : pas de serveur TURN de secours, seulement un STUN public
(`stun:stun.l.google.com:19302`). Un joueur derrière un NAT symétrique/pare-feu
très restrictif peut échouer à établir la connexion P2P.

## Développement local

```bash
npm i -g vercel   # une seule fois
npm run dev:vercel   # sert le front Vite ET api/ws.js (nécessite `vercel link` + Upstash Redis provisionné)
```

`vite dev` seul ne sait pas servir `/api/ws` — le multijoueur ne fonctionne
qu'avec `vercel dev`.

**Variable d'environnement** : `VITE_WS_URL` — si absent, le client se connecte
en `ws(s)://<hostname>/api/ws`, toujours même origine que le front (fonctionne
aussi bien en local avec `vercel dev` qu'en prod).

## Modes de jeu multijoueur

| Mode | Description | IA |
|------|-------------|-----|
| `multiplayer` | Lobby coopératif libre | 0 |
| `ffa` | Free-for-all — chacun pour soi | 0 (bots si hôte) |
| `tdm` | Team deathmatch — Rouge vs Bleu | 0 |

En FFA et TDM, l'hôte gère les bots IA localement et diffuse leurs positions via `bot_state`.

## Protocole WebSocket

Tous les messages sont JSON : `{ type: string, payload: object }`.

### Connexion et salon

| Direction | Type | Payload |
|-----------|------|---------|
| S→C | `welcome` | `{ id }` |
| C→S | `create_room` | `{ config }` |
| C→S | `join_room` | `{ code, playerInfo }` |
| S→C | `player_joined` | `{ id, info }` |
| S→C | `player_left` | `{ id }` |
| S→C | `host_left` | — |
| S→C | `error` | `{ message }` |

### Synchronisation de chargement

| Direction | Type | Payload |
|-----------|------|---------|
| C→S | `player_loaded` | — |
| S→C | `all_players_loaded` | — |
| S→C | `player_load_progress` | `{ loaded, total }` |

### Partie

| Direction | Type | Payload | Fréquence |
|-----------|------|---------|-----------|
| C→S→C | `player_update` | `{ pos, quat, speed, hp, isDead }` | ~20 Hz |
| C→S→C | `bullet_fired` | `{ position, quaternion }` | à chaque tir |
| C→S→C | `player_hit` | `{ targetId, damage, shooterId }` | à l'impact |
| C→S→C | `score_update` | `{ id, kills, deaths, name }` | à chaque kill |
| C→S→C | `player_respawn` | `{ id, position }` | à la réapparition |

### Modes spéciaux (hôte autorité)

| Direction | Type | Payload |
|-----------|------|---------|
| Hôte→S→C | `bot_state` | `{ bots: [{ id, pos, quat, hp, isDead }] }` |
| Hôte→S→C | `enemy_killed` | `{ netId }` |
| Hôte→S→C | `survival_wave_config` | `{ cfg }` |
| S→C | `force_end_game` | — |

## NetworkManager (client)

```js
// Connexion
const nm = new NetworkManager();          // URL depuis VITE_WS_URL ou auto
await nm.connect();                       // throws si timeout (5 s)

// Salon — établit aussi la connexion WebRTC P2P en interne (host ou guest)
const room = await nm.createRoom(config); // { code, players }
await nm.joinRoom(code, playerInfo);
await nm.waitForPeerReady();              // attend l'ouverture du DataChannel (immédiat côté hôte)

// Envoi/réception — routé automatiquement vers le DataChannel P2P une fois prêt
// pour les messages de partie (player_update, bullet_fired...), sinon vers la WS de signaling
nm.send('player_update', { pos, quat, speed, hp });
nm.on('player_joined', (payload) => { /* ... */ });
nm.once('all_players_loaded', () => { /* ... */ });
nm.off('player_joined', handler);

// Déconnexion
nm.disconnect();
```

`nm.id` — ID attribué par le serveur à la connexion.

## MultiplayerManager (joueurs distants)

Gère l'interpolation de tous les joueurs et bots distants.

```js
// Interpolation : affiche les joueurs 100 ms dans le passé
const INTERP_DELAY = 0.10; // secondes
```

Chaque `RemotePlayer` maintient un buffer de snapshots `[{ t, pos, quat }]`. À chaque frame, `update(delta)` interpole entre les deux derniers snapshots reçus.

**Propriétés d'un RemotePlayer :**

```js
{
  id, name, team, isEnemy,
  isDead, hp, speed,
  kills, deaths,        // scoreboard
  shieldActive, shieldType,
  pivot,                // THREE.Object3D (position dans la scène)
  aimPosition,          // getter → position prédite (lead targeting)
}
```

**Méthodes de diffusion (à appeler depuis Game.js) :**

```js
mm.sendLocalState(player, extraData)    // position, HP, etc.
mm.sendScore(kills, deaths, name)
mm.sendBullet(position, quaternion)
mm.sendHit(targetId, damage)
mm.sendEnemyKill(netId)
mm.sendBotStates(states)               // hôte FFA/TDM uniquement
mm.sendSurvivalWaveConfig(cfg)         // hôte survival uniquement
```

**Événements émis par MultiplayerManager :**

```js
mm.on('remote_player_joined', ({ id, player }) => {})
mm.on('remote_player_left',   ({ id }) => {})
mm.on('remote_player_died',   ({ id, killerId }) => {})
mm.on('remoteHit',            ({ targetId, damage, shooterId }) => {})
mm.on('remoteBullet',         ({ position, quaternion }) => {})
mm.on('enemy_killed',         ({ netId }) => {})
mm.on('scoreboard_changed',   (rows) => {})
mm.on('survival_wave_config', (cfg) => {})
```

## Modèle de propriété (autorité)

- Chaque client est autorité sur **son propre avion** (position, santé, tirs).
- En FFA/TDM, l'**hôte** est autorité sur les bots IA.
- En Survival, l'**hôte** calcule les vagues et diffuse la config.
- Il n'y a pas de validation côté serveur : l'hôte relaie le trafic de partie en P2P sans le valider (le backend Vercel ne voit même plus passer ces messages, voir Architecture ci-dessus).

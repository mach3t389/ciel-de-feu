# Multijoueur

## Architecture

```
Client A (hôte)          Serveur (server.js / Railway)      Client B
     │                           │                               │
     │── create_room ──────────► │                               │
     │◄─ room_created ──────────-│                               │
     │                           │◄──────────── join_room ───────│
     │◄─ player_joined ─────────-│─── player_joined ────────────►│
     │── player_loaded ─────────►│◄─────────── player_loaded ────│
     │◄─ all_players_loaded ─────│──── all_players_loaded ───────►│
     │         [partie en cours]                                  │
     │── player_update ─────────►│──── player_update ────────────►│
     │── bullet_fired ──────────►│──── bullet_fired ─────────────►│
     │── player_hit ────────────►│──── player_hit ────────────────►│
```

## Démarrage du serveur

```bash
node server.js        # port 8080 par défaut
PORT=9000 node server.js
```

Le serveur répond aux health-checks HTTP (Railway/Render) avec un `200 OK` avant d'upgrader en WebSocket.

**Variable d'environnement** : `VITE_WS_URL` — si absent, le client se connecte en `ws://localhost:8080` (local) ou `wss://<hostname>` (prod).

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

// Salon
const room = await nm.createRoom(config); // { code, players }
await nm.joinRoom(code, playerInfo);

// Envoi/réception
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
- Il n'y a pas de server-side validation : le serveur est un relais pur.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Documentation détaillée dans [`docs/`](docs/index.md) : architecture, cartes, physique, armes, progression, multijoueur, HUD.

## Commandes

```bash
npm run dev      # dev Vite → http://localhost:3000
npm run build    # bundle production dans dist/
npm run server   # serveur WebSocket multijoueur (port 8080)
```

Pas de tests automatisés, pas de linter configuré. Vérification manuelle dans le navigateur.

## Stack

**Vite + Three.js** — ES modules purs, zéro TypeScript, zéro framework UI. Rendu Three.js WebGL + overlays HTML/Canvas dessinés à la main.

Multijoueur : signaling léger via `api/ws.js` (Function Vercel, Node.js + `ws` + Redis Upstash pour l'état des salons), trafic de partie en P2P WebRTC direct entre joueurs (voir section Multijoueur plus bas et `docs/multiplayer.md`). Variable d'environnement `VITE_WS_URL` optionnelle pour pointer vers un signaling distant — sinon même origine que le front (`/api/ws`).

## Architecture

### Boucle principale (`main.js`)

`main.js` tourne avec `top-level await` dans une boucle infinie :
```
Menu.show() → LoadingScreen → Game.preload() → Game.start() → (replay ou reboucle)
```
`Game.start()` retourne `{ action: 'replay' }` ou `null`. En multijoueur, le `networkManager` est injecté dans le `config` passé à `Game`.

### Cartes (`BocageMap.js`, `CretesMap.js`, `NormandyMap.js`)

Chaque carte est une classe autonome. `Game.js` détecte la carte via `config.map` (1 = Crêtes, 4 = Bocage, 5 = Normandie ; autres = terrain océan legacy généré dans Game.js).

Toutes les cartes exposent la même interface après `await map.build()` :
```js
{ getTerrainHeight(x, z), isOnRunway(x, z), getVillageZones(), getAirportZones(), ... }
```
La hauteur terrain est calculée via noise fBm + pics gaussiens (tableaux `PEAKS`) — les valeurs sont codées en dur dans chaque fichier de carte.

**CretesMap** a deux canyons volables (`CANYON_DEFS`) avec `halfW`/`blend` distincts par trajet.

### Système de progression (`ProgressionSystem.js` + `UpgradeTree.js`)

Persistance via `localStorage` (clé `cielDeFeu_progression`). Niveau 1-50, XP cumulé, crédits, 3 slots d'avions.

`UpgradeTree.js` contient :
- `UPGRADES` — dictionnaire plat de toutes les améliorations (id, cat, levelReq, cost, requires, stats, desc, effets spéciaux)
- `computeStats(upgradeIds)` — fusionne les stats additives au-dessus de `BASE_STATS`
- `loadModifiers(upgradeIds)` / `missileParams(upgradeIds)` / `activeDefenseParams(upgradeIds)` — effets dérivés
- `EQUIPMENT_CATALOG` / `DEFAULT_LOADOUT` — système d'équipement par slot (défense active, missiles…)

### Missiles et défense active

**`MissileSystem.js`** — missiles joueur : lock-on (cône + range), tir AA et AG, guidage par niveau (`TURN_SPEED_LEVELS`, `TRACK_TIME_BONUS`). Slots visuels = charges via `_slotCharges`. Callbacks : `onHit`, `onLockStart/Complete/Lost`.

**`EnemyMissileManager.js`** — missiles entrants : physique, impact, alarme HUD. Distinct de MissileSystem.

### IA ennemie (`Enemy.js`)

Machine à états PATROL → FOLLOW → ATTACK → FLEE. Trois tiers : `rookie / regular / ace` (portée, précision, cadence). Évitement terrain par look-ahead sur plusieurs distances (`LOOK_DISTS`). Gère aussi son propre lock-on missile (`_updateMissileLock`).

### Défense sol (`GroundDefense.js`)

Tanks, trucks, mitrailleuses AA placés autour des villages. `GroundDefense.preloadModels()` précharge les GLB avant `build()`. Les unités alliées réapparaissent (`ALLY_RESPAWN_CD = 45s`).

### Multijoueur (`NetworkManager.js` + `PeerConnection.js` + `MultiplayerManager.js` + `api/ws.js`)

`api/ws.js` (Function Vercel) gère uniquement le **lobby** (create/join room, config, ready) et le **signaling WebRTC** (offer/answer/ICE) — état des salons dans Redis (Upstash, plusieurs instances de la Function peuvent tourner en parallèle). Le trafic de partie (haute fréquence, `player_update` ~20 Hz) ne transite jamais par ce backend : une fois le salon rejoint, `PeerConnection.js` établit une connexion **WebRTC P2P en étoile** — les invités se connectent uniquement à l'hôte, qui relaie aux autres (même sémantique que l'ancien `Room.broadcast()` de `server.js`, mais côté client).

`NetworkManager` : API publique inchangée (`createRoom` / `joinRoom` / `send` / `on` / `once`), protocole JSON `{ type, payload }`. En interne, route les messages de partie vers le DataChannel P2P une fois ouvert (`waitForPeerReady()`), le reste (lobby, signaling) reste sur la WS de signaling. Reconnect avec backoff exponentiel sur la WS.

`MultiplayerManager` : interpolation snapshot des joueurs distants (buffer de 100 ms de retard pour absorber la gigue réseau). Les joueurs distants chargent `/SK_Veh_Plane_Stunt_01.glb`. Alliés affichés en **bleu** (`ALLY_COLOR`), ennemis en rouge.

**Coop/Survie/TDM host-authoritative** : en coop et survie networkées, l'hôte possède les ennemis (IA + progression de mission/vague) et diffuse leur état via `bot_state` (réutilise le `RemoteBot` du FFA), leur feu via `enemy_bullet`, et l'avancement via `mission_state`/`survival_wave_config`. En TDM avec bots IA, les bots des deux équipes sont eux aussi hôte-autoritaires (`RemoteBot` avec `isEnemy` dynamique selon l'équipe du joueur local). Les clients ne spawnent aucun ennemi/bot : ils affichent des `RemoteBot`, leur tirent dessus (dégâts optimistes locaux via `_localHp`, autoritaire à la baisse) et créditent leurs propres kills. La victoire est décidée par l'hôte. Drapeaux : `Game._coopHost` / `Game._coopClient`.

**Défense sol host-authoritative** (coop + survie) : mêmes principes — l'hôte diffuse le placement une fois (`ground_defense_init`, le placement utilise `Math.random()`) puis l'état (vie, mort, orientation tourelle) via `ground_defense_state` (~10 Hz). Les clients n'affichent qu'un miroir (`GroundDefense.buildFromRemote`/`applyRemoteState`), sans ciblage/tir local ; leurs propres tirs sur une unité sont rapportés à l'hôte via `ground_hit` (dégât optimiste local + hôte autoritaire). Drapeaux : `Game._groundDefenseHost` / `Game._groundDefenseClient`.

**Difficulté adaptative** (`Game._pickEnemySkill` / `_enemyMissilesAllowed`) : le tier d'IA est pondéré par le niveau du joueur (rookie aux bas niveaux, jamais d'ace avant niv. 10) et les missiles ennemis ne se débloquent qu'à partir du niveau `ENEMY_MISSILE_MIN_LEVEL` (5, déblocage des leurres). Nouveaux joueurs (< niv. 5) démarrent en difficulté `easy` par défaut.

### HUD (`UI.js`)

Canvas/HTML style cockpit WW2. Palette définie dans l'objet `C` en tête de fichier (`cream`, `dimCream`, `bezelHi`…). Fonts : Rajdhani (chiffres) + Courier New (labels).

La mire est un `THREE.Sprite` rendu dans une **scène orthographique séparée** après la scène principale — elle s'affiche toujours par-dessus les balles.

Méthodes HUD clés :
- `setActiveDefenseStatus(type, count, max, cooldownPct, isActive, timeRemaining)` — panneau défense active
- `_drawCounterBox(canvas, label, count, max, valColor, symFull, symEmpty, desc)` — encadré compteur réutilisable
- `_drawWorldMarkers()` — cercles villages + indicateurs de bord d'écran

### Autres modules

| Fichier | Rôle |
|---------|------|
| `Player.js` | Physique de vol, input clavier/souris, animation bones, carburant/munitions/santé |
| `CameraController.js` | Caméra 3e personne — **NE PAS MODIFIER** (version stable validée) |
| `Bullet.js` | `BulletManager` + `EnemyBulletManager` — pool de projectiles instanciés |
| `Trail.js` | Traînée persistante derrière l'avion |
| `LODManager.js` | `InstancedLOD` — 3 niveaux de détail via `SimplifyModifier`, utilisé par les cartes pour les arbres/buissons |
| `AudioManager.js` | Web Audio API + fichiers WAV (`public/sfx/`), synthèse pour effets ponctuels |
| `PracticeMode.js` | Mode entraînement — anneaux + cibles autour de la base joueur |
| `MobileControls.js` | Joystick virtuel touch, détection `IS_MOBILE` |
| `LoadingScreen.js` | Écran de chargement avec barre de progression |
| `BugReport.js` | Overlay de rapport de bug (contexte mode/carte/vague injecté par Game.js) |
| `SettingsOverlay.js` | Overlay paramètres en jeu |
| `CursorFX.js` | Effets visuels curseur dans le menu |
| `i18n.js` | Dictionnaire FR/EN, fonctions `t()`, `tTips()`, `tModeInfo()`… |

## Physique (`Player.js`)

- Vitesse : MIN 20, MAX 120 km/h, accél 20/s, drag 3/s
- Altitude max : **1000 m** (plafond bloquant)
- Carburant : 100→0, drain 0.4/s + 0.93/s avec Shift — moteur coupe si vide
- Munitions : 200 rounds de base (-1 par tir, modifiable par upgrades)
- Santé : 100 HP, -50 HP par contact sol (cooldown 0.3s)
- Bones animés : hélice, ailerons, gouverne, queue, flaps — axes calibrés par essai/erreur, **ne pas reset**
- Traînée complexe intentionnellement absente (physique simplifiée)

## Contrôles

| Touche | Action |
|--------|--------|
| Shift | Accélérer |
| W / S | Monter / Descendre |
| A / D | Virer gauche / droite |
| Espace | Tirer |
| Souris | Diriger (mode souris capturée) |

## Assets (`public/`)

```
Avions/          — 4 GLB (blanc, bleu, jaune, rouge)
Village/         — bâtiments villages
Village defense/ — tank, truck, mitrailleuse AA
Arbres/ Buissons/— végétation instanciée (LOD)
Missiles/        — modèles missiles AA et AG
Montagnes/ Montgolfières/ Mode libre/ — props décoratifs
sfx/             — fichiers WAV pour AudioManager
SK_Veh_Plane_Stunt_01.glb — modèle avion générique (joueurs distants multijoueur)
```

## Modes de jeu

`config.mode` dans `Game.js` :

| Mode | Description |
|------|-------------|
| `freeflight` | Vol libre, 5 IA |
| `solo` | Mission solo, 10 IA |
| `coop` | Coopératif, 12 IA |
| `multiplayer` | Lobbys WebSocket, 0 IA |
| `ffa` / `tdm` | Free-for-all / Team deathmatch, 0 IA |
| `survival` | Vagues d'ennemis croissantes |

## Règles impératives

### i18n — OBLIGATOIRE
- **Tout texte visible par l'utilisateur DOIT passer par `t('clé')`** — jamais de string FR ou EN hardcodée dans JS/HTML
- Si une clé n'existe pas, l'ajouter dans **les deux sections** (FR et EN) de `src/i18n.js` avant de l'utiliser
- Exception : commentaires de code, noms de variables, logs console de debug

### Ne pas modifier
- **`CameraController.js`** — version stable, ne pas toucher
- Les axes des bones dans `Player.js` — déterminés par essai/erreur, ne pas reset

# Architecture

## Boucle principale

`main.js` tourne en boucle infinie avec `top-level await`. Chaque itération suit ce pipeline :

```
Menu.show()
  └─ retourne config {mode, team, map, difficulty, pilotName, networkManager?, remotePlayers?}
      │
      ▼
LoadingScreen(label)
      │
      ▼
new Game(container, config)
  └─ constructeur synchrone : renderer, scène, caméra, Player, CameraController,
     BulletManagers, UI, ciel, nuages, lumières, mire, carte (si map 1/4/5)
      │
      ▼
game.preload(onProgress)
  └─ asynchrone : build() de la carte, chargement GLB avions/défenses sol,
     ProgressionSystem, MissileSystem, GroundDefense, MultiplayerManager
      │
      ▼  (multijoueur uniquement)
networkManager.send('player_loaded') + attente 'all_players_loaded' (timeout 12 s)
      │
      ▼
game.start()
  └─ démarre la boucle de rendu (requestAnimationFrame), retourne une Promise
     résolue quand le joueur quitte : { action: 'replay' } ou { action: 'menu' }
      │
      ▼
game.destroy()  →  retour au début de la boucle (ou replay sans menu)
```

## Graphe de dépendances

```
main.js
├── Menu.js
│   ├── ProgressionSystem.js
│   ├── UpgradeTree.js
│   ├── AudioManager.js
│   ├── CursorFX.js
│   └── i18n.js
│
└── Game.js
    ├── Player.js
    │   └── (pas de dépendances src)
    ├── CameraController.js   ← NE PAS MODIFIER
    ├── UI.js
    │   └── ProgressionSystem.js (levelFromTotalXp)
    ├── Bullet.js             (BulletManager + EnemyBulletManager)
    ├── Enemy.js
    ├── MissileSystem.js
    │   └── UpgradeTree.js
    ├── EnemyMissileManager.js
    ├── GroundDefense.js
    ├── MultiplayerManager.js
    ├── NetworkManager.js
    ├── ProgressionSystem.js
    ├── UpgradeTree.js
    ├── AudioManager.js
    ├── MobileControls.js
    ├── PracticeMode.js
    ├── Trail.js
    ├── LODManager.js
    ├── BocageMap.js   ─┐
    ├── CretesMap.js    ├─ toutes importent LODManager + i18n
    ├── NormandyMap.js ─┘
    └── i18n.js
```

## Sélection de carte

`config.map` est un entier passé depuis le menu :

| Valeur | Classe | Terrain |
|--------|--------|---------|
| 1 | `CretesMap` | Montagnes + canyons, 8 000 u |
| 4 | `BocageMap` | Bocage normand, 6 800 u |
| 5 | `NormandyMap` | Côte / débarquement |
| autre | *(inline Game.js)* | Océan + terrain plat généré |

## Contrat d'interface de carte

Chaque classe de carte expose la même interface après `await map.build()` :

```js
const result = await map.build();

result.getTerrainHeight(x, z)   // → number (altitude en unités monde)
result.isOnRunway(x, z)         // → bool (zone de piste atterrissage/décollage)
result.airports                 // → [{ center: Vector3, surfaceY, radius, ang }]

map.getVillageZones()           // → [{ x, z, radius, team:'ally'|'enemy', name }]
map.getAirportZones()           // → [{ x, z, ang, team:'ally'|'enemy' }]
map.updateLOD(camPos, fwdX, fwdZ, ultra)  // appelé chaque frame par Game.js
```

## Rendu

- Un seul renderer `THREE.WebGLRenderer`, antialiasing désactivé sur hardware léger (`hardwareConcurrency ≤ 4` ou `deviceMemory ≤ 4 GB`)
- `pixelRatio` plafonné à 1.0
- Pas de shadow maps
- Tone mapping ACESFilmic (exposure 1.2)
- Caméra principale `near = 1.0` (évite le z-fighting sur les pistes)
- La mire est rendue dans une **scène orthographique séparée** après la scène principale — `renderOrder` garantit qu'elle passe au-dessus des balles

## Patterns récurrents

**Scratch objects** — `Enemy.js` alloue des quaternions/vecteurs en dehors des fonctions hot (`_dQY`, `_dFwd`…) pour éviter le GC par frame.

**Pool de balles** — `BulletManager` réutilise un tableau, pas d'allocation par tir.

**Interpolation réseau** — `MultiplayerManager` maintient un buffer de snapshots par joueur distant et affiche avec 100 ms de retard pour absorber la gigue réseau (Railway gratuit).

**LOD instancié** — `InstancedLOD` warp trois niveaux de détail (`SimplifyModifier`) en `InstancedMesh`. Les cartes appellent `updateLOD()` chaque frame pour choisir le bon niveau selon la distance caméra.

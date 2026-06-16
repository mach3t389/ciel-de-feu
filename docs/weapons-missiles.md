# Armes et missiles

## Canon (`Bullet.js`)

### Constantes

| Constante | Valeur |
|-----------|--------|
| Vitesse | 950 u/s |
| Durée de vie (joueur) | 0.95 s (~900 u de portée) |
| Durée de vie (ennemi) | 0.62 s (~590 u de portée) |
| Géométrie | `CylinderGeometry(0.10, 0.10, 0.9)`, 6 segments |
| Couleur | `0xff3300` (rouge-orangé traceur) |

### BulletManager

```js
manager.fire(position, quaternion, dmg?, ally?)  // spawn une balle
manager.update(delta)                             // avance + expire les balles
manager.getBullets()                              // → tableau de balles actives
manager.dispose()                                 // nettoyage
```

Quatre instances dans Game.js :
- `bulletManager` — balles joueur
- `_enemyBulletManager` — balles ennemis IA
- `_alliedBulletManager` — balles défense sol alliée
- `_remoteBulletManager` — balles joueurs distants (visuel uniquement)

---

## Missiles joueur (`MissileSystem.js`)

### Constantes

| Constante | Valeur |
|-----------|--------|
| `MISSILE_SPEED` | 340 u/s |
| `LOCK_CONE_COS` | 0.65 (≈ cône de 49° demi-angle) |
| `LOCK_RANGE` | 2 500 u |
| `DAMAGE_DIRECT` | 70 HP (base, modifiable via upgrades) |
| `SPLASH_RADIUS` | 22 u |
| `SPLASH_DMG_PCTG` | 0.30 (30% des dégâts directs) |
| `DECOY_EFFECT` | 0.75 (75% d'efficacité du leurre) |
| `HIT_RADIUS` | 18 u (rayon de détection d'impact) |

### Niveaux de guidage (`trackingLevel`)

| Niveau | Vitesse virage | Durée de piste bonus | Comportement |
|--------|---------------|---------------------|--------------|
| 0 | 6 rad/s | 0 s | Standard |
| 1 | 13 rad/s | +2.5 s | Plus agile |
| 2 | 18 rad/s | +4.0 s | Ré-engage une fois |
| 3 | 22 rad/s | +6.0 s | Ré-engage toujours, piste serrée |

### Initialisation

`MissileSystem` est créé dans `Game._startGame()` et configuré via les upgrades actifs :

```js
const ms = new MissileSystem(scene, audioManager);
ms.setParams(missileParams(upgradeIds));  // lock, track, dual, hasAA, hasAG, damage
ms.setTerrainHeightFn(getTerrainHeight);
ms.friendlyFire = false;

// Attacher les missiles visuels aux ailes
ms.attachWingMissiles(player.model, upgradeIds, totalCount);
ms.attachDecoyPods(player.model, decoyCount);
```

### API de tir

```js
ms.fire(playerPivot)        // → bool (succès ou non)
ms.deployDecoy(playerPivot) // → décoy actif (objet)
```

### Callbacks

```js
ms.onHit = (target, damage) => { /* infliger dégâts */ }
ms.onLockStart    = (target) => { ui.showLockIndicator() }
ms.onLockComplete = (target) => { ui.showLockFull() }
ms.onLockLost     = ()       => { ui.hideLockIndicator() }
```

### Getters

```js
ms.lockProgress         // 0-1
ms.lockTarget           // Enemy | null
ms.isLocked             // bool
ms.missilesRemainingAA  // nombre de missiles AA restants
ms.missilesRemainingAG  // nombre de missiles AG restants
```

### Prestige Arsenal

Avec le skill prestige `arsenal`, `_arsenalMult = 2` : chaque slot visuel compte pour 2 missiles. La réserve effective est doublée sans ajouter de modèles visuels supplémentaires sous les ailes.

---

## Missiles ennemis (`EnemyMissileManager.js`)

Gère les missiles tirés par les ennemis IA vers le joueur. Entièrement distinct de `MissileSystem`.

- Vitesse : 190 u/s
- Rayon d'impact : 18 u
- Peut être déjoué par les leurres du joueur

Chaque ennemi avec `missileCooldown > 0` peut lock et tirer via `_updateMissileLock()`. Le lock-on ennemi déclenche `startMissileAlarm()` dans `AudioManager` et l'alerte HUD.

---

## Défense active (`UpgradeTree.js` + `UI.js`)

La défense active est configurée via le slot équipement, pas via des upgrades individuels. `activeDefenseParams(loadout)` retourne la config complète.

### Types disponibles

| Type | Effet en jeu | Durée | Cooldown |
|------|-------------|-------|---------|
| `ecm` | Annule le lock-on ennemi | 3 s | 20 s |
| `shield_front` | Réduit les dégâts frontaux | variable | variable |
| `shield_rear` | Réduit les dégâts arrière | variable | variable |
| `shield_full` | Protection omnidirectionnelle | variable | variable |
| `leurres` | Déjoue les missiles guidés | N charges | par charge |

Les leurres sont comptés en charges (affichées dans `_drawCounterBox`). Les boucliers et ECM ont un cooldown affiché dans `setActiveDefenseStatus()`.

---

## Défense sol (`GroundDefense.js`)

### Unités

| Type | HP | Rôle |
|------|----|------|
| Tank | 120 | Résistant, tire sur le joueur |
| Truck | 60 | Léger, transport |
| Mitrailleuse AA (MG) | 80 | Tire sur avions, portée 900 u |

### Mitrailleuse AA

| Paramètre | Valeur |
|-----------|--------|
| Portée | 900 u |
| Dégâts par balle | 5 HP |
| Cadence | 1 rafale / 0.7 s |
| Balles par rafale | 3 |
| Intervalle intra-rafale | 0.09 s |
| Altitude minimale cible | 25 m |
| Dispersion | 0.14 rad (× facteur distance) |

### Respawn allié

Les unités alliées détruites réapparaissent après `ALLY_RESPAWN_CD = 45 s`.

### Initialisation

```js
// Dans preload() :
const models = await GroundDefense.preloadModels();

// Dans _startGame() :
const gd = new GroundDefense(scene, getTerrainHeight);
await gd.build(
  map.getVillageZones(),   // [{ x, z, team, name }]
  map.getAirportZones(),   // [{ x, z, ang, team }]
  models,
  decorative,              // true = props passifs (practice mode)
  buildingPositions,       // positions des bâtiments pour éviter les collisions
);
```

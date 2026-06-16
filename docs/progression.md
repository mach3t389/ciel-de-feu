# Système de progression

## Vue d'ensemble

Persistance via `localStorage` (clé `cielDeFeu_progression`). Le joueur a un niveau global, des crédits, et trois slots d'avions indépendants chacun avec leurs propres upgrades et loadout.

## XP et niveaux

- **Niveau max** : 50
- **Formule** : `xpToNextLevel(n) = 1000 + (n - 1) × 200`
  - Niveau 2 : 1 000 XP
  - Niveau 10 : 2 800 XP
  - Niveau 50 : Infinity (cap)
- XP total cumulé pour atteindre le niveau N : somme des paliers 1→N-1

**Fonctions utilitaires** (`ProgressionSystem.js`) :

```js
xpToNextLevel(level)           // XP requis pour le prochain niveau
totalXpForLevel(n)             // XP total cumulé pour atteindre le niveau n
levelFromTotalXp(totalXp)      // → { level, xpInLevel }
```

## Crédits et récompenses

Calculés par `calcRewards(result)` à la fin de chaque partie selon : kills, victoire, difficulté, mode, vague survie atteinte. Retourne `{ xp, credits }`.

## Trois slots d'avions

Chaque slot est indépendant :

```js
{
  name: 'AVION 1',              // personnalisable
  color: 'blanc' | 'bleu' | 'rouge' | 'jaune',
  upgrades: { [upgradeId]: true },
  loadout: { [slotKey]: optionId },
}
```

`activePlane` (0-2) détermine quel slot est utilisé en jeu.

## Prestige

Quatre compétences permanentes achetées une fois (non liées à un slot) :

| Clé | Effet |
|-----|-------|
| `arsenal` | Chaque slot visuel missile = 2 charges (double la réserve) |
| `cellule` | +5 HP permanents |
| `moteur` | +10% vitesse permanente |
| `souffle` | 1× par partie : survit à un coup fatal avec 1 HP |

---

## Arbre d'upgrades (`UpgradeTree.js`)

### Catégories

| `cat` | Description |
|-------|-------------|
| `aviation` | Moteurs, réservoirs, ailes |
| `armement` | Munitions, cadence, missiles, ogives, guidage |
| `defense` | Blindage, résistances, structures |
| `logistics` | Réparation, réarmement, ravitaillement |
| `utility` | Radar, leurres, caméra queue |
| `propulsion` | Turbo, filtres altitude |

### Stats de base (`BASE_STATS`)

Toutes les stats sont sur une échelle 0-100, les upgrades sont additives.

```js
{
  health: 100, speed: 100, maneuverability: 100,
  weaponry: 100, defense: 100, logistics: 100,
  load: 0, fuel: 100, ammo: 100,
  accel: 100, fireRate: 100, rollSpeed: 100,
  missiles: 0, decoys: 0,
}
```

### Structure d'un upgrade

```js
{
  id: 'missile_aa',
  cat: 'armement',
  name: 'Missile air-air',       // affiché dans le menu
  levelReq: 15,                  // niveau minimum pour acheter
  cost: 10000,                   // en crédits
  requires: null,                // ou 'autre_upgrade_id' (dépendance)
  stats: { weaponry: +20, maneuverability: -6, speed: -4, fuel: -10, logistics: -6, load: +20 },
  desc: '...',                   // texte explicatif

  // Effets spéciaux (optionnels) :
  grantsMissiles: 2,             // ajoute N missiles à la réserve
  missileType: 'aa' | 'ag',     // type de missile accordé
  grantsDecoys: 2,               // ajoute N leurres
  trackingLevel: 0 | 1 | 2 | 3, // niveau de guidage missile
  grantsTailCam: true,           // débloque la caméra arrière
  repairSpeed: 0.20,             // réduit le temps de réparation de 20%
  rearmSpeed: 0.20,              // réarmement canon
  refuelSpeed: 0.20,             // ravitaillement
  resistTurrets: 0.15,           // réduction dégâts tourelles AA -15%
  resistPlanes: 0.15,            // réduction dégâts avions -15%
  collisionDmgMult: 0.50,        // dégâts collision × 0.50
  rollSpeed: 0.25,               // bonus vitesse de roulis
  radarRange: 0.25,              // +25% portée radar
}
```

### Fonctions exportées

```js
computeStats(upgradeIds)
// → objet stats final (BASE_STATS + additives de tous les upgrades actifs)

loadModifiers(load)
// → { accel, maneuverability, speed } multiplicateurs selon la charge totale

missileParams(upgradeIds)
// → { lockTime, trackTime, dual, hasAA, hasAG, trackingLevel, damage }

serviceTimeMult(upgradeIds)
// → { repair, rearm, refuel } multiplicateurs de temps de service

activeDefenseParams(loadout)
// → { type, decoys, ecmDuration, ecmCooldown, shieldReduction, ... } ou null

missileLoadPenalties(upgradeIds)
// → { speedDelta, maneuverDelta } pénalités de charge missiles

interleaveSlots(aaCount, agCount)
// → { aaSlots, agSlots } indices de positionnement sous les ailes

loadoutToUpgradeIds(loadout)
// → string[] liste des upgrade IDs actifs depuis un loadout
```

---

## Système d'équipement (`EQUIPMENT_CATALOG`)

En parallèle des upgrades classiques, le système d'équipement organise les choix par **slot** avec des **options** mutuellement exclusives. Chaque option peut activer plusieurs upgrades à la fois et a un coût indépendant (`OPTION_COSTS`).

```js
EQUIPMENT_CATALOG = {
  [catKey]: {
    label: string,
    icon: string,
    slots: {
      [slotKey]: {
        label: string,
        options: [{
          id: string,
          name: string,
          icon: string,
          levelReq: number,
          pros: string[],
          cons: string[],
          upgrades: string[],   // upgrade IDs activés par cette option
        }]
      }
    }
  }
}
```

`DEFAULT_LOADOUT` définit les valeurs par défaut de chaque slot.

---

## Statistiques trackées

```js
stats: {
  totalKills, totalDeaths, totalGames,
  flightTimeSec, distanceKm,
  mission : { maxDiff, maxKills, victories, timeSec },
  survival: { bestWave, maxDiff, timeSec },
  versus  : { wins, losses, kills, deaths },
  teams   : { wins, losses, kills, deaths, assists },
}
```

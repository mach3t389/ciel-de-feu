# Cartes

## Vue d'ensemble

| ID | Fichier | Taille | Segments | Villages | Canyons |
|----|---------|--------|----------|----------|---------|
| 1 | `CretesMap.js` | 8 000 u | 280×280 | 4 | 2 |
| 4 | `BocageMap.js` | 6 800 u | 170×170 | 3 | — |
| 5 | `NormandyMap.js` | variable | 220×220 | 4 | — |

## Génération du terrain

Toutes les cartes utilisent le même pipeline de génération :

1. **fBm** (8 octaves, value noise) — relief général
2. **Micro-relief** (4 octaves) — texture de surface
3. **Pics gaussiens** (tableau `PEAKS`) — montagnes définies manuellement
4. **Zone plate** (r < ~400) — espace de décollage au spawn
5. **Vertex colors** par altitude + pente (sable, plaine, forêt, roche, neige)

### Tableau PEAKS

Format : `[cx, cz, rayon, hauteur_max]`

```js
// Exemple CretesMap
const PEAKS = [
  [ 1400, -1000, 500, 580],  // grande montagne NE
  [-1500,   600, 340, 1400], // grande montagne NO (face spawn)
  // ...
];
```

La hauteur effective est additionnée au bruit de base avec `gaussianPeak(x, z, cx, cz, r, h)`.

### Seuils de couleur vertex

| Altitude | Couleur |
|----------|---------|
| h < 5 | Sable / berge |
| h < 18 | Plaine verte |
| h < 60 | Forêt |
| h < 140 | Prairie alpine |
| h < 280 | Roche claire |
| h < 480 | Roche sombre |
| h < 600 | Neige légère |
| h ≥ 600 | Neige épaisse |
| pente > 0.68 | Roche (quelle qu'altitude) |

---

## BocageMap (carte 4)

Bocage normand. Trois villages en triangle, deux bases aériennes.

```
Alpha (allié)  — NW  (-650, -250)
Beta  (ennemi) — E   (1050, -800)
Gamma (ennemi) — SE  (250, 2050)
```

- 17 pics (8 grandes montagnes de bord 700-800 m, 3 collines inter-villages, 6 collines décoratives)
- 4 lacs
- 2 aéroports (base Alpha player, base Gamma enemy)
- Végétation instanciée via `InstancedLOD` (arbres, buissons, rochers)

---

## CretesMap (carte 1)

Carte de montagne avec deux **canyons volables**.

```
Base alliée  — OUEST (-2400, 0)
Base ennemie — EST   (+2400, 0)
```

### Canyons

```js
const CANYON_DEFS = [
  { pts: CANYON_MAIN,   halfW: 90, blend: 65 },  // corridor base→base
  { pts: CANYON_BRANCH, halfW: 62, blend: 45 },  // branche vers Sudvil
];
```

Le canyon est creusé dans `getH()` via une fonction point-segment `segD()` et un `smoothstep` avec `halfW` (demi-largeur du fond plat) et `blend` (zone de transition). Le plancher est à altitude `CANYON_FLOOR = 28`.

**CANYON_MAIN** : 10 waypoints, base alliée → base ennemie (non-linéaire, méandres).

**CANYON_BRANCH** : 7 waypoints, débranchement à (-1300, -350) vers le village Sudvil (100, 2400). Plus étroit et sinueux que le principal.

Villages : Sudvil (allié), + 3 villages ennemis distribués sur la carte.

---

## NormandyMap (carte 5)

Côte normande, inspiration Débarquement. Villages avec noms historiques.

```js
const DISPLAY = {
  'sainte-mere-eglise': t('villageSteMere'),   // 'Ste-Mère'
  arromanches: t('villageArro'),
  bayeux:      t('villageBayeux'),
  falaise:     t('villageFalaise'),
};
```

Les villages sont identifiés par un champ `id` (slug), pas par index. `getVillageZones()` fait la traduction `id → nom affiché` via `t()`.

---

## Ajouter une nouvelle carte

1. Créer `src/MonMap.js` en copiant la structure d'une carte existante
2. Exporter une classe avec :
   - `async build()` → retourne `{ getTerrainHeight, isOnRunway, airports }`
   - `getVillageZones()` → `[{ x, z, radius, team, name }]`
   - `getAirportZones()` → `[{ x, z, ang, team }]`
   - `updateLOD(camPos, fwdX, fwdZ, ultra)` (si végétation instanciée)
3. Dans `Game.js`, ajouter le cas dans le bloc `if (config.map === ...)` du constructeur
4. Dans `Menu.js`, ajouter la carte dans le tableau `MAPS` avec ses métadonnées
5. Dans `i18n.js`, ajouter `mapName_X`, `mapShort_X`, `mapDesc_X` (FR + EN)

## Lacs

Les lacs sont des `CircleGeometry` planes à `lh + 1.0` avec `renderOrder = 1` pour passer au-dessus du terrain. Format `[cx, cz, rayon, niveau_eau]`.

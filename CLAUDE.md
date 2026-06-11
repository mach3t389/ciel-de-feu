# Jeu Avion — Contexte du projet

## Stack & démarrage
- **Vite + Three.js** (ES modules)
- `npm run dev` → http://localhost:3000
- Pas de TypeScript, pas de framework UI

## Structure des fichiers
```
src/
  main.js          — point d'entrée, instancie Game et appelle start()
  Game.js          — scène Three.js, boucle de rendu, terrain, eau, nuages, ciel, mire
  Player.js        — physique de vol, input clavier, animation des bones, carburant/munitions
  CameraController.js — caméra 3ème personne (NE PAS MODIFIER — version stable)
  UI.js            — HUD canvas/HTML style WW2 cockpit
  Bullet.js        — gestion des projectiles
public/
  SK_Veh_Plane_Stunt_01.glb  — modèle avion Skeletal Mesh (Unreal Engine export)
```

## Contrôles
| Touche | Action |
|--------|--------|
| Shift | Accélérer |
| W / S | Monter / Descendre |
| A / D | Virer gauche / droite |
| Espace | Tirer |

## Physique (Player.js)
- Vitesse : MIN 20, MAX 120 km/h, accél 20/s, drag 3/s
- Altitude max : **1000 m** (plafond bloquant)
- Carburant : 100→0, drain 0.4/s + 0.93/s avec Shift — moteur coupe si vide
- Munitions : **200** rounds, -1 par tir, tir bloqué si vide
- Santé : 100 HP, -50 HP par contact sol (cooldown 0.3s)
- Mort → isDead = true → écran CRASH + bouton réapparaître
- Bones animés : hélice, ailerons, gouverne, queue, flaps (cascade)
- Vibration moteur : oscillation subtile sur model.position (intensity ∝ speed)

## Getters exposés par Player
```js
player.speed      // km/h
player.altitude   // mètres
player.heading    // degrés 0-360 (0=Nord, 90=Est)
player.fuel       // 0-100
player.ammo       // 0-200
player.health     // 0-100
player.isDead     // bool
player.position   // THREE.Vector3
player.quaternion // THREE.Quaternion
```

## HUD (UI.js) — style cockpit WW2, Courier New, palette crème #d4c88a
| Élément | Position | Description |
|---------|----------|-------------|
| Cadran vitesse | Bas-gauche | 0-120 km/h, aiguille animée, zones colorées |
| Cadran altitude | Bas-droite | 0-1000 m, aiguille animée |
| Ruban de cap | Bas-centre | N/NE/E/SE/S/SO/O/NO, défile en continu |
| Cadran carburant | Centre-bas gauche | E-¼-½-¾-F, icône jerrycan |
| Cadran dommages | Centre-bas droite | OK-DMG-CRIT, icône clé plate |
| Compteur munitions | Haut-droite | 3 chiffres mécaniques, rouge si < 20 |
| Mire | Centre écran | Sprite Three.js orthographique (AU-DESSUS des balles) |
| Aide touches | Haut-gauche | Panel semi-transparent |

**Important** : la mire est un `THREE.Sprite` rendu dans une scène orthographique séparée après la scène principale — elle s'affiche toujours par-dessus les balles.

## Scène 3D (Game.js)

### Terrain
- `BufferGeometry` custom, **260×260 segments**, 12 000 unités de large
- Height : fBm 8 octaves (value noise) + micro-relief 4 octaves + pics gaussiens
- Zone plate autour origine (r < 400) pour décollage
- **Vertex colors** par altitude :
  - h < 5 : sable/berge
  - h < 18 : plaine verte
  - h < 60 : forêt
  - h < 140 : prairie alpine
  - h < 280 : roche claire
  - h < 480 : roche sombre
  - h < 600 : neige légère
  - h ≥ 600 : neige épaisse
  - pente > 0.68 : roche (quelle qu'altitude)

### Pics montagneux (PEAKS)
```js
[ 1600, -1200, 1500, 700]  // GRANDE montagne principale (~1500m)
[ 2400, -1800,  750, 500]
[-2800,  2000,  820, 480]
[ 1600,  3200,  680, 440]
```

### Lacs (12 lacs, surfaces planes MeshLambertMaterial bleu)
- Format `[cx, cz, rayon, niveau_eau]`
- Lac principal : `[650, -550, 340, 4]` — visible depuis le spawn
- Lacs alpins jusqu'à h=125, grands lacs de plaine h=4-8
- Surface plane `CircleGeometry` à `lh + 1.0` avec `renderOrder = 1`

### Nuages (30 formations)
- Clusters d'`IcosahedronGeometry(r, 1)` avec `flatShading: true`
- 6-12 blobs par formation, blobs core + satellites
- Altitude 440-700 m, semi-transparents

### Ciel
- `SphereGeometry(4000)` BackSide, suit `camera.position` chaque frame (pas de bulle noire)
- Fog : `THREE.Fog(0x7aa0c8, 800, 4500)`

### Balles
- `CylinderGeometry(0.10, 0.10, 0.9)` couleur `0xff3300` (rouge-orangé traceur)
- Vitesse 950 unités/s, durée de vie 2.5s
- Rendu SOUS la mire (mire = sprite orthographique)

## Règles importantes
- **Ne pas toucher à CameraController.js** — version stable validée
- Les axes des bones ont été déterminés par essai/erreur — ne pas reset
- Pas de traînée complexe (physique simplifiée intentionnelle)
- Pas de commentaires sauf si WHY non-évident

## Règle i18n — OBLIGATOIRE
- **Tout texte visible par l'utilisateur DOIT passer par `t('clé')`** — jamais de string FR ou EN hardcodée dans le JS/HTML
- Si une clé n'existe pas encore, l'ajouter dans les deux sections (FR et EN) de `src/i18n.js` avant de l'utiliser
- Exception autorisée : commentaires de code, noms de variables/fonctions, logs console de debug

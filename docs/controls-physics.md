# Contrôles et physique

## Physique de vol (`Player.js`)

### Constantes de vitesse

| Constante | Valeur | Description |
|-----------|--------|-------------|
| `ENGINE_CUTOFF` | 14 km/h | En dessous → moteur calé |
| `MIN_SPEED` | 30 km/h | Vitesse de croisière sans gaz |
| `MAX_SPEED` | 120 km/h | Plafond |
| `ACCEL` | 10 /s | Accélération avec Shift |
| `DECEL` | 20 /s | Décélération sans gaz |
| `DRAG` | 8 /s | Freinage en vol libre |
| `GROUND_ROLL_DRAG` | 18 /s | Freinage sur piste |
| `SAFE_LANDING_SPEED` | 38 km/h | Atterrissage sur terrain |
| `RUNWAY_LANDING_SPEED` | 50 km/h | Atterrissage sur piste |

### Altitude

| Constante | Valeur |
|-----------|--------|
| `START_ALT` | 400 m |
| `MAX_ALT` | 1 000 m (plafond bloquant) |
| `GROUND_Y` | 1.0 u |

### Carburant et munitions

| Constante | Valeur |
|-----------|--------|
| `MAX_FUEL` | 100 |
| `FUEL_DRAIN` | 0.20 /s (idle) |
| `FUEL_BOOST` | 0.46 /s (par unité de throttle) |
| `MAX_AMMO` | 200 rounds (modifiable via upgrades) |

### Santé et dommages

- Santé de base : 100 HP
- Contact sol : -50 HP par impact (cooldown 0.3 s)
- Mort : `isDead = true` → écran CRASH + bouton réapparaître

### Taux de rotation (mode standard)

| Axe | Valeur |
|-----|--------|
| Pitch max | 0.90 rad/s |
| Roll max | 1.60 rad/s |
| Yaw max | 0.50 rad/s |
| Auto-roll en virage | 1.60 rad/s |
| Auto-yaw en virage | 0.50 rad/s |

### Taux de rotation (mode simulateur)

| Axe | Valeur |
|-----|--------|
| Roll | 1.80 rad/s |
| Pitch | 0.85 rad/s |
| Yaw | 0.70 rad/s |

### Getters exposés par Player

```js
player.speed       // km/h
player.altitude    // mètres
player.heading     // degrés 0-360 (0 = Nord, 90 = Est)
player.fuel        // 0-100
player.ammo        // 0-max
player.health      // 0-100
player.isDead      // bool
player.position    // THREE.Vector3
player.quaternion  // THREE.Quaternion
player.velocity    // THREE.Vector3 (direction × speed)
```

---

## Contrôles clavier

| Touche | Action |
|--------|--------|
| W / S | Monter / Descendre (pitch) |
| A / D | Virer gauche / droite (yaw + auto-roll) |
| Q / E | Rouler gauche / droite (roll pur) |
| Shift | Augmenter les gaz |
| Ctrl | Réduire les gaz |
| Espace | Tirer (canon) |
| F | Tirer missile |
| X | Lancer leurre |
| Esc | Pause / menu |
| Tab (maintenu) | Scoreboard |
| H | Aide / tutoriel |
| F3 | Overlay FPS |

### Rampe d'entrée clavier

- `KEY_RAMP_TIME` = 0.12 s (temps pour atteindre l'entrée maximale)
- `KEY_RAMP_EXP` = 0.7 (exponentiel — réponse rapide au départ)

---

## Contrôles souris

La souris contrôle le pitch et le yaw via un stick virtuel centré.

- `STICK_SENSITIVITY` = 0.0018
- `STICK_DECAY` = 0.08 (retour au centre par frame)
- Clic gauche = tirer
- La souris doit être capturée (Pointer Lock API)

---

## Contrôles gamepad

| Bouton / Axe | Action |
|--------------|--------|
| Stick gauche | Pitch + yaw |
| LB / RB | Roll gauche / droite |
| RT (trigger droit) | Gaz (throttle+) |
| LT (trigger gauche) | Frein (throttle-) |
| Bouton A | Tirer (canon) |
| Bouton X | Tirer missile |
| Bouton B | Lancer leurre |
| Bouton Y | Changer vue caméra |
| Menu | Pause |
| Select | Scoreboard |

- `GAMEPAD_DEADZONE` = 0.10

---

## Contrôles mobiles (`MobileControls.js`)

Joystick virtuel touch (côté gauche : pitch+yaw, côté droit : roll/caméra). Détection mobile : `navigator.maxTouchPoints >= 2`.

Boutons additionnels : Feu, Missile, Leurre, Pause. Support optionnel du gyroscope.

---

## Bones animés

Les axes ont été calibrés par essai/erreur. **Ne pas reset.**

| Bone | Animé par |
|------|-----------|
| `propeller` | Vitesse moteur (RPM) |
| `flapFl01`, `flapFl02` | Aileron gauche |
| `flapFr01`, `flapFr02` | Aileron droit |
| `flapRl01`, `flapRr01` | Stabilisateurs horizontaux |
| `flapTail` | Gouverne de direction |

La vibration moteur est une oscillation subtile sur `model.position`, intensité proportionnelle à la vitesse.

---

## IA ennemie (`Enemy.js`)

### Machine à états

```
PATROL ──(cible détectée)──► FOLLOW ──(en portée)──► ATTACK
   ▲                              │                       │
   └──────(cible perdue)──────────┘◄──(hors portée)───────┘
                                                           │
                                                 (HP < 25%)▼
                                                         FLEE
```

- `ATTACK_ENTER` = 440 u (FOLLOW → ATTACK)
- `ATTACK_EXIT` = 640 u (ATTACK → FOLLOW)
- `FLEE_HP` = 0.25 × HP max

### Niveaux de compétence

| Skill | Détection | Virage | Portée tir | Cône tir | Cadence | Dispersion |
|-------|-----------|--------|------------|----------|---------|------------|
| `rookie` | 1 100 u | 0.55 | 250 u | 58° | 0.85 s | 0.14 rad |
| `regular` | 1 600 u | 0.95 | 320 u | 48° | 0.50 s | 0.075 rad |
| `ace` | 2 200 u | 1.55 | 390 u | 38° | 0.28 s | 0.030 rad |

### Évitement terrain

L'IA échantillonne le terrain à 5 distances devant l'avion (`LOOK_DISTS = [90, 180, 300, 450, 620]`). Si le sol dépasse la marge :

- `CLEARANCE` = 180 m au-dessus du sol → remontée
- `MIN_ALT` = 220 m → plancher absolu
- `STEEP_GAP` = 130 m → dénivellation déclenchant l'évitement latéral

### Options de spawn

```js
{
  role: 'attacker' | 'defender' | 'wingman',
  skill: 'rookie' | 'regular' | 'ace',
  hp: number,
  faction: 'enemy' | 'ally',
  homeZone: { x, z, radius },
  leash: number,       // distance max avant retour forcé à la base
  isHeavy: bool,       // affecte vitesse / modèle / dégâts
  passive: bool,       // sans combat (décoration)
  leader: Enemy,       // référence pour formation wingman
  wingOffset: Vector3, // position relative en formation
  missileCooldown: number,      // intervalle entre missiles
  missileLockTime: number,
  missileTrackQuality: number,
  missileRange: number,
}
```

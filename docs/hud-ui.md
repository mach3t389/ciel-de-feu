# HUD et interface

## Vue d'ensemble

Le HUD est entièrement dessiné en Canvas 2D + éléments HTML superposés. Pas de framework UI. Style cockpit WW2 : fond très sombre, palette crème dorée, police Rajdhani (chiffres) + Courier New (labels).

---

## Palette de couleurs (`C`)

```js
const C = {
  cream    : '#d4c88a',   // texte principal, aiguilles
  dimCream : '#8a8060',   // texte secondaire, labels
  panelDark: '#0a0a06',   // fond des cadrans
  panelMid : '#14120c',   // fond intermédiaire
  bezelHi  : '#6a6050',   // bordure haute (biseauté clair)
  bezelLo  : '#2a2418',   // bordure basse (biseauté sombre)
  zoneGreen: '#2a5a18',   // zone verte (vitesse normale)
  zoneOrange:'#7a4010',   // zone orange (attention)
  zoneRed  : '#6a1010',   // zone rouge (danger)
  needleHi : '#f0e0a0',   // aiguille (clair)
  needleLo : '#a09050',   // aiguille (sombre)
  tickMajor: '#d4c88a',   // graduation principale
  tickMinor: '#4a4030',   // graduation secondaire / texte descriptif
  rivetHi  : '#9a8a60',   // rivet clair
  rivetLo  : '#2a2418',   // rivet sombre
  menuBackdrop: 'rgba(10,11,13,0.66)', // fond overlay (pause, crash, victoire)
};
```

---

## Éléments HUD

| Élément | Position | Notes |
|---------|----------|-------|
| Cadran vitesse | Bas-gauche | 0-120 km/h, aiguille animée, zones colorées |
| Cadran altitude | Bas-gauche (sous vitesse) | 0-1 000 m |
| Ruban de cap | Bas-centre | N/NE/E/SE/S/SO/O/NO, défile |
| Cadran carburant | Centre-bas gauche | E-¼-½-¾-F, icône jerrycan |
| Cadran dommages | Centre-bas droite | OK / DMG / CRIT, icône clé plate |
| Compteur munitions | Haut-droite | 3 chiffres mécaniques, rouge si < 20 |
| HUD missiles | Bas-centre | Slots AA et AG avec compteurs |
| Défense active | Bas-centre | ECM / Bouclier / Leurres, cooldown |
| Radar | Haut-droite | Cercle 250 px, blips ennemis/alliés |
| Mire | Centre écran | `THREE.Sprite` orthographique — toujours au-dessus des balles |
| Indicateurs villages | Bord d'écran | Cercle rouge + nom village (off-screen) |
| Hit marker | Centre | Flash bref à l'impact |
| Alerte carburant | Bas | Flash rouge si fuel < seuil |
| Alerte santé | Bas | Flash rouge si HP < seuil |
| Alerte missile entrant | Centre-haut | Pulsation rouge, texte d'alarme |
| Compteur de vague | Haut-centre | Mode Survival uniquement |
| Timer | Haut-centre | Modes Versus / Équipes |
| Scoreboard | Overlay | Tab maintenu, ou bouton mobile |
| Pause | Overlay | Esc / bouton gamepad Menu |
| Crash | Overlay | `isDead = true` |
| Victoire / Défaite | Overlay | Fin de partie |

### La mire

La mire est un `THREE.Sprite` rendu dans une **scène orthographique séparée**, après la scène principale. Elle s'affiche donc toujours par-dessus les balles et les objets 3D. La position 2D de la mire est stockée dans `_reticleX`/`_reticleY` et reflète la position du curseur souris ou du stick droit gamepad.

---

## API publique de `UI`

### Callbacks à brancher avant `game.start()`

```js
ui.setRespawnCallback(fn)          // fn() → appelé quand joueur clique "Réapparaître"
ui.setMobileControls(controls)     // pour afficher les boutons tactiles
ui.setBugReportContext(fn)         // fn() → { mode, map, wave }
ui.setAudio(audioManager)
ui.setEndCallbacks({ onMenu, onReplay })
```

### Armes et défenses

```js
ui.setMissileCount(aaRemaining, aaMax, agRemaining, agMax)

// type : 'ecm' | 'shield_front' | 'shield_rear' | 'shield_full' | 'leurres'
ui.setActiveDefenseStatus(type, count, max, cooldownPct, isActive, timeRemaining)
```

### Alertes et notifications

```js
ui.showMissileIncoming()           // alarme missile entrant
ui.hideMissileWarning()
ui.showMissileHit()                // flash impact missile
ui.showPlayerNotice(text, color)   // notification temporaire (ex. kill)
```

### Scoreboard

```js
ui.showScoreboard(visible)
ui.updateScoreboardData(rows)      // rows : [{ name, kills, deaths, team }]
```

### Modes de jeu

```js
ui.setSurvivalMode(true)
ui.setSurvivalWave(waveNumber)

ui.setTDMMode(true, 'rouge' | 'bleu')
ui.setTDMScore(myScore, opponentScore)
```

### Menus overlay

```js
ui.showPause(visible, { onQuit, onResume, onRespawn, survivalMode })
ui.showEscMenu(visible, { onQuit, onRespawn, onClose, onEndGame })
```

---

## Indicateurs de villages (`_drawWorldMarkers`)

Affiche un cercle rouge et le nom du village pour chaque zone ennemie avec des unités sol restantes.

- **On-screen** : cercle rouge + nom en dessous (8px Courier New, rouge, centré)
- **Off-screen** : repère sur le bord de l'écran + nom à gauche/droite selon le côté

Le nom provient du champ `name` retourné par `map.getVillageZones()`. Toujours en majuscules.

---

## Panneau de défense active (`setActiveDefenseStatus`)

Canvas 95×70 px (desktop), 70×52 px (mobile). Affiche :

1. **Label** du type de défense (9px Rajdhani)
2. **Description spécifique** au type (7px Rajdhani, couleur `tickMinor`)
3. **État** : ACTIF / RECHARGE / PRÊT (13px bold, couleur dynamique)
4. **Temps restant** en secondes (si actif ou en recharge)
5. **Barre de cooldown** en bas (si en recharge)

Descriptions par type :

| Type | Clé i18n |
|------|----------|
| `ecm` | `adDescEcm` |
| `shield_front` | `adDescShieldFront` |
| `shield_rear` | `adDescShieldRear` |
| `shield_full` | `adDescShield360` |
| `leurres` | `adDescLeurres` |

---

## Compteur réutilisable (`_drawCounterBox`)

```js
_drawCounterBox(canvas, label, count, max, valColor, symFull, symEmpty, desc = '')
```

- Fond sombre + bordure biseautée
- Label en haut, description optionnelle en dessous
- Icônes au centre (symboles pleins/vides selon `count`/`max`, max 8 affichés)
- Chiffre `count` en bas en gras

---

## Règle i18n — OBLIGATOIRE

**Tout texte visible par l'utilisateur doit passer par `t('clé')`.**

Jamais de string FR ou EN hardcodée dans le JS ou le HTML. Si une clé n'existe pas encore :
1. L'ajouter dans la section **FR** de `src/i18n.js`
2. L'ajouter dans la section **EN** de `src/i18n.js`
3. Utiliser `t('nouvelle_clé')` dans le code

Exception autorisée : commentaires de code, noms de variables/fonctions, logs console de debug.

### Fonctions i18n disponibles

```js
import { t, tTips, tModeInfo, tModeBullets, tCtrlKb, tCtrlGp, tCtrlLines, tCtrlBindings,
         getLang, setLang, tEquip } from './i18n.js';

t('clé')           // traduction simple
tTips()            // tableau de tips (langue courante)
tCtrlLines()       // lignes de contrôle pour le tutoriel
tCtrlBindings()    // bindings clavier pour affichage
getLang()          // 'fr' | 'en'
setLang('en')      // persiste en localStorage
```

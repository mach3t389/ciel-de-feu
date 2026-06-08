// ── Internationalisation — FR / EN ─────────────────────────────────────────
const LANGS = {
  fr: {
    // ── Menu principal ───────────────────────────────────────────────────────
    squadron    : 'ESCADRILLE · 1940',
    tagline     : 'TON JEU DE COMBAT AÉRIEN THREE.JS FAVORI',
    solo        : 'SOLO',
    multi       : 'MULTIJOUEUR',
    settings    : 'PARAMÈTRES',
    mouseHint   : 'DÉPLACEZ LA SOURIS POUR PILOTER',
    credit      : 'UN JEU PAR ALEXIS MOREL',

    // ── Solo ─────────────────────────────────────────────────────────────────
    training    : 'ENTRAÎNEMENT',
    trainingDesc: 'Vol libre · IAs passives · Exploration',
    mission     : 'MISSION',
    missionDesc : 'Vagues ennemies · Objectif principal',
    survival    : 'SURVIE',
    survivalDesc: 'Vagues infinies · Score croissant',
    back        : '← RETOUR',

    // ── Config ───────────────────────────────────────────────────────────────
    pilotName   : 'NOM DU PILOTE',
    pilotPlaceh : 'ENTREZ VOTRE NOM',
    plane       : 'AVION',
    difficulty  : 'DIFFICULTÉ',
    easy        : 'FACILE',
    standard    : 'STANDARD',
    hard        : 'DIFFICILE',
    easyDesc    : 'Ennemis 60 HP · réactivité réduite',
    standardDesc: 'Ennemis 100 HP · difficulté standard',
    hardDesc    : 'Ennemis 160 HP · pilotes expérimentés',
    enemyCount  : 'EFFECTIF ENNEMI — TOTAL MISSION',
    maxPlayers  : 'MAX JOUEURS',
    friendlyFire: 'TIR ALLIÉ',
    map         : 'CARTE',
    takeoff     : '✈  DÉCOLLER',
    openLobby   : '✈  OUVRIR LE LOBBY',

    // ── Couleurs avion ───────────────────────────────────────────────────────
    color_rouge : 'ROUGE',
    color_bleu  : 'BLEU',
    color_jaune : 'JAUNE',
    color_blanc : 'BLANC',

    // ── Terminologie uniforme ────────────────────────────────────────────────
    eliminations: 'ÉLIMINATIONS',
    morts       : 'MORTS',
    waves       : 'VAGUES',
    victory     : 'VICTOIRE',
    defeat      : 'DÉFAITE',

    // ── Score cumulé ─────────────────────────────────────────────────────────
    cumulScore  : 'SCORE CUMULÉ — TOUTES PARTIES',
    cumulKills  : '✈ ÉLIMINATIONS',
    cumulDeaths : '✖ MORTS',

    // ── Multijoueur ──────────────────────────────────────────────────────────
    host        : 'HÉBERGER',
    join        : 'REJOINDRE',
    joinCode    : 'CODE DE PARTIE',
    joinBtn     : '✈  REJOINDRE',
    roomCode    : 'CODE :',
    players     : 'JOUEURS',
    mapLabel    : 'CARTE :',

    // ── Héberger / Rejoindre ─────────────────────────────────────────────────
    nameRequired : 'NOM REQUIS',
    invalidCode  : 'CODE INVALIDE (4 CAR.)',
    copyCode     : 'Copier le code',

    // ── Lobby buttons ─────────────────────────────────────────────────────────
    lobbyQuit    : '← QUITTER',
    lobbyReady   : '□ JE SUIS PRÊT',
    lobbyReadyCancel: '■ ANNULER',
    lobbyStart   : 'LANCER LA PARTIE ▶',
    ffaTimeLimit : 'LIMITE DE TEMPS',
    ffaTime5     : '5 MIN',
    ffaTime10    : '10 MIN',
    ffaTime15    : '15 MIN',
    ffaTime20    : '20 MIN',
    ffaTimeUnlim : 'ILLIMITÉ',

    // ── Lobby ────────────────────────────────────────────────────────────────
    lobby        : 'LOBBY',
    gameMode     : 'MODE DE JEU',
    aiDiff       : 'DIFFICULTÉ IA',
    team         : 'ÉQUIPE',
    team1Label   : 'ÉQUIPE 1',
    team2Label   : 'ÉQUIPE 2',
    team1Short   : 'ÉQ.1',
    team2Short   : 'ÉQ.2',
    myTeamLabel  : 'NOTRE ÉQUIPE',
    oppTeamLabel : 'ADVERSAIRES',
    disabled     : 'DÉSACTIVÉ',
    enabled      : 'ACTIVÉ',
    hostOnly     : "Seul l'hôte peut modifier la configuration de partie.",
    mTraining    : 'ENTRAÎN.',
    mMission     : 'MISSION',
    mSurvival    : 'SURVIE',
    mFFA         : 'VERSUS',
    mTDM         : 'ÉQUIPES',
    waveNote     : 'Max 15 actifs simultanément — renforts par vagues de 5',

    // ── Alertes HUD ──────────────────────────────────────────────────────────
    alertFuel   : '⚠ CARBURANT FAIBLE',
    alertHealth : '⚠ ÉTAT CRITIQUE',

    // ── Statistiques détaillées ───────────────────────────────────────────────
    gamesPlayed    : 'PARTIES JOUÉES',
    flightTime     : 'TEMPS DE VOL',
    bestWave       : 'MEILLEURE VAGUE',
    statsSolo      : 'SOLO',
    statsMulti     : 'MULTI',
    statsSurvival  : 'SURVIE',
    // Stat contextuelles par mode/carte
    mapRecord      : 'RECORD — CETTE CARTE',
    highestDiff    : 'DIFFICULTÉ MAX',
    mostEnemies    : 'MAX ENNEMIS ÉLIMINÉS',
    bestScore      : 'MEILLEUR SCORE',
    mostEliminations: 'MAX ÉLIMINATIONS',
    trainingModeLabel: 'MODE ENTRAÎNEMENT',
    trainingModeHint : 'Aucun objectif · Vol libre',
    noRecord       : 'AUCUN RECORD',
    diffCompleted  : 'COMPLÉTÉE',
    // Noms des cartes (écran de chargement + boutons menu)
    mapName_1  : 'CRÊTES SAUVAGES',
    mapName_2  : 'SOMMETS GLACÉS',
    mapName_3  : 'PLAINE EN FEU',
    mapName_4  : 'BOCAGE',
    mapName_5  : 'NORMANDIE — CIEL DE FEU',
    mapName_99 : 'NOUVELLE CARTE',
    // Abréviations pour les boutons de sélection de carte (espace limité)
    mapShort_1  : 'CRÊTES',
    mapShort_4  : 'BOCAGE',
    mapShort_5  : 'NORMANDIE',
    // Chargement
    loading           : 'CHARGEMENT EN COURS',
    waitingForPlayers : 'EN ATTENTE DES AUTRES JOUEURS...',

    // ── Paramètres ───────────────────────────────────────────────────────────
    stats       : 'STATISTIQUES',
    kills       : 'ÉLIMINATIONS',
    deaths      : 'MORTS',
    audio       : 'AUDIO',
    musicVol    : 'MUSIQUE MENU',
    sfxVol      : 'EFFETS SONORES',
    xboxCtrl    : 'MANETTE XBOX — CONTRÔLES',
    kbCtrl      : 'CLAVIER — CONTRÔLES',
    resetStats  : 'RÉINITIALISER STATS',
    lang        : 'LANGUE',
    langFR      : 'FRANÇAIS',
    langEN      : 'ENGLISH',
    ctrlMode    : 'MODE DE CONTRÔLE',
    ctrlStd     : 'STANDARD',
    ctrlSim     : 'SIMULATEUR',
    ctrlStdDesc : 'Virage coordonné auto · Style GTA V · Réactivité arcade',
    ctrlSimDesc : 'Roulis pur · Souris = roulis · A/D = gouvernail · Style Battlefield',

    // ── Astuces ──────────────────────────────────────────────────────────────
    tipsTitle   : '— ASTUCE —',
    tips: [
      { icon: '🎮', text: 'Utilise un contrôleur Xbox · Stick G = diriger, RT/LT = gaz' },
      { icon: '⛽', text: 'Surveille ton carburant · Atterris pour faire le plein' },
      { icon: '🖱',  text: 'Souris = orienter · Shift = accélérer · Clic G = tirer' },
      { icon: '🔄', text: 'Q/E ou LB/RB · Effectue des tonneaux et acrobaties' },
      { icon: '🎯', text: 'Vise en avance sur les ennemis · Compense leur vitesse' },
      { icon: '📷', text: 'Stick D ou V · Vue libre sans changer de cap' },
      { icon: '⚠️', text: 'Munitions vides ? · Reviens à la base pour ravitailler' },
    ],

    // ── Fin de partie ────────────────────────────────────────────────────────
    mainMenu    : '↩  MENU PRINCIPAL',
    retry       : '⟳  REJOUER',

    // ── HUD en jeu ───────────────────────────────────────────────────────────
    pauseTitle    : 'PAUSE',
    resume        : '▶  REPRENDRE',
    respawnBtn    : '↺  RÉAPPARAÎTRE',
    settingsBtn   : '⚙  PARAMÈTRES',
    endGameBtn    : '✗  FIN DE PARTIE',
    gameInProgress: '[ EN COURS ]',
    gameGoesOn    : 'La partie continue pendant votre absence',
    speedLabel    : 'VITESSE',
    altLabel      : 'ALTITUDE',
    radarLabel    : 'RADAR',
    ammoLabel     : 'MUNITIONS',
    engineOff     : '⚠ MOTEUR COUPÉ',
    engineLanded  : 'POSÉ — SHIFT pour décoller',
    helpHint      : '[H] AIDE',
    controlsTitle : 'CONTRÔLES',
    ctrlLines: [
      '— CONTRÔLES —',
      'Souris — Diriger (haut/bas/gauche/droite)',
      'Shift — Augmenter les gaz',
      'Ctrl — Réduire les gaz (0 % = moteur coupé)',
      'Q / E — Roll gauche / droite',
      'A / D — Gouvernail gauche / droite',
      'W / S — Piquer / Cabrer',
      'Clic gauche / Espace — Tirer',
      'V (maintenir) — Vue libre (souris = orbite caméra)',
      'R (maintenir) — Vue arrière',
      'C — Changer de caméra',
      'Échap — Pause',
      '— DEBUG —',
      'F3 — Afficher/masquer les stats de performance',
      'F4 — Activer/désactiver le mode Low Graphics',
      'I  — Debug IA (états des ennemis)',
    ],
    missionRemaining: 'AVIONS REST.',
    missionActive   : 'EN VOL',
    missionTurrets  : 'TOURELLES',
    missionArmor    : 'VÉHICULES',
    victoryTitle  : 'MISSION RÉUSSIE',
    victoryZone   : '✦  ZONE SÉCURISÉE  ✦',
    missionResults: 'RÉSULTATS DE MISSION',
    crashTitle    : 'CRASH',
    crashSub      : 'APPAREIL DÉTRUIT',
    gameOver      : 'FIN DE PARTIE',
    gameDone      : 'PARTIE TERMINÉE',
    survivalResults: 'RÉSULTATS',
    wavesCleared  : 'VAGUES TERMINÉES',
    nextWaveIn      : 'PROCHAINE VAGUE DANS',
    waveLabel       : 'VAGUE',
    enemies         : 'ENNEMIS',
    enemy           : 'ENNEMI',
    spectatorMode   : 'MODE SPECTATEUR',
    respawnNextWave : 'RÉAPPARAÎTRE À LA PROCHAINE MANCHE',
  },

  en: {
    // ── Main menu ────────────────────────────────────────────────────────────
    squadron    : 'SQUADRON · 1940',
    tagline     : 'YOUR FAVORITE THREE.JS AERIAL COMBAT GAME',
    solo        : 'SOLO',
    multi       : 'MULTIPLAYER',
    settings    : 'SETTINGS',
    mouseHint   : 'MOVE THE MOUSE TO FLY',
    credit      : 'A GAME BY ALEXIS MOREL',

    // ── Solo ─────────────────────────────────────────────────────────────────
    training    : 'TRAINING',
    trainingDesc: 'Free flight · Passive AIs · Exploration',
    mission     : 'MISSION',
    missionDesc : 'Enemy waves · Main objective',
    survival    : 'SURVIVAL',
    survivalDesc: 'Endless waves · Rising score',
    back        : '← BACK',

    // ── Config ───────────────────────────────────────────────────────────────
    pilotName   : 'PILOT NAME',
    pilotPlaceh : 'ENTER YOUR NAME',
    plane       : 'AIRCRAFT',
    difficulty  : 'DIFFICULTY',
    easy        : 'EASY',
    standard    : 'STANDARD',
    hard        : 'HARD',
    easyDesc    : '60 HP enemies · reduced reactivity',
    standardDesc: '100 HP enemies · standard difficulty',
    hardDesc    : '160 HP enemies · veteran pilots',
    enemyCount  : 'ENEMY COUNT — TOTAL MISSION',
    maxPlayers  : 'MAX PLAYERS',
    friendlyFire: 'FRIENDLY FIRE',
    map         : 'MAP',
    takeoff     : '✈  TAKE OFF',
    openLobby   : '✈  OPEN LOBBY',

    // ── Aircraft colours ─────────────────────────────────────────────────────
    color_rouge : 'RED',
    color_bleu  : 'BLUE',
    color_jaune : 'YELLOW',
    color_blanc : 'WHITE',

    // ── Unified terminology ───────────────────────────────────────────────────
    eliminations: 'ELIMINATIONS',
    morts       : 'DEATHS',
    waves       : 'WAVES',
    victory     : 'VICTORY',
    defeat      : 'DEFEAT',

    // ── Cumulative score ─────────────────────────────────────────────────────
    cumulScore  : 'CUMULATIVE SCORE — ALL GAMES',
    cumulKills  : '✈ ELIMINATIONS',
    cumulDeaths : '✖ DEATHS',

    // ── Multiplayer ──────────────────────────────────────────────────────────
    host        : 'HOST',
    join        : 'JOIN',
    joinCode    : 'GAME CODE',
    joinBtn     : '✈  JOIN',
    roomCode    : 'CODE:',
    players     : 'PLAYERS',
    mapLabel    : 'MAP:',

    // ── Host / Join ──────────────────────────────────────────────────────────
    nameRequired : 'NAME REQUIRED',
    invalidCode  : 'INVALID CODE (4 CHARS)',
    copyCode     : 'Copy code',

    // ── Lobby buttons ─────────────────────────────────────────────────────────
    lobbyQuit    : '← QUIT',
    lobbyReady   : '□ READY',
    lobbyReadyCancel: '■ CANCEL',
    lobbyStart   : 'START GAME ▶',
    ffaTimeLimit : 'TIME LIMIT',
    ffaTime5     : '5 MIN',
    ffaTime10    : '10 MIN',
    ffaTime15    : '15 MIN',
    ffaTime20    : '20 MIN',
    ffaTimeUnlim : 'UNLIMITED',

    // ── Lobby ────────────────────────────────────────────────────────────────
    lobby        : 'LOBBY',
    gameMode     : 'GAME MODE',
    aiDiff       : 'AI DIFFICULTY',
    team         : 'TEAM',
    team1Label   : 'TEAM 1',
    team2Label   : 'TEAM 2',
    team1Short   : 'T.1',
    team2Short   : 'T.2',
    myTeamLabel  : 'OUR TEAM',
    oppTeamLabel : 'OPPONENTS',
    disabled     : 'DISABLED',
    enabled      : 'ENABLED',
    hostOnly     : 'Only the host can change game settings.',
    mTraining    : 'TRAINING',
    mMission     : 'MISSION',
    mSurvival    : 'SURVIVAL',
    mFFA         : 'VERSUS',
    mTDM         : 'TEAMS',
    waveNote     : 'Max 15 active at once — reinforcements in waves of 5',

    // ── HUD alerts ───────────────────────────────────────────────────────────
    alertFuel   : '⚠ LOW FUEL',
    alertHealth : '⚠ CRITICAL DAMAGE',

    // ── Detailed statistics ───────────────────────────────────────────────────
    gamesPlayed    : 'GAMES PLAYED',
    flightTime     : 'FLIGHT TIME',
    bestWave       : 'BEST WAVE',
    statsSolo      : 'SOLO',
    statsMulti     : 'MULTI',
    statsSurvival  : 'SURVIVAL',
    // Contextual stats per mode/map
    mapRecord      : 'RECORD — THIS MAP',
    highestDiff    : 'HIGHEST DIFFICULTY',
    mostEnemies    : 'MOST ENEMIES DEFEATED',
    bestScore      : 'BEST SCORE',
    mostEliminations: 'MOST ELIMINATIONS',
    trainingModeLabel: 'TRAINING MODE',
    trainingModeHint : 'No objective · Free flight',
    noRecord       : 'NO RECORD YET',
    diffCompleted  : 'COMPLETED',
    // Map names (loading screen + menu buttons)
    mapName_1  : 'WILD RIDGES',
    mapName_2  : 'FROZEN PEAKS',
    mapName_3  : 'PLAINS OF FIRE',
    mapName_4  : 'BOCAGE',
    mapName_5  : 'NORMANDY — SKIES OF FIRE',
    mapName_99 : 'NEW MAP',
    // Short labels for map selection buttons (limited space)
    mapShort_1  : 'WILD RIDGES',
    mapShort_4  : 'BOCAGE',
    mapShort_5  : 'NORMANDY',
    // Loading
    loading           : 'LOADING',
    waitingForPlayers : 'WAITING FOR OTHER PLAYERS...',

    // ── Settings ─────────────────────────────────────────────────────────────
    stats       : 'STATISTICS',
    kills       : 'ELIMINATIONS',
    deaths      : 'DEATHS',
    audio       : 'AUDIO',
    musicVol    : 'MENU MUSIC',
    sfxVol      : 'SOUND EFFECTS',
    xboxCtrl    : 'XBOX CONTROLLER — CONTROLS',
    kbCtrl      : 'KEYBOARD — CONTROLS',
    resetStats  : 'RESET STATS',
    lang        : 'LANGUAGE',
    langFR      : 'FRANÇAIS',
    langEN      : 'ENGLISH',
    ctrlMode    : 'CONTROL MODE',
    ctrlStd     : 'STANDARD',
    ctrlSim     : 'SIMULATOR',
    ctrlStdDesc : 'Auto-coordinated turns · GTA V style · Arcade reactivity',
    ctrlSimDesc : 'Pure roll · Mouse = roll · A/D = rudder · Battlefield style',

    // ── Tips ─────────────────────────────────────────────────────────────────
    tipsTitle   : '— TIP —',
    tips: [
      { icon: '🎮', text: 'Use an Xbox controller · Left stick = steer, RT/LT = throttle' },
      { icon: '⛽', text: 'Watch your fuel gauge · Land to refuel at a base' },
      { icon: '🖱',  text: 'Mouse = aim · Shift = accelerate · Left click = fire' },
      { icon: '🔄', text: 'Q/E or LB/RB · Perform rolls and aerobatics' },
      { icon: '🎯', text: 'Lead your shots · Aim ahead to hit fast enemies' },
      { icon: '📷', text: 'Right stick or V · Free look without changing course' },
      { icon: '⚠️', text: 'Out of ammo? · Return to base to resupply' },
    ],

    // ── End screen ───────────────────────────────────────────────────────────
    mainMenu    : '↩  MAIN MENU',
    retry       : '⟳  PLAY AGAIN',

    // ── In-game HUD ──────────────────────────────────────────────────────────
    pauseTitle    : 'PAUSE',
    resume        : '▶  RESUME',
    respawnBtn    : '↺  RESPAWN',
    settingsBtn   : '⚙  SETTINGS',
    endGameBtn    : '✗  END GAME',
    gameInProgress: '[ IN PROGRESS ]',
    gameGoesOn    : 'The game continues while you are away',
    speedLabel    : 'SPEED',
    altLabel      : 'ALTITUDE',
    radarLabel    : 'RADAR',
    ammoLabel     : 'AMMO',
    engineOff     : '⚠ ENGINE OFF',
    engineLanded  : 'LANDED — SHIFT to take off',
    helpHint      : '[H] HELP',
    controlsTitle : 'CONTROLS',
    ctrlLines: [
      '— CONTROLS —',
      'Mouse — Steer (pitch / roll / yaw)',
      'Shift — Increase throttle',
      'Ctrl — Decrease throttle (0% = engine off)',
      'Q / E — Roll left / right',
      'A / D — Rudder left / right',
      'W / S — Pitch down / up',
      'Left click / Space — Fire',
      'V (hold) — Free look (mouse = camera orbit)',
      'R (hold) — Look back',
      'C — Change camera',
      'Escape — Pause',
      '— DEBUG —',
      'F3 — Show/hide performance overlay',
      'F4 — Toggle Low Graphics mode',
      'I  — AI debug overlay (enemy states)',
    ],
    missionRemaining: 'AIRCRAFT',
    missionActive   : 'IN FLIGHT',
    missionTurrets  : 'TURRETS',
    missionArmor    : 'VEHICLES',
    victoryTitle  : 'MISSION COMPLETE',
    victoryZone   : '✦  AREA SECURED  ✦',
    missionResults: 'MISSION RESULTS',
    crashTitle    : 'CRASH',
    crashSub      : 'AIRCRAFT DESTROYED',
    gameOver      : 'GAME OVER',
    gameDone      : 'GAME ENDED',
    survivalResults: 'RESULTS',
    wavesCleared  : 'WAVES CLEARED',
    nextWaveIn      : 'NEXT WAVE IN',
    waveLabel       : 'WAVE',
    enemies         : 'ENEMIES',
    enemy           : 'ENEMY',
    spectatorMode   : 'SPECTATOR MODE',
    respawnNextWave : 'RESPAWN AT NEXT WAVE',
  },
};

export function getLang() {
  return localStorage.getItem('lang') || 'fr';
}

export function setLang(code) {
  localStorage.setItem('lang', code);
}

export function t(key) {
  const lang = getLang();
  return LANGS[lang]?.[key] ?? LANGS.fr[key] ?? key;
}

export function tTips() {
  const lang = getLang();
  return LANGS[lang]?.tips ?? LANGS.fr.tips;
}

export function tCtrlLines() {
  const lang = getLang();
  return LANGS[lang]?.ctrlLines ?? LANGS.fr.ctrlLines;
}

const MODE_INFO_LANGS = {
  fr: {
    freeflight: { title: 'ENTRAÎNEMENT', lines: ['VOL LIBRE EN SOLO OU ENTRE AMIS.', '5 AVIONS IA PASSIFS PRÉSENTS', 'COMME CIBLES D\'ENTRAÎNEMENT.', 'AUCUN OBJECTIF — EXPLORATION LIBRE.', 'MANŒUVRES ET PERFECTIONNEMENT.', 'RÉAPPARITION ILLIMITÉE, SANS PÉNALITÉ.'] },
    survival:   { title: 'MODE SURVIE',  lines: ['VAGUES INFINIES D\'ENNEMIS IA.', 'CHAQUE VAGUE : PLUS D\'ENNEMIS,', 'DIFFICULTÉ ET HP CROISSANTS.', 'SCORE = VAGUES SURVIVÉES + KILLS.', 'LA PARTIE SE TERMINE À LA MORT.', 'CLASSEMENT AFFICHÉ EN FIN DE PARTIE.'] },
    coop:       { title: 'MISSION',      lines: ['L\'ÉQUIPE S\'UNIT CONTRE DES VAGUES', 'D\'ENNEMIS CONTRÔLÉS PAR L\'IA.', 'TOURELLES ET VÉHICULES AU SOL.', 'DIFFICULTÉ RÉGLABLE CI-DESSOUS.', 'VICTOIRE : ÉLIMINER TOUTES LES VAGUES.', 'RÉAPPARITION À L\'AÉROPORT ALLIÉ.'] },
    ffa:        { title: 'VERSUS — LIBRE POUR TOUS', lines: ['CHACUN POUR SOI — AUCUN ALLIÉ.', 'PAS D\'IA, PAS DE TOURELLES AU SOL.', 'ENNEMIS DISPERSÉS SUR TOUTE LA CARTE.', 'SCORE INDIVIDUEL PAR ÉLIMINATION.', 'CARBURANT ET MUNITIONS LIMITÉS.', 'DERNIER SURVIVANT GAGNE LA MANCHE.'] },
    tdm:        { title: 'MATCH D\'ÉQUIPES', lines: ['DEUX ÉQUIPES S\'AFFRONTENT EN AIR.', 'ÉQUIPE 1 → AÉROPORT ALPHA (N-O).', 'ÉQUIPE 2 → AÉROPORT GAMMA (S-E).', 'TIR ALLIÉ CONFIGURABLE.', 'RAVITAILLEMENT À SA BASE UNIQUEMENT.', 'VICTOIRE : SCORE D\'ÉQUIPE CUMULÉ.'] },
  },
  en: {
    freeflight: { title: 'TRAINING',        lines: ['FREE FLIGHT SOLO OR WITH FRIENDS.', '5 PASSIVE AI PLANES PRESENT', 'AS TRAINING TARGETS.', 'NO OBJECTIVE — FREE EXPLORATION.', 'MANOEUVRES AND SKILL BUILDING.', 'UNLIMITED RESPAWN, NO PENALTY.'] },
    survival:   { title: 'SURVIVAL MODE',   lines: ['ENDLESS WAVES OF AI ENEMIES.', 'EACH WAVE: MORE ENEMIES,', 'RISING DIFFICULTY AND HP.', 'SCORE = WAVES SURVIVED + KILLS.', 'GAME ENDS ON DEATH.', 'LEADERBOARD SHOWN AT END.'] },
    coop:       { title: 'MISSION',         lines: ['TEAM UP AGAINST AI-CONTROLLED', 'ENEMY WAVES.', 'GROUND TURRETS AND VEHICLES.', 'ADJUSTABLE DIFFICULTY BELOW.', 'WIN BY ELIMINATING ALL WAVES.', 'RESPAWN AT ALLIED AIRPORT.'] },
    ffa:        { title: 'VERSUS — FREE FOR ALL', lines: ['EVERY PILOT FOR THEMSELVES.', 'NO AI, NO GROUND TURRETS.', 'ENEMIES SPREAD ACROSS THE MAP.', 'INDIVIDUAL SCORE PER KILL.', 'LIMITED FUEL AND AMMO.', 'LAST SURVIVOR WINS THE ROUND.'] },
    tdm:        { title: 'TEAM DEATHMATCH', lines: ['TWO TEAMS CLASH IN THE AIR.', 'TEAM 1 → ALPHA AIRPORT (NW).', 'TEAM 2 → GAMMA AIRPORT (SE).', 'CONFIGURABLE FRIENDLY FIRE.', 'RESUPPLY AT YOUR OWN BASE ONLY.', 'WIN BY CUMULATIVE TEAM SCORE.'] },
  },
};

export function tModeInfo(mode) {
  const lang = getLang();
  const map  = MODE_INFO_LANGS[lang] ?? MODE_INFO_LANGS.fr;
  return map[mode] ?? map.coop;
}

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
    expertDesc  : 'Ennemis 200 HP · réflexes maximaux · récompenses ×3',
    descriptif  : 'DESCRIPTIF',
    enemyCount  : 'EFFECTIF ENNEMI — TOTAL MISSION',
    tdmAiCount  : 'AVIONS IA PAR ÉQUIPE',
    tdmAiNone   : 'AUCUN',
    ffaBotCount : 'BOTS IA — VERSUS',
    ffaBotNone  : 'AUCUN',
    ffaBotDiff  : 'DIFFICULTÉ DES BOTS',
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
    mobileCtrl   : 'TACTILE',
    mobileTip    : 'Disponible automatiquement sur appareil tactile',
    mobileJoy    : 'Joystick gauche',
    mobileJoyDesc: 'Diriger l\'avion (tangage + virage)',
    mobileFire   : 'Bouton Tir',
    mobileFireDesc: 'Maintenir pour tirer en continu',
    mobileThrLbl : 'GAZ',
    mobileThr    : 'Bouton Gaz',
    mobileThrDesc: 'Maintenir pour accélérer (≡ Shift)',
    mobileMiss   : 'Bouton Missile',
    mobileMissDesc: 'Tirer un missile guidé (≡ F)',
    mobileDecoy  : 'Bouton Leurre',
    mobileDecoyDesc: 'Larguer un leurre (≡ X)',
    mobilePause     : 'Bouton Pause',
    mobilePauseDesc : 'Ouvrir le menu pause (≡ Échap)',
    mobileCtrlMode  : 'MODE DE CONTRÔLE',
    mobileJoystick  : 'JOYSTICK',
    mobileGyro      : 'GYROSCOPE',
    gyroCalibrate   : 'RECALIBRER',
    gyroCalibrateDesc: 'Tiens le téléphone en position de vol, puis appuie.',
    gyroSensitivity : 'SENSIBILITÉ',
    gyroPermDenied  : 'Permission refusée — active le gyroscope dans les réglages.',
    gyroNotSupported: 'Gyroscope non disponible sur cet appareil.',
    gyroActive      : 'Gyroscope actif',

    // ── Alertes HUD ──────────────────────────────────────────────────────────
    alertFuel            : '⚠ CARBURANT FAIBLE',
    alertHealth          : '⚠ ÉTAT CRITIQUE',
    alertMissileLock     : '⚠ VERROUILLAGE MISSILE',
    alertMissileIncoming : '⚠ MISSILE ENTRANT',

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
    // Descriptions de cartes (écran de sélection)
    mapDesc_1  : ['2 bases · 4 villages · 7 massifs · lacs', 'Altitude max : 900 m · Grande carte'],
    mapDesc_2  : ['Haute altitude · 6 sommets · neige dense', 'Altitude max : 1 800 m'],
    mapDesc_3  : ['Terrain plat · 2 sommets · grands lacs', 'Altitude max : 800 m'],
    mapDesc_4  : ['Villages · ravitaillement · lacs alpins', 'Altitude max : 1 250 m'],
    mapDesc_5  : ['2 îles · La Manche · 4 villages · 2 aéroports', 'Relief doux · Plages · Altitude max : 160 m'],
    mapDesc_99 : ['En développement', 'Bientôt disponible'],
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
    exportSave  : '↓  EXPORTER LA SAUVEGARDE',
    importSave  : '↑  IMPORTER UNE SAUVEGARDE',
    exportDesc  : 'Télécharge un fichier .json contenant toute ta progression.',
    importDesc  : 'Restaure une sauvegarde exportée (remplace la progression actuelle).',
    importSuccess: 'Sauvegarde importée avec succès.',
    importError : 'Fichier invalide — sauvegarde non modifiée.',
    importConfirm: 'Remplacer ta progression actuelle par ce fichier ?',
    lang        : 'LANGUE',
    langFR      : 'FRANÇAIS',
    langEN      : 'ENGLISH',
    graphicsQuality : 'QUALITÉ GRAPHIQUE',
    gfxHigh         : 'HAUTE',
    gfxMed          : 'MOYENNE',
    gfxLow          : 'BASSE',
    gfxHighDesc     : 'Pleine résolution · Nuages · Distance maximale',
    gfxMedDesc      : 'Résolution réduite · Sans nuages · Bonnes performances',
    gfxLowDesc      : 'Résolution minimale · LOD agressif · Performances maximales',
    ctrlMode    : 'MODE DE CONTRÔLE',
    controls    : 'COMMANDES',
    ctrlStd     : 'STANDARD',
    ctrlSim     : 'SIMULATEUR',
    ctrlStdDesc : 'Virage coordonné auto · Style GTA V · Réactivité arcade',
    ctrlSimDesc : 'Roulis pur · Souris = roulis · A/D = gouvernail · Style Battlefield',
    backToSettings : '← PARAMÈTRES',
    lobbyConnecting: 'Connexion...',
    lobbyWaiting   : 'En attente de joueurs...',
    lobbyServerDown: 'Serveur indisponible — hors-ligne',
    lobbyConnected : 'Connecté',
    mapInDev       : 'EN DÉVELOPPEMENT',
    mapComingSoon  : 'BIENTÔT DISPONIBLE',
    cheatLevels    : '+10 NIVEAUX',
    cheatCredits   : '+50 000 CRÉDITS',
    cheatReset     : 'RESET',
    resetConfirm   : 'Réinitialiser toute la progression ?',
    tutHide        : '× Ne plus afficher',
    tutSkip        : '[ ENTRÉE ]  PASSER',
    tutClose       : 'Fermer',

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
    reportBug     : '⚑  SIGNALER UN BUG',
    bugReportTitle: 'SIGNALER UN BUG',
    bugDesc       : 'Description du problème *',
    bugDescPh     : 'Décris ce qui s\'est passé...',
    bugSteps      : 'Comment reproduire (optionnel)',
    bugStepsPh    : 'Étapes pour reproduire le bug...',
    bugSend       : 'ENVOYER',
    bugSending    : 'ENVOI EN COURS...',
    bugSent       : '✓  RAPPORT ENVOYÉ',
    bugError      : '✗  ERREUR — RÉESSAIE',
    bugRequired   : 'La description est obligatoire.',
    bugFieldScreen: '🖥️ Écran',
    endGameBtn    : '✗  FIN DE PARTIE',
    gameInProgress: '[ EN COURS ]',
    gameGoesOn    : 'La partie continue pendant votre absence',
    speedLabel    : 'VITESSE',
    altLabel      : 'ALTITUDE',
    radarLabel    : 'RADAR',
    ammoLabel     : 'MUNITIONS',
    engineOff     : '⚠ MOTEUR COUPÉ',
    engineLanded  : 'POSÉ — SHIFT pour décoller',
    refuelInProgress: '▲ RAVITAILLEMENT EN COURS ▲',
    refuelDone      : '✓ RAVITAILLEMENT TERMINÉ',
    adActive        : 'ACTIF',
    adRecharge      : 'RCH',
    adReady         : 'PRÊT',
    adDefense       : 'DÉFENSE',
    adShieldFront   : 'BOUCL. AV.',
    adShieldRear    : 'BOUCL. AR.',
    adShield360     : 'BOUCL. 360',
    adNone          : 'Aucune',
    adLeurres       : 'Leurres',
    adEcmLabel      : 'ECM',
    adShieldFrontSh : 'Boucl. Av.',
    adShieldRearSh  : 'Boucl. Ar.',
    adShield360Sh   : 'Boucl. 360°',
    ranking         : 'CLASSEMENT',
    roundLabel      : 'MANCHE',
    clickToCapture  : '— CLIQUEZ POUR CAPTURER LA SOURIS —',
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
      'Clic gauche / Espace — Tirer (manette : A)',
      'F — Tirer un missile (manette : X)',
      'X — Déployer un leurre (manette : LB court)',
      'V (maintenir) — Vue libre (clic pour lock souris + bouger)',
      'R (maintenir) — Vue arrière',
      'C — Changer de caméra (poursuite / cockpit / cinématique)',
      'Tab (maintenir) — Tableau des scores (manette : Select)',
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
    bossWarning         : '⚠ L\'ARMÉE ENNEMIE A DÉPLOYÉ UN ADVERSAIRE REDOUTABLE',
    groundReinforcements: '⚠ RENFORTS AU SOL DÉPLOYÉS',
    landingSpeed        : 'APPROCHE AÉROPORT',
    landingSafe         : 'VITESSE OK — ATTERRISSAGE POSSIBLE',
    landingWarn         : 'RÉDUIRE VITESSE — MAX 12 KM/H',
    landingDanger       : 'TROP RAPIDE — RISQUE DE CRASH',
    spectatorMode   : 'MODE SPECTATEUR',
    respawnNextWave : 'RÉAPPARAÎTRE À LA PROCHAINE MANCHE',
    spectatorCycle  : "changer d'allié",
    playerJoinedSuffix : 'a rejoint la partie',
    playerLeftSuffix   : 'a quitté la partie',
    hostLeftNotice     : "L'HÔTE A QUITTÉ — RETOUR À L'ACCUEIL",
    scoreboardTitle    : 'TABLEAU DES SCORES',
    playerCol          : 'JOUEUR',
    elimCol            : 'ÉLIMINATIONS',
    deathCol           : 'MORTS',
    you                : 'VOUS',

    // ── Mon Avion ─────────────────────────────────────────────────────────────
    myPlane        : 'MON AVION',
    levelLabel     : 'NIVEAU',
    creditsLabel   : 'CRÉDITS',
    planeNameLabel : "NOM DE L'AVION",
    buildTypeLabel : "TYPE D'APPAREIL",
    equippedBadge  : '✓ ÉQUIPÉ',
    lockedBadge    : '⊘ VERROUILLÉ',
    buyTitle       : 'ACHETER L\'AMÉLIORATION',
    buyCost        : 'Coût',
    buyHave        : 'Vous avez',
    buyYes         : 'ACHETER',
    buyNo          : 'ANNULER',
    buyNoCredits   : 'CRÉDITS INSUFFISANTS',
    baseConfigDesc : 'Configuration de base — aucun bonus ni malus.',
    closeBtn       : '✕ Fermer',
    newBadge       : 'NOUVEAU',
    newSlotBadge   : '● NOUVEAU',
    baseTier       : 'BASE',
    lvlReqPrefix   : 'NIV.',
    // Types de build (classifyBuild)
    buildMissile       : 'SPÉCIALISTE MISSILES',
    buildMissileSub    : 'Forte puissance de feu guidée',
    buildDefensive     : 'CHASSEUR DÉFENSIF',
    buildDefensiveSub  : 'Blindé et résistant au combat',
    buildHeavy         : 'ATTAQUANT LOURD',
    buildHeavySub      : 'Dégâts élevés, peu agile',
    buildInterceptorL  : 'INTERCEPTEUR LÉGER',
    buildInterceptorLSub: 'Rapide et très maniable',
    buildGeneral       : 'CHASSEUR POLYVALENT',
    buildGeneralSub    : 'Configuration équilibrée',
    // Barres de stats (panneau droit)
    statSpeed      : 'VITESSE',
    statManeuver   : 'MANIABILITÉ',
    statHealth     : 'VIE',
    statWeaponry   : 'ARMEMENT',
    statDefense    : 'DÉFENSE',
    statLogistics  : 'LOGISTIQUE',
    statFuel       : 'CARBURANT',
    statAmmo       : 'MUNITIONS',
    // Descriptions des slots d'équipement
    slotDesc_tank          : "Capacité de carburant. Plus grand = autonomie accrue mais charge et ravitaillement plus longs.",
    slotDesc_engine        : "Puissance moteur : vitesse et accélération. Un moteur lourd consomme davantage.",
    slotDesc_wings         : "Profil des ailes : maniabilité et traînée. Des ailes légères sont plus fragiles.",
    slotDesc_turbo         : "Suralimentation : pointe de vitesse, au prix d'une forte consommation.",
    slotDesc_alt_filter    : "Filtre haute altitude : maintient les performances au-dessus de 500 m.",
    slotDesc_ammo          : "Réserve de munitions embarquée. Plus de balles = plus de charge et réarmement plus long.",
    slotDesc_ap            : "Type de projectile : densité et pouvoir de pénétration des munitions.",
    slotDesc_calibre       : "Diamètre du canon : dégâts par tir contre cadence de tir.",
    slotDesc_firerate      : "Cadence de tir : balles par seconde. Mécanisme plus sollicité.",
    slotDesc_missiles_aa   : "Missiles guidés air-air contre les avions. Lourds et traînants.",
    slotDesc_missiles_ag   : "Missiles lourds air-sol contre tanks et tourelles. Très pénalisants en vol.",
    slotDesc_active_defense: "Système de défense actif exclusif : leurres, brouillage ECM ou bouclier. Un seul type à la fois.",
    slotDesc_decoys        : "Leurres pyrotechniques pour briser le verrouillage des missiles ennemis.",
    slotDesc_armor         : "Plaques de blindage : points de vie. Alourdit fortement l'appareil.",
    slotDesc_resist        : "Revêtements spécialisés : réduction des dégâts selon la menace.",
    slotDesc_structure     : "Structure de l'appareil : résistance mécanique, collisions et explosions.",
    slotDesc_repair        : "Vitesse de réparation au sol. L'outillage embarqué ajoute du poids.",
    slotDesc_rearm         : "Vitesse de réarmement au sol. Mécanismes de chargement plus lourds.",
    slotDesc_refuel        : "Vitesse de ravitaillement au sol. Tuyauterie haute pression embarquée.",
    slotDesc_maintenance   : "Optimise tous les temps de service au sol, mais charge importante.",
    slotDesc_radar         : "Portée de détection des ennemis et systèmes électroniques.",
    slotDesc_roll          : "Vitesse de roulis : rapidité des tonneaux et changements d'assiette.",
    slotDesc_tail_cam      : "Caméra arrière : alerte si un ennemi se place dans votre dos.",
    slotDesc_acquisition   : "Capteur d'acquisition : vitesse de verrouillage des missiles guidés.",
    slotDesc_tracking      : "Système de guidage : précision et portée de suivi des missiles.",

    sectionGlobal  : 'GLOBAL',
    sectionVersus  : 'VERSUS (FFA)',
    sectionTeams   : 'ÉQUIPES (TDM)',
    statLevelLabel : 'NIVEAU',
    statXpTotal    : 'XP TOTAL',
    statCredits    : 'CRÉDITS',
    statKD         : 'RATIO K/D',
    statDistance   : 'DISTANCE (KM)',
    statMaxDiff    : 'DIFFICULTÉ MAX',
    statSurvTime   : 'TEMPS SURVIE TOTAL',
    statVictories  : 'VICTOIRES',
    statMaxKills   : 'MAX KILLS (PARTIE)',
    statTotalTime  : 'TEMPS TOTAL',
    statLosses     : 'DÉFAITES',
    statAssists    : 'ASSISTS',
    statRatio      : 'RATIO',
    diffEasy       : 'FACILE',
    diffNormal     : 'NORMAL',
    diffHard       : 'DIFFICILE',
    diffExpert     : 'EXPERT',

    // ── Récompenses ──────────────────────────────────────────────────────────
    rewardsTitle   : 'RÉCOMPENSES',
    rewardsTotal   : 'TOTAL',
    levelUpLabel   : 'NIVEAU ATTEINT',
    levelShort     : 'NVL',
    rwKills        : 'Éliminations',
    rwVictory      : 'Victoire',
    rwWaves        : 'Vagues',
    rwDeaths       : 'Morts',

    // Tutoriel
    tutControls    : 'SHIFT accélérer  ·  W/S monter/descendre  ·  A/D virer  ·  ESPACE tirer',
    tutShoot       : 'ESPACE pour tirer\nVisez les avions ennemis (rouge)',
    tutLand        : 'Posez-vous sur la piste\npour ravitailler et réparer',

    // ── Survie ───────────────────────────────────────────────────────────────
    freeResupply   : '✦ RAVITAILLEMENT OFFERT',

    // ── Slot description missile_power ────────────────────────────────────────
    slotDesc_missile_power : 'Puissance des ogives missiles : dégâts directs par impact. Plus lourdes à niveau élevé.',

    // ── Prestige ─────────────────────────────────────────────────────────────
    prestigeBtn            : '★ PRESTIGE',
    prestigeTitle          : 'PRESTIGE — NIVEAU 50 ATTEINT',
    prestigeSub            : 'Réinitialisez votre niveau et débloquez un avantage permanent pour toujours.',
    prestigeWarning        : '⚠ Niveau remis à 1, améliorations perdues. Crédits conservés.',
    prestigeNext           : 'VOUS DÉBLOQUEREZ',
    prestigeConfirm        : 'CONFIRMER',
    prestigeCancel         : 'ANNULER',
    prestigeAlready        : '✓ Obtenu',
    prestigeLevel          : 'PRESTIGE',
    prestigeSkillArsenal   : 'ARSENAL ÉTENDU',
    prestigeSkillArsenalD  : 'Chaque slot de missile représente 2 charges — jusqu\'à 12 missiles AA et 12 AG.',
    prestigeSkillCellule   : 'CELLULE RENFORCÉE',
    prestigeSkillCelluleD  : '+5 HP permanents. Résistance accrue de la cellule.',
    prestigeSkillMoteur    : 'MOTEUR DE LÉGENDE',
    prestigeSkillMoteurD   : 'Vitesse maximale +10% en permanence.',
    prestigeSkillSouffle   : 'DERNIER SOUFFLE',
    prestigeSkillSouffleD  : '1× par partie : survivez à un coup fatal avec 1 HP.',
    prestigeSouffleActivated: '⚡ DERNIER SOUFFLE — SURVIE CRITIQUE',
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
    expertDesc  : '200 HP enemies · maximum reflexes · ×3 rewards',
    descriptif  : 'OVERVIEW',
    enemyCount  : 'ENEMY COUNT — TOTAL MISSION',
    tdmAiCount  : 'AI PLANES PER TEAM',
    tdmAiNone   : 'NONE',
    ffaBotCount : 'AI BOTS — VERSUS',
    ffaBotNone  : 'NONE',
    ffaBotDiff  : 'BOT DIFFICULTY',
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
    mobileCtrl   : 'TOUCH',
    mobileTip    : 'Automatically available on touch devices',
    mobileJoy    : 'Left joystick',
    mobileJoyDesc: 'Steer the aircraft (pitch + turn)',
    mobileFire   : 'Fire button',
    mobileFireDesc: 'Hold to fire continuously',
    mobileThrLbl : 'GAS',
    mobileThr    : 'Throttle button',
    mobileThrDesc: 'Hold to accelerate (≡ Shift)',
    mobileMiss   : 'Missile button',
    mobileMissDesc: 'Fire a guided missile (≡ F)',
    mobileDecoy  : 'Decoy button',
    mobileDecoyDesc: 'Deploy a decoy (≡ X)',
    mobilePause     : 'Pause button',
    mobilePauseDesc : 'Open pause menu (≡ Escape)',
    mobileCtrlMode  : 'CONTROL MODE',
    mobileJoystick  : 'JOYSTICK',
    mobileGyro      : 'GYROSCOPE',
    gyroCalibrate   : 'RECALIBRATE',
    gyroCalibrateDesc: 'Hold phone in flight position, then press.',
    gyroSensitivity : 'SENSITIVITY',
    gyroPermDenied  : 'Permission denied — enable gyroscope in device settings.',
    gyroNotSupported: 'Gyroscope not available on this device.',
    gyroActive      : 'Gyroscope active',

    // ── HUD alerts ───────────────────────────────────────────────────────────
    alertFuel            : '⚠ LOW FUEL',
    alertHealth          : '⚠ CRITICAL DAMAGE',
    alertMissileLock     : '⚠ MISSILE LOCK',
    alertMissileIncoming : '⚠ MISSILE INCOMING',

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
    // Map descriptions (selection screen)
    mapDesc_1  : ['2 bases · 4 villages · 7 ranges · lakes', 'Max altitude: 900 m · Large map'],
    mapDesc_2  : ['High altitude · 6 peaks · dense snow', 'Max altitude: 1,800 m'],
    mapDesc_3  : ['Flat terrain · 2 peaks · large lakes', 'Max altitude: 800 m'],
    mapDesc_4  : ['Villages · resupply · alpine lakes', 'Max altitude: 1,250 m'],
    mapDesc_5  : ['2 islands · The Channel · 4 villages · 2 airports', 'Gentle relief · Beaches · Max altitude: 160 m'],
    mapDesc_99 : ['In development', 'Coming soon'],
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
    exportSave  : '↓  EXPORT SAVE',
    importSave  : '↑  IMPORT SAVE',
    exportDesc  : 'Downloads a .json file with your full progression.',
    importDesc  : 'Restores an exported save (replaces current progression).',
    importSuccess: 'Save imported successfully.',
    importError : 'Invalid file — save unchanged.',
    importConfirm: 'Replace your current progression with this file?',
    lang        : 'LANGUAGE',
    langFR      : 'FRANÇAIS',
    langEN      : 'ENGLISH',
    graphicsQuality : 'GRAPHICS QUALITY',
    gfxHigh         : 'HIGH',
    gfxMed          : 'MEDIUM',
    gfxLow          : 'LOW',
    gfxHighDesc     : 'Full resolution · Clouds · Maximum draw distance',
    gfxMedDesc      : 'Reduced resolution · No clouds · Good performance',
    gfxLowDesc      : 'Minimum resolution · Aggressive LOD · Maximum performance',
    ctrlMode    : 'CONTROL MODE',
    controls    : 'CONTROLS',
    ctrlStd     : 'STANDARD',
    ctrlSim     : 'SIMULATOR',
    ctrlStdDesc : 'Auto-coordinated turns · GTA V style · Arcade reactivity',
    ctrlSimDesc : 'Pure roll · Mouse = roll · A/D = rudder · Battlefield style',
    backToSettings : '← SETTINGS',
    lobbyConnecting: 'Connecting...',
    lobbyWaiting   : 'Waiting for players...',
    lobbyServerDown: 'Server unavailable — offline',
    lobbyConnected : 'Connected',
    mapInDev       : 'IN DEVELOPMENT',
    mapComingSoon  : 'COMING SOON',
    cheatLevels    : '+10 LEVELS',
    cheatCredits   : '+50,000 CREDITS',
    cheatReset     : 'RESET',
    resetConfirm   : 'Reset all progression?',
    tutHide        : "× Don't show again",
    tutSkip        : '[ ENTER ]  SKIP',
    tutClose       : 'Close',

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
    reportBug     : '⚑  REPORT A BUG',
    bugReportTitle: 'REPORT A BUG',
    bugDesc       : 'Problem description *',
    bugDescPh     : 'Describe what happened...',
    bugSteps      : 'How to reproduce (optional)',
    bugStepsPh    : 'Steps to reproduce the bug...',
    bugSend       : 'SEND',
    bugSending    : 'SENDING...',
    bugSent       : '✓  REPORT SENT',
    bugError      : '✗  ERROR — TRY AGAIN',
    bugRequired   : 'Description is required.',
    bugFieldScreen: '🖥️ Screen',
    endGameBtn    : '✗  END GAME',
    gameInProgress: '[ IN PROGRESS ]',
    gameGoesOn    : 'The game continues while you are away',
    speedLabel    : 'SPEED',
    altLabel      : 'ALTITUDE',
    radarLabel    : 'RADAR',
    ammoLabel     : 'AMMO',
    engineOff     : '⚠ ENGINE OFF',
    engineLanded  : 'LANDED — SHIFT to take off',
    refuelInProgress: '▲ REFUELING IN PROGRESS ▲',
    refuelDone      : '✓ REFUELING COMPLETE',
    adActive        : 'ON',
    adRecharge      : 'CD',
    adReady         : 'READY',
    adDefense       : 'DEFENSE',
    adShieldFront   : 'FRONT SH.',
    adShieldRear    : 'REAR SH.',
    adShield360     : '360 SH.',
    adNone          : 'None',
    adLeurres       : 'Decoys',
    adEcmLabel      : 'ECM',
    adShieldFrontSh : 'Front Sh.',
    adShieldRearSh  : 'Rear Sh.',
    adShield360Sh   : 'Shield 360°',
    ranking         : 'RANKING',
    roundLabel      : 'ROUND',
    clickToCapture  : '— CLICK TO CAPTURE THE MOUSE —',
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
      'Left click / Space — Fire (gamepad: A)',
      'F — Fire missile (gamepad: X)',
      'X — Deploy decoy (gamepad: LB short)',
      'V (hold) — Free look (click to lock mouse, then move)',
      'R (hold) — Look back',
      'C — Change camera (chase / cockpit / cinematic)',
      'Tab (hold) — Scoreboard (gamepad: Select)',
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
    bossWarning         : '⚠ ENEMY FORCES HAVE DEPLOYED A FORMIDABLE ADVERSARY',
    groundReinforcements: '⚠ GROUND REINFORCEMENTS DEPLOYED',
    landingSpeed        : 'AIRPORT APPROACH',
    landingSafe         : 'SPEED OK — LANDING POSSIBLE',
    landingWarn         : 'REDUCE SPEED — MAX 12 KM/H',
    landingDanger       : 'TOO FAST — CRASH RISK',
    spectatorMode   : 'SPECTATOR MODE',
    respawnNextWave : 'RESPAWN AT NEXT WAVE',
    spectatorCycle  : 'switch ally',
    playerJoinedSuffix : 'joined the game',
    playerLeftSuffix   : 'left the game',
    hostLeftNotice     : 'HOST LEFT — RETURNING TO MENU',
    scoreboardTitle    : 'SCOREBOARD',
    playerCol          : 'PLAYER',
    elimCol            : 'ELIMINATIONS',
    deathCol           : 'DEATHS',
    you                : 'YOU',

    // ── My Aircraft ──────────────────────────────────────────────────────────
    myPlane        : 'MY AIRCRAFT',
    levelLabel     : 'LEVEL',
    creditsLabel   : 'CREDITS',
    planeNameLabel : 'AIRCRAFT NAME',
    buildTypeLabel : 'AIRCRAFT TYPE',
    equippedBadge  : '✓ EQUIPPED',
    lockedBadge    : '⊘ LOCKED',
    buyTitle       : 'BUY UPGRADE',
    buyCost        : 'Cost',
    buyHave        : 'You have',
    buyYes         : 'BUY',
    buyNo          : 'CANCEL',
    buyNoCredits   : 'INSUFFICIENT CREDITS',
    baseConfigDesc : 'Base configuration — no bonuses or penalties.',
    closeBtn       : '✕ Close',
    newBadge       : 'NEW',
    newSlotBadge   : '● NEW',
    baseTier       : 'BASE',
    lvlReqPrefix   : 'LVL.',
    // Build types
    buildMissile       : 'MISSILE SPECIALIST',
    buildMissileSub    : 'High guided firepower',
    buildDefensive     : 'DEFENSIVE FIGHTER',
    buildDefensiveSub  : 'Armoured and resilient in combat',
    buildHeavy         : 'HEAVY ATTACKER',
    buildHeavySub      : 'High damage, low agility',
    buildInterceptorL  : 'LIGHT INTERCEPTOR',
    buildInterceptorLSub: 'Fast and highly manoeuvrable',
    buildGeneral       : 'VERSATILE FIGHTER',
    buildGeneralSub    : 'Balanced configuration',
    // Stat bars (right panel)
    statSpeed      : 'SPEED',
    statManeuver   : 'MANEUVERABILITY',
    statHealth     : 'HEALTH',
    statWeaponry   : 'WEAPONRY',
    statDefense    : 'DEFENSE',
    statLogistics  : 'LOGISTICS',
    statFuel       : 'FUEL',
    statAmmo       : 'AMMO',
    // Equipment slot descriptions
    slotDesc_tank          : 'Fuel capacity. Larger = more range but heavier and slower to refuel.',
    slotDesc_engine        : 'Engine power: speed and acceleration. A heavier engine consumes more fuel.',
    slotDesc_wings         : 'Wing profile: maneuverability and drag. Lighter wings are more fragile.',
    slotDesc_turbo         : 'Supercharger: top speed boost at the cost of high fuel consumption.',
    slotDesc_alt_filter    : 'High-altitude filter: maintains performance above 500 m.',
    slotDesc_ammo          : 'Onboard ammo reserve. More bullets = more weight and longer rearming.',
    slotDesc_ap            : 'Ammunition type: density and armour-piercing power.',
    slotDesc_calibre       : 'Cannon calibre: damage per shot versus fire rate.',
    slotDesc_firerate      : 'Fire rate: bullets per second. Higher wear on mechanisms.',
    slotDesc_missiles_aa   : 'Air-to-air guided missiles against aircraft. Heavy and creates drag.',
    slotDesc_missiles_ag   : 'Heavy air-to-ground missiles against tanks and turrets. Very penalising in flight.',
    slotDesc_active_defense: 'Exclusive active defense system: decoys, ECM jamming, or shield. One type at a time.',
    slotDesc_decoys        : 'Pyrotechnic decoys to break enemy missile locks.',
    slotDesc_armor         : 'Armour plates: hit points. Adds significant weight.',
    slotDesc_resist        : 'Specialised coatings: damage reduction based on threat type.',
    slotDesc_structure     : 'Aircraft structure: mechanical resistance against collisions and explosions.',
    slotDesc_repair        : 'Ground repair speed. Onboard tooling adds weight.',
    slotDesc_rearm         : 'Ground rearming speed. Loading mechanisms are heavier.',
    slotDesc_refuel        : 'Ground refuelling speed. High-pressure plumbing adds weight.',
    slotDesc_maintenance   : 'Optimises all ground service times, but adds significant weight.',
    slotDesc_radar         : 'Enemy detection range and electronic systems.',
    slotDesc_roll          : 'Roll rate: speed of barrel rolls and attitude changes.',
    slotDesc_tail_cam      : 'Rear camera: alerts when an enemy is on your six.',
    slotDesc_acquisition   : 'Acquisition sensor: lock-on speed for guided missiles.',
    slotDesc_tracking      : 'Guidance system: precision and tracking range of missiles.',

    // ── Statistics ────────────────────────────────────────────────────────────
    sectionGlobal  : 'GLOBAL',
    sectionVersus  : 'VERSUS (FFA)',
    sectionTeams   : 'TEAMS (TDM)',
    statLevelLabel : 'LEVEL',
    statXpTotal    : 'TOTAL XP',
    statCredits    : 'CREDITS',
    statKD         : 'K/D RATIO',
    statDistance   : 'DISTANCE (KM)',
    statMaxDiff    : 'MAX DIFFICULTY',
    statSurvTime   : 'TOTAL SURVIVAL TIME',
    statVictories  : 'VICTORIES',
    statMaxKills   : 'MAX KILLS (GAME)',
    statTotalTime  : 'TOTAL TIME',
    statLosses     : 'LOSSES',
    statAssists    : 'ASSISTS',
    statRatio      : 'RATIO',
    diffEasy       : 'EASY',
    diffNormal     : 'NORMAL',
    diffHard       : 'HARD',
    diffExpert     : 'EXPERT',

    // ── Rewards ───────────────────────────────────────────────────────────────
    rewardsTitle   : 'REWARDS',
    rewardsTotal   : 'TOTAL',
    levelUpLabel   : 'LEVEL UP',
    levelShort     : 'LVL',
    rwKills        : 'Eliminations',
    rwVictory      : 'Victory',
    rwWaves        : 'Waves',
    rwDeaths       : 'Deaths',

    // Tutorial
    tutControls    : 'SHIFT throttle  ·  W/S pitch  ·  A/D turn  ·  SPACE fire',
    tutShoot       : 'SPACE to fire\nAim at enemy aircraft (red)',
    tutLand        : 'Land on the runway\nto refuel and repair',

    // ── Survival ─────────────────────────────────────────────────────────────
    freeResupply   : '✦ FREE RESUPPLY',

    // ── Slot description missile_power ────────────────────────────────────────
    slotDesc_missile_power : 'Warhead power: direct damage per impact. Heavier at higher tiers.',

    // ── Prestige ─────────────────────────────────────────────────────────────
    prestigeBtn            : '★ PRESTIGE',
    prestigeTitle          : 'PRESTIGE — LEVEL 50 REACHED',
    prestigeSub            : 'Reset your level and unlock a permanent advantage forever.',
    prestigeWarning        : '⚠ Level resets to 1, upgrades are lost. Credits are kept.',
    prestigeNext           : 'YOU WILL UNLOCK',
    prestigeConfirm        : 'CONFIRM',
    prestigeCancel         : 'CANCEL',
    prestigeAlready        : '✓ Obtained',
    prestigeLevel          : 'PRESTIGE',
    prestigeSkillArsenal   : 'EXTENDED ARSENAL',
    prestigeSkillArsenalD  : 'Each missile slot holds 2 charges — up to 12 AA and 12 AG missiles.',
    prestigeSkillCellule   : 'REINFORCED AIRFRAME',
    prestigeSkillCelluleD  : '+5 permanent HP. Increased structural resistance.',
    prestigeSkillMoteur    : 'LEGENDARY ENGINE',
    prestigeSkillMoteurD   : 'Maximum speed permanently +10%.',
    prestigeSkillSouffle   : 'LAST BREATH',
    prestigeSkillSouffleD  : '1× per game: survive a fatal hit with 1 HP.',
    prestigeSouffleActivated: '⚡ LAST BREATH — CRITICAL SURVIVAL',
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
    freeflight: { title: 'ENTRAÎNEMENT',          lines: ['VOL LIBRE · 5 IA PASSIVES COMME CIBLES.', 'AUCUN OBJECTIF — EXPLORATION LIBRE.', 'RÉAPPARITION ILLIMITÉE, SANS PÉNALITÉ.'] },
    survival:   { title: 'MODE SURVIE',            lines: ['VAGUES INFINIES D\'ENNEMIS IA CROISSANTES.', 'SCORE = VAGUES SURVIVÉES + KILLS.', 'FIN DE PARTIE À LA MORT.'] },
    coop:       { title: 'MISSION CO-OP',          lines: ['L\'ÉQUIPE ÉLIMINE DES VAGUES IA EN COOPÉRATION.', 'TOURELLES · VÉHICULES · DIFFICULTÉ RÉGLABLE.', 'RÉAPPARITION À L\'AÉROPORT ALLIÉ.'] },
    ffa:        { title: 'VERSUS — LIBRE POUR TOUS', lines: ['CHACUN POUR SOI — AUCUN ALLIÉ NI IA.', 'SCORE INDIVIDUEL PAR ÉLIMINATION.', 'CARBURANT ET MUNITIONS LIMITÉS.'] },
    tdm:        { title: 'MATCH D\'ÉQUIPES',       lines: ['DEUX ÉQUIPES · ALPHA (N-O) VS GAMMA (S-E).', 'TIR ALLIÉ CONFIGURABLE · RAVIT. À SA BASE.', 'VICTOIRE : SCORE D\'ÉQUIPE CUMULÉ.'] },
  },
  en: {
    freeflight: { title: 'TRAINING',               lines: ['FREE FLIGHT · 5 PASSIVE AI PLANES AS TARGETS.', 'NO OBJECTIVE — FREE EXPLORATION.', 'UNLIMITED RESPAWN, NO PENALTY.'] },
    survival:   { title: 'SURVIVAL MODE',          lines: ['ENDLESS ESCALATING WAVES OF AI ENEMIES.', 'SCORE = WAVES SURVIVED + KILLS.', 'GAME ENDS ON DEATH.'] },
    coop:       { title: 'CO-OP MISSION',          lines: ['TEAM UP TO ELIMINATE AI ENEMY WAVES.', 'TURRETS · VEHICLES · ADJUSTABLE DIFFICULTY.', 'RESPAWN AT THE ALLIED AIRPORT.'] },
    ffa:        { title: 'VERSUS — FREE FOR ALL',  lines: ['EVERY PILOT FOR THEMSELVES — NO AI.', 'INDIVIDUAL SCORE PER KILL.', 'LIMITED FUEL AND AMMO.'] },
    tdm:        { title: 'TEAM DEATHMATCH',        lines: ['TWO TEAMS · ALPHA (NW) VS GAMMA (SE).', 'CONFIGURABLE FRIENDLY FIRE · RESUPPLY AT OWN BASE.', 'WIN BY CUMULATIVE TEAM SCORE.'] },
  },
};

export function tModeInfo(mode) {
  const lang = getLang();
  const map  = MODE_INFO_LANGS[lang] ?? MODE_INFO_LANGS.fr;
  return map[mode] ?? map.coop;
}

// ── Page commandes : sous-labels des touches clavier + légende manette ───────
const CTRL_KB_LANGS = {
  fr: {
    esc:'PAUSE', tab:'SCORES', shift:'GAZ +', q:'ROLL G', w:'CABRER', e:'ROLL D',
    r:'VUE AR.', f:'MISSILE', g:'LEURRE', h:'AIDE', v:'V.LIBRE', c:'CAMÉRA',
    ctrl:'GAZ −', a:'GOUV G', s:'PIQUER', d:'GOUV D', space:'TIRER',
    simW:'PIQUER', simS:'CABRER', simA:'LACET G', simD:'LACET D',
    noteMouse :'▸  SOURIS — Orienter (haut / bas / gauche / droite)',
    noteClick :"▸  CLIC GAUCHE — Tirer (même effet qu'ESPACE)",
    noteTurbo :'★  TURBO — Bonus passif si installé · Aucune touche requise',
    noteDebug :'▸  F3 / F4 — Statistiques de performance / Low Graphics',
    noteSimRoll :'▸  SOURIS G/D — Roulis gauche / droite',
    noteSimPitch:'▸  SOURIS H/B — Piquer / Cabrer',
  },
  en: {
    esc:'PAUSE', tab:'SCORES', shift:'THR +', q:'ROLL L', w:'PULL UP', e:'ROLL R',
    r:'LOOK BK', f:'MISSILE', g:'DECOY', h:'HELP', v:'FREELOOK', c:'CAMERA',
    ctrl:'THR −', a:'YAW L', s:'DIVE', d:'YAW R', space:'FIRE',
    simW:'DIVE', simS:'PULL UP', simA:'YAW L', simD:'YAW R',
    noteMouse :'▸  MOUSE — Steer (up / down / left / right)',
    noteClick :'▸  LEFT CLICK — Fire (same as SPACE)',
    noteTurbo :'★  TURBO — Passive bonus if installed · No key required',
    noteDebug :'▸  F3 / F4 — Performance overlay / Low Graphics',
    noteSimRoll :'▸  MOUSE L/R — Roll left / right',
    noteSimPitch:'▸  MOUSE U/D — Dive / Pull up',
  },
};

const CTRL_GP_LANGS = {
  fr: [
    ['LT','Réduire les gaz'], ['RT','Augmenter les gaz'],
    ['LB','Roll gauche'], ['RB','Roll droite'],
    ['A','Tirer','#22aa44'], ['X','Missile','#2255cc'],
    ['B','Défense (leurre)','#cc4444'], ['Y','Caméra','yellow'],
    ['L.Stick','Diriger (tangage · lacet)'], ['R.Stick','Vue libre'],
    ['L3','Vue arrière (clic stick G)'],
    ['Select','Tableau des scores'], ['Menu','Pause'],
  ],
  en: [
    ['LT','Decrease throttle'], ['RT','Increase throttle'],
    ['LB','Roll left'], ['RB','Roll right'],
    ['A','Fire','#22aa44'], ['X','Missile','#2255cc'],
    ['B','Defense (decoy)','#cc4444'], ['Y','Camera','yellow'],
    ['L.Stick','Steer (pitch · yaw)'], ['R.Stick','Free look'],
    ['L3','Look back (click left stick)'],
    ['Select','Scoreboard'], ['Menu','Pause'],
  ],
};

export function tCtrlKb() {
  return CTRL_KB_LANGS[getLang()] ?? CTRL_KB_LANGS.fr;
}

export function tCtrlGp() {
  return CTRL_GP_LANGS[getLang()] ?? CTRL_GP_LANGS.fr;
}

// ── Overlay d'aide en jeu (touche H / pause) : table des commandes ───────────
const CTRL_BINDINGS_LANGS = {
  fr: {
    colKb: 'CLAVIER', colGp: 'MANETTE XBOX',
    std: [
      ['Souris', 'Diriger (tangage · roulis coordonné)'],
      ['Shift', 'Augmenter les gaz'],
      ['Ctrl', 'Réduire les gaz  (0 % = moteur coupé)'],
      ['Espace / Clic G', 'Tirer'],
      ['F', 'Missile'],
      ['X', 'Déployer un leurre'],
      ['Q / E', 'Roll gauche / droite'],
      ['A / D', 'Gouvernail G / D'],
      ['W / S', 'Piquer / Cabrer'],
      ['R (maintien)', 'Vue arrière'],
      ['V (maintien)', 'Vue libre'],
      ['C', 'Changer de caméra'],
      ['Tab', 'Tableau des scores'],
      ['Échap', 'Pause'],
    ],
    sim: [
      ['Souris G/D', 'Roulis gauche / droite'],
      ['Souris H/B', 'Piquer / Cabrer'],
      ['Shift', 'Augmenter les gaz'],
      ['Ctrl', 'Réduire les gaz  (0 % = moteur coupé)'],
      ['Espace / Clic G', 'Tirer'],
      ['F', 'Missile'],
      ['X', 'Déployer un leurre'],
      ['Q / E', 'Roll gauche / droite'],
      ['A / D', 'Gouvernail G / D (lacet)'],
      ['W / S', 'Piquer / Cabrer (clavier)'],
      ['R (maintien)', 'Vue arrière'],
      ['V (maintien)', 'Vue libre'],
      ['C', 'Changer de caméra'],
      ['Tab', 'Tableau des scores'],
      ['Échap', 'Pause'],
    ],
    gamepad: [
      ['LT / RT', 'Réduire / augmenter les gaz'],
      ['L.Stick', 'Diriger (tangage · lacet)'],
      ['R.Stick', 'Vue libre'],
      ['A', 'Tirer', '#22aa44'],
      ['X', 'Missile', '#2255cc'],
      ['LB', 'Roll gauche'],
      ['RB', 'Roll droite'],
      ['B', 'Défense (leurre)', '#cc4444'],
      ['Y', 'Changer de caméra', '#ccaa22'],
      ['L3', 'Vue arrière (clic stick G)'],
      ['Select', 'Tableau des scores'],
      ['Menu', 'Pause'],
    ],
  },
  en: {
    colKb: 'KEYBOARD', colGp: 'XBOX CONTROLLER',
    std: [
      ['Mouse', 'Steer (pitch · coordinated roll)'],
      ['Shift', 'Increase throttle'],
      ['Ctrl', 'Decrease throttle (0% = engine off)'],
      ['Space / Left Click', 'Fire'],
      ['F', 'Missile'],
      ['X', 'Deploy a decoy'],
      ['Q / E', 'Roll left / right'],
      ['A / D', 'Rudder L / R'],
      ['W / S', 'Dive / Pull up'],
      ['R (hold)', 'Look back'],
      ['V (hold)', 'Free look'],
      ['C', 'Change camera'],
      ['Tab', 'Scoreboard'],
      ['Esc', 'Pause'],
    ],
    sim: [
      ['Mouse L/R', 'Roll left / right'],
      ['Mouse U/D', 'Dive / Pull up'],
      ['Shift', 'Increase throttle'],
      ['Ctrl', 'Decrease throttle (0% = engine off)'],
      ['Space / Left Click', 'Fire'],
      ['F', 'Missile'],
      ['X', 'Deploy a decoy'],
      ['Q / E', 'Roll left / right'],
      ['A / D', 'Rudder L / R (yaw)'],
      ['W / S', 'Dive / Pull up (keyboard)'],
      ['R (hold)', 'Look back'],
      ['V (hold)', 'Free look'],
      ['C', 'Change camera'],
      ['Tab', 'Scoreboard'],
      ['Esc', 'Pause'],
    ],
    gamepad: [
      ['LT / RT', 'Decrease / increase throttle'],
      ['L.Stick', 'Steer (pitch · yaw)'],
      ['R.Stick', 'Free look'],
      ['A', 'Fire', '#22aa44'],
      ['X', 'Missile', '#2255cc'],
      ['LB', 'Roll left'],
      ['RB', 'Roll right'],
      ['B', 'Defense (decoy)', '#cc4444'],
      ['Y', 'Change camera', '#ccaa22'],
      ['L3', 'Look back (click left stick)'],
      ['Select', 'Scoreboard'],
      ['Menu', 'Pause'],
    ],
  },
};

export function tCtrlBindings() {
  return CTRL_BINDINGS_LANGS[getLang()] ?? CTRL_BINDINGS_LANGS.fr;
}

// ── Traduction du catalogue d'équipement (UpgradeTree) ──────────────────────
// Les labels de catégories/slots et les noms d'options sont traduits par
// correspondance exacte ; les avantages/inconvénients par remplacement de
// mots-clés (le mot français → anglais, en gardant chiffres et symboles).

// Correspondance exacte : labels de catégories, labels de slots, noms d'options
const EQUIP_LABELS_EN = {
  // Catégories
  'PROPULSION':'PROPULSION', 'ARMEMENT':'ARMAMENT', 'DÉFENSE':'DEFENSE',
  'LOGISTIQUE':'LOGISTICS', 'ÉQUIPEMENTS':'EQUIPMENT',
  // Slots
  'RÉSERVOIR':'FUEL TANK', 'MOTEUR':'ENGINE', 'AILES':'WINGS',
  'TURBO':'TURBO', 'FILTRE ALTITUDE':'ALTITUDE FILTER',
  'MUNITIONS':'AMMO', 'TYPE MUNITIONS':'AMMO TYPE', 'CALIBRE':'CALIBER',
  'CADENCE':'FIRE RATE', 'MISSILES AIR-AIR':'AIR-TO-AIR MISSILES',
  'MISSILES AIR-SOL':'AIR-TO-GROUND MISSILES', 'LEURRES':'DECOYS',
  'BLINDAGE':'ARMOR', 'RÉSISTANCE':'RESISTANCE', 'CELLULE':'AIRFRAME',
  'COCKPIT':'COCKPIT', 'RÉPARATION':'REPAIR', 'RÉARMEMENT':'REARM',
  'RAVITAILLEMENT':'REFUEL', 'MAINTENANCE':'MAINTENANCE', 'RADAR':'RADAR',
  'ROULIS':'ROLL', 'FUMIGÈNE':'SMOKE GEN.', 'CAMÉRA ARRIÈRE':'REAR CAMERA',
  // Catégories manquantes
  'MISSILES':'MISSILES', 'CANONS':'CANNONS',
  // Slots manquants
  'MISSILES AA':'AA MISSILES', 'MISSILES AS':'AG MISSILES',
  'DÉFENSE ACTIVE':'ACTIVE DEFENSE', 'GUIDAGE':'GUIDANCE', 'ACQUISITION':'ACQUISITION',
  // Noms d'options — guidage/acquisition
  'Standard':'Standard', 'Agrandi I':'Enlarged I', 'Agrandi II':'Enlarged II',
  'Amélioré I':'Upgraded I', 'Amélioré II':'Upgraded II',
  'Haute Vitesse I':'High Speed I', 'Haute Vitesse II':'High Speed II',
  'Haute Puissance I':'High Power I', 'Haute Puissance II':'High Power II',
  'Allégées I':'Lightweight I', 'Allégées II':'Lightweight II',
  'Guidage I':'Guidance I', 'Guidage II':'Guidance II', 'Guidage IA':'AI Guidance',
  'Senseur I':'Sensor I', 'Senseur II':'Sensor II',
  'Aucun':'None', 'Aucune':'None', 'Installé':'Installed', 'Installée':'Installed',
  '100 rds':'100 rds', '200 rds':'200 rds', '300 rds':'300 rds',
  'Perforantes':'Armor-Piercing', 'Supérieur':'Larger',
  'Améliorée':'Improved', 'Amélioré':'Improved',
  '×2 AA':'×2 AA', '×4 AA':'×4 AA', '×6 AA':'×6 AA',
  '×2 AS':'×2 AG', '×4 AS':'×4 AG', '×6 AS':'×6 AG',
  '×2':'×2', '×4':'×4', '×6':'×6',
  'Léger':'Light', 'Moyen':'Medium', 'Lourd':'Heavy',
  'Anti-Tourelles':'Anti-Turret', 'Anti-Avions':'Anti-Aircraft',
  'Renforcée':'Reinforced', 'Blindé':'Armored',
  'Rapide I':'Fast I', 'Rapide II':'Fast II', 'Avancée':'Advanced',
  // Défense active : leurres, ECM, boucliers
  'Leurres I':'Decoys I', 'Leurres II':'Decoys II', 'Leurres III':'Decoys III',
  'ECM I':'ECM I', 'ECM II':'ECM II', 'ECM III':'ECM III',
  'Boucl. Av. I':'Front Sh. I',  'Boucl. Av. II':'Front Sh. II',  'Boucl. Av. III':'Front Sh. III',
  'Boucl. Ar. I':'Rear Sh. I',   'Boucl. Ar. II':'Rear Sh. II',   'Boucl. Ar. III':'Rear Sh. III',
  'Boucl. 360° I':'360° Sh. I',  'Boucl. 360° II':'360° Sh. II',  'Boucl. 360° III':'360° Sh. III',
  // Noms complets des boucliers (popup d'achat)
  'Bouclier avant I':'Front Shield I',   'Bouclier avant II':'Front Shield II',   'Bouclier avant III':'Front Shield III',
  'Bouclier arrière I':'Rear Shield I',  'Bouclier arrière II':'Rear Shield II',  'Bouclier arrière III':'Rear Shield III',
  'Bouclier 360° I':'360° Shield I',     'Bouclier 360° II':'360° Shield II',     'Bouclier 360° III':'360° Shield III',
};

// Remplacement de phrases/mots (avantages & inconvénients) — ordre = plus long d'abord
const EQUIP_PHRASES_EN = [
  ['Agilité missile +', 'Missile agility +'],
  ['Ré-engage toujours', 'Always re-engages'],
  ['Ré-engage ×', 'Re-engage ×'],
  ['Piste maximale', 'Max. tracking'],
  ['Piste +', 'Tracking +'],
  ['Brouille missiles ennemis', 'Jams enemy missiles'],
  ['Alerte ennemis dans le dos', 'Alerts to threats behind'],
  ['dégâts (tourelles)', 'damage (turrets)'],
  ['dégâts (avions)', 'damage (aircraft)'],
  ['Collision', 'Collision'],
  ['leurres anti-missile', 'anti-missile decoys'],
  ['Brouille lock missile', 'Jams missile lock'],
  ['dégâts frontaux', 'frontal damage'],
  ['dégâts arrière', 'rear damage'],
  ['tous dégâts', 'all damage'],
  ['tous les temps', 'all service times'],
  ['vs tourelles', 'vs turrets'],
  ['vs avions', 'vs aircraft'],
  ['Maniabilité', 'Maneuverability'],
  ['Ravitaillement', 'Refuel'],
  ['Réarmement', 'Rearm'],
  ['Réparation', 'Repair'],
  ['Logistique', 'Logistics'],
  ['Carburant', 'Fuel'],
  ['Armement', 'Armament'],
  ['Munitions', 'Ammo'],
  ['Maniab.', 'Maneuv.'],
  ['Vitesse', 'Speed'],
  ['Défense', 'Defense'],
  ['Cadence', 'Fire rate'],
  ['Dégâts', 'Damage'],
  ['Portée', 'Range'],
  ['Roulis', 'Roll'],
  ['Accél.', 'Accel.'],
  ['Déf.', 'Def.'],
  ['Vie', 'Health'],
  ['leurres', 'decoys'],
  ['leurre', 'decoy'],
];

const MODE_BULLETS_LANGS = {
  fr: {
    freeflight: {
      color  : '#6f9cff',
      bullets: [
        '✈  Vol libre sur toute la carte',
        '◎  Anneaux d\'entraînement à franchir',
        '✦  Cibles au sol destructibles',
        '○  IAs présentes mais passives — ne tirent pas',
        '∞  Aucune limite de temps ni d\'objectif',
      ],
      note: 'Idéal pour apprendre les contrôles et tester tes équipements.',
    },
    solo: {
      color  : '#d4c88a',
      bullets: [
        '✦  Élimine tous les avions ennemis pour gagner',
        '⚙  Défense sol active — tourelles et blindés',
        '↑  Difficulté et nombre d\'ennemis configurables',
        '⊙  Ravitaillement à l\'aéroport allié',
        '★  Récompenses XP & crédits à la victoire',
      ],
      note: 'Objectif clair : zéro ennemi en vol pour remporter la mission.',
    },
    survival: {
      color  : '#ff6b6b',
      bullets: [
        '▲  Vagues ennemies infinies et croissantes',
        '↑  Chaque vague : plus d\'ennemis, plus de PV',
        '⚙  Ennemis au sol réapparaissent toutes les 5 vagues',
        '⊙  Ravitaillement progressif entre les vagues',
        '★  Récompenses par vague complétée',
      ],
      note: 'Tiens le plus longtemps possible. Ton record de vagues est sauvegardé.',
    },
    coop: {
      color  : '#bcdb4f',
      bullets: [
        '✈  Mission coopérative multijoueur',
        '✦  Élimine tous les avions ennemis en équipe',
        '⚙  Défense sol active — tourelles et blindés',
        '⊙  Ravitaillement à l\'aéroport allié',
        '★  Récompenses partagées à la victoire',
      ],
      note: 'Coordonne-toi avec ton équipe pour venir à bout des vagues.',
    },
  },
  en: {
    freeflight: {
      color  : '#6f9cff',
      bullets: [
        '✈  Free flight across the entire map',
        '◎  Training rings to fly through',
        '✦  Destructible ground targets',
        '○  AIs present but passive — they don\'t shoot',
        '∞  No time limit or objective',
      ],
      note: 'Perfect for learning the controls and testing your loadout.',
    },
    solo: {
      color  : '#d4c88a',
      bullets: [
        '✦  Eliminate all enemy aircraft to win',
        '⚙  Active ground defense — turrets and armour',
        '↑  Configurable difficulty and enemy count',
        '⊙  Resupply at the allied airport',
        '★  XP & credit rewards on victory',
      ],
      note: 'Clear objective: zero enemies in the air to complete the mission.',
    },
    survival: {
      color  : '#ff6b6b',
      bullets: [
        '▲  Endless, escalating enemy waves',
        '↑  Each wave: more enemies, more HP',
        '⚙  Ground enemies respawn every 5 waves',
        '⊙  Progressive resupply between waves',
        '★  Rewards for each wave completed',
      ],
      note: 'Survive as long as you can. Your wave record is saved.',
    },
    coop: {
      color  : '#bcdb4f',
      bullets: [
        '✈  Cooperative multiplayer mission',
        '✦  Eliminate all enemy aircraft as a team',
        '⚙  Active ground defense — turrets and armour',
        '⊙  Resupply at the allied airport',
        '★  Shared rewards on victory',
      ],
      note: 'Coordinate with your team to take down every wave.',
    },
  },
};

export function tModeBullets(mode) {
  const lang = getLang();
  const map  = MODE_BULLETS_LANGS[lang] ?? MODE_BULLETS_LANGS.fr;
  return map[mode] ?? null;
}

// Descriptions complètes des améliorations (popup d'achat) — correspondance exacte
const EQUIP_DESC_EN = {
  'Réservoir plus grand : +20% carburant. Charge accrue → moins agile, ravitaillement plus long.':
    'Larger tank: +20% fuel. Heavier → less agile, longer refueling.',
  'Réservoir maximal : +40% carburant total. Appareil nettement plus lourd.':
    'Maximum tank: +40% total fuel. Significantly heavier aircraft.',
  'Moteur suralimenté : plus puissant mais plus lourd, gourmand et complexe à entretenir.':
    'Supercharged engine: more powerful but heavier, thirsty and complex to maintain.',
  'Moteur haute performance : vitesse maximale, forte consommation, entretien lourd.':
    'High-performance engine: top speed, high fuel use, heavy maintenance.',
  'Ailes allégées : moins de traînée, meilleure consommation, structure plus fragile.':
    'Lightweight wings: less drag, better fuel economy, more fragile structure.',
  'Ailes ultra-légères : maniabilité et efficacité maximales.':
    'Ultra-light wings: maximum maneuverability and efficiency.',
  'Commandes de roulis optimisées, entretien légèrement plus complexe.':
    'Optimized roll controls, slightly more complex maintenance.',
  'Chargeur plus grand : 100 → 200 munitions. Charge accrue, réarmement plus long.':
    'Larger magazine: 100 → 200 rounds. Heavier, longer rearming.',
  'Chargeur maximal : 200 → 300 munitions. Appareil sensiblement plus lourd.':
    'Maximum magazine: 200 → 300 rounds. Noticeably heavier aircraft.',
  'Munitions plus denses et lourdes : +15% dégâts, plus lentes à charger.':
    'Denser, heavier rounds: +15% damage, slower to load.',
  'Mécanisme de tir plus rapide — consomme plus, s\'use plus vite, entretien accru.':
    'Faster firing mechanism — uses more ammo, wears faster, more maintenance.',
  '2 missiles guidés air-air haute précision. Guidage avancé : très efficaces contre les cibles aériennes.':
    '2 high-precision air-to-air guided missiles. Advanced guidance: very effective against aerial targets.',
  '2 missiles de plus (×4) + guidage amélioré. Charge supplémentaire sous les ailes.':
    '2 more missiles (×4) + improved guidance. Extra load under the wings.',
  '2 missiles de plus (×6) + guidage avancé. Appareil très chargé.':
    '2 more missiles (×6) + advanced guidance. Heavily loaded aircraft.',
  'Tire 2 missiles simultanément.':
    'Fires 2 missiles simultaneously.',
  '2 missiles lourds anti-sol (tanks, tourelles). Très lourds : forte perte de performances.':
    '2 heavy air-to-ground missiles (tanks, turrets). Very heavy: major performance loss.',
  'Plaques légères : résistance accrue, moteur davantage sollicité.':
    'Light plates: increased durability, more engine strain.',
  'Blindage renforcé : meilleure survie, nettement moins agile et plus gourmand.':
    'Reinforced armor: better survivability, much less agile and thirstier.',
  'Blindage intégral : très résistant mais lourd, lent et coûteux à réparer.':
    'Full armor: very durable but heavy, slow and costly to repair.',
  'Revêtement absorbant anti-éclats : léger surplus de masse, entretien spécialisé.':
    'Anti-shrapnel absorbing coating: slight added mass, specialized maintenance.',
  'Blindage balistique renforcé : protection accrue mais plus lourd.':
    'Reinforced ballistic armor: increased protection but heavier.',
  'Structure renforcée : résistance mécanique +10 HP, dégâts de collision −50%.':
    'Reinforced airframe: mechanical resistance +10 HP, collision damage −50%.',
  'Cockpit blindé : absorbe 10% de tous les dégâts reçus.':
    'Armored cockpit: absorbs 10% of all incoming damage.',
  'Équipe + équipement embarqué : réparation −20%, mais surpoids → −vitesse.':
    'Crew + onboard equipment: repair −20%, but overweight → −speed.',
  'Réparation −40% total. Outillage lourd embarqué.':
    'Repair −40% total. Heavy onboard tooling.',
  'Chargement automatisé : réarmement −20%, mécanismes plus lourds → −maniabilité.':
    'Automated loading: rearm −20%, heavier mechanisms → −maneuverability.',
  'Réarmement −40% total. Systèmes lourds.':
    'Rearm −40% total. Heavy systems.',
  'Conduites haute pression : ravitaillement −20%, tuyauterie embarquée → −maniabilité.':
    'High-pressure lines: refuel −20%, onboard plumbing → −maneuverability.',
  'Ravitaillement −40% total. Système haute capacité.':
    'Refuel −40% total. High-capacity system.',
  '−10% sur tous les temps de service, mais charge importante et forte consommation.':
    '−10% on all service times, but heavy load and high fuel use.',
  'Antenne plus puissante : portée +25%, consomme de l\'énergie électrique.':
    'More powerful antenna: range +25%, draws electrical power.',
  '2 leurres pyrotechniques contre missiles guidés. Lanceurs et cartouches embarqués.':
    '2 pyrotechnic decoys against guided missiles. Onboard launchers and cartridges.',
  'Capacité portée à 4 leurres. Charge pyrotechnique supplémentaire.':
    'Capacity raised to 4 decoys. Extra pyrotechnic load.',
  'Capacité portée à 6 leurres. Soutes à leurres pleines.':
    'Capacity raised to 6 decoys. Full decoy bays.',
  'Suralimentation permanente : vitesse de pointe accrue, mais très gourmand et fragile.':
    'Permanent supercharging: higher top speed, but very thirsty and fragile.',
  'Filtre à air haute altitude : performances maintenues au-delà de 500m.':
    'High-altitude air filter: performance maintained above 500m.',
  'Canon plus large : dégâts massifs, cadence réduite, vibrations accrues.':
    'Larger cannon: massive damage, reduced fire rate, increased vibration.',
  '2 bombes à fragmentation légères : dégâts de zone au sol.':
    '2 light fragmentation bombs: ground area damage.',
  'Bombes perforantes de 500 kg : dégâts extrêmes, rayon d\'explosion large.':
    '500 kg armor-piercing bombs: extreme damage, large blast radius.',
  'Porte les missiles air-sol de ×2 à ×4. Charge très lourde sous les ailes.':
    'Raises air-to-ground missiles from ×2 to ×4. Very heavy load under the wings.',
  'Porte les missiles air-sol de ×4 à ×6. Appareil au maximum de sa charge.':
    'Raises air-to-ground missiles from ×4 to ×6. Aircraft at maximum load.',
  'Missile plus agile (+TURN speed) et piste +1.5s. Ne ré-engage pas si raté.':
    'More agile missile (+TURN speed) and +1.5s tracking. Does not re-engage if missed.',
  'Ré-engage une fois après un miss. Rayon de virage encore amélioré.':
    'Re-engages once after a miss. Turn radius further improved.',
  'Ré-engage toujours. Piste maintenue même si la cible vire serré.':
    'Always re-engages. Tracking held even if the target turns sharply.',
  'Capteur IR amélioré : acquisition de cible 0.4s plus rapide.':
    'Improved IR sensor: target acquisition 0.4s faster.',
  'Capteur haute sensibilité : acquisition 0.7s plus rapide au total.':
    'High-sensitivity sensor: acquisition 0.7s faster in total.',
  'Structure renforcée : −50% dégâts de collision avec le terrain.':
    'Reinforced airframe: −50% terrain collision damage.',
  'Cockpit blindé : −10% tous les dégâts reçus.':
    'Armored cockpit: −10% all incoming damage.',
  'Éjecteur de fumée : brouille le suivi des missiles ennemis.':
    'Smoke ejector: disrupts enemy missile tracking.',
  'Alerte sur le HUD si un ennemi se trouve dans le secteur arrière.':
    'HUD alert if an enemy is in the rear sector.',
  'Brouilleur électronique : interrompt le verrouillage missile ennemi. Actif 3s, recharge 20s.':
    'Electronic jammer: breaks enemy missile lock. Active 3s, recharge 20s.',
  'ECM renforcé : actif 5s, recharge 16s.':
    'Enhanced ECM: active 5s, recharge 16s.',
  'ECM maximal : actif 8s, recharge 12s.':
    'Maximum ECM: active 8s, recharge 12s.',
  'Champ défensif frontal : −30% dégâts reçus de l\'avant. Actif 5s, recharge 25s.':
    'Frontal defensive field: −30% damage taken from the front. Active 5s, recharge 25s.',
  '−45% dégâts frontaux. Actif 6s, recharge 20s.':
    '−45% frontal damage. Active 6s, recharge 20s.',
  '−60% dégâts frontaux. Actif 8s, recharge 15s.':
    '−60% frontal damage. Active 8s, recharge 15s.',
  'Champ défensif arrière : −30% dégâts reçus par l\'arrière. Actif 5s, recharge 25s.':
    'Rear defensive field: −30% damage taken from behind. Active 5s, recharge 25s.',
  '−45% dégâts arrière. Actif 6s, recharge 20s.':
    '−45% rear damage. Active 6s, recharge 20s.',
  '−60% dégâts arrière. Actif 8s, recharge 15s.':
    '−60% rear damage. Active 8s, recharge 15s.',
  'Bouclier omnidirectionnel : −20% tous les dégâts. Actif 4s, recharge 30s. Lourd.':
    'Omnidirectional shield: −20% all damage. Active 4s, recharge 30s. Heavy.',
  '−30% tous les dégâts. Actif 5s, recharge 25s.':
    '−30% all damage. Active 5s, recharge 25s.',
  '−40% tous les dégâts. Actif 7s, recharge 18s.':
    '−40% all damage. Active 7s, recharge 18s.',
  // Moteurs (nouveaux types)
  'Moteur optimisé pour la vitesse de pointe : cylindrée élevée, peu de couple bas régime.':
    'Engine optimized for top speed: high displacement, low low-end torque.',
  'Version course : vitesse de pointe maximale, forte consommation.':
    'Racing version: maximum top speed, high fuel consumption.',
  'Moteur à fort couple : reprise immédiate et maniabilité accrue, vitesse de pointe modérée.':
    'High-torque engine: instant response and improved maneuverability, moderate top speed.',
  'Version combat : accélération maximale, idéal pour les dogfights serrés.':
    'Combat version: maximum acceleration, ideal for tight dogfights.',
  // Turbo et filtre altitude (descriptions mises à jour)
  'Suralimentation permanente : vitesse de pointe et accélération nettement accrues, consommation augmentée.':
    'Permanent supercharging: top speed and acceleration significantly increased, higher fuel use.',
  'Filtre à air haute altitude : performances maintenues au-delà de 500m. Entretien et consommation légèrement accrus.':
    'High-altitude air filter: performance maintained above 500m. Slightly increased maintenance and fuel use.',
};

export function tEquip(str) {
  if (!str) return str;
  if (getLang() === 'fr') return str;
  if (EQUIP_LABELS_EN[str] !== undefined) return EQUIP_LABELS_EN[str];
  if (EQUIP_DESC_EN[str]   !== undefined) return EQUIP_DESC_EN[str];
  let out = str;
  for (const [fr, en] of EQUIP_PHRASES_EN) out = out.split(fr).join(en);
  return out;
}

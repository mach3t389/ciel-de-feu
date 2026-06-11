// ── Arbre de progression — définitions de toutes les améliorations ────────────
// stats: valeurs ADDITIVES appliquées au-dessus des stats de base (0–100 scale)
// fuelPct, ammoPct : pourcentages additifs sur les valeurs de base
// speedFlat, healthFlat : valeurs absolues additives
// load : augmente la charge (0 = léger, 100+ = très lourd)

export const UPGRADES = {
  // ═══════════════════════ AVIATION ══════════════════════════
  tank1: {
    id:'tank1', cat:'aviation', name:'Réservoir renforcé I',
    levelReq:5, cost:1000, requires:null,
    stats: { fuel:+20, speed:-3, maneuverability:-4, logistics:-7, load:+15 },
    desc:'Réservoir plus grand : +20% carburant. Charge accrue → moins agile, ravitaillement plus long.',
  },
  tank2: {
    id:'tank2', cat:'aviation', name:'Réservoir renforcé II',
    levelReq:10, cost:2000, requires:'tank1',
    stats: { fuel:+20, speed:-3, maneuverability:-4, logistics:-7, load:+15 },
    desc:'Réservoir maximal : +40% carburant total. Appareil nettement plus lourd.',
  },
  engine1: {
    id:'engine1', cat:'aviation', name:'Moteur amélioré I',
    levelReq:8, cost:1500, requires:null,
    stats: { speed:+10, accel:+5, maneuverability:-2, fuel:-8, logistics:-5 },
    desc:'Moteur suralimenté : plus puissant mais plus lourd, gourmand et complexe à entretenir.',
  },
  engine2: {
    id:'engine2', cat:'aviation', name:'Moteur amélioré II',
    levelReq:15, cost:3000, requires:'engine1',
    stats: { speed:+10, accel:+5, maneuverability:-2, fuel:-8, logistics:-5 },
    desc:'Moteur haute performance : vitesse maximale, forte consommation, entretien lourd.',
  },
  wings1: {
    id:'wings1', cat:'aviation', name:'Ailes allégées I',
    levelReq:12, cost:2000, requires:null,
    stats: { maneuverability:+10, defense:-5, fuel:+5 },
    desc:'Ailes allégées : moins de traînée, meilleure consommation, structure plus fragile.',
  },
  wings2: {
    id:'wings2', cat:'aviation', name:'Ailes allégées II',
    levelReq:20, cost:4000, requires:'wings1',
    stats: { maneuverability:+10, defense:-5, fuel:+5 },
    desc:'Ailes ultra-légères : maniabilité et efficacité maximales.',
  },
  roll: {
    id:'roll', cat:'aviation', name:'Roll amélioré',
    levelReq:18, cost:3500, requires:null,
    stats: { rollSpeed:+25, logistics:-2 },
    desc:'Commandes de roulis optimisées, entretien légèrement plus complexe.',
    rollSpeed: 0.25,
  },

  // ═══════════════════════ ARMEMENT ══════════════════════════
  mag1: {
    id:'mag1', cat:'armement', name:'Chargeur agrandi I',
    levelReq:5, cost:1000, requires:null,
    stats: { ammo:+50, speed:-2, maneuverability:-3, logistics:-5, load:+10 },
    desc:'Chargeur plus grand : 100 → 200 munitions. Charge accrue, réarmement plus long.',
  },
  mag2: {
    id:'mag2', cat:'armement', name:'Chargeur agrandi II',
    levelReq:12, cost:2500, requires:'mag1',
    stats: { ammo:+50, speed:-2, maneuverability:-3, logistics:-5, load:+10 },
    desc:'Chargeur maximal : 200 → 300 munitions. Appareil sensiblement plus lourd.',
  },
  ap: {
    id:'ap', cat:'armement', name:'Munitions perforantes',
    levelReq:10, cost:2500, requires:null,
    stats: { weaponry:+15, speed:-2, maneuverability:-1, fuel:-2, logistics:-5 },
    desc:'Munitions plus denses et lourdes : +15% dégâts, plus lentes à charger.',
  },
  firerate: {
    id:'firerate', cat:'armement', name:'Cadence améliorée',
    levelReq:15, cost:3500, requires:null,
    stats: { fireRate:+20, maneuverability:-3, fuel:-5, logistics:-6 },
    desc:'Mécanisme de tir plus rapide — consomme plus, s\'use plus vite, entretien accru.',
  },
  missile_aa: {
    id:'missile_aa', cat:'armement', name:'Missile air-air',
    levelReq:20, cost:10000, requires:null,
    stats: { weaponry:+20, maneuverability:-6, speed:-4, fuel:-10, logistics:-6, load:+20 },
    desc:'2 missiles guidés air-air haute précision. Guidage avancé : très efficaces contre les cibles aériennes.',
    grantsMissiles: 2, missileType: 'aa',
  },
  missile_imp1: {
    id:'missile_imp1', cat:'armement', name:'Missile amélioré I',
    levelReq:30, cost:4000, requires:'missile_aa',
    stats: { weaponry:+5, maneuverability:-3, speed:-2, fuel:-3, logistics:-3 },
    desc:'2 missiles de plus (×4) + guidage amélioré. Charge supplémentaire sous les ailes.',
    grantsMissiles: 2,
  },
  missile_imp2: {
    id:'missile_imp2', cat:'armement', name:'Missile amélioré II',
    levelReq:40, cost:6000, requires:'missile_imp1',
    stats: { weaponry:+5, maneuverability:-3, speed:-2, fuel:-3, logistics:-3 },
    desc:'2 missiles de plus (×6) + guidage avancé. Appareil très chargé.',
    grantsMissiles: 2,
  },
  dual_missile: {
    id:'dual_missile', cat:'armement', name:'Double missile',
    levelReq:35, cost:8000, requires:'missile_imp1',
    stats: { speed:-2, maneuverability:-3, fuel:-4, logistics:-5 },
    desc:'Tire 2 missiles simultanément.',
    grantsMissiles: 2,
  },
  missile_ag: {
    id:'missile_ag', cat:'armement', name:'Missile air-sol',
    levelReq:25, cost:6000, requires:null,
    stats: { weaponry:+15, maneuverability:-12, speed:-8, fuel:-18, logistics:-12, load:+30 },
    desc:'2 missiles lourds anti-sol (tanks, tourelles). Très lourds : forte perte de performances.',
    missileType: 'ag', grantsMissiles: 2,
  },

  // ═══════════════════════ DÉFENSE ══════════════════════════
  armor1: {
    id:'armor1', cat:'defense', name:'Blindage léger',
    levelReq:5, cost:1000, requires:null,
    stats: { health:+15, speed:-3, maneuverability:-2, fuel:-5, logistics:-4, load:+10 },
    desc:'Plaques légères : résistance accrue, moteur davantage sollicité.',
  },
  armor2: {
    id:'armor2', cat:'defense', name:'Blindage moyen',
    levelReq:15, cost:3500, requires:'armor1',
    stats: { health:+20, speed:-6, maneuverability:-5, fuel:-8, logistics:-6, load:+20 },
    desc:'Blindage renforcé : meilleure survie, nettement moins agile et plus gourmand.',
  },
  armor3: {
    id:'armor3', cat:'defense', name:'Blindage lourd',
    levelReq:25, cost:8000, requires:'armor2',
    stats: { health:+30, speed:-10, maneuverability:-10, fuel:-14, logistics:-12, load:+30 },
    desc:'Blindage intégral : très résistant mais lourd, lent et coûteux à réparer.',
  },
  resist_aa: {
    id:'resist_aa', cat:'defense', name:'Résistance tourelles',
    levelReq:20, cost:5000, requires:null,
    stats: { defense:+15, fuel:-3, logistics:-4 },
    desc:'Revêtement absorbant anti-éclats : léger surplus de masse, entretien spécialisé.',
    resistTurrets: 0.15,
  },
  resist_plane: {
    id:'resist_plane', cat:'defense', name:'Résistance avions',
    levelReq:30, cost:7000, requires:null,
    stats: { defense:+15, speed:-2, fuel:-4, logistics:-5 },
    desc:'Blindage balistique renforcé : protection accrue mais plus lourd.',
    resistPlanes: 0.15,
  },

  cell_renforcee: {
    id:'cell_renforcee', cat:'defense', name:'Cellule renforcée',
    levelReq:8, cost:2000, requires:null,
    stats: { health:+10, defense:+5, speed:-1 },
    desc:'Structure renforcée : résistance mécanique +10 HP, dégâts de collision −50%.',
    collisionDmgMult: 0.50,
  },
  siege_blinde: {
    id:'siege_blinde', cat:'defense', name:'Cockpit blindé',
    levelReq:18, cost:4000, requires:null,
    stats: { defense:+10, health:+8, speed:-2, fuel:-3 },
    desc:'Cockpit blindé : absorbe 10% de tous les dégâts reçus.',
    reduceDmgPct: 0.10,
  },

  // ═══════════════════════ LOGISTIQUE ══════════════════════════
  repair1: {
    id:'repair1', cat:'logistics', name:'Réparation rapide I',
    levelReq:8, cost:1500, requires:null,
    stats: { logistics:+10, speed:-2 },
    desc:'Équipe + équipement embarqué : réparation −20%, mais surpoids → −vitesse.',
    repairSpeed: 0.20,
  },
  repair2: {
    id:'repair2', cat:'logistics', name:'Réparation rapide II',
    levelReq:18, cost:3500, requires:'repair1',
    stats: { logistics:+10, speed:-2 },
    desc:'Réparation −40% total. Outillage lourd embarqué.',
    repairSpeed: 0.20,
  },
  rearm1: {
    id:'rearm1', cat:'logistics', name:'Réarmement rapide I',
    levelReq:10, cost:2000, requires:null,
    stats: { logistics:+10, maneuverability:-2 },
    desc:'Chargement automatisé : réarmement −20%, mécanismes plus lourds → −maniabilité.',
    rearmSpeed: 0.20,
  },
  rearm2: {
    id:'rearm2', cat:'logistics', name:'Réarmement rapide II',
    levelReq:20, cost:4000, requires:'rearm1',
    stats: { logistics:+10, maneuverability:-2 },
    desc:'Réarmement −40% total. Systèmes lourds.',
    rearmSpeed: 0.20,
  },
  refuel1: {
    id:'refuel1', cat:'logistics', name:'Ravitaillement rapide I',
    levelReq:12, cost:2500, requires:null,
    stats: { logistics:+10, maneuverability:-2 },
    desc:'Conduites haute pression : ravitaillement −20%, tuyauterie embarquée → −maniabilité.',
    refuelSpeed: 0.20,
  },
  refuel2: {
    id:'refuel2', cat:'logistics', name:'Ravitaillement rapide II',
    levelReq:25, cost:5000, requires:'refuel1',
    stats: { logistics:+10, maneuverability:-2 },
    desc:'Ravitaillement −40% total. Système haute capacité.',
    refuelSpeed: 0.20,
  },
  maintenance: {
    id:'maintenance', cat:'logistics', name:'Maintenance avancée',
    levelReq:35, cost:8000, requires:null,
    stats: { logistics:+20, speed:-4, maneuverability:-4, fuel:-6 },
    desc:'−10% sur tous les temps de service, mais charge importante et forte consommation.',
    repairSpeed:0.10, rearmSpeed:0.10, refuelSpeed:0.10,
  },

  // ═══════════════════════ UTILITAIRE ══════════════════════════
  radar: {
    id:'radar', cat:'utility', name:'Radar amélioré',
    levelReq:10, cost:2500, requires:null,
    stats: { fuel:-2, logistics:-3 },
    desc:'Antenne plus puissante : portée +25%, consomme de l\'énergie électrique.',
    radarRange: 0.25,
  },
  decoy1: {
    id:'decoy1', cat:'utility', name:'Leurres',
    levelReq:20, cost:5000, requires:null,
    stats: { maneuverability:-3, fuel:-4, logistics:-4 },
    desc:'2 leurres pyrotechniques contre missiles guidés. Lanceurs et cartouches embarqués.',
    grantsDecoys: 2,
  },
  decoy2: {
    id:'decoy2', cat:'utility', name:'Leurres améliorés',
    levelReq:30, cost:7000, requires:'decoy1',
    stats: { maneuverability:-2, fuel:-3, logistics:-3 },
    desc:'Capacité portée à 4 leurres. Charge pyrotechnique supplémentaire.',
    grantsDecoys: 2,
  },
  decoy3: {
    id:'decoy3', cat:'utility', name:'Leurres avancés',
    levelReq:40, cost:9000, requires:'decoy2',
    stats: { maneuverability:-2, fuel:-3, logistics:-3 },
    desc:'Capacité portée à 6 leurres. Soutes à leurres pleines.',
    grantsDecoys: 2,
  },

  // ═══════════════════════ NOUVEAUX ══════════════════════════
  turbo: {
    id:'turbo', cat:'propulsion', name:'Turbocompresseur',
    levelReq:20, cost:6000, requires:null,
    stats: { speed:+8, accel:+8, maneuverability:-2, fuel:-18, logistics:-8 },
    desc:'Suralimentation permanente : vitesse de pointe accrue, mais très gourmand et fragile.',
  },
  alt_filter: {
    id:'alt_filter', cat:'propulsion', name:'Filtre altitude',
    levelReq:14, cost:3000, requires:null,
    stats: { speed:+5, maneuverability:+5 },
    desc:'Filtre à air haute altitude : performances maintenues au-delà de 500m.',
  },
  calibre_sup: {
    id:'calibre_sup', cat:'armement', name:'Gros calibre',
    levelReq:12, cost:4000, requires:null,
    stats: { weaponry:+20, fireRate:-15, maneuverability:-2, fuel:-3 },
    desc:'Canon plus large : dégâts massifs, cadence réduite, vibrations accrues.',
  },
  bomb1: {
    id:'bomb1', cat:'armement', name:'Bombes légères',
    levelReq:18, cost:4500, requires:null,
    stats: { weaponry:+25, speed:-5, maneuverability:-7, fuel:-10, logistics:-8 },
    desc:'2 bombes à fragmentation légères : dégâts de zone au sol.',
    grantsBombs: 2, bombType: 'light',
  },
  bomb2: {
    id:'bomb2', cat:'armement', name:'Bombes lourdes',
    levelReq:28, cost:8000, requires:'bomb1',
    stats: { weaponry:+15, speed:-4, maneuverability:-5, fuel:-8, logistics:-6 },
    desc:'Bombes perforantes de 500 kg : dégâts extrêmes, rayon d\'explosion large.',
    grantsBombs: 2, bombType: 'heavy',
  },
  missile_ag2: {
    id:'missile_ag2', cat:'armement', name:'Missile A-Sol II',
    levelReq:35, cost:5000, requires:'missile_ag',
    stats: { weaponry:+5, speed:-4, maneuverability:-4, fuel:-5, logistics:-5 },
    desc:'Porte les missiles air-sol de ×2 à ×4. Charge très lourde sous les ailes.',
    missileType: 'ag', grantsMissiles: 2,
  },
  missile_ag3: {
    id:'missile_ag3', cat:'armement', name:'Missile A-Sol III',
    levelReq:45, cost:6000, requires:'missile_ag2',
    stats: { weaponry:+5, speed:-4, maneuverability:-4, fuel:-5, logistics:-5 },
    desc:'Porte les missiles air-sol de ×4 à ×6. Appareil au maximum de sa charge.',
    missileType: 'ag', grantsMissiles: 2,
  },

  // ── Guidage avancé ──────────────────────────────────────────────────────────
  tracking1: {
    id:'tracking1', cat:'armement', name:'Guidage actif I',
    levelReq:28, cost:5000, requires:'missile_aa',
    stats: { weaponry:+3, logistics:-3 },
    desc:'Missile plus agile (+TURN speed) et piste +1.5s. Ne ré-engage pas si raté.',
    trackingLevel: 1,
  },
  tracking2: {
    id:'tracking2', cat:'armement', name:'Guidage actif II',
    levelReq:36, cost:8000, requires:'tracking1',
    stats: { weaponry:+5, logistics:-5 },
    desc:'Ré-engage une fois après un miss. Rayon de virage encore amélioré.',
    trackingLevel: 2,
  },
  tracking3: {
    id:'tracking3', cat:'armement', name:'Guidage IA',
    levelReq:45, cost:14000, requires:'tracking2',
    stats: { weaponry:+7, logistics:-8 },
    desc:'Ré-engage toujours. Piste maintenue même si la cible vire serré.',
    trackingLevel: 3,
  },
  lock_speed1: {
    id:'lock_speed1', cat:'armement', name:'Senseur I',
    levelReq:22, cost:3500, requires:'missile_aa',
    stats: { weaponry:+2, logistics:-2 },
    desc:'Capteur IR amélioré : acquisition de cible 0.4s plus rapide.',
  },
  lock_speed2: {
    id:'lock_speed2', cat:'armement', name:'Senseur II',
    levelReq:32, cost:6500, requires:'lock_speed1',
    stats: { weaponry:+2, logistics:-3 },
    desc:'Capteur haute sensibilité : acquisition 0.7s plus rapide au total.',
  },
  cell_renforcee: {
    id:'cell_renforcee', cat:'defense', name:'Cellule renforcée',
    levelReq:8, cost:2000, requires:null,
    stats: { health:+10, defense:+5, speed:-1 },
    desc:'Structure renforcée : −50% dégâts de collision avec le terrain.',
    reducesCollisionDmg: 0.5,
  },
  siege_blinde: {
    id:'siege_blinde', cat:'defense', name:'Siège blindé',
    levelReq:18, cost:4500, requires:null,
    stats: { defense:+10, health:+8, speed:-2, fuel:-3 },
    desc:'Cockpit blindé : −10% tous les dégâts reçus.',
    reduceDmgPct: 0.10,
  },
  smokegen: {
    id:'smokegen', cat:'utility', name:'Fumigène',
    levelReq:15, cost:3000, requires:null,
    stats: { maneuverability:-1, logistics:-2 },
    desc:'Éjecteur de fumée : brouille le suivi des missiles ennemis.',
    grantsSmoke: true,
  },
  tail_cam: {
    id:'tail_cam', cat:'utility', name:'Caméra de queue',
    levelReq:22, cost:4000, requires:null,
    stats: { logistics:+5 },
    desc:'Alerte sur le HUD si un ennemi se trouve dans le secteur arrière.',
    grantsTailCam: true,
  },

  // ═══════════════════════ DÉFENSE ACTIVE ════════════════════════
  ecm1: {
    id:'ecm1', cat:'defense', name:'ECM I',
    levelReq:25, cost:8000, requires:null,
    stats: { defense:+12, fuel:-6, logistics:-5 },
    desc:'Brouilleur électronique : interrompt le verrouillage missile ennemi. Actif 3s, recharge 20s.',
  },
  ecm2: {
    id:'ecm2', cat:'defense', name:'ECM II',
    levelReq:32, cost:5000, requires:'ecm1',
    stats: { defense:+5, fuel:-4, logistics:-3 },
    desc:'ECM renforcé : actif 5s, recharge 16s.',
  },
  ecm3: {
    id:'ecm3', cat:'defense', name:'ECM III',
    levelReq:40, cost:8000, requires:'ecm2',
    stats: { defense:+5, fuel:-4, logistics:-3 },
    desc:'ECM maximal : actif 8s, recharge 12s.',
  },
  shield_front1: {
    id:'shield_front1', cat:'defense', name:'Bouclier avant I',
    levelReq:20, cost:6000, requires:null,
    stats: { defense:+18, speed:-4, maneuverability:-5 },
    desc:'Champ défensif frontal : −30% dégâts reçus de l\'avant. Actif 5s, recharge 25s.',
  },
  shield_front2: {
    id:'shield_front2', cat:'defense', name:'Bouclier avant II',
    levelReq:28, cost:4000, requires:'shield_front1',
    stats: { defense:+5, speed:-2, maneuverability:-2 },
    desc:'−45% dégâts frontaux. Actif 6s, recharge 20s.',
  },
  shield_front3: {
    id:'shield_front3', cat:'defense', name:'Bouclier avant III',
    levelReq:36, cost:6000, requires:'shield_front2',
    stats: { defense:+5, speed:-3, maneuverability:-3 },
    desc:'−60% dégâts frontaux. Actif 8s, recharge 15s.',
  },
  shield_rear1: {
    id:'shield_rear1', cat:'defense', name:'Bouclier arrière I',
    levelReq:20, cost:6000, requires:null,
    stats: { defense:+18, speed:-4, maneuverability:-5 },
    desc:'Champ défensif arrière : −30% dégâts reçus par l\'arrière. Actif 5s, recharge 25s.',
  },
  shield_rear2: {
    id:'shield_rear2', cat:'defense', name:'Bouclier arrière II',
    levelReq:28, cost:4000, requires:'shield_rear1',
    stats: { defense:+5, speed:-2, maneuverability:-2 },
    desc:'−45% dégâts arrière. Actif 6s, recharge 20s.',
  },
  shield_rear3: {
    id:'shield_rear3', cat:'defense', name:'Bouclier arrière III',
    levelReq:36, cost:6000, requires:'shield_rear2',
    stats: { defense:+5, speed:-3, maneuverability:-3 },
    desc:'−60% dégâts arrière. Actif 8s, recharge 15s.',
  },
  shield_full1: {
    id:'shield_full1', cat:'defense', name:'Bouclier 360° I',
    levelReq:30, cost:10000, requires:null,
    stats: { defense:+22, speed:-12, maneuverability:-15, fuel:-5 },
    desc:'Bouclier omnidirectionnel : −20% tous les dégâts. Actif 4s, recharge 30s. Lourd.',
  },
  shield_full2: {
    id:'shield_full2', cat:'defense', name:'Bouclier 360° II',
    levelReq:38, cost:6000, requires:'shield_full1',
    stats: { defense:+5, speed:-3, maneuverability:-3, fuel:-3 },
    desc:'−30% tous les dégâts. Actif 5s, recharge 25s.',
  },
  shield_full3: {
    id:'shield_full3', cat:'defense', name:'Bouclier 360° III',
    levelReq:46, cost:8000, requires:'shield_full2',
    stats: { defense:+5, speed:-3, maneuverability:-3, fuel:-4 },
    desc:'−40% tous les dégâts. Actif 7s, recharge 18s.',
  },
};

// ── Ordre d'affichage par catégorie ──────────────────────────────────────────
export const CAT_ORDER = {
  aviation: ['tank1','tank2','engine1','engine2','wings1','wings2','roll'],
  armement: ['mag1','mag2','ap','firerate','missile_aa','missile_imp1','missile_imp2','dual_missile','missile_ag','tracking1','tracking2','tracking3','lock_speed1','lock_speed2'],
  defense : ['armor1','armor2','armor3','resist_aa','resist_plane'],
  logistics:['repair1','repair2','rearm1','rearm2','refuel1','refuel2','maintenance'],
  utility : ['radar','decoy1','decoy2','decoy3'],
};

export const CAT_LABELS = {
  aviation    : 'AVIATION',
  canons      : 'CANONS',
  missiles_cat: 'MISSILES',
  defense     : 'DÉFENSE',
  logistics   : 'LOGISTIQUE',
  utility     : 'UTILITAIRE',
};

// ── Statistiques de base de l'avion ──────────────────────────────────────────
export const BASE_STATS = {
  health          : 100,
  speed           : 100,
  maneuverability : 100,
  weaponry        : 100,
  defense         : 100,
  logistics       : 100,
  load            : 0,
  fuel            : 100,
  ammo            : 100, // 200 munitions de base = 100%
  accel           : 100,
  fireRate        : 100,
  rollSpeed       : 100,
  missiles        : 0,
  decoys          : 0,
};

// ── Entrelace les emplacements de missiles AA/AG sur l'aile ──────────────────
// Retourne les indices d'emplacement X (par aile) pour chaque type, alternés
// AA, AG, AA, AG… afin que les deux types ne s'empilent pas.
export function interleaveSlots(aaCount, agCount) {
  const perWingAA = Math.ceil(aaCount / 2);
  const perWingAG = Math.ceil(agCount / 2);

  // Positions fixes calculées pour le chargement maximum (3 AA + 3 AG par aile).
  // Quand le count diminue, les missiles extérieurs (plus grand X) disparaissent en premier.
  // AA : emplacements entiers 0, 1, 2 (X = 0.70, 1.12, 1.54) — du fuselage vers l'extrémité.
  // AG : demi-slots -0.5, 0.5, 1.5 (X = 0.49, 0.91, 1.33) — entre les AA, puis inward.
  const AA_FIXED = [0, 1, 2];
  const AG_FIXED = [-0.5, 0.5, 1.5];

  const aaSlots = AA_FIXED.slice(0, Math.min(perWingAA, AA_FIXED.length));
  const agSlots = AG_FIXED.slice(0, Math.min(perWingAG, AG_FIXED.length));

  return { aaSlots, agSlots };
}

// ── Calcule les stats finales depuis une liste d'IDs d'améliorations ─────────
export function computeStats(upgradeIds) {
  const s = { ...BASE_STATS };
  for (const id of upgradeIds) {
    const upg = UPGRADES[id];
    if (!upg) continue;
    for (const [k, v] of Object.entries(upg.stats ?? {})) {
      s[k] = (s[k] ?? 0) + v;
    }
    if (upg.grantsMissiles) s.missiles += upg.grantsMissiles;
    if (upg.grantsDecoys)   s.decoys   += upg.grantsDecoys;
  }
  return s;
}

// ── Charge → modificateurs de gameplay ──────────────────────────────────────
export function loadModifiers(load) {
  if (load <= 20)  return { accel: +0.10, maneuverability: +0.10, speed: 0 };
  if (load <= 50)  return { accel: 0,     maneuverability: 0,     speed: 0 };
  if (load <= 80)  return { accel: -0.10, maneuverability: -0.10, speed: -0.05 };
  return               { accel: -0.20, maneuverability: -0.20, speed: -0.10 };
}

// ── Paramètres missiles selon niveau d'amélioration ─────────────────────────
export function missileParams(upgradeIds) {
  const hasMissile = upgradeIds.includes('missile_aa') || upgradeIds.includes('missile_ag');
  if (!hasMissile) return null;

  let lockTime  = 2.0;
  let trackTime = 2.2;  // standard limité — fiable sur cible droite, aléatoire en manœuvre
  let dual      = false;

  if (upgradeIds.includes('missile_imp1')) { lockTime = 1.75; trackTime = 3.0; }
  if (upgradeIds.includes('missile_imp2')) { lockTime = 1.50; trackTime = 4.0; }
  if (upgradeIds.includes('dual_missile')) { dual = true; }
  if (upgradeIds.includes('lock_speed1'))  lockTime -= 0.40;
  if (upgradeIds.includes('lock_speed2'))  lockTime -= 0.30;
  lockTime = Math.max(0.8, lockTime);

  let trackingLevel = 0;
  if (upgradeIds.includes('tracking1')) trackingLevel = 1;
  if (upgradeIds.includes('tracking2')) trackingLevel = 2;
  if (upgradeIds.includes('tracking3')) trackingLevel = 3;

  return {
    lockTime,
    trackTime,
    dual,
    hasAA: upgradeIds.includes('missile_aa'),
    hasAG: upgradeIds.includes('missile_ag'),
    trackingLevel,
  };
}

// IDs d'upgrades qui contribuent au poids des missiles sous les ailes
const MISSILE_WEIGHT_IDS = ['missile_aa','missile_imp1','missile_imp2','dual_missile','missile_ag','missile_ag2','missile_ag3'];

// Retourne les pénalités de speedMult et maneuverMult imputables exclusivement
// au chargement en missiles. Appelé une fois au démarrage pour séparer ces
// pénalités des autres mods, afin de les réappliquer proportionnellement au
// nombre de missiles restants en vol.
export function missileLoadPenalties(upgradeIds) {
  const statsAll  = computeStats(upgradeIds);
  const statsBase = computeStats(upgradeIds.filter(id => !MISSILE_WEIGHT_IDS.includes(id)));
  const lmAll  = loadModifiers(statsAll.load);
  const lmBase = loadModifiers(statsBase.load);
  const speedAll    = (100 + (statsAll.speed  - 100) / 100 * 20) / 100 * (1 + lmAll.speed);
  const speedBase   = (100 + (statsBase.speed - 100) / 100 * 20) / 100 * (1 + lmBase.speed);
  const manAll  = 1 + (statsAll.maneuverability  - 100) / 500 + lmAll.maneuverability;
  const manBase = 1 + (statsBase.maneuverability - 100) / 500 + lmBase.maneuverability;
  return { speedDelta: speedAll - speedBase, maneuverDelta: manAll - manBase };
}

// ── Catalogue d'équipements (système hangar) ─────────────────────────────────
// Chaque slot = choix mutuellement exclusif. upgrades[] = IDs legacy utilisés par computeStats.
export const EQUIPMENT_CATALOG = {
  propulsion: { label:'PROPULSION', icon:'✈', slots:{
    tank:   { label:'RÉSERVOIR', options:[
      { id:'standard',  name:'Standard',        icon:'○',  levelReq:1,  pros:[],                        cons:[],                                              upgrades:[] },
      { id:'agrandi1',  name:'Agrandi I',        icon:'◑',  levelReq:5,  pros:['Carburant +20%'],        cons:['Vitesse −2','Maniab. −3','Logistique −5'],     upgrades:['tank1'] },
      { id:'agrandi2',  name:'Agrandi II',       icon:'●',  levelReq:15, pros:['Carburant +40%'],        cons:['Vitesse −4','Maniab. −6','Logistique −10'],    upgrades:['tank1','tank2'] },
    ]},
    engine: { label:'MOTEUR', options:[
      { id:'standard',   name:'Standard',        icon:'⚙',  levelReq:1,  pros:[],                        cons:[],                                              upgrades:[] },
      { id:'ameliore1',  name:'Amélioré I',      icon:'◑',  levelReq:8,  pros:['Vitesse +10','Accél. +5'], cons:['Maniab. −2','Carburant −8','Logistique −5'],   upgrades:['engine1'] },
      { id:'ameliore2',  name:'Amélioré II',     icon:'●',  levelReq:18, pros:['Vitesse +20','Accél. +10'], cons:['Maniab. −4','Carburant −16','Logistique −10'], upgrades:['engine1','engine2'] },
    ]},
    wings:  { label:'AILES', options:[
      { id:'standard',   name:'Standard',        icon:'—',  levelReq:1,  pros:[],                        cons:[],                                              upgrades:[] },
      { id:'allegees1',  name:'Allégées I',      icon:'↑',  levelReq:12, pros:['Maniabilité +10','Carburant +5'],  cons:['Défense −5'],                       upgrades:['wings1'] },
      { id:'allegees2',  name:'Allégées II',     icon:'⬆',  levelReq:22, pros:['Maniabilité +20','Carburant +10'], cons:['Défense −10'],                      upgrades:['wings1','wings2'] },
    ]},
    turbo:  { label:'TURBO', options:[
      { id:'none',       name:'Aucun',           icon:'○',  levelReq:1,  pros:[],                        cons:[],                                              upgrades:[] },
      { id:'installed',  name:'Installé',        icon:'✺',  levelReq:20, pros:['Vitesse +8','Accél. +8'], cons:['Maniab. −2','Carburant −18','Logistique −8'],  upgrades:['turbo'] },
    ]},
    alt_filter: { label:'FILTRE ALTITUDE', options:[
      { id:'none',       name:'Aucun',           icon:'○',  levelReq:1,  pros:[],                        cons:[],                                              upgrades:[] },
      { id:'installed',  name:'Installé',        icon:'▲',  levelReq:14, pros:['Vitesse +5 (>500m)','Maniab. +5'], cons:[],                                  upgrades:['alt_filter'] },
    ]},
  }},
  canons: { label:'CANONS', icon:'⌖', slots:{
    ammo:     { label:'MUNITIONS', options:[
      { id:'100',  name:'100 rds',  icon:'▪',   levelReq:1,  pros:[],              cons:[],                                         upgrades:[] },
      { id:'200',  name:'200 rds',  icon:'▪▪',  levelReq:5,  pros:['Munitions ×2'], cons:['Carburant −3','Logistique −3'],          upgrades:['mag1'] },
      { id:'300',  name:'300 rds',  icon:'▪▪▪', levelReq:12, pros:['Munitions ×3'], cons:['Carburant −6','Logistique −6'],          upgrades:['mag1','mag2'] },
    ]},
    ap:       { label:'TYPE MUNITIONS', options:[
      { id:'standard',    name:'Standard',       icon:'○',  levelReq:1,  pros:[],               cons:[],                                                  upgrades:[] },
      { id:'perforantes', name:'Perforantes',    icon:'◆',  levelReq:10, pros:['Armement +15'], cons:['Vitesse −1','Carburant −2','Logistique −4'],       upgrades:['ap'] },
    ]},
    calibre:  { label:'CALIBRE', options:[
      { id:'standard',    name:'Standard',       icon:'○',  levelReq:1,  pros:[],               cons:[],                                                  upgrades:[] },
      { id:'superieur',   name:'Supérieur',      icon:'◈',  levelReq:12, pros:['Armement +20'], cons:['Cadence −15','Maniab. −2','Carburant −3'],        upgrades:['calibre_sup'] },
    ]},
    firerate: { label:'CADENCE', options:[
      { id:'standard',  name:'Standard',         icon:'○',  levelReq:1,  pros:[],               cons:[],                                                  upgrades:[] },
      { id:'ameliore',  name:'Améliorée',        icon:'≫',  levelReq:15, pros:['Cadence +20%'], cons:['Maniab. −2','Carburant −5','Logistique −5'],      upgrades:['firerate'] },
    ]},
  }},
  missiles_cat: { label:'MISSILES', icon:'⊕', slots:{
    missiles_aa: { label:'MISSILES AA', options:[
      { id:'none',  name:'Aucun',   icon:'○',  levelReq:1,  pros:[],               cons:[],                                                                  upgrades:[] },
      { id:'2aa',   name:'×2 AA',   icon:'◎',  levelReq:20, pros:['Armement +20'], cons:['Vitesse −4','Maniab. −6','Carburant −10','Logistique −6'],         upgrades:['missile_aa'] },
      { id:'4aa',   name:'×4 AA',   icon:'◎',  levelReq:30, pros:['Armement +25'], cons:['Vitesse −6','Maniab. −9','Carburant −13','Logistique −9'],         upgrades:['missile_aa','missile_imp1'] },
      { id:'6aa',   name:'×6 AA',   icon:'◎',  levelReq:40, pros:['Armement +30'], cons:['Vitesse −8','Maniab. −12','Carburant −16','Logistique −12'],       upgrades:['missile_aa','missile_imp1','missile_imp2'] },
    ]},
    missiles_ag: { label:'MISSILES AS', options:[
      { id:'none',  name:'Aucun',   icon:'○',  levelReq:1,  pros:[],               cons:[],                                                                  upgrades:[] },
      { id:'2ag',   name:'×2 AS',   icon:'▽',  levelReq:25, pros:['Armement +15'], cons:['Vitesse −8','Maniab. −12','Carburant −18','Logistique −12'],       upgrades:['missile_ag'] },
      { id:'4ag',   name:'×4 AS',   icon:'▽',  levelReq:35, pros:['Armement +20'], cons:['Vitesse −12','Maniab. −16','Carburant −23','Logistique −17'],      upgrades:['missile_ag','missile_ag2'] },
      { id:'6ag',   name:'×6 AS',   icon:'▽',  levelReq:45, pros:['Armement +25'], cons:['Vitesse −16','Maniab. −20','Carburant −28','Logistique −22'],      upgrades:['missile_ag','missile_ag2','missile_ag3'] },
    ]},
    tracking: { label:'GUIDAGE', options:[
      { id:'none',   name:'Standard',    icon:'—', levelReq:1,  pros:[],                                                   cons:[],                          upgrades:[] },
      { id:'actif1', name:'Guidage I',   icon:'◎', levelReq:28, pros:['Agilité missile +','Piste +1.5s'],                 cons:['Logistique −3'],            upgrades:['tracking1'] },
      { id:'actif2', name:'Guidage II',  icon:'◉', levelReq:36, pros:['Ré-engage ×1','Piste +2.5s'],                     cons:['Logistique −5'],            upgrades:['tracking1','tracking2'] },
      { id:'ia',     name:'Guidage IA',  icon:'⦿', levelReq:45, pros:['Ré-engage toujours','Piste maximale'],             cons:['Logistique −8'],            upgrades:['tracking1','tracking2','tracking3'] },
    ]},
    acquisition: { label:'ACQUISITION', options:[
      { id:'none',    name:'Standard',  icon:'○',  levelReq:1,  pros:[],                      cons:[],                  upgrades:[] },
      { id:'rapide1', name:'Senseur I', icon:'◎',  levelReq:22, pros:['Lock −0.4s'],           cons:['Logistique −2'],  upgrades:['lock_speed1'] },
      { id:'rapide2', name:'Senseur II',icon:'◉',  levelReq:32, pros:['Lock −0.7s'],           cons:['Logistique −3'],  upgrades:['lock_speed1','lock_speed2'] },
    ]},
  }},
  defense: { label:'DÉFENSE', icon:'⬡', slots:{
    active_defense: { label:'DÉFENSE ACTIVE', options:[
      { id:'none',          name:'Aucune',         icon:'○',  levelReq:1,  pros:[],                                        cons:[],                                                     upgrades:[] },
      { id:'leurres_1',     name:'Leurres I',       icon:'◉',  levelReq:25, pros:['2 leurres anti-missile'],               cons:['Maniab. −2'],                                        upgrades:['decoy1'] },
      { id:'leurres_2',     name:'Leurres II',      icon:'◉',  levelReq:35, pros:['4 leurres anti-missile'],               cons:['Maniab. −3'],                                        upgrades:['decoy1','decoy2'] },
      { id:'leurres_3',     name:'Leurres III',     icon:'◉',  levelReq:45, pros:['6 leurres anti-missile'],               cons:['Maniab. −4'],                                        upgrades:['decoy1','decoy2','decoy3'] },
      { id:'ecm_1',         name:'ECM I',           icon:'⊡',  levelReq:25, pros:['Brouille lock missile','3s / cd 20s'],  cons:['Carburant −6','Logistique −5'],                      upgrades:['ecm1'] },
      { id:'ecm_2',         name:'ECM II',          icon:'⊡',  levelReq:32, pros:['Brouille lock missile','5s / cd 16s'],  cons:['Carburant −10','Logistique −8'],                     upgrades:['ecm1','ecm2'] },
      { id:'ecm_3',         name:'ECM III',         icon:'⊡',  levelReq:40, pros:['Brouille lock missile','8s / cd 12s'],  cons:['Carburant −14','Logistique −11'],                    upgrades:['ecm1','ecm2','ecm3'] },
      { id:'shield_front_1',name:'Boucl. Av. I',    icon:'◭',  levelReq:20, pros:['−30% dégâts frontaux','5s / cd 25s'],  cons:['Vitesse −4','Maniab. −5'],                           upgrades:['shield_front1'] },
      { id:'shield_front_2',name:'Boucl. Av. II',   icon:'◭',  levelReq:28, pros:['−45% dégâts frontaux','6s / cd 20s'],  cons:['Vitesse −6','Maniab. −7'],                           upgrades:['shield_front1','shield_front2'] },
      { id:'shield_front_3',name:'Boucl. Av. III',  icon:'◭',  levelReq:36, pros:['−60% dégâts frontaux','8s / cd 15s'],  cons:['Vitesse −9','Maniab. −10'],                          upgrades:['shield_front1','shield_front2','shield_front3'] },
      { id:'shield_rear_1', name:'Boucl. Ar. I',    icon:'◬',  levelReq:20, pros:['−30% dégâts arrière','5s / cd 25s'],   cons:['Vitesse −4','Maniab. −5'],                           upgrades:['shield_rear1'] },
      { id:'shield_rear_2', name:'Boucl. Ar. II',   icon:'◬',  levelReq:28, pros:['−45% dégâts arrière','6s / cd 20s'],   cons:['Vitesse −6','Maniab. −7'],                           upgrades:['shield_rear1','shield_rear2'] },
      { id:'shield_rear_3', name:'Boucl. Ar. III',  icon:'◬',  levelReq:36, pros:['−60% dégâts arrière','8s / cd 15s'],   cons:['Vitesse −9','Maniab. −10'],                          upgrades:['shield_rear1','shield_rear2','shield_rear3'] },
      { id:'shield_full_1', name:'Boucl. 360° I',   icon:'⊙',  levelReq:30, pros:['−20% tous dégâts','4s / cd 30s'],      cons:['Vitesse −12','Maniab. −15','Carburant −5'],          upgrades:['shield_full1'] },
      { id:'shield_full_2', name:'Boucl. 360° II',  icon:'⊙',  levelReq:38, pros:['−30% tous dégâts','5s / cd 25s'],      cons:['Vitesse −15','Maniab. −18','Carburant −8'],          upgrades:['shield_full1','shield_full2'] },
      { id:'shield_full_3', name:'Boucl. 360° III', icon:'⊙',  levelReq:46, pros:['−40% tous dégâts','7s / cd 18s'],      cons:['Vitesse −18','Maniab. −21','Carburant −12'],         upgrades:['shield_full1','shield_full2','shield_full3'] },
    ]},
    armor:  { label:'BLINDAGE', options:[
      { id:'none',  name:'Aucun',  icon:'○',  levelReq:1,  pros:[],          cons:[],                                                              upgrades:[] },
      { id:'leger', name:'Léger',  icon:'◔',  levelReq:5,  pros:['Vie +15'], cons:['Vitesse −2','Carburant −4','Logistique −3'],                   upgrades:['armor1'] },
      { id:'moyen', name:'Moyen',  icon:'◑',  levelReq:15, pros:['Vie +35'], cons:['Vitesse −7','Maniab. −3','Carburant −11','Logistique −8'],     upgrades:['armor1','armor2'] },
      { id:'lourd', name:'Lourd',  icon:'●',  levelReq:28, pros:['Vie +65'], cons:['Vitesse −15','Maniab. −12','Carburant −23','Logistique −18'], upgrades:['armor1','armor2','armor3'] },
    ]},
    resist: { label:'RÉSISTANCE', options:[
      { id:'none',    name:'Aucune',         icon:'○',  levelReq:1,  pros:[],                        cons:[],                                             upgrades:[] },
      { id:'turrets', name:'Anti-Tourelles', icon:'⬡',  levelReq:20, pros:['Déf. +15 vs tourelles'], cons:['Carburant −3','Logistique −4'],              upgrades:['resist_aa'] },
      { id:'planes',  name:'Anti-Avions',    icon:'✈',  levelReq:30, pros:['Déf. +15 vs avions'],    cons:['Vitesse −2','Carburant −4','Logistique −5'], upgrades:['resist_plane'] },
    ]},
    cell_renforcee: { label:'CELLULE', options:[
      { id:'none',        name:'Standard',   icon:'○',  levelReq:1, pros:[],                            cons:[],              upgrades:[] },
      { id:'renforcee',   name:'Renforcée',  icon:'⬡',  levelReq:8, pros:['Vie +10','Déf. +5','Collision −50%'], cons:['Vitesse −1'], upgrades:['cell_renforcee'] },
    ]},
    siege_blinde: { label:'COCKPIT', options:[
      { id:'none',     name:'Standard',      icon:'○',  levelReq:1,  pros:[],                            cons:[],                                    upgrades:[] },
      { id:'blinde',   name:'Blindé',        icon:'◈',  levelReq:18, pros:['Déf. +10','Vie +8','Dégâts −10%'], cons:['Vitesse −2','Carburant −3'], upgrades:['siege_blinde'] },
    ]},
  }},
  logistics: { label:'LOGISTIQUE', icon:'⚙', slots:{
    repair:      { label:'RÉPARATION', options:[
      { id:'standard', name:'Standard',  icon:'○',  levelReq:1,  pros:[],                                    cons:[], upgrades:[] },
      { id:'rapide1',  name:'Rapide I',  icon:'◑',  levelReq:8,  pros:['Réparation −20%','Logistique +10'],  cons:[], upgrades:['repair1'] },
      { id:'rapide2',  name:'Rapide II', icon:'●',  levelReq:20, pros:['Réparation −40%','Logistique +20'],  cons:[], upgrades:['repair1','repair2'] },
    ]},
    rearm:       { label:'RÉARMEMENT', options:[
      { id:'standard', name:'Standard',  icon:'○',  levelReq:1,  pros:[],                                    cons:[], upgrades:[] },
      { id:'rapide1',  name:'Rapide I',  icon:'◑',  levelReq:10, pros:['Réarmement −20%','Logistique +10'],  cons:[], upgrades:['rearm1'] },
      { id:'rapide2',  name:'Rapide II', icon:'●',  levelReq:22, pros:['Réarmement −40%','Logistique +20'],  cons:[], upgrades:['rearm1','rearm2'] },
    ]},
    refuel:      { label:'RAVITAILLEMENT', options:[
      { id:'standard', name:'Standard',  icon:'○',  levelReq:1,  pros:[],                                      cons:[], upgrades:[] },
      { id:'rapide1',  name:'Rapide I',  icon:'◑',  levelReq:12, pros:['Ravitaillement −20%','Logistique +10'], cons:[], upgrades:['refuel1'] },
      { id:'rapide2',  name:'Rapide II', icon:'●',  levelReq:25, pros:['Ravitaillement −40%','Logistique +20'], cons:[], upgrades:['refuel1','refuel2'] },
    ]},
    maintenance: { label:'MAINTENANCE', options:[
      { id:'none',   name:'Aucune',  icon:'○',  levelReq:1,  pros:[], cons:[], upgrades:[] },
      { id:'active', name:'Avancée', icon:'✦',  levelReq:35, pros:['−10% tous les temps','Logistique +20'], cons:[], upgrades:['maintenance'] },
    ]},
  }},
  equipements: { label:'ÉQUIPEMENTS', icon:'◈', slots:{
    radar:    { label:'RADAR', options:[
      { id:'standard',  name:'Standard',  icon:'○',  levelReq:1,  pros:[],              cons:[],                                upgrades:[] },
      { id:'ameliore',  name:'Amélioré',  icon:'◉',  levelReq:10, pros:['Portée +25%'], cons:['Carburant −2','Logistique −3'], upgrades:['radar'] },
    ]},
    roll:     { label:'ROULIS', options:[
      { id:'standard',  name:'Standard',  icon:'○',  levelReq:1,  pros:[],              cons:[], upgrades:[] },
      { id:'ameliore',  name:'Amélioré',  icon:'↺',  levelReq:18, pros:['Roulis +25%'], cons:['Logistique −2'], upgrades:['roll'] },
    ]},
    smokegen: { label:'FUMIGÈNE', options:[
      { id:'none',       name:'Aucun',    icon:'○',  levelReq:1,  pros:[],                         cons:[],                         upgrades:[] },
      { id:'installed',  name:'Installé', icon:'≋',  levelReq:15, pros:['Brouille missiles ennemis'], cons:['Maniab. −1','Logistique −2'], upgrades:['smokegen'] },
    ]},
    tail_cam: { label:'CAMÉRA ARRIÈRE', options:[
      { id:'none',       name:'Aucune',   icon:'○',  levelReq:1,  pros:[],                              cons:[],                 upgrades:[] },
      { id:'installed',  name:'Installée',icon:'⊙',  levelReq:22, pros:['Alerte ennemis dans le dos','Logistique +5'], cons:[], upgrades:['tail_cam'] },
    ]},
  }},
};

// ── Coûts d'achat par option du catalogue ────────────────────────────────────
// Format : "slotKey:optId" → crédits
export const OPTION_COSTS = {
  // PROPULSION
  'tank:agrandi1'          : 1000,
  'tank:agrandi2'          : 3000,
  'engine:ameliore1'       : 2500,
  'engine:ameliore2'       : 6000,
  'wings:allegees1'        : 2000,
  'wings:allegees2'        : 4500,
  'turbo:installed'        : 6000,
  'alt_filter:installed'   : 3000,
  // ARMEMENT
  'ammo:200'               : 1000,
  'ammo:300'               : 2500,
  'ap:perforantes'         : 2500,
  'calibre:superieur'      : 4000,
  'firerate:ameliore'      : 3500,
  'missiles_aa:2aa'        : 5000,
  'missiles_aa:4aa'        : 5000,
  'missiles_aa:6aa'        : 7000,
  'missiles_ag:2ag'        : 10000,
  'missiles_ag:4ag'        : 10000,
  'missiles_ag:6ag'        : 12000,
  'tracking:actif1'        : 5000,
  'tracking:actif2'        : 8000,
  'tracking:ia'            : 14000,
  'acquisition:rapide1'    : 3500,
  'acquisition:rapide2'    : 6500,
  'active_defense:leurres_1'     : 4000,
  'active_defense:leurres_2'     : 7000,
  'active_defense:leurres_3'     : 9000,
  'active_defense:ecm_1'         : 8000,
  'active_defense:ecm_2'         : 5000,
  'active_defense:ecm_3'         : 8000,
  'active_defense:shield_front_1': 6000,
  'active_defense:shield_front_2': 4000,
  'active_defense:shield_front_3': 6000,
  'active_defense:shield_rear_1' : 6000,
  'active_defense:shield_rear_2' : 4000,
  'active_defense:shield_rear_3' : 6000,
  'active_defense:shield_full_1' : 10000,
  'active_defense:shield_full_2' : 6000,
  'active_defense:shield_full_3' : 8000,
  // DÉFENSE
  'armor:leger'            : 1000,
  'armor:moyen'            : 3000,
  'armor:lourd'            : 7000,
  'resist:turrets'         : 5000,
  'resist:planes'          : 7000,
  'cell_renforcee:renforcee': 2000,
  'siege_blinde:blinde'    : 4500,
  // LOGISTIQUE
  'repair:rapide1'         : 1500,
  'repair:rapide2'         : 3500,
  'rearm:rapide1'          : 2000,
  'rearm:rapide2'          : 4000,
  'refuel:rapide1'         : 2500,
  'refuel:rapide2'         : 5000,
  'maintenance:active'     : 8000,
  // ÉQUIPEMENTS
  'radar:ameliore'         : 2500,
  'roll:ameliore'          : 3500,
  'smokegen:installed'     : 3000,
  'tail_cam:installed'     : 4000,
};

// Loadout par défaut
export const DEFAULT_LOADOUT = {
  tank:'standard', engine:'standard', wings:'standard', turbo:'none', alt_filter:'none',
  ammo:'100', ap:'standard', calibre:'standard', firerate:'standard',
  missiles_aa:'none', missiles_ag:'none', tracking:'none', acquisition:'none', active_defense:'none',
  armor:'none', resist:'none', cell_renforcee:'none', siege_blinde:'none',
  repair:'standard', rearm:'standard', refuel:'standard', maintenance:'none',
  radar:'standard', roll:'standard', smokegen:'none', tail_cam:'none',
};

// Convertit un loadout en liste d'IDs d'upgrades legacy (pour computeStats, missileParams, etc.)
export function loadoutToUpgradeIds(loadout) {
  const ids = new Set();
  for (const cat of Object.values(EQUIPMENT_CATALOG)) {
    for (const [slotKey, slot] of Object.entries(cat.slots)) {
      const chosen = loadout[slotKey] ?? 'standard';
      const opt = slot.options.find(o => o.id === chosen);
      if (opt) opt.upgrades.forEach(id => ids.add(id));
    }
  }
  return [...ids];
}

// ── Paramètres du système de défense active ──────────────────────────────────
// Retourne { type, level, decoys, ecmDuration, ecmCooldown,
//            shieldReduction, shieldDuration, shieldCooldown } ou null
export function activeDefenseParams(loadout) {
  const opt = loadout?.active_defense ?? 'none';
  if (!opt || opt === 'none') return null;

  if (opt.startsWith('leurres_')) {
    const level = parseInt(opt.split('_')[1]);
    return { type:'leurres', level, decoys: level * 2,
      ecmDuration:0, ecmCooldown:0, shieldReduction:0, shieldDuration:0, shieldCooldown:0 };
  }

  if (opt.startsWith('ecm_')) {
    const level    = parseInt(opt.split('_')[1]);
    const DUR      = [0, 3, 5, 8];
    const CD       = [0, 20, 16, 12];
    return { type:'ecm', level, decoys:0,
      ecmDuration: DUR[level] ?? 3, ecmCooldown: CD[level] ?? 20,
      shieldReduction:0, shieldDuration:0, shieldCooldown:0 };
  }

  if (opt.startsWith('shield_')) {
    const parts   = opt.split('_');          // ['shield','front','1'] or ['shield','full','2']
    const subtype = parts[1];                // 'front' | 'rear' | 'full'
    const level   = parseInt(parts[2]);
    const isFull  = subtype === 'full';
    const RED     = isFull ? [0, 0.20, 0.30, 0.40] : [0, 0.30, 0.45, 0.60];
    const DUR     = isFull ? [0, 4, 5, 7]           : [0, 5, 6, 8];
    const CD      = isFull ? [0, 30, 25, 18]         : [0, 25, 20, 15];
    return { type:`shield_${subtype}`, level, decoys:0,
      ecmDuration:0, ecmCooldown:0,
      shieldReduction: RED[level] ?? 0.20,
      shieldDuration:  DUR[level] ?? 5,
      shieldCooldown:  CD[level]  ?? 25 };
  }

  return null;
}

// ── Temps de service au sol avec améliorations ──────────────────────────────
export function serviceTimeMult(upgradeIds) {
  let repair = 1.0, rearm = 1.0, refuel = 1.0;
  for (const id of upgradeIds) {
    const u = UPGRADES[id];
    if (!u) continue;
    if (u.repairSpeed) repair *= (1 - u.repairSpeed);
    if (u.rearmSpeed)  rearm  *= (1 - u.rearmSpeed);
    if (u.refuelSpeed) refuel *= (1 - u.refuelSpeed);
  }
  return { repair, rearm, refuel };
}

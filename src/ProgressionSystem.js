// ── Système de progression persistant ────────────────────────────────────────
// XP, crédits, niveau (1-50), 3 slots d'avions, statistiques globales

import { DEFAULT_LOADOUT, loadoutToUpgradeIds, EQUIPMENT_CATALOG } from './UpgradeTree.js';
import { t } from './i18n.js';

const SAVE_KEY = 'cielDeFeu_progression';

// XP requis pour passer du niveau n au niveau n+1 : 1000 + (n-1)*200
export function xpToNextLevel(level) {
  if (level >= 50) return Infinity;
  return 1000 + (level - 1) * 200;
}

// XP total cumulé pour atteindre exactement le niveau n (depuis le niveau 1)
export function totalXpForLevel(n) {
  if (n <= 1) return 0;
  let total = 0;
  for (let i = 1; i < n; i++) total += xpToNextLevel(i);
  return total;
}

// Calcule le niveau + XP dans le niveau courant depuis un XP total
export function levelFromTotalXp(totalXp) {
  let lvl = 1;
  let rem = totalXp;
  while (lvl < 50) {
    const needed = xpToNextLevel(lvl);
    if (rem < needed) break;
    rem -= needed;
    lvl++;
  }
  return { level: lvl, xpInLevel: rem };
}

const DEFAULT_PLANE = (idx) => ({
  name: `AVION ${idx + 1}`,
  color: ['blanc', 'bleu', 'rouge'][idx] ?? 'blanc',
  upgrades: {},
  loadout: {},
});

const DEFAULT_STATE = () => ({
  totalXp  : 0,
  credits  : 0,
  activePlane: 0,
  seenOptions  : [], // clés "slotKey:optId" des options déjà consultées par le joueur
  ownedOptions : [], // clés "slotKey:optId" des options achetées (global, tous avions)
  planes: [DEFAULT_PLANE(0), DEFAULT_PLANE(1), DEFAULT_PLANE(2)],
  stats: {
    totalKills  : 0, totalDeaths: 0, totalGames: 0,
    flightTimeSec: 0, distanceKm: 0,
    mission : { maxDiff: 0, maxKills: 0, victories: 0, timeSec: 0 },
    survival: { bestWave: 0, maxDiff: 0, timeSec: 0 },
    versus  : { wins: 0, losses: 0, kills: 0, deaths: 0 },
    teams   : { wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 },
  },
});

export class ProgressionSystem {
  constructor() {
    this._state = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Fusion défensive avec les defaults pour les nouvelles clés
        const def = DEFAULT_STATE();
        parsed.totalXp     = Number.isFinite(parsed.totalXp)     ? parsed.totalXp     : 0;
        parsed.credits     = Number.isFinite(parsed.credits)     ? parsed.credits     : 0;
        parsed.activePlane = Number.isFinite(parsed.activePlane) ? parsed.activePlane : 0;
        parsed.stats = { ...def.stats, ...parsed.stats };
        parsed.stats.mission  = { ...def.stats.mission,  ...(parsed.stats.mission  ?? {}) };
        parsed.stats.survival = { ...def.stats.survival, ...(parsed.stats.survival ?? {}) };
        parsed.stats.versus   = { ...def.stats.versus,   ...(parsed.stats.versus   ?? {}) };
        parsed.stats.teams    = { ...def.stats.teams,    ...(parsed.stats.teams    ?? {}) };
        if (!Array.isArray(parsed.planes)) parsed.planes = [];
        while (parsed.planes.length < 3) parsed.planes.push(DEFAULT_PLANE(parsed.planes.length));
        parsed.activePlane = Math.max(0, Math.min(parsed.planes.length - 1, parsed.activePlane));
        if (!Array.isArray(parsed.seenOptions)) parsed.seenOptions = [];
        // Migration : si ownedOptions absent, grandfather les options déjà équipées
        if (!Array.isArray(parsed.ownedOptions)) {
          const owned = new Set();
          for (const plane of parsed.planes) {
            for (const [slotKey, optId] of Object.entries(plane.loadout ?? {})) {
              if (optId && optId !== 'standard' && optId !== 'none' && optId !== '100') {
                owned.add(`${slotKey}:${optId}`);
              }
            }
          }
          parsed.ownedOptions = [...owned];
        }
        return parsed;
      }
    } catch (_) { /* */ }
    return DEFAULT_STATE();
  }

  _save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this._state)); } catch (_) { /* */ }
  }

  // ── Niveau / XP ──────────────────────────────────────────────────────────────
  get totalXp()   { return this._state.totalXp; }
  get credits()   { return this._state.credits; }

  get levelInfo() {
    return levelFromTotalXp(this._state.totalXp);
  }

  get level() { return this.levelInfo.level; }
  get xpInLevel() { return this.levelInfo.xpInLevel; }

  // ── DEV : débloque niveau 50 + crédits pour tester ──────────────────────────
  devUnlockAll() {
    this._state.totalXp = totalXpForLevel(50);
    this._state.credits = 9999999;
    this._save();
    return { level: this.level, credits: this.credits };
  }

  // Ajoute de l'XP et des crédits, retourne { oldLevel, newLevel, leveledUp }
  addRewards(xp, credits) {
    const oldLevel = this.level;
    this._state.totalXp  = Math.max(0, this._state.totalXp  + xp);
    this._state.credits  = Math.max(0, this._state.credits  + credits);
    const newLevel = this.level;
    this._save();
    return { oldLevel, newLevel, leveledUp: newLevel > oldLevel };
  }

  // ── Slots d'avions ──────────────────────────────────────────────────────────
  get activePlane() { return this._state.activePlane; }
  setActivePlane(idx) {
    this._state.activePlane = Math.max(0, Math.min(2, idx));
    this._save();
  }

  getPlane(idx) { return this._state.planes[idx] ?? this._state.planes[0]; }
  getActivePlaneData() { return this.getPlane(this._state.activePlane); }

  setPlane(idx, data) {
    this._state.planes[idx] = { ...this._state.planes[idx], ...data };
    this._save();
  }

  renamePlane(idx, name) { this.setPlane(idx, { name: name.toUpperCase().substring(0, 16) }); }
  setPlaneColor(idx, color) { this.setPlane(idx, { color }); }

  // ── Améliorations ──────────────────────────────────────────────────────────
  hasUpgrade(planeIdx, upgradeId) {
    return !!(this._state.planes[planeIdx]?.upgrades?.[upgradeId]);
  }

  buyUpgrade(planeIdx, upgradeId, cost) {
    if (this._state.credits < cost) return false;
    this._state.credits -= cost;
    if (!this._state.planes[planeIdx]) return false;
    this._state.planes[planeIdx].upgrades[upgradeId] = true;
    this._save();
    return true;
  }

  removeUpgrade(planeIdx, upgradeId) {
    delete this._state.planes[planeIdx]?.upgrades?.[upgradeId];
    this._save();
  }

  // ── Loadout (système hangar) ────────────────────────────────────────────────
  getLoadout(planeIdx) {
    return { ...DEFAULT_LOADOUT, ...(this._state.planes[planeIdx]?.loadout ?? {}) };
  }

  setLoadoutItem(planeIdx, slotKey, optionId) {
    if (!this._state.planes[planeIdx]) return;
    if (!this._state.planes[planeIdx].loadout) this._state.planes[planeIdx].loadout = {};
    this._state.planes[planeIdx].loadout[slotKey] = optionId;
    this._save();
  }

  getUpgrades(planeIdx) {
    return loadoutToUpgradeIds(this.getLoadout(planeIdx));
  }

  // ── Notifications : options débloquées non encore consultées ────────────────
  // Retourne la liste des options { catKey, slotKey, optId, key } débloquées par
  // le niveau actuel et que le joueur n'a jamais vues.
  getNewOptions() {
    const lvl  = this.level;
    const seen = new Set(this._state.seenOptions ?? []);
    const out  = [];
    for (const [catKey, cat] of Object.entries(EQUIPMENT_CATALOG)) {
      for (const [slotKey, slot] of Object.entries(cat.slots)) {
        for (const opt of slot.options) {
          if (opt.levelReq > 1 && opt.levelReq <= lvl) {
            const key = `${slotKey}:${opt.id}`;
            if (!seen.has(key)) out.push({ catKey, slotKey, optId: opt.id, key });
          }
        }
      }
    }
    return out;
  }

  newOptionCount()        { return this.getNewOptions().length; }
  slotHasNew(slotKey)     { return this.getNewOptions().some(o => o.slotKey === slotKey); }
  isOptionNew(slotKey, optId) {
    return this.getNewOptions().some(o => o.slotKey === slotKey && o.optId === optId);
  }

  // Marque comme vues toutes les options débloquées d'un slot donné.
  markSlotSeen(slotKey) {
    const lvl  = this.level;
    const set  = new Set(this._state.seenOptions ?? []);
    for (const cat of Object.values(EQUIPMENT_CATALOG)) {
      const slot = cat.slots[slotKey];
      if (!slot) continue;
      slot.options.forEach(opt => {
        if (opt.levelReq <= lvl) set.add(`${slotKey}:${opt.id}`);
      });
    }
    this._state.seenOptions = [...set];
    this._save();
  }

  // ── Achats d'options (global — tous avions) ───────────────────────────────
  ownsOption(slotKey, optId) {
    return (this._state.ownedOptions ?? []).includes(`${slotKey}:${optId}`);
  }

  buyOption(slotKey, optId, cost) {
    if (this._state.credits < cost) return false;
    this._state.credits -= cost;
    if (!Array.isArray(this._state.ownedOptions)) this._state.ownedOptions = [];
    const key = `${slotKey}:${optId}`;
    if (!this._state.ownedOptions.includes(key)) this._state.ownedOptions.push(key);
    this._save();
    return true;
  }

  // ── Statistiques ──────────────────────────────────────────────────────────
  get stats() { return this._state.stats; }

  recordGame({ mode, kills = 0, deaths = 0, won = false, wavesCleared = 0,
               flightTimeSec = 0, distanceKm = 0, diff = 'normal', assists = 0 }) {
    const s = this._state.stats;
    s.totalKills   += kills;
    s.totalDeaths  += deaths;
    s.totalGames   += 1;
    s.flightTimeSec += flightTimeSec;
    s.distanceKm   += distanceKm;

    if (mode === 'survival' || mode === 'coop') {
      if (wavesCleared > s.survival.bestWave) s.survival.bestWave = wavesCleared;
      s.survival.timeSec += flightTimeSec;
      const diffIdx = { easy:0, normal:1, hard:2, expert:3 }[diff] ?? 0;
      if (diffIdx > (s.survival.maxDiff ?? 0)) s.survival.maxDiff = diffIdx;
    } else if (mode === 'freeflight' || mode === 'solo') {
      s.mission.maxKills = Math.max(s.mission.maxKills, kills);
      s.mission.timeSec += flightTimeSec;
      if (won) s.mission.victories++;
      const diffIdx = { easy:0, normal:1, hard:2, expert:3 }[diff] ?? 0;
      if (diffIdx > (s.mission.maxDiff ?? 0)) s.mission.maxDiff = diffIdx;
    } else if (mode === 'ffa') {
      if (won) s.versus.wins++; else s.versus.losses++;
      s.versus.kills  += kills;
      s.versus.deaths += deaths;
    } else if (mode === 'tdm') {
      if (won) s.teams.wins++; else s.teams.losses++;
      s.teams.kills   += kills;
      s.teams.deaths  += deaths;
      s.teams.assists += assists;
    }

    this._save();
  }

  // Calcule le ratio K/D
  kd(kills, deaths) {
    return deaths === 0 ? kills : (kills / deaths).toFixed(2);
  }
}

// ── Multiplicateurs de difficulté ────────────────────────────────────────────
export const DIFF_MULT = { easy: 1.0, normal: 1.5, hard: 2.0, expert: 3.0 };

// ── Calcul des récompenses de fin de partie ──────────────────────────────────
export function calcRewards({ mode, kills, deaths, won, wavesCleared, diff, isTraining }) {
  if (isTraining) return { xp: 0, credits: 0, breakdown: [] };

  const mult   = DIFF_MULT[diff] ?? 1.0;
  const bd     = [];
  let xp = 0, credits = 0;

  const addR = (label, x, c) => { xp += x; credits += c; bd.push({ label, xp: x, credits: c }); };

  if (kills > 0)         addR(`${t('rwKills')} ×${kills}`,         kills * 85,          kills * 45);
  if (won)               addR(t('rwVictory'),                        350,                 175);
  if (wavesCleared > 0)  addR(`${t('rwWaves')} ×${wavesCleared}`,   wavesCleared * 140,  wavesCleared * 70);
  if (deaths > 0)        addR(`${t('rwDeaths')} ×${deaths}`,        -deaths * 50,        0);

  xp       = Math.max(0, Math.round(xp      * mult));
  credits  = Math.max(0, Math.round(credits * mult));
  bd.forEach(r => {
    r.xp       = Math.max(0, Math.round(r.xp      * mult));
    r.credits  = Math.round(r.credits * mult);
  });

  return { xp, credits, breakdown: bd };
}

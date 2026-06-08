import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Player } from './Player.js';
import { CameraController } from './CameraController.js';
import { UI } from './UI.js';
import { BulletManager, EnemyBulletManager } from './Bullet.js';
import { Enemy, setAIDebug } from './Enemy.js';
import { TEAM_COLORS } from './Menu.js';
import { VillageMap } from './VillageMap.js';
import { NormandyMap } from './NormandyMap.js';
import { CretesMap } from './CretesMap.js';
import { GroundDefense } from './GroundDefense.js';
import { PracticeMode } from './PracticeMode.js';
import { AudioManager } from './AudioManager.js';

const PLANE_PATHS = {
  blanc: '/Avions/SK_Veh_Plane_Stunt_01_AvionBlanc.glb',
  bleu : '/Avions/SK_Veh_Plane_Stunt_01_AvionBleu.glb',
  jaune: '/Avions/SK_Veh_Plane_Stunt_01_AvionJaune.glb',
  rouge: '/Avions/SK_Veh_Plane_Stunt_01_AvionRouge.glb',
};

// Nombre d'ennemis IA par mode
const AI_COUNTS = { freeflight: 5, solo: 10, coop: 12, multiplayer: 0, ffa: 0, tdm: 0, survival: 0 };

const DIFFICULTY = {
  easy    : { hp:  35, countMult: 0.6 },
  standard: { hp:  65, countMult: 1.0 },
  hard    : { hp: 120, countMult: 1.0 },
};

export class Game {
  constructor(container, config = {}) {
    this.container = container;
    this._config   = {
      mode      : 'solo',
      team      : 'jaune',
      pilotName : 'PILOTE',
      map       : 1,
      maxPlayers: 4,
      ...config,
    };

    // ── Renderer ────────────────────────────────────────────────────────────
    this._isLowEnd = navigator.hardwareConcurrency <= 4 ||
                     (navigator.deviceMemory != null && navigator.deviceMemory <= 4);
    this.renderer = new THREE.WebGLRenderer({ antialias: !this._isLowEnd, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // ── Scène ───────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x7aa0c8, 300, this._isLowEnd ? 1600 : 2200);

    // ── Caméra principale ───────────────────────────────────────────────────
    // near=1.0 (pas 0.1) : la caméra 3e personne est toujours à ≥5u de l'avion,
    // donc 0.1 gaspillait toute la précision du depth buffer sur une plage jamais
    // utilisée → z-fighting des surfaces coplanaires (aéroports) à distance.
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1.0,
      5000
    );

    // ── Horloge pour le delta time ──────────────────────────────────────────
    this.clock = new THREE.Clock();

    // Position lissée de la mire (initialisée au centre)
    this._aimX = window.innerWidth  / 2;
    this._aimY = window.innerHeight / 2;

    // ── Modules du jeu ──────────────────────────────────────────────────────
    const planePath = PLANE_PATHS[this._config.team] || '/SK_Veh_Plane_Stunt_01.glb';
    this.player = new Player(this.scene, { planePath });
    this.cameraController = new CameraController(this.camera, this.player);
    this.bulletManager      = new BulletManager(this.scene);
    this._enemyBulletManager = new EnemyBulletManager(this.scene);
    this._alliedBulletManager = new BulletManager(this.scene); // tirs sol alliés → ennemis
    this.ui            = new UI();
    this.ui.setRespawnCallback(() => this._respawn());

    // ── Environnement ───────────────────────────────────────────────────────
    this._buildSky();
    this._buildClouds();
    this._buildLights();
    this._buildReticle();
    this._buildMuzzleFlash();

    if (this._config.map === 1) {
      this._villageMap = new CretesMap(this.scene);
    } else if (this._config.map === 4) {
      this._villageMap = new VillageMap(this.scene);
    } else if (this._config.map === 5) {
      this._villageMap = new NormandyMap(this.scene);
    } else {
      this._villageMap = null;
      this._buildOcean();
      this._buildGround();
      this._buildWater();
    }

    // Ravitaillement
    this._refuelTimer = 0;

    // ── Resize ──────────────────────────────────────────────────────────────
    window.addEventListener('resize', () => this._onResize());
  }

  // ── Préchargement des assets (appelé avant start()) ────────────────────────
  async preload(onProgress = () => {}) {
    onProgress(5);
    if (this._villageMap) {
      const mapResult = await this._villageMap.build();
      this.getTerrainHeight = mapResult.getTerrainHeight;
      this.isOnRunway = mapResult.isOnRunway;
      onProgress(65);
    } else {
      onProgress(35);
    }
    // Chargement en parallèle : joueur + ennemi aérien + véhicules sol
    const [, enemyGltf, groundModels] = await Promise.all([
      this.player.load(),
      new Promise(res => new GLTFLoader().load('/SK_Veh_Plane_Stunt_01.glb', res, null, () => res(null))),
      GroundDefense.preloadModels(),
    ]);
    this._enemyModelScene   = enemyGltf?.scene ?? null;
    this._groundModelCache  = groundModels;
    onProgress(92);
    this.player.getTerrainHeight = this.getTerrainHeight;
    this.player.isOnRunway = this.isOnRunway ?? null;
    this._applySpawnPosition();
    this._adjustCloudHeights();
    onProgress(100);
    this._preloaded = true;
  }

  // ── Points de spawn selon le mode ────────────────────────────────────────────
  // slot  : index unique du joueur dans la session (0-7), déterministe (tri d'ID)
  // FFA   : 8 points dispersés en cercle, aucune base assignée
  // TDM   : équipe 1 → airports[0], équipe 2 → airports[1], grille de 4×2 slots
  // Autres: tous à airports[0], grille 4×2 autour de la piste
  _applySpawnPosition(overridePos = null) {
    const airports = this._villageMap?.airports;
    if (!airports?.length) { this.player.pivot.position.set(0, 200, 0); return; }

    const mode = this._config.mode;
    const slot = overridePos ? -1 : (this._config.playerSlot ?? 0);

    // ── FFA : cercle de 8 points équidistants, personne ne démarre au même endroit ──
    if (mode === 'ffa' && !overridePos) {
      this._setFFASpawnSlot(slot);
      return;
    }

    if (overridePos) {
      this.player.pivot.position.copy(overridePos.pos);
      this.player._yaw = overridePos.yaw;
      this.player.pivot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), overridePos.yaw);
      return;
    }

    // ── TDM / coop / freeflight / survival / solo : grille autour d'un aéroport ──
    let apIdx = 0;
    if (mode === 'tdm') {
      apIdx = this._config.playerTeam === 'team2' ? Math.min(1, airports.length - 1) : 0;
    }

    const ap    = airports[apIdx];
    const other = airports[apIdx === 0 ? 1 : 0]?.center;

    // Grille 4 colonnes × N rangées — étalement perpendiculaire à la piste
    const COLS    = 4;
    const SPACING = 45;   // écart latéral entre slots
    const DEPTH   = 55;   // écart en profondeur entre rangées
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const perpAng = (ap.ang ?? 0) + Math.PI / 2;
    const fwdAng  = (ap.ang ?? 0);
    const latOff  = (col - (COLS - 1) / 2) * SPACING;
    const px = ap.center.x + latOff * Math.cos(perpAng) - row * DEPTH * Math.cos(fwdAng);
    const pz = ap.center.z - latOff * Math.sin(perpAng) + row * DEPTH * Math.sin(fwdAng);
    const py = ap.center.y + 130 + row * 18;

    this.player.pivot.position.set(px, py, pz);

    if (other) {
      const dx  = other.x - ap.center.x;
      const dz  = other.z - ap.center.z;
      const yaw = Math.atan2(-dx, -dz);
      this.player._yaw = yaw;
      this.player.pivot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    }
  }

  // Spawn FFA : 8 points en cercle, face au centre
  _setFFASpawnSlot(slot) {
    const ang = (slot / 8) * Math.PI * 2 + Math.PI / 8;
    const rad = 900 + (slot % 2) * 250;
    const cx  = Math.cos(ang) * rad;
    const cz  = Math.sin(ang) * rad;
    const h   = (this.getTerrainHeight ? this.getTerrainHeight(cx, cz) : 0) + 180;
    this.player.pivot.position.set(cx, h, cz);
    const yaw = ang + Math.PI; // face au centre de la map
    this.player._yaw = yaw;
    this.player.pivot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  }

  // Respawn FFA : choisit le point le plus loin des joueurs ennemis vivants
  _applyFFARespawn() {
    const enemies = (this._multiplayerManager?.getRemotePlayers() ?? []).filter(e => !e.isDead);
    let bestSlot = 0, bestDist = -1;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const rad = 900 + (i % 2) * 250;
      const cx  = Math.cos(ang) * rad;
      const cz  = Math.sin(ang) * rad;
      const pos = new THREE.Vector3(cx, 200, cz);
      let minDist = Infinity;
      for (const e of enemies) minDist = Math.min(minDist, pos.distanceTo(e.position));
      if (minDist === Infinity) minDist = 99999; // aucun ennemi → tous les points sont bons
      if (minDist > bestDist) { bestDist = minDist; bestSlot = i; }
    }
    this._setFFASpawnSlot(bestSlot);
  }

  // Respawn TDM : base d'équipe, mais recule si un ennemi est trop proche
  _applyTDMRespawn() {
    this._applySpawnPosition(); // position de base selon l'équipe + slot
    const SAFE_DIST = 220;
    const enemies = (this._multiplayerManager?.getRemotePlayers() ?? []).filter(e => e.isEnemy && !e.isDead);
    const pos = this.player.pivot.position;
    const tooClose = enemies.some(e => pos.distanceTo(e.position) < SAFE_DIST);
    if (tooClose) {
      // Reculer de 300 unités dans la direction opposée aux ennemis
      const ap = this._villageMap?.airports;
      const apIdx = this._config.playerTeam === 'team2' ? 1 : 0;
      const base = ap?.[apIdx]?.center ?? pos.clone();
      const awayDir = pos.clone().sub(base).normalize();
      if (awayDir.lengthSq() < 0.001) awayDir.set(0, 0, 1);
      this.player.pivot.position.addScaledVector(awayDir, 300);
      this.player.pivot.position.y = Math.max(this.player.pivot.position.y, base.y + 150);
    }
  }

  // ── Démarrage → retourne une Promise qui se résout quand l'utilisateur quitte ──
  start() {
    return new Promise(async (resolve) => {
      this._quitResolve = resolve;
      await this._startGame();
    });
  }

  async _startGame() {
    if (!this._preloaded) {
      if (this._villageMap) {
        const mapResult = await this._villageMap.build();
        this.getTerrainHeight = mapResult.getTerrainHeight;
        this.isOnRunway = mapResult.isOnRunway;
      }
      await this.player.load();
      this.player.getTerrainHeight = this.getTerrainHeight;
      this.player.isOnRunway = this.isOnRunway ?? null;
      this._applySpawnPosition();
      this._adjustCloudHeights();
    }

    // ── Compteur de parties ───────────────────────────────────────────────────
    this._bumpLifetime('stats_games');

    // ── Audio ────────────────────────────────────────────────────────────────
    this._audio = new AudioManager();
    this._audio.init();
    this._audio.startEngine();
    this.ui._audioRef = this._audio;
    this.ui.setAudio(this._audio);
    this._netSyncTimer = 0;

    this.cameraController.init();
    this._buildPointerLockOverlay();
    this.player.onFire = (pos, quat) => {
      this.bulletManager.fire(pos, quat);
      this._audio.playGunshot();
      if (this._muzzleSprite) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
        this._muzzleSprite.position.copy(pos).addScaledVector(fwd, -0.5);
        this._muzzleSprite.position.y += 0.0;
        this._muzzleSprite.visible = true;
        this._muzzleFlashTimer3D = 0.12;
      }
      if (this._multiplayerManager) this._multiplayerManager.sendBullet(pos, quat);
    };

    this.player.onNoAmmo = () => this._audio.playNoAmmo();

    // Dégâts reçus → son d'alerte
    this.player.onHit = () => this._audio.playPlayerHit();

    // Bouton Start/Menu manette → pause (sauf en multijoueur PvP)
    if (!this._config.networkManager) this.player.onPause = () => { if (!this.isPaused) this._setPause(true); };

    // ── Bases : joueur = airports[0] (Alpha), ennemis = airports[1] (Gamma) ──
    const playerBase = this._villageMap?.airports?.[0]?.center ?? new THREE.Vector3(0,   200, 0);
    const enemyBase  = this._villageMap?.airports?.[1]?.center ?? new THREE.Vector3(800, 200, 800);

    // Difficulté et total de mission
    const mode       = this._config.mode;
    const isPractice = mode === 'freeflight';
    const isFFA      = mode === 'ffa';
    const isTDM      = mode === 'tdm';
    const isSurvival = mode === 'survival';
    const isMulti    = ['multiplayer', 'coop', 'ffa', 'tdm', 'freeflight'].includes(mode);
    this._isSurvival = isSurvival;
    this._isTDM      = isTDM;

    // ── Mise à l'échelle selon le nombre de joueurs (coop/survie multijoueur) ──
    // Solo : playerCount=1 → aucun changement. Chaque joueur additionnel ajoute des
    // ennemis (plus longtemps + plus en l'air) et les rend un peu plus coriaces.
    const playerCount  = Math.max(1, this._config.playerCount ?? 1);
    this._playerCount  = playerCount;
    this._countScale   = 1 + 0.6  * (playerCount - 1);  // ×1, ×1.6, ×2.2, ×2.8
    this._enemyHpMult  = 1 + 0.12 * (playerCount - 1);  // +12% PV / joueur additionnel
    const diff         = this._scaledDiff();

    // Versus et Équipes = joueurs uniquement, zéro IA
    const baseTotal    = this._config.totalEnemies ?? 30;
    const missionTotal = (isPractice || isSurvival || isFFA || isTDM)
      ? 0 : Math.round(baseTotal * this._countScale);

    // Timer de match pour les modes compétitifs (0 = illimité)
    const timeLimitMin = (isFFA || isTDM) ? (this._config.ffaTimeLimit ?? 0) : 0;
    this._timeRemaining = timeLimitMin > 0 ? timeLimitMin * 60 : null;
    if (this._timeRemaining !== null) this.ui.setMatchTimer(this._timeRemaining);
    const MAX_ACTIVE   = this._isLowEnd ? 8 : Math.min(30, 15 + 5 * (playerCount - 1));
    const WAVE_SIZE    = 5;

    // État de mission
    this._missionTotal      = missionTotal;
    this._missionSpawned    = 0;
    this._missionKilled     = 0;
    this._waveKillThreshold = WAVE_SIZE;
    this._maxActive         = MAX_ACTIVE;
    this._waveSize          = WAVE_SIZE;
    this._missionComplete   = false;
    this._aiDebug           = false;

    const pickSkill = () => {
      if (isPractice || isFFA) return 'regular';
      const r = Math.random();
      if (r < 0.65) return 'regular';
      return 'ace';
    };

    this.enemies = [];
    this._enemyNetIdCounter = 0;
    const initialCount = Math.min(MAX_ACTIVE, missionTotal);
    if (initialCount > 0) {
      this._spawnInitialWave(initialCount, diff, playerBase, enemyBase, pickSkill, isFFA);
    }

    // ── Mode survie : état des vagues ────────────────────────────────────────
    this._survivalWave          = 0;
    this._survivalKills         = 0;
    this._survivalCountdown     = 0;
    this._survivalBetweenWaves  = false;
    if (isSurvival) {
      this.ui.setSurvivalMode(true);
      this._survivalBetweenWaves = true;
      this._survivalCountdown    = 3;  // 3s avant la première vague
    }

    // ── Mode pratique : anneaux + cibles + ennemis passifs abattables ─────────
    this._practiceMode = null;
    this._practiceEnemyBase = enemyBase;
    if (isPractice) {
      this._practiceMode = new PracticeMode(this.scene, playerBase);
      this._practiceMode.build();
      for (let i = 0; i < 5; i++) this._spawnPracticeEnemy();
    }

    // ── Défense au sol — Mission/Survie (active) + Training (décor passif) ────
    // En training : tours et camions présents comme décor, mais passifs (ne tirent
    // jamais) et sans marqueur d'équipe (rien d'hostile à signaler).
    if (!isFFA && !isTDM && this._villageMap?.getVillageZones) {
      const zones = this._villageMap.getVillageZones();
      const villages = zones.map((z, i) => ({
        x: z.x, z: z.z,
        team: z.team ?? (i === 0 ? 'ally' : 'enemy'),
      }));
      const runways = this._villageMap.airports.map((ap, i) => ({
        x: ap.center.x, z: ap.center.z, ang: ap.ang ?? 0,
        surfaceY: ap.surfaceY ?? null,
        team: i === 0 ? 'ally' : 'enemy',
      }));
      this._groundDefense = new GroundDefense(this.scene, this.getTerrainHeight, isPractice);
      this._groundDefense.build(villages, runways, this._groundModelCache, isPractice);
    }

    // Mode multijoueur : initialiser le gestionnaire de joueurs distants
    if (isMulti && this._config.networkManager) {
      const { MultiplayerManager } = await import('./MultiplayerManager.js');
      this._multiplayerManager = new MultiplayerManager(
        this.scene, this._config.networkManager,
        { mode, playerTeam: this._config.playerTeam, friendlyFire: this._config.friendlyFire }
      );
      // Ajouter les joueurs déjà présents dans le lobby au moment du démarrage
      (this._config.remotePlayers || []).forEach(p => this._multiplayerManager.addRemotePlayer(p.id, p));

      // Ennemi abattu par un autre joueur → le tuer localement aussi
      this._multiplayerManager.on('enemy_killed', ({ netId }) => {
        const e = this.enemies.find(e => e.netId === netId && !e.isDead);
        if (e) e.hit(99999);
      });
    }

    // Mode Équipes : compteurs de score par équipe
    this._myTeamScore  = 0;
    this._oppTeamScore = 0;
    if (isTDM) {
      this.ui.setTDMMode(true, this._config.playerTeam ?? 'team1');
      // Quand un joueur distant meurt → crédit à l'équipe adverse ou à la nôtre
      if (this._multiplayerManager) {
        this._multiplayerManager.on('remote_player_died', ({ isEnemy }) => {
          if (isEnemy) {
            this._myTeamScore++;
            this.stats.kills++;
          } else {
            this._oppTeamScore++;
          }
          this.ui.setTDMScore(this._myTeamScore, this._oppTeamScore);
        });
      }
    }

    // Stats DE LA PARTIE (repartent à 0) — affichées sur le HUD
    // Le cumul de toutes les parties reste dans localStorage (visible au menu)
    this.stats = {
      kills  : 0,
      deaths : 0,
      pilotName: this._config.pilotName,
      mode     : this._config.mode,
    };

    // Réseau : timer de sync
    this._netSyncTimer = 0;

    this._playerWasAlive  = true;
    this._spectatorMode   = false;
    this._spectatorTarget = null;
    this.isPaused = false;
    this._destroyed = false;

    const isPvP  = !!this._config.networkManager;
    const onQuit = () => {
      if (this._isSurvival) {
        this._setPause(false);
        this.ui.showSurvivalEnd(() => this._quit());
      } else {
        this._quit();
      }
    };

    this._keydownHandler = (e) => {
      if (this.player.isDead) return;
      const key = e.key;
      if (isPvP) {
        // Multijoueur : Echap ouvre l'overlay ESC sans pause
        if (key === 'Escape' || key === 'p' || key === 'P') {
          const visible = this._escMenuVisible = !this._escMenuVisible;
          this.ui.showEscMenu(visible, onQuit);
          if (visible) document.exitPointerLock();
          else         document.body.requestPointerLock();
        }
      } else {
        if ((key === 'p' || key === 'P') && !this.isPaused) this._setPause(true);
        if (key === 'i' || key === 'I') {
          this._aiDebug = !this._aiDebug;
          setAIDebug(this._aiDebug);
        }
      }
    };
    document.addEventListener('keydown', this._keydownHandler);
    this._escMenuVisible = false;

    // Pointer lock perdu → pause automatique (sauf multijoueur)
    this._pauseCooldownUntil = 0;
    this._pllHandler = () => {
      if (this.player.isDead || isPvP) return;
      if (!document.pointerLockElement && !this.isPaused
          && performance.now() > this._pauseCooldownUntil) {
        this._setPause(true);
      }
    };
    document.addEventListener('pointerlockchange', this._pllHandler);

    // Callback réapparaître : remet le joueur à sa base, restaure carburant/santé
    const onRespawn = () => {
      this.player.health   = 100;
      this.player.fuel     = 100;
      this.player.isDead   = false;
      this.player.isLanded = false;
      this.player.engineOn = true;
      this.player.speed    = 30;
      this.player._sinkRate = 0;
      this.player._prevY    = null;
      this._applySpawnPosition();
      this._setPause(false);
    };

    const onResume = () => this._setPause(false);
    this.ui.showPause(false, onQuit, onResume, onRespawn, this._isSurvival);

    // Boutons des écrans de fin : menu = retour menu ; rejouer = même partie
    // (solo uniquement — réutiliser une connexion réseau au replay n'a pas de sens).
    this.ui.setEndCallbacks({
      onMenu  : () => this._quit('menu'),
      onReplay: this._config.networkManager ? null : () => this._quit('replay'),
    });

    this.clock.getDelta();
    this._loop();
  }

  // Navigation manette dans le menu pause
  _pollPauseGamepad() {
    const gamepads = navigator.getGamepads?.();
    const gp = gamepads ? Array.from(gamepads).find(g => g !== null) : null;
    if (!gp) return;

    const prev = this._pauseGpPrev ?? {};
    const dz   = (v) => Math.abs(v) < 0.3 ? 0 : v;
    const up   = (gp.buttons[12]?.pressed) || dz(gp.axes[1]) < -0.5;
    const down = (gp.buttons[13]?.pressed) || dz(gp.axes[1]) >  0.5;
    const btnA = gp.buttons[0]?.pressed ?? false;
    const btnStart = gp.buttons[9]?.pressed ?? false;

    if (up && !prev.up) {
      const btns = Array.from(document.querySelectorAll('[data-pause-overlay] button, .pause-nav button'))
        .filter(b => b.offsetParent);
      // Fallback : chercher dans le overlay de pause
      const all = document.querySelectorAll('button');
      const visible = Array.from(all).filter(b => b.offsetParent && window.getComputedStyle(b).display !== 'none');
      const idx = visible.indexOf(document.activeElement);
      if (idx > 0) visible[idx - 1].focus();
      else if (visible.length) visible[visible.length - 1].focus();
    }
    if (down && !prev.down) {
      const all = document.querySelectorAll('button');
      const visible = Array.from(all).filter(b => b.offsetParent && window.getComputedStyle(b).display !== 'none');
      const idx = visible.indexOf(document.activeElement);
      if (idx >= 0 && idx < visible.length - 1) visible[idx + 1].focus();
      else if (visible.length) visible[0].focus();
    }
    if (btnA && !prev.a) {
      const focused = document.activeElement;
      if (focused && focused.tagName === 'BUTTON') focused.click();
    }
    // Start → reprendre
    if (btnStart && !prev.start) this._setPause(false);

    this._pauseGpPrev = { up, down, a: btnA, start: btnStart };
  }

  _wireEnemyFire(enemy) {
    enemy.netId = this._enemyNetIdCounter++;
    enemy.onFire = (pos, quat) => this._enemyBulletManager.fire(pos, quat);
  }

  // Première vague : spawn en altitude autour de la base ennemie (ou dispersés en FFA)
  _spawnInitialWave(count, diff, playerBase, enemyBase, pickSkill, scattered = false) {
    const attackCount  = Math.round(count * 0.45);
    const attackerOpts = {
      role: 'attacker', homeZone: { x: playerBase.x, z: playerBase.z, radius: 650 }, leash: 1600,
    };
    const defenderOpts = {
      role: 'defender', homeZone: { x: enemyBase.x, z: enemyBase.z, radius: 700 }, leash: 600, detect: 2200,
    };
    // Niveaux d'altitude pour les défenseurs — répartition basse/moyenne/haute
    const _defAlt = () => {
      const r = Math.random();
      if (r < 0.35) return { minAlt: 90,  clearance: 50  }; // bas — couvert par les tourelles
      if (r < 0.75) return {};                                // moyen — défaut
      return          { minAlt: 380, clearance: 100 };       // haut — couverture aérienne
    };
    const roamOpts = {
      role: 'attacker', homeZone: { x: 0, z: 0, radius: 3000 }, leash: 4000,
    };
    const mkSpawn = () => {
      if (scattered) {
        // Dispersés aléatoirement sur la carte
        const ang = Math.random() * Math.PI * 2;
        const r   = 400 + Math.random() * 1800;
        return new THREE.Vector3(Math.cos(ang)*r, 200 + Math.random()*200, Math.sin(ang)*r);
      }
      const ang = Math.random() * Math.PI * 2;
      const r   = 180 + Math.random() * 280;
      return new THREE.Vector3(enemyBase.x + Math.cos(ang)*r, 200 + Math.random()*120, enemyBase.z + Math.sin(ang)*r);
    };
    let created = 0;
    while (created < count) {
      const remaining  = count - created;
      const groupSize  = remaining > 2 ? (Math.random() < 0.4 ? 3 : 2) : 1;
      const baseOpts  = scattered ? roamOpts : (created < attackCount ? attackerOpts : defenderOpts);
      const altOpts   = (!scattered && created >= attackCount) ? _defAlt() : {};
      const opts      = { ...baseOpts, ...altOpts };
      const skill     = pickSkill();
      const spawn     = mkSpawn();

      const leader = new Enemy(this.scene, spawn.clone(), { hp: diff.hp, ...opts, skill, preloadedScene: this._enemyModelScene });
      leader.getTerrainHeight = this.getTerrainHeight ?? null;
      this._wireEnemyFire(leader);
      this.enemies.push(leader);
      created++;

      const wingCount = Math.min(groupSize - 1, remaining - 1);
      for (let w = 0; w < wingCount && created < count; w++) {
        const side   = w % 2 === 0 ? -1 : 1;
        const offset = new THREE.Vector3(side*(32+w*14), 5+w*3, -24-w*10);
        const wPos   = spawn.clone().add(new THREE.Vector3(side*52, 0, -42));
        const wingman = new Enemy(this.scene, wPos, {
          hp: diff.hp, role: 'wingman', leader, wingOffset: offset,
          homeZone: opts.homeZone, leash: opts.leash, skill, preloadedScene: this._enemyModelScene,
        });
        wingman.getTerrainHeight = this.getTerrainHeight ?? null;
        this._wireEnemyFire(wingman);
        this.enemies.push(wingman);
        created++;
      }
    }
    this._missionSpawned += count;
  }

  // Ennemi passif (mode entraînement) — abattable, respawn à l'aéroport ennemi
  _spawnPracticeEnemy() {
    const base = this._practiceEnemyBase ?? new THREE.Vector3(250, 42, 2390);
    const ang  = Math.random() * Math.PI * 2;
    const r    = 20 + Math.random() * 40;
    const sp   = new THREE.Vector3(base.x + Math.cos(ang)*r, base.y + 160 + Math.random()*60, base.z + Math.sin(ang)*r);
    const homeBase = this._villageMap?.airports?.[0]?.center ?? new THREE.Vector3(0, 45, 0);
    const e = new Enemy(this.scene, sp, {
      hp: 80, skill: 'regular', role: 'defender',
      homeZone: { x: homeBase.x, z: homeBase.z, radius: 600 }, leash: 800,
      passive: true,
      preloadedScene: this._enemyModelScene,
    });
    e.getTerrainHeight = this.getTerrainHeight ?? null;
    e.onFire = null;
    this.enemies.push(e);
  }

  // Vague de renfort depuis l'aéroport ennemi (décollage visible)
  // Difficulté ajustée par le nombre de joueurs (PV ×_enemyHpMult)
  _scaledDiff() {
    const base = DIFFICULTY[this._config.difficulty] ?? DIFFICULTY.standard;
    return { hp: Math.round(base.hp * (this._enemyHpMult ?? 1)), countMult: base.countMult };
  }

  _spawnWave(count) {
    const enemyBase  = this._villageMap?.airports?.[1]?.center ?? new THREE.Vector3(800, 45, 800);
    const playerBase = this._villageMap?.airports?.[0]?.center ?? new THREE.Vector3(0, 45, 0);
    const diff       = this._scaledDiff();
    const pickSkill  = () => { const r=Math.random(); return r<0.65?'regular':'ace'; };
    // Tous attaquants sauf le dernier (un défenseur de base)
    const attackCount = Math.max(count - 1, 0);

    for (let i = 0; i < count; i++) {
      const ang      = Math.random() * Math.PI * 2;
      const spread   = Math.random() * 30;
      const spawnPos = new THREE.Vector3(
        enemyBase.x + Math.cos(ang) * spread,
        enemyBase.y + 4 + i * 3,
        enemyBase.z + Math.sin(ang) * spread,
      );
      const isAttacker = i < attackCount;
      const baseOpts = isAttacker
        ? { role: 'attacker', homeZone: { x: playerBase.x, z: playerBase.z, radius: 650 }, leash: 1600 }
        : { role: 'defender', homeZone: { x: enemyBase.x,  z: enemyBase.z,  radius: 700 }, leash: 600, detect: 2200 };
      const waveAltOpts = !isAttacker ? (() => {
        const r = Math.random();
        if (r < 0.35) return { minAlt: 90,  clearance: 50  };
        if (r < 0.75) return {};
        return          { minAlt: 380, clearance: 100 };
      })() : {};
      const opts = { ...baseOpts, ...waveAltOpts };

      const enemy = new Enemy(this.scene, spawnPos, { hp: diff.hp, ...opts, skill: pickSkill(), preloadedScene: this._enemyModelScene });
      enemy.getTerrainHeight = this.getTerrainHeight ?? null;
      this._wireEnemyFire(enemy);
      this.enemies.push(enemy);
    }
    this._missionSpawned += count;
  }

  // ── Vague survie ─────────────────────────────────────────────────────────
  _startSurvivalWave() {
    this._survivalWave++;
    // Plus de joueurs → vagues plus grosses + avions un peu plus coriaces
    const count = Math.floor((3 + this._survivalWave * 1.5) * (this._countScale ?? 1));
    const hp    = Math.round((30 + this._survivalWave * 10) * (this._enemyHpMult ?? 1));
    // Spawn autour de la base ennemie — pas près du joueur
    const enemyBase  = this._villageMap?.airports?.[1]?.center ?? new THREE.Vector3(800, 45, 800);
    const playerBase = this._villageMap?.airports?.[0]?.center ?? new THREE.Vector3(0, 45, 0);

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r   = 120 + Math.random() * 280;
      const sp  = new THREE.Vector3(
        enemyBase.x + Math.cos(ang) * r,
        120 + Math.random() * 160,
        enemyBase.z + Math.sin(ang) * r,
      );
      // Progression douce : rookies au départ, aces progressivement
      const aceChance = Math.min(0.65, 0.10 + this._survivalWave * 0.05);
      const skill = Math.random() < aceChance ? 'ace' : (Math.random() < 0.5 ? 'regular' : 'rookie');
      const enemy = new Enemy(this.scene, sp, {
        hp, skill, role: 'attacker',
        homeZone: { x: playerBase.x, z: playerBase.z, radius: 6000 }, leash: 7000,
        preloadedScene: this._enemyModelScene,
      });
      enemy.getTerrainHeight = this.getTerrainHeight ?? null;
      this._wireEnemyFire(enemy);
      this.enemies.push(enemy);
    }
    this.ui.showSurvivalWave(this._survivalWave, count);
    this.ui.showSurvivalCountdown(0);
  }

  _renderAIDebug() {
    if (!this._dbgCanvas) {
      this._dbgCanvas = document.createElement('canvas');
      Object.assign(this._dbgCanvas.style, {
        position: 'fixed', top: '80px', right: '20px',
        background: 'rgba(0,0,0,0.70)', border: '1px solid #3a3020',
        fontFamily: '"Courier New",monospace', pointerEvents: 'none', zIndex: '400',
        width: '430px',
      });
      document.body.appendChild(this._dbgCanvas);
    }
    const rows = ['[I] DEBUG IA  (role/skill état | j=joueur b=base | hp alt clr)', ''];
    const tag = { attacker: 'ATK', defender: 'DEF', wingman: 'WNG' };
    const sk  = { rookie: 'rk', regular: 'rg', ace: 'AC' };
    for (const e of this.enemies.slice(0, 12)) {
      if (!e._loaded) continue;
      const d = e.debugInfo;
      rows.push(
        `${e.isDead ? '✗' : '●'} ${(tag[d.role] || '?').padEnd(3)} ${(sk[d.skill] || '?')} ` +
        `${(d.state || '?').padEnd(7)} ` +
        `j:${String(d.dist).padStart(4)} b:${String(d.distHome).padStart(4)} | ` +
        `hp:${String(d.hp).padStart(3)} a:${String(d.alt).padStart(3)} c:${String(d.terrainClear).padStart(3)}`
      );
    }
    const lh = 16, pad = 8;
    const h  = rows.length * lh + pad * 2;
    this._dbgCanvas.width  = 430;
    this._dbgCanvas.height = h;
    const ctx = this._dbgCanvas.getContext('2d');
    ctx.clearRect(0, 0, 430, h);
    ctx.font = '11px "Courier New"';
    rows.forEach((r, i) => {
      const y = pad + i * lh;
      const col = i === 0 ? '#d4c88a' : i === 1 ? '#3a3020' : '#88aa66';
      ctx.fillStyle = col;
      ctx.fillText(r, pad, y + lh - 3);
    });
    if (!this._aiDebug && this._dbgCanvas) {
      this._dbgCanvas.remove(); this._dbgCanvas = null;
    }
  }

  // action : 'menu' (défaut) ou 'replay' (main.js relance la même config).
  // La déconnexion réseau est gérée par destroy() après résolution.
  _quit(action = 'menu') {
    if (this._quitResolve) {
      this._quitResolve({ action });
      this._quitResolve = null;
    }
  }

  // Cumul persistant de toutes les parties
  _bumpLifetime(key) {
    const v = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(v));
  }

  // ── Helpers stats per-map/mode ────────────────────────────────────────────
  _statKey(statName) {
    const mode  = this._config?.mode  || 'solo';
    const mapId = this._config?.map   || 4;
    return `stats_${mode}_${mapId}_${statName}`;
  }

  _updateBestWave(wave) {
    // Global (panneau paramètres)
    const globalBest = parseInt(localStorage.getItem('stats_bestWave') || '0', 10);
    if (wave > globalBest) localStorage.setItem('stats_bestWave', String(wave));
    // Par carte + difficulté
    const diff = this._config?.difficulty || 'standard';
    const key  = this._statKey(`bestWave_${diff}`);
    const best = parseInt(localStorage.getItem(key) || '0', 10);
    if (wave > best) localStorage.setItem(key, String(wave));
  }

  _updateMissionRecord() {
    const diff  = this._config?.difficulty || 'standard';
    const kills = this.stats?.kills ?? 0;
    // Difficulté max (easy < standard < hard)
    const ORDER = { easy: 0, standard: 1, hard: 2 };
    const keyDiff = this._statKey('highestDiff');
    const prevDiff = localStorage.getItem(keyDiff);
    if (prevDiff === null || ORDER[diff] > ORDER[prevDiff]) {
      localStorage.setItem(keyDiff, diff);
    }
    // Max ennemis éliminés
    const keyEn = this._statKey('mostEnemies');
    const prev = parseInt(localStorage.getItem(keyEn) || '0', 10);
    if (kills > prev) localStorage.setItem(keyEn, String(kills));
  }

  _updateFFARecord(elim) {
    const keyElim = this._statKey('bestElim');
    if ((elim || 0) > parseInt(localStorage.getItem(keyElim) || '0', 10)) {
      localStorage.setItem(keyElim, String(elim));
    }
  }

  _respawn() {
    const p = this.player;
    p.health   = 100;
    p.fuel     = 100;
    p.ammo     = 200;
    p.speed    = 30;
    p.isDead   = false;
    p.isLanded = false;
    p.engineOn = true;
    p._pitch   = 0;
    p._roll    = 0;
    p._sHoldTime = 0;
    p._sinkRate  = 0;
    p._groundDamageCooldown = 1.5;

    const mode = this._config.mode;
    if (mode === 'ffa') {
      this._applyFFARespawn();        // point le plus loin des ennemis
    } else if (mode === 'tdm') {
      this._applyTDMRespawn();        // base d'équipe, recule si ennemi proche
    } else {
      this._applySpawnPosition();     // base alliée (slot initial)
    }

    // Informer les autres joueurs de la réapparition
    if (this._multiplayerManager) {
      const pos = p.position;
      this._config.networkManager.send('player_respawn', {
        position: { x: pos.x, y: pos.y, z: pos.z }
      });
    }

    document.body.requestPointerLock();
  }

  // ── Mode spectateur (survie multijoueur) ──────────────────────────────────
  _enterSpectator() {
    this._spectatorMode   = true;
    const remotePlayers   = this._multiplayerManager?.getRemotePlayers() ?? [];
    this._spectatorTarget = remotePlayers.find(p => !p.isDead) ?? null;
    this.ui.showSpectatorBanner(true);
  }

  _exitSpectator() {
    this._spectatorMode   = false;
    this._spectatorTarget = null;
    this.ui.showSpectatorBanner(false);
    this._respawn();
  }

  // ── Pause ────────────────────────────────────────────────────────────────
  _setPause(paused) {
    this.isPaused = paused;
    this.ui.showPause(paused, () => this._quit(), () => {
      // Reprendre via le bouton UI (manette / clavier)
      this._pauseCooldownUntil = performance.now() + 500;
      this._setPause(false);
      document.body.requestPointerLock();
    });
    if (paused) {
      // Marquer le bouton Start comme déjà enfoncé pour éviter un dépause immédiat
      this._pauseGpPrev = { up: false, down: false, a: false, start: true };
      this._audio?.pauseEngine(true);   // couper moteur + moteurs ennemis en pause
      document.exitPointerLock();
      if (this._pointerLockHint) this._pointerLockHint.style.display = 'none';
      // Nettoyer tout listener précédent avant d'en ajouter un nouveau
      if (this._resumeHandler) {
        document.removeEventListener('mousedown', this._resumeHandler);
      }
      this._resumeHandler = (e) => {
        if (e.target.closest('button, a, input')) return;
        document.removeEventListener('mousedown', this._resumeHandler);
        this._resumeHandler = null;
        this._pauseCooldownUntil = performance.now() + 500; // ignore pointerlockchange pendant 500ms
        this._setPause(false);
        document.body.requestPointerLock();
      };
      document.addEventListener('mousedown', this._resumeHandler);
    } else {
      this._audio?.pauseEngine(false);  // restaurer moteurs en reprenant
      if (this._resumeHandler) {
        document.removeEventListener('mousedown', this._resumeHandler);
        this._resumeHandler = null;
      }
    }
  }

  // ── Boucle principale ────────────────────────────────────────────────────
  _loop() {
    if (this._destroyed) return;
    this._loopId = requestAnimationFrame(() => this._loop());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Sync hint visibilité chaque frame — masqué si souris capturée OU manette active
    if (this._pointerLockHint) {
      const locked   = document.pointerLockElement === document.body;
      const gpActive = Array.from(navigator.getGamepads?.() ?? []).some(g => g?.connected);
      const hide     = locked || this.isPaused || this.player?.isDead || this._missionComplete || gpActive;
      this._pointerLockHint.style.display = hide ? 'none' : 'block';
    }

    // Pause : on rend mais on ne met pas à jour la physique
    if (this.isPaused) {
      this.renderer.render(this.scene, this.camera);
      this._pollPauseGamepad();
      return;
    }

    try {
    // ── Timer de match (Versus / Équipes) ────────────────────────────────────
    if (this._timeRemaining !== null && !this._missionComplete) {
      this._timeRemaining -= delta;
      this.ui.updateMatchTimer(this._timeRemaining);
      if (this._timeRemaining <= 0) {
        this._timeRemaining = 0;
        this._missionComplete = true;
        document.exitPointerLock();
        if (this._pointerLockHint) this._pointerLockHint.style.display = 'none';
        this._updateFFARecord(this.stats.kills);
        this.ui.showVictory(
          this.stats,
          this._config.networkManager ? null : () => this._quit('replay'),
          () => this._quit(),
        );
      }
    }

    // Met à jour la physique / les contrôles du joueur
    this.player.update(delta);

    // Mode spectateur (survie MP) : piloter la caméra vers un allié vivant
    if (this._spectatorMode) {
      // Rafraîchir la cible si elle est morte
      if (!this._spectatorTarget || this._spectatorTarget.isDead) {
        const remotePlayers = this._multiplayerManager?.getRemotePlayers() ?? [];
        this._spectatorTarget = remotePlayers.find(p => !p.isDead) ?? null;
      }
      if (this._spectatorTarget) {
        // Le CameraController suit player.pivot → on le déplace sur la cible
        this.player.pivot.position.copy(this._spectatorTarget.position);
        this.player.pivot.quaternion.copy(this._spectatorTarget.quaternion);
      }
      // Tous les alliés morts → game over (on le montre une seule fois)
      const allDead = (this._multiplayerManager?.getRemotePlayers() ?? []).every(p => p.isDead);
      if (allDead) {
        this._spectatorMode = false;
        this.ui.showSpectatorBanner(false);
        this.ui.showSurvivalGameOver(
          this._survivalWave, this._survivalKills,
          () => this._quit(),
          null,
        );
      }
    }

    // Mort du joueur
    if (this._playerWasAlive && this.player.isDead) {
      this.stats.deaths++;
      this._bumpLifetime('stats_deaths');
      document.exitPointerLock();
      if (this._pointerLockHint) this._pointerLockHint.style.display = 'none';
      // TDM : mort du joueur local = point pour l'équipe adverse
      if (this._isTDM) {
        this._oppTeamScore++;
        this.ui.setTDMScore(this._myTeamScore, this._oppTeamScore);
      }
      if (this._isSurvival) {
        this._updateBestWave(this._survivalWave);
        // Multijoueur : entrer en spectateur si des alliés sont connectés (vivants ou pas encore à jour)
        const remotePlayers = this._multiplayerManager?.getRemotePlayers() ?? [];
        const hasAllies     = !!this._config.networkManager && remotePlayers.length > 0;
        const anyAllyAlive  = hasAllies && remotePlayers.some(p => !p.isDead);
        if (hasAllies && (anyAllyAlive || remotePlayers.length > 0)) {
          this._enterSpectator();
        } else {
          this.ui.showSurvivalGameOver(
            this._survivalWave, this._survivalKills,
            () => this._quit(),
            this._config.networkManager ? null : () => this._quit('replay'),
          );
        }
      }
    }
    this._playerWasAlive = !this.player.isDead;
    this.bulletManager.update(delta);
    this._enemyBulletManager.update(delta);
    this._alliedBulletManager.update(delta);

    // Défense au sol : visée + tir des tourelles AA
    if (this._groundDefense) {
      this._groundDefense.update(delta, {
        playerPos  : this.player.position,
        playerAlive: !this.player.isDead,
        enemies    : this.enemies,
        enemyFire  : (pos, quat, dmg) => this._enemyBulletManager.fire(pos, quat, dmg),
        alliedFire : (pos, quat, dmg) => this._alliedBulletManager.fire(pos, quat, dmg, true),
      });
    }

    // Balles ennemies → dégâts au joueur
    if (!this.player.isDead) {
      for (const b of this._enemyBulletManager.getBullets()) {
        if (b.age >= 999) continue;
        if (b.mesh.position.distanceTo(this.player.position) < 8) {
          this.player.health = Math.max(0, this.player.health - (b.dmg ?? 7));
          b.age = 999;
          this.ui.showPlayerHit();
          this._audio?.playPlayerHit();
        }
      }
    }

    // Balles alliées (sol) → dégâts aux avions ennemis
    for (const b of this._alliedBulletManager.getBullets()) {
      for (const e of this.enemies) {
        if (!e.isDead && b.mesh.position.distanceTo(e.position) < 9) {
          e.hit(25); b.age = 999; break;
        }
      }
    }

    // Mise à jour ennemis + détection collision balles joueur
    const allyGroundTargets = this._groundDefense
      ? this._groundDefense.units.filter(u => !u.isDead && u.team === 'ally')
      : [];
    for (const enemy of this.enemies) {
      enemy.update(delta, this.player.position, allyGroundTargets);

      if (!enemy.isDead) {
        for (const b of this.bulletManager.getBullets()) {
          if (b.age >= 999) continue;
          if (b.mesh.position.distanceTo(enemy.position) < 9) {
            const wasAlive = !enemy.isDead;
            enemy.hit(25);
            b.age = 999;
            this.ui.showHitMarker();
            this._audio?.playImpact('plane');
            if (wasAlive && enemy.isDead) {
              this._audio?.playExplosion(1.0);
              this._audio?.removeEnemyEngine(enemy);
              this.stats.kills++;
              this._multiplayerManager?.sendEnemyKill(enemy.netId);
              this._bumpLifetime('stats_kills');
              if (this._isSurvival) this._survivalKills++;
              // Mode entraînement : respawn un ennemi passif à la base ennemie après 5s
              if (this._practiceMode) {
                setTimeout(() => { if (this._practiceMode) this._spawnPracticeEnemy(); }, 5000);
              } else {
                this._missionKilled++;
                while (this._missionKilled >= this._waveKillThreshold &&
                       this._missionSpawned < this._missionTotal) {
                  const alive     = this.enemies.filter(e => !e.isDead).length;
                  const canSpawn  = Math.min(this._waveSize, this._missionTotal - this._missionSpawned,
                                             this._maxActive - alive);
                  if (canSpawn > 0) this._spawnWave(canSpawn);
                  this._waveKillThreshold += this._waveSize;
                }
              }
            }
          }
        }
      }
    }

    // Balles joueur → véhicules/tourelles au sol ennemis
    if (this._groundDefense) {
      for (const b of this.bulletManager.getBullets()) {
        if (b.age >= 999) continue;
        const u = this._groundDefense.damageAt(b.mesh.position, 14, 25);
        if (u) {
          b.age = 999;
          this.ui.showHitMarker();
          this._audio?.playImpact('structure');
          if (u.isDead) {
            this._audio?.playExplosion(0.7);
            this.stats.kills++;
            this._bumpLifetime('stats_kills');
          }
        }
      }
    }

    // Purger les ennemis dont l'animation de mort est terminée (mesh=null)
    this.enemies = this.enemies.filter(e => !e.isDead || e.mesh !== null);

    // Mode survie : gestion des vagues infinies
    // En mode spectateur (survie MP) : la boucle continue même si le joueur local est mort
    if (this._isSurvival && (!this.player.isDead || this._spectatorMode)) {
      if (this._survivalBetweenWaves) {
        this._survivalCountdown -= delta;
        this.ui.showSurvivalCountdown(Math.max(1, Math.ceil(this._survivalCountdown)));
        if (this._survivalCountdown <= 0) {
          this._survivalBetweenWaves = false;
          // Réapparition automatique du spectateur au début de chaque nouvelle vague
          if (this._spectatorMode) this._exitSpectator();
          this._startSurvivalWave();
        }
      } else {
        const aliveCount = this.enemies.filter(e => !e.isDead).length;
        this.ui.updateSurvivalAlive(aliveCount);
        if (aliveCount === 0) {
          this._survivalBetweenWaves = true;
          this._survivalCountdown    = 10;
        }
      }
    }

    // Vérification victoire : toutes vagues envoyées, tous avions morts, tous ennemis sol morts
    if (!this._isSurvival && !this._missionComplete && !this.player.isDead && this._missionTotal > 0) {
      const allAirDead    = this._missionSpawned >= this._missionTotal && this.enemies.every(e => e.isDead);
      const allGroundDead = !this._groundDefense || this._groundDefense.allEnemiesDead();
      if (allAirDead && allGroundDead) {
        this._missionComplete = true;
        document.exitPointerLock();
        if (this._pointerLockHint) this._pointerLockHint.style.display = 'none';
        this._updateMissionRecord();
        this.ui.showVictory(
          this.stats,
          this._config.networkManager ? null : () => this._quit('replay'),
          () => this._quit(),
        );
      }
    }

    // HUD mission
    if (!this._isSurvival && this._missionTotal > 0) {
      const remaining = Math.max(0, this._missionTotal - this._missionKilled);
      const active    = this.enemies.filter(e => !e.isDead).length;
      const turrets   = this._groundDefense ? this._groundDefense.getEnemyCountByKind('mg')    : 0;
      const armor     = this._groundDefense ? this._groundDefense.getEnemyCountByKind('tank','truck') : 0;
      this.ui.updateMissionHUD(remaining, active, turrets, armor);
    }

    // Mode pratique : anneaux + cibles
    if (this._practiceMode) {
      this._practiceMode.update(delta, this.player.position);
      const hit = this._practiceMode.checkBulletHits(this.bulletManager.getBullets());
      if (hit) this.ui.showHitMarker();
    }

    // Multijoueur : mise à jour joueurs distants + sync réseau
    if (this._multiplayerManager) {
      this._multiplayerManager.update(delta);
      this._netSyncTimer += delta;
      if (this._netSyncTimer >= 0.05) { // 20 Hz
        this._multiplayerManager.sendLocalState(this.player);
        this._netSyncTimer = 0;
      }
    }

    // Mise à jour carte Village (ballons, etc.)
    if (this._villageMap) this._villageMap.update(delta);

    // ── Audio : moteur joueur + moteurs ennemis ───────────────────────────────
    if (this._audio?.ready) {
      this._audio.updateEngine(this.player.speed, 120, this.player.engineOn);

      if (this.player.isLanded) {
        this._audio.updateGroundRoll(this.player.speed, 120);
      } else {
        this._audio.stopGroundRoll();
      }

      const listenerPos = this.player.position;
      this._audioEnemyTimer = (this._audioEnemyTimer || 0) + delta;
      if (this._audioEnemyTimer >= 0.05) { // 20 Hz pour les moteurs ennemis
        this._audioEnemyTimer = 0;
        const activeIds = new Set();
        for (const e of this.enemies) {
          if (!e.isDead) {
            this._audio.updateEnemyEngine(e, e.position, e.speed ?? 60, 120, listenerPos);
            activeIds.add(e);
          }
        }
        // Nettoyer les ennemis morts / disparus
        for (const key of this._audio._enemies.keys()) {
          if (!activeIds.has(key)) this._audio.removeEnemyEngine(key);
        }
      }
    }

    // Ravitaillement sur aéroport
    if (this._villageMap?.airports && !this.player.isDead) {
      const p = this.player;
      let nearAirport = false;
      let refueling = false;
      for (const ap of this._villageMap.airports) {
        const d2D = Math.hypot(p.position.x - ap.center.x, p.position.z - ap.center.z);
        if (d2D < ap.radius && p.isLanded && p.speed < 12) {
          nearAirport = true;
          this._refuelTimer += delta;
          if (this._refuelTimer > 2.0) {
            const wasFull = p.fuel >= 100 && p.ammo >= 200 && p.health >= 100;
            if (!wasFull) {
              p.fuel   = Math.min(100, p.fuel   + delta * 12);
              p.ammo   = Math.min(200, p.ammo   + delta * 25);
              p.health = Math.min(100, p.health + delta * 18);
              refueling = true;
              this._refuelSoundTimer = (this._refuelSoundTimer || 0) + delta;
              if (this._refuelSoundTimer >= 1.0) {
                this._audio?.playRefuelTick();
                this._refuelSoundTimer = 0;
              }
              if (p.fuel >= 100 && p.ammo >= 200 && p.health >= 100) {
                this.ui.showRefuelComplete();
              }
            } else {
              this._refuelSoundTimer = 0;
            }
          }
          break;
        }
      }
      if (!nearAirport) { this._refuelTimer = 0; this._refuelSoundTimer = 0; }
      if (!p.isLanded) this.ui.clearRefuelMessage();
      this.ui.showRefueling(refueling);
    }

    // Met à jour la caméra pour qu'elle suive l'avion
    this.cameraController.update(delta);

    // Vue arrière
    if (this.player.keys.lookBack) {
      const q       = this.player.quaternion;
      const pos     = this.player.position;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      const up      = new THREE.Vector3(0, 1,  0).applyQuaternion(q);
      this.camera.position.copy(pos)
        .addScaledVector(forward,  7)
        .addScaledVector(up,       1.2);
      this.camera.lookAt(pos.clone().addScaledVector(forward, -6));
    }

    // Vue libre — offset angulaire relatif à la position naturelle du CameraController.
    // Les axes yaw/pitch suivent l'orientation de l'avion (banking/inversion) via _camQ :
    // sur le dos, « monter la vue » reste vers le haut de l'habitacle, pas vers le ciel.
    // Quand _fvYaw=0 et _fvPitch=0 : fvPos = ctrlPos exactement → zéro transition visible.
    if (this.player.freeView) {
      const ctrlPos = this.camera.position.clone();

      const fvYaw   = this.player._fvYaw   ?? 0;
      const fvPitch = this.player._fvPitch ?? 0;

      // Offset naturel CC (de player vers caméra)
      const naturalOff = ctrlPos.clone().sub(this.player.position);

      // Repère relatif à l'avion (suit roll/pitch)
      const ccQ     = this.cameraController._camQ;
      const ccUp    = new THREE.Vector3(0, 1, 0).applyQuaternion(ccQ);
      const ccRight = new THREE.Vector3(1, 0, 0).applyQuaternion(ccQ);

      // Yaw autour du « up » avion ; pitch autour de l'axe latéral avion.
      // pitchAxis dérivé de naturalOff garde exactement le même signe qu'avant à l'endroit.
      const pitchAxis = new THREE.Vector3().crossVectors(ccUp, naturalOff).normalize();
      if (pitchAxis.lengthSq() < 0.001) pitchAxis.copy(ccRight);

      const qYaw   = new THREE.Quaternion().setFromAxisAngle(ccUp,     fvYaw);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(pitchAxis, fvPitch);

      // Pitch d'abord, puis yaw — fvPos revient à ctrlPos quand angles → 0
      const fvOff = naturalOff.clone().applyQuaternion(qPitch).applyQuaternion(qYaw);
      this.camera.position.copy(this.player.position.clone().add(fvOff));

      // Même cible de regard que CameraController → aucun saut de direction en fin de transition
      const lookTarget = this.player.position.clone()
        .addScaledVector(ccUp,    this.cameraController._laP ?? 0)
        .addScaledVector(ccRight, this.cameraController._laR ?? 0);
      this.camera.up.copy(ccUp);
      this.camera.lookAt(lookTarget);
    }

    // Positionner la mire sur l'écran au point visé par l'avion
    const qAim = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0,1,0), this.player._yaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), this.player._pitch));
    const aimWorld = new THREE.Vector3(0, 0, -500)
      .applyQuaternion(qAim)
      .add(this.player.position);
    const aimNDC = aimWorld.clone().project(this.camera);
    const rawAimX = ( aimNDC.x * 0.5 + 0.5) * window.innerWidth;
    const rawAimY = (-aimNDC.y * 0.5 + 0.5) * window.innerHeight;
    const smooth  = Math.min(1, 25 * delta);
    this._aimX += (rawAimX - this._aimX) * smooth;
    this._aimY += (rawAimY - this._aimY) * smooth;
    this.ui.setReticlePosition(this._aimX, this._aimY);

    // Forcer la mise à jour de la matrice caméra avant les projections HUD
    this.camera.updateMatrixWorld();

    // Met à jour le HUD (ennemis IA + joueurs distants)
    const allTargets = [
      ...this.enemies,
      ...(this._multiplayerManager ? this._multiplayerManager.getRemotePlayers() : []),
    ];
    // Base alliée / ennemie selon le mode
    const _aps  = this._villageMap?.airports;
    const _mode = this._config.mode;
    let basePos   = _aps?.[0]?.center ?? null;
    let enemyBase = _aps?.[1]?.center ?? null;
    if (_mode === 'ffa') {
      // FFA : aucune base assignée — les deux aéroports sont neutres (ravitaillement libre)
      basePos = null; enemyBase = null;
    } else if (_mode === 'tdm') {
      const myApIdx = this._config.playerTeam === 'team2' ? 1 : 0;
      basePos   = _aps?.[myApIdx]?.center ?? null;
      enemyBase = _aps?.[myApIdx === 0 ? 1 : 0]?.center ?? null;
    }
    this.ui.update(this.player, allTargets, this.camera, this.stats, basePos, {
      groundTargets : this._groundDefense ? this._groundDefense.getEnemyGroundTargets() : [],
      enemyBase,
      villages      : this._villageMap?.getVillageZones() ?? [],
      leadSpeed     : 950,
      survivalWave  : this._isSurvival ? this._survivalWave : null,
      delta,
    });

    // Debug IA
    if (this._aiDebug) this._renderAIDebug();

    // Muzzle flash 3D — suit le nez de l'avion chaque frame pour ne pas traîner à haute vitesse
    if (this._muzzleSprite?.visible) {
      this._muzzleFlashTimer3D -= delta;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.pivot.quaternion);
      this._muzzleSprite.position.copy(this.player.pivot.position).addScaledVector(fwd, 2.5);
      const a = Math.max(0, this._muzzleFlashTimer3D / 0.12);
      this._muzzleSprite.material.opacity = a;
      if (this._muzzleFlashTimer3D <= 0) this._muzzleSprite.visible = false;
    }

    // La sphère de ciel suit la caméra pour éviter la bulle noire
    this.skyMesh.position.copy(this.camera.position);

    // Rendu scène principale
    this.renderer.render(this.scene, this.camera);

    // Mire par-dessus tout (pass orthographique, pas de clear)
    this._reticleSprite.position.set(
      this._aimX - window.innerWidth  / 2,
    -(this._aimY - window.innerHeight / 2),
      0
    );
    if (!this.player.keys.lookBack && !this.player.freeView && !this._spectatorMode) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this._reticleScene, this._reticleCamera);
      this.renderer.autoClear = true;
    }
    } catch(e) { console.error('[loop]', e); }
  }

  // ── Ciel ─────────────────────────────────────────────────────────────────
  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(4000, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x4a7ab5, side: THREE.BackSide, depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.renderOrder = -1;
    this.scene.add(this.skyMesh);
  }

  // ── Nuages low-poly stylisés ─────────────────────────────────────────────
  _buildClouds() {
    const rng = (a, b) => a + Math.random() * (b - a);

    const spawns = [
      [ 150, 480, -300, 1.2], [-300, 520, -500, 1.0], [ 400, 500, -700, 0.85],
      [-500, 460,  150, 1.4], [ 100, 600, -900, 1.1], [ 600, 470,  350, 0.95],
      [-200, 550, -600, 1.3], [ 300, 440,  500, 1.0], [-600, 490, -300, 0.9],
      [  50, 700,-1000, 1.2], [-300, 580,  450, 1.15],[ 500, 510, -250, 1.05],
      [-100, 450,  700, 0.8], [ 200, 630,-1100, 1.3], [-400, 470,  800, 0.9],
      [ 800, 540,  150, 1.1], [-700, 500, -700, 0.95],[ 350, 680,-1200, 1.2],
    ];

    this._cloudMeshes = [];
    const visibleSpawns = this._isLowEnd ? spawns.slice(0, 10) : spawns;
    visibleSpawns.forEach(([cx, cy, cz, s]) => {
      const blobCount = 6 + Math.floor(rng(0, 7));
      const axisLen   = rng(70, 140) * s;
      const geos      = [];

      for (let i = 0; i < blobCount; i++) {
        const isCore = i < Math.ceil(blobCount * 0.45);
        const r      = (isCore ? rng(28, 52) : rng(14, 30)) * s;
        const geo    = new THREE.IcosahedronGeometry(r, 1);

        // Appliquer position + scale + rotation directement dans la géométrie
        const dummy = new THREE.Mesh(geo);
        dummy.scale.set(rng(1.0, 1.5), rng(0.65, 0.90), rng(0.85, 1.2));
        dummy.rotation.set(rng(0, Math.PI*2), rng(0, Math.PI*2), rng(0, Math.PI*2));
        const t = (i / (blobCount - 1) - 0.5);
        dummy.position.set(
          t * axisLen + rng(-18, 18) * s,
          rng(-18, 18) * s,
          rng(-28, 28) * s
        );
        dummy.updateMatrix();
        const baked = geo.clone().applyMatrix4(dummy.matrix);
        geos.push(baked);
      }

      // Un seul mesh par nuage → un seul point de tri → zéro flickering intra-nuage
      const merged = mergeGeometries(geos);
      geos.forEach(g => g.dispose());

      const g = rng(0.88, 0.96);
      const mat = new THREE.MeshLambertMaterial({
        color      : new THREE.Color(g, g, g),
        flatShading: true,
        transparent: true,
        opacity    : rng(0.82, 0.92),
        depthWrite : false,
      });

      const mesh = new THREE.Mesh(merged, mat);
      mesh.position.set(cx, cy, cz);
      this.scene.add(mesh);
      this._cloudMeshes.push({ mesh, x: cx, z: cz });
    });
  }

  // Relève les nuages au-dessus du terrain après chargement de getTerrainHeight
  _adjustCloudHeights() {
    if (!this.getTerrainHeight || !this._cloudMeshes) return;
    const MIN_MARGIN = 110; // mètres min au-dessus du terrain
    for (const c of this._cloudMeshes) {
      const th = this.getTerrainHeight(c.x, c.z);
      const minY = th + MIN_MARGIN;
      if (c.mesh.position.y < minY) c.mesh.position.y = minY;
    }
  }

  // ── Terrain montagneux avec vertex colors ─────────────────────────────────
  _buildGround() {
    const SEGS = this._isLowEnd ? 110 : 160;  // segments par axe
    const SIZE = 3000;         // taille du terrain en unités monde (3 km × 3 km)

    // ── Noise valeur (fBm) ────────────────────────────────────────────────
    const hash = (x, z) => {
      const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const vnoise = (x, z) => {
      const xi = Math.floor(x), zi = Math.floor(z);
      const xf = x - xi, zf = z - zi;
      const ux = xf*xf*(3-2*xf), uz = zf*zf*(3-2*zf);
      const a = hash(xi,   zi),   b = hash(xi+1, zi);
      const c = hash(xi,   zi+1), d = hash(xi+1, zi+1);
      return a*(1-ux)*(1-uz) + b*ux*(1-uz) + c*(1-ux)*uz + d*ux*uz;
    };
    const fbm = (x, z) => {
      let v=0, amp=1, freq=1, sum=0;
      for (let i=0; i<8; i++) {
        v   += vnoise(x*freq, z*freq) * amp;
        sum += amp; amp *= 0.48; freq *= 2.13;
      }
      return v / sum;
    };
    // Bruit de détail fin (micro-relief)
    const detail = (x, z) => {
      let v=0, amp=1, freq=1, sum=0;
      for (let i=0; i<4; i++) {
        v   += vnoise(x*freq + 73.1, z*freq + 19.7) * amp;
        sum += amp; amp *= 0.5; freq *= 3.1;
      }
      return (v/sum - 0.5) * 2;
    };
    // Pics isolés [wx, wz, hauteur, rayon]
    const PEAKS = [
      [ 600, -400, 900, 200],   // montagne principale
      [-700,  250, 650, 170],
      [ 350,  700, 550, 150],
      [-300, -700, 480, 130],
    ];
    const gauss = (wx, wz, px, pz, h, r) => {
      const d2 = (wx-px)**2 + (wz-pz)**2;
      return h * Math.exp(-d2 / (2 * r * r));
    };

    // Lacs [cx, cz, rayon, niveau_eau] — uniquement en basse plaine (lh ≤ 10)
    const LAKES = this._lakes = [
      [ 180, -200,  95,  4],   // lac principal proche de l'origine
      [-280,  100,  70,  5],   // lac de plaine ouest
      [ 100,  450,  55,  6],   // lac de vallée nord
      [-180, -450,  60,  4],   // lac de plaine sud
    ];

    // ── Failles / canyons ────────────────────────────────────────────────────
    const RIFTS = [
      // Vallée principale : grand diagonal SW→NE
      { pts: [[-900,-700],[-500,-300],[-100,50],[200,350],[500,650]], width: 55, depth: 380 },
      // Faille est
      { pts: [[ 900, 200],[ 600,-100],[200,-400],[-100,-800]],        width: 40, depth: 300 },
      // Faille ouest
      { pts: [[-900, 600],[-550,300],[-150,0],[200,-300]],            width: 35, depth: 270 },
    ];

    const distToSeg = (px,pz, ax,az, bx,bz) => {
      const dx=bx-ax, dz=bz-az, len2=dx*dx+dz*dz;
      if (len2===0) return Math.hypot(px-ax, pz-az);
      const t = Math.max(0, Math.min(1, ((px-ax)*dx+(pz-az)*dz)/len2));
      return Math.hypot(px-(ax+t*dx), pz-(az+t*dz));
    };

    const riftCarve = (wx, wz) => {
      // Domain warp pour courber les failles
      const ws = 0.0022, wa = 45;
      const dwx = wx + (vnoise(wx*ws,       wz*ws      ) - 0.5) * 2 * wa;
      const dwz = wz + (vnoise(wx*ws + 4.7, wz*ws + 9.3) - 0.5) * 2 * wa;

      // La faille la plus proche gagne — empêche toute fusion entre failles
      let minDist = Infinity, bestRift = null;
      for (const rift of RIFTS) {
        for (let i=0; i<rift.pts.length-1; i++) {
          const d = distToSeg(dwx,dwz, rift.pts[i][0],rift.pts[i][1], rift.pts[i+1][0],rift.pts[i+1][1]);
          if (d < minDist) { minDist = d; bestRift = rift; }
        }
      }
      if (!bestRift || minDist >= bestRift.width / 2) return 0;
      const t = 1 - minDist / (bestRift.width / 2);
      const profile = minDist < bestRift.width * 0.15 ? 1 : t * t;
      return bestRift.depth * profile;
    };

    const getH = (wx, wz) => {
      const d = Math.sqrt(wx*wx + wz*wz);
      const flat = Math.min(1, Math.max(0, (d - 80) / 120));
      const n = fbm(wx * 0.003, wz * 0.003);
      const ridge = 1 - Math.abs(2*n - 1);
      const micro = detail(wx * 0.015, wz * 0.015) * 8;
      let h = (n*0.6 + ridge*0.4) * (n*0.6 + ridge*0.4) * 520 * flat + micro * flat;
      for (const [px,pz,ph,pr] of PEAKS)
        h += gauss(wx,wz,px,pz,ph,pr) * Math.min(1,Math.max(0,(d-50)/100));

      // Fondu vers la mer : le terrain plonge sous l'océan aux bords
      const edge = Math.max(Math.abs(wx), Math.abs(wz));
      const et = Math.max(0, Math.min(1, (edge - 1050) / 400));
      const s  = et*et*(3-2*et);
      h = h * (1-s) + (-8) * s;
      // Failles : creuser uniquement les zones basses (pas les montagnes)
      const carve = riftCarve(wx, wz);
      if (carve > 0) {
        const mask = Math.max(0, Math.min(1, (220 - h) / 180));
        h = Math.max(-30, h - carve * mask);
      }
      // Lacs : zone centrale parfaitement plate, transition sur la moitié extérieure
      for (const [lx,lz,lr,lh] of LAKES) {
        const ld = Math.hypot(wx-lx, wz-lz);
        if (ld < lr) {
          const tEdge = Math.max(0, (ld - lr * 0.45) / (lr * 0.55));
          const s = 1 - tEdge * tEdge * (3 - 2 * tEdge);
          h = h * (1 - s) + lh * s;
        }
      }
      return h;
    };

    // ── Couleur selon l'altitude ───────────────────────────────────────────
    const hColor = (h, wx, wz, steepness) => {
      // parois de faille / fond : roche sombre humide
      if (h < -5) return [0.28, 0.24, 0.20];
      // berges sableuses autour de l'eau
      if (h < 5) return [0.62, 0.56, 0.38];
      // pente forte = roche (seuil relevé pour garder plus de vert)
      if (steepness > 0.80) {
        if (h > 300) return [0.52, 0.48, 0.42];
        return [0.44, 0.40, 0.34];
      }
      if (h < 35)  return [0.28, 0.54, 0.18]; // grande plaine verte
      if (h < 100) return [0.22, 0.44, 0.14]; // forêt dense
      if (h < 200) return [0.34, 0.52, 0.20]; // prairie alpine verte
      if (h < 340) return [0.50, 0.44, 0.30]; // roche claire
      if (h < 520) return [0.42, 0.38, 0.30]; // roche sombre
      if (h < 650) return [0.78, 0.76, 0.72]; // neige légère
      return [0.93, 0.94, 0.95];               // neige épaisse
    };

    // ── Buffers ───────────────────────────────────────────────────────────
    const vCount = (SEGS+1) * (SEGS+1);
    const pos    = new Float32Array(vCount * 3);
    const col    = new Float32Array(vCount * 3);
    const idx    = [];

    // Première passe : positions Y
    const ys = new Float32Array(vCount);
    for (let z=0; z<=SEGS; z++) {
      for (let x=0; x<=SEGS; x++) {
        const wx = (x/SEGS - 0.5) * SIZE;
        const wz = (z/SEGS - 0.5) * SIZE;
        ys[z*(SEGS+1)+x] = getH(wx, wz);
      }
    }

    // Deuxième passe : positions, normales approchées, couleurs
    for (let z=0; z<=SEGS; z++) {
      for (let x=0; x<=SEGS; x++) {
        const i  = z*(SEGS+1)+x;
        const wx = (x/SEGS - 0.5) * SIZE;
        const wz = (z/SEGS - 0.5) * SIZE;
        const wy = ys[i];
        pos[i*3]   = wx;
        pos[i*3+1] = wy;
        pos[i*3+2] = wz;

        // gradient local pour détecter la pente
        const hR = x < SEGS ? ys[i+1]          : wy;
        const hU = z < SEGS ? ys[i+(SEGS+1)]   : wy;
        const dx = (hR - wy) / (SIZE/SEGS);
        const dz = (hU - wy) / (SIZE/SEGS);
        const steepness = Math.sqrt(dx*dx + dz*dz);

        const [r,g,b] = hColor(wy, wx, wz, steepness);
        col[i*3]   = r;
        col[i*3+1] = g;
        col[i*3+2] = b;
      }
    }

    // Indices
    for (let z=0; z<SEGS; z++) {
      for (let x=0; x<SEGS; x++) {
        const a = z*(SEGS+1)+x, b = a+1;
        const c = (z+1)*(SEGS+1)+x, d = c+1;
        idx.push(a,c,b, b,c,d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.getTerrainHeight = getH;
  }

  // ── Océan (plan infini au niveau de la mer) ──────────────────────────────
  _buildOcean() {
    const geo = new THREE.PlaneGeometry(40000, 40000, 4, 4);
    const mat = new THREE.MeshPhongMaterial({
      color    : 0x1a4a6e,
      shininess: 50,
      specular : new THREE.Color(0x2266aa),
      polygonOffset     : true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits : 2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -1;
    this.scene.add(mesh);
    this._oceanMesh = mesh;
  }

  // ── Surfaces d'eau planes ────────────────────────────────────────────────
  _buildWater() {
    for (const [lx, lz, lr, lh] of this._lakes) {
      const geo = new THREE.CircleGeometry(lr * 0.42, 48);
      const mat = new THREE.MeshLambertMaterial({
        color     : 0x3a8fcc,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(lx, lh + 2.0, lz);
      mesh.renderOrder = 2;
      this.scene.add(mesh);
    }
  }

  // ── Muzzle flash 3D (sprite au nez de l'avion) ───────────────────────────
  _buildMuzzleFlash() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0,   'rgba(255,255,200,0.55)');
    grad.addColorStop(0.25,'rgba(255,200,60,0.40)');
    grad.addColorStop(0.6, 'rgba(255,120,0,0.15)');
    grad.addColorStop(1,   'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this._muzzleSprite = new THREE.Sprite(mat);
    this._muzzleSprite.scale.set(0.7, 0.7, 1);
    this._muzzleSprite.visible = false;
    this._muzzleFlashTimer3D = 0;
    this.scene.add(this._muzzleSprite);
  }

  // ── Lumières ─────────────────────────────────────────────────────────────
  _buildLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.set(500, 800, 300);
    this.scene.add(sun);
  }

  // ── Mire Three.js (sprite orthographique) ────────────────────────────────
  _buildReticle() {
    const S = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d');
    const cx = S / 2, r1 = 9, r2 = 20;
    const col = 'rgba(212,200,138,';

    // cercle extérieur discret
    ctx.beginPath(); ctx.arc(cx,cx,r2,0,Math.PI*2);
    ctx.strokeStyle = col+'0.22)'; ctx.lineWidth=1; ctx.stroke();
    // cercle principal
    ctx.beginPath(); ctx.arc(cx,cx,r1,0,Math.PI*2);
    ctx.strokeStyle = col+'0.92)'; ctx.lineWidth=1.4; ctx.stroke();
    // point central
    ctx.beginPath(); ctx.arc(cx,cx,1.8,0,Math.PI*2);
    ctx.fillStyle = col+'0.92)'; ctx.fill();
    // croix
    const lines = [[cx,2,cx,12],[cx,52,cx,62],[2,cx,12,cx],[52,cx,62,cx]];
    ctx.strokeStyle = col+'0.82)'; ctx.lineWidth=1.4; ctx.lineCap='round';
    lines.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    // diagonales aux angles
    const diag = [[15,15,17,17],[49,15,47,17],[15,49,17,47],[49,49,47,47]];
    ctx.strokeStyle = col+'0.38)'; ctx.lineWidth=0.9;
    diag.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map:tex, depthTest:false, depthWrite:false, transparent:true });
    this._reticleSprite = new THREE.Sprite(mat);
    this._reticleSprite.scale.set(44, 44, 1);
    this._reticleSprite.renderOrder = 999;

    this._reticleScene  = new THREE.Scene();
    this._reticleCamera = new THREE.OrthographicCamera(
      -window.innerWidth/2,  window.innerWidth/2,
       window.innerHeight/2, -window.innerHeight/2,
      -1, 1
    );
    this._reticleScene.add(this._reticleSprite);
  }

  _buildPointerLockOverlay() {
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position: 'fixed', bottom: '38%', left: '50%',
      transform: 'translateX(-50%)',
      color: '#d4c88a', fontFamily: 'Courier New, monospace',
      fontSize: '14px', letterSpacing: '2px', zIndex: '999',
      pointerEvents: 'none', opacity: '0.85',
    });
    hint.textContent = '— CLIQUEZ POUR CAPTURER LA SOURIS —';
    document.body.appendChild(hint);
    this._pointerLockHint = hint;

    document.addEventListener('pointerlockchange', () => {
      if (this.player?.isDead) return;
      hint.style.display = document.pointerLockElement === document.body ? 'none' : 'block';
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this._reticleCamera) {
      this._reticleCamera.left   = -window.innerWidth  / 2;
      this._reticleCamera.right  =  window.innerWidth  / 2;
      this._reticleCamera.top    =  window.innerHeight / 2;
      this._reticleCamera.bottom = -window.innerHeight / 2;
      this._reticleCamera.updateProjectionMatrix();
    }
    this._aimX = window.innerWidth  / 2;
    this._aimY = window.innerHeight / 2;
  }

  // ── Nettoyage complet (retour au menu) ────────────────────────────────────
  destroy() {
    this._destroyed = true;

    if (this._loopId) cancelAnimationFrame(this._loopId);

    // Événements
    if (this._keydownHandler) document.removeEventListener('keydown',           this._keydownHandler);
    if (this._pllHandler)     document.removeEventListener('pointerlockchange', this._pllHandler);
    window.removeEventListener('resize', this._resizeHandler);

    // Pointer lock
    document.exitPointerLock();

    // DOM
    if (this.renderer?.domElement?.parentNode)
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    if (this.ui?._root?.parentNode)
      this.ui._root.parentNode.removeChild(this.ui._root);
    if (this.ui?._pauseOverlay?.parentNode)
      this.ui._pauseOverlay.parentNode.removeChild(this.ui._pauseOverlay);
    if (this.ui?._escOverlay?.parentNode)
      this.ui._escOverlay.parentNode.removeChild(this.ui._escOverlay);
    if (this.ui?._victoryOverlay?.parentNode)
      this.ui._victoryOverlay.parentNode.removeChild(this.ui._victoryOverlay);
    if (this._pointerLockHint?.parentNode)
      this._pointerLockHint.parentNode.removeChild(this._pointerLockHint);
    // Overlays survie / mort (appended to body)
    this.ui?._deadOverlay?.remove();
    this.ui?._survivalBanner?.remove();
    this.ui?._survivalCdEl?.remove();
    this.ui?._spectatorEl?.remove();
    this.ui?._alertFuelEl?.remove();
    this.ui?._alertHealthEl?.remove();
    this.ui?.setMatchTimer(0); // cache le timer

    // Réseau
    if (this._config?.networkManager) this._config.networkManager.disconnect();

    if (this._dbgCanvas) { this._dbgCanvas.remove(); this._dbgCanvas = null; }

    // Balles
    this.bulletManager?.dispose();
    this._enemyBulletManager?.dispose();
    this._alliedBulletManager?.dispose();
    this._groundDefense?.dispose();
    this._practiceMode?.dispose();

    // Audio — arrêt moteur + fermeture contexte
    if (this._audio) {
      this._audio.dispose();
      this._audio = null;
    }

    // Three.js
    this.renderer?.dispose();
    this.scene?.clear();
  }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { IS_MOBILE } from './MobileControls.js';

// ── Constantes de vol ────────────────────────────────────────────────────────
const MIN_SPEED            = 30;  // vitesse de croisière minimale (moteur on, sans gaz)
const ENGINE_CUTOFF        = 14;  // km/h en dessous desquels le moteur cale
const MAX_SPEED            = 120;
const ACCEL                = 10;
const DECEL                = 20;
const DRAG                 = 8;
const START_ALT            = 400;
const GROUND_Y             = 1.0;
const MAX_ALT              = 1000;
const MAX_FUEL             = 100;
const FUEL_DRAIN           = 0.20;
const FUEL_BOOST           = 0.46;
const MAX_AMMO             = 200;
const GLIDE_DRAG           = 8.0;
const GROUND_ROLL_DRAG     = 18;
const SAFE_LANDING_SPEED   = 38;
const RUNWAY_LANDING_SPEED = 50;
const GRAVITY              = 4;
const LIFT_SPEED           = 30;

// ── Paramètres de contrôle — identiques quel que soit le périphérique ────────
// Souris, manette et clavier atteignent exactement les mêmes taux angulaires max.
const STICK_SENSITIVITY = 0.0018;
const STICK_DECAY       = 0.08;  // quasi-persistant : le stick reste en position, dérive très lentement
const GAMEPAD_DEADZONE  = 0.10;

// Rampe clavier : réponse immédiate au premier appui, pleine autorité en ~120 ms
const KEY_RAMP_TIME = 0.12;  // secondes pour atteindre 100% d'autorité
const KEY_RAMP_EXP  = 0.7;   // <1 = début rapide, fin lente (pas de dead zone perçue)

// ── Mode STANDARD ─────────────────────────────────────────────────────────────
const MAX_PITCH_RATE  = 0.90;  // rad/s tangage — tous périphériques
const TURN_AUTO_ROLL  = 1.60;  // rad/s roulis automatique lors d'un virage
const TURN_AUTO_YAW   = 0.50;  // rad/s lacet coordonné lors d'un virage
const MAX_ROLL_RATE   = 1.60;  // rad/s roulis manuel Q/E / LB/RB (= TURN_AUTO_ROLL → égalité)
const MAX_YAW_RATE    = 0.50;  // rad/s lacet A/D

// ── Mode SIMULATEUR ───────────────────────────────────────────────────────────
const SIM_ROLL_RATE   = 1.80;  // rad/s roulis — tous périphériques
const SIM_PITCH_RATE  = 0.85;  // rad/s tangage — tous périphériques
const SIM_YAW_RATE    = 0.70;  // rad/s lacet — tous périphériques

export class Player {
  constructor(scene, options = {}) {
    this.scene      = scene;
    this._teamColor = options.teamColor || null;
    this._planePath = options.planePath || '/SK_Veh_Plane_Stunt_01.glb';

    // ── Modificateurs d'améliorations ────────────────────────────────────────
    // Appliqués via applyUpgradeModifiers() depuis Game.js après chargement
    this._upgMods = {
      healthBonus     : 0,       // HP supplémentaires (absolu)
      speedMult       : 1.0,     // multiplicateur vitesse max
      accelMult       : 1.0,     // multiplicateur accélération
      maneuverMult    : 1.0,     // multiplicateur taux angulaires
      rollMult        : 1.0,     // multiplicateur vitesse de roll
      fuelMult        : 1.0,     // multiplicateur jauge carburant
      ammoBonus       : 0,       // munitions supplémentaires (absolu)
      fireCooldownMult: 1.0,     // multiplicateur cadence (< 1 = plus rapide)
      damageMult      : 1.0,     // multiplicateur dégâts balles
      resistTurrets   : 0,       // % réduction dégâts tourelles (0-1)
      resistPlanes    : 0,       // % réduction dégâts avions
      repairMult      : 1.0,     // multiplicateur vitesse réparation
      rearmMult       : 1.0,     // multiplicateur vitesse réarmement
      refuelMult      : 1.0,     // multiplicateur vitesse ravitaillement
    };
    // Caméra arrière (touche R) — activée par défaut, restreinte par l'équipement en partie réelle
    this._tailCamEnabled = true;
    // Missiles & leurres
    this.missileCount = 0;
    this.decoyCount   = 0;
    this._maxMissiles = 0;
    this._maxDecoys   = 0;

    // Callbacks missiles/leurres
    this.onFireMissile = null;  // () appelé quand le joueur tire un missile
    this.onDeployDecoy = null;  // () appelé quand le joueur déploie un leurre
    this._missileCooldown = 0;
    this._decoyCooldown   = 0;

    // ── État de vol ──────────────────────────────────────────────────────────
    this.speed    = 30;
    this.altitude = START_ALT;

    // ── Santé ────────────────────────────────────────────────────────────────
    this.health  = 100;
    this.isDead  = false;
    this._groundDamageCooldown = 0;

    // ── Carburant & munitions ────────────────────────────────────────────────
    this.fuel = MAX_FUEL;
    this.ammo = MAX_AMMO;   // 200

    // ── État moteur & sol ────────────────────────────────────────────────────
    this.engineOn  = true;
    this.isLanded  = false;
    this._sinkRate = 0;
    this._prevY    = null;  // pour détecter la vitesse d'impact verticale

    // Callbacks
    this.onPause        = null;
    this.onCameraChange = null;  // touche C / bouton B manette
    this.onHelpToggle   = null;  // touche H

    // ── Tirs ─────────────────────────────────────────────────────────────────
    this.onFire      = null; // callback(position, quaternion) assigné par Game
    this.onNoAmmo    = null; // callback quand on essaie de tirer sans munitions
    this._fireCooldown   = 0;
    this._noAmmoCooldown = 0;
    this._fireRate   = 0.18; // secondes entre deux tirs

    // Pivot physique
    this.pivot = new THREE.Object3D();
    this.pivot.position.set(0, START_ALT, 0);
    scene.add(this.pivot);

    // Euler dérivés (pour HUD, bones, sol) — mis à jour depuis le quaternion
    this._yaw   = 0;
    this._pitch = 0;
    this._roll  = 0;

    // Taux angulaires calculés par _handleInput, consommés par _applyPhysics
    this._pitchRate = 0;
    this._rollRate  = 0;
    this._yawRate   = 0;

    // Entrées tactiles mobiles (injectées par MobileControls)
    this._touchTurn  = 0;
    this._touchPitch = 0;

    // Entrées normalisées [-1,1] pour animation des bones
    this._rollInput  = 0;
    this._pitchInput = 0;

    // Joystick virtuel souris (-1 à 1)
    this._stickX = 0;
    this._stickY = 0;

    // État manette
    // _gpTurn  : stick gauche X → virage coordonné (auto-roll + auto-yaw)
    // _gpRoll  : LB/RB → roll manuel acrobatique
    // _gpPitch : stick gauche Y → tangage
    this._gpTurn  = 0; this._gpRoll = 0; this._gpPitch = 0;
    this._gpThrottleUp = 0; this._gpThrottleDown = 0;
    this._gpBtnA_prev = false; this._gpBtnB_prev = false; this._gpBtnMenu_prev = false;

    // Vue libre / regard libre — angles relatifs à la position naturelle du CC
    this.freeView   = false;
    this._fvYaw     = 0;   // angle horizontal (rotation autour de Y monde)
    this._fvPitch   = 0;   // angle vertical (rotation autour de l'axe droit local)
    this._rsActive  = false;

    // ── Modèle 3D (sera rempli après load()) ────────────────────────────────
    this.model = null;
    this.mixer = null;
    this.bones = {};

    this._boneNames = {
      propeller : ['SK_Veh_Plane_Stunt_01_Prop', 'Propeller', 'propeller', 'Prop', 'prop'],
      flapFl01  : ['SK_Veh_Plane_Stunt_01_Flap_fl_01'],
      flapFl02  : ['SK_Veh_Plane_Stunt_01_Flap_fl_02'],
      flapFr01  : ['SK_Veh_Plane_Stunt_01_Flap_fr_01'],
      flapFr02  : ['SK_Veh_Plane_Stunt_01_Flap_fr_02'],
      flapRl01  : ['SK_Veh_Plane_Stunt_01_Flap_rl_01'],
      flapRr01  : ['SK_Veh_Plane_Stunt_01_Flap_rr_01'],
      flapTail  : ['SK_Veh_Plane_Stunt_01_Flap_Tail'],
    };

    // ── Entrées ──────────────────────────────────────────────────────────────
    this.keys = { w: false, s: false, a: false, d: false, q: false, e: false,
                  shift: false, ctrl: false, space: false, lookBack: false,
                  c_prev: false, h_prev: false };
    // Durée de maintien de chaque touche de vol (pour la rampe exponentielle)
    this._kHold = { w: 0, s: 0, a: 0, d: 0, q: 0, e: 0 };
    this._bindInputs();
  }

  // ── Chargement du GLB ────────────────────────────────────────────────────
  async load() {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        this._planePath,
        (gltf) => {
          this.model = gltf.scene;

          // Auto-calibration : on cible une envergure d'environ 4 unités de monde
          const box = new THREE.Box3().setFromObject(this.model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 4;  // taille cible en unités monde
          const autoScale = maxDim > 0 ? targetSize / maxDim : 1;
          this.model.scale.setScalar(autoScale);
          console.log(`[Player] Taille brute du modèle : ${maxDim.toFixed(2)} → échelle appliquée : ${autoScale.toFixed(4)}`);

          // Le modèle Unreal pointe vers +X ou +Z selon l'export ;
          // on le retourne de 180° sur Y pour qu'il regarde vers -Z (convention Three.js)
          this.model.rotation.y = Math.PI;

          // Expose l'échelle pour que la caméra puisse s'y adapter
          this.modelScale = autoScale;

          // Ombres sur tous les meshes
          this.model.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          // Retirer le crop duster
          const cropNodes = [];
          this.model.traverse(node => {
            if (node.name === 'SK_Veh_Plane_Stunt_01_Crop_Duster') cropNodes.push(node);
          });
          cropNodes.forEach(node => {
            node.visible = false;
            node.geometry?.dispose();
            if (node.parent) node.parent.remove(node);
          });

          this.pivot.add(this.model);

          // Teinte équipe : emissive subtile sur les matériaux
          if (this._teamColor !== null) {
            this.model.traverse(node => {
              if (node.isMesh && node.material) {
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach(m => {
                  if (m.emissive !== undefined) {
                    m.emissive = new THREE.Color(this._teamColor);
                    m.emissiveIntensity = 0.14;
                  }
                });
              }
            });
          }

          // ── Débogage complet ──────────────────────────────────────────────
          this._debugModel(gltf);

          // ── Récupération des bones ────────────────────────────────────────
          this._mapBones();

          // ── SkeletonHelper pour visualisation ─────────────────────────────
          this._addSkeletonHelper();

          // ── AnimationMixer si des animations existent ─────────────────────
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.model);
            console.log(`[Player] ${gltf.animations.length} animation(s) trouvée(s) :`);
            gltf.animations.forEach((clip) => {
              console.log(`  • ${clip.name} (durée: ${clip.duration.toFixed(2)}s)`);
            });
          }

          resolve();
        },
        (xhr) => {
          console.log(`[Player] Chargement : ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
        },
        (err) => {
          console.error('[Player] Erreur de chargement :', err);
          reject(err);
        }
      );
    });
  }

  // ── Mise à jour chaque frame ─────────────────────────────────────────────
  update(delta) {
    // Mort dès que la santé atteint 0 (balles, tourelles, collisions) — pas seulement au sol
    if (this.health <= 0 && !this.isDead) {
      this.health = 0;
      this.isDead = true;
      this.speed  = 0;
      this.engineOn = false;
    }
    if (this.isDead) return;
    this._handleInput(delta);
    this._applyPhysics(delta);
    this._checkGroundDamage(delta);
    this._handleFire(delta);
    this._animateBones(delta);
    if (this.mixer) this.mixer.update(delta);
  }

  // ── Dégâts au sol / atterrissage ────────────────────────────────────────
  _checkGroundDamage(delta) {
    const groundY = this.getTerrainHeight
      ? this.getTerrainHeight(this.pivot.position.x, this.pivot.position.z)
      : GROUND_Y;
    this.altitude = this.pivot.position.y;
    this._groundDamageCooldown -= delta;

    // Vitesse verticale réelle (positive = descente)
    const curY = this.pivot.position.y;
    const impactSpeed = this._prevY !== null ? (this._prevY - curY) / delta : 0;
    this._prevY = curY;

    if (this.pivot.position.y <= groundY + 1.5) {
      this.pivot.position.y = groundY + 1.5;

      if (!this.isLanded) {
        // Chute libre ou piqué brutal → destruction immédiate
        if (impactSpeed > 28) {
          this.health = 0;
          this.isDead = true;
          this.speed  = 0;
          return;
        }

        const onRunway = this.isOnRunway?.(this.pivot.position.x, this.pivot.position.z) ?? false;
        const safeSpeed = onRunway ? RUNWAY_LANDING_SPEED : SAFE_LANDING_SPEED;
        if (this.speed <= safeSpeed) {
          // Atterrissage réussi
          this.isLanded = true;
          this.engineOn = false;
        } else if (this._groundDamageCooldown <= 0) {
          // Impact trop rapide → dégâts
          this.health -= 50;
          this._groundDamageCooldown = 0.3;
          if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            this.speed  = 0;
          }
        }
      }
    } else if (this.isLanded && this.altitude > 3) {
      // L'avion a décollé de nouveau
      this.isLanded = false;
    }
  }

  // ── Tirs ─────────────────────────────────────────────────────────────────
  _handleFire(delta) {
    this._fireCooldown -= delta;
    // wantFire : espace/manette maintenu, OU bouton souris physiquement enfoncé, OU latch court
    const wantFire = this.keys.space || this._mouseFireDown || this._mouseFireLatch;
    this._mouseFireLatch = false; // consommé une seule fois par frame
    if (wantFire && this._fireCooldown <= 0 && this.onFire && this.ammo > 0) {
      this._fireCooldown = this._fireRate;
      this.ammo--;
      const muzzle = new THREE.Vector3(0, 0, -2)
        .applyQuaternion(this.pivot.quaternion)
        .add(this.pivot.position);
      this.onFire(muzzle, this.pivot.quaternion.clone());
    } else if (wantFire && this.ammo <= 0 && this._noAmmoCooldown <= 0) {
      this._noAmmoCooldown = 0.6;
      this.onNoAmmo?.();
    }
    if (this._noAmmoCooldown > 0) this._noAmmoCooldown -= delta;
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get position()  { return this.pivot.position; }
  get quaternion(){ return this.pivot.quaternion; }

  get heading() {
    return ((-this._yaw * 180 / Math.PI) % 360 + 360) % 360;
  }

  // ── Inputs : clavier + souris + pointer lock ─────────────────────────────
  _bindInputs() {
    const down = (e) => {
      if (e.key === 'w' || e.key === 'W') this.keys.w = true;
      if (e.key === 's' || e.key === 'S') this.keys.s = true;
      if (e.key === 'a' || e.key === 'A') this.keys.a = true;
      if (e.key === 'd' || e.key === 'D') this.keys.d = true;
      if (e.key === 'q' || e.key === 'Q') this.keys.q = true;
      if (e.key === 'e' || e.key === 'E') this.keys.e = true;
      if (e.key === 'Shift')   this.keys.shift = true;
      if (e.key === 'Control') this.keys.ctrl  = true;
      if (e.key === ' ')       { this.keys.space = true; e.preventDefault(); }
      // C : changer de caméra (edge trigger)
      if ((e.key === 'c' || e.key === 'C') && !this.keys.c_prev) {
        if (this.onCameraChange) this.onCameraChange();
        this.keys.c_prev = true;
      }
      // H : afficher/masquer l'aide (edge trigger)
      if ((e.key === 'h' || e.key === 'H') && !this.keys.h_prev) {
        if (this.onHelpToggle) this.onHelpToggle();
        this.keys.h_prev = true;
      }
      // Tab : tableau des scores (maintenir pour afficher)
      if (e.key === 'Tab') {
        e.preventDefault();
        if (!this.keys.tab_prev && this.onScoreboardShow) this.onScoreboardShow(true);
        this.keys.tab_prev = true;
      }
      // R : vue arrière (maintenir) — seulement si l'équipement caméra arrière est installé
      if ((e.key === 'r' || e.key === 'R') && this._tailCamEnabled) this.keys.lookBack = true;
      // V : vue libre souris (maintenir)
      if (e.key === 'v' || e.key === 'V') this._vKeyActive = true;
      if (e.key === 'Escape') { if (this.onPause) this.onPause(); }
      // F : tirer un missile
      if ((e.key === 'f' || e.key === 'F') && !this.keys.f_prev) {
        this.keys.f_prev = true;
        if (this.onFireMissile) this.onFireMissile();
      }
      // G : déployer un leurre
      if ((e.key === 'g' || e.key === 'G') && !this.keys.g_prev) {
        this.keys.g_prev = true;
        if (this.onDeployDecoy) this.onDeployDecoy();
      }
    };
    const up = (e) => {
      if (e.key === 'w' || e.key === 'W') this.keys.w = false;
      if (e.key === 's' || e.key === 'S') this.keys.s = false;
      if (e.key === 'a' || e.key === 'A') this.keys.a = false;
      if (e.key === 'd' || e.key === 'D') this.keys.d = false;
      if (e.key === 'q' || e.key === 'Q') this.keys.q = false;
      if (e.key === 'e' || e.key === 'E') this.keys.e = false;
      if (e.key === 'Shift')   this.keys.shift = false;
      if (e.key === 'Control') this.keys.ctrl  = false;
      if (e.key === ' ')       this.keys.space  = false;
      if (e.key === 'c' || e.key === 'C') this.keys.c_prev = false;
      if (e.key === 'h' || e.key === 'H') this.keys.h_prev = false;
      if (e.key === 'Tab') { this.keys.tab_prev = false; if (this.onScoreboardShow) this.onScoreboardShow(false); }
      if (e.key === 'r' || e.key === 'R') this.keys.lookBack = false;
      if (e.key === 'f' || e.key === 'F') this.keys.f_prev = false;
      if (e.key === 'g' || e.key === 'G') this.keys.g_prev = false;
      if (e.key === 'v' || e.key === 'V') this._vKeyActive = false;
    };
    // Clic gauche : tirer + (optionnellement) acquérir le pointer lock.
    // Problème Chrome : requestPointerLock() déclenche un mouseup synthétique pendant
    // l'acquisition, ce qui couperait le tir maintenu. On l'ignore via _plPending.
    this._mouseFireDown = false;   // vrai tant que le bouton gauche est physiquement enfoncé
    this._pointerLockPending = false;

    const onMouseDown = (e) => {
      if (IS_MOBILE) return;
      if (e.button !== 0) return;
      if (e.sourceCapabilities?.firesTouchEvents) return;
      if (e.target.closest('button, a, input, [role="button"]')) return;
      if (this.isDead || this._blockPointerLock) return;
      this._mouseFireDown  = true;
      this._mouseFireLatch = true;   // tir garanti même si mouseup arrive avant la frame
      this.keys.space      = true;
      if (!document.pointerLockElement) {
        this._pointerLockPending = true;
        document.body.requestPointerLock?.()?.catch?.(() => { this._pointerLockPending = false; });
      }
    };
    const onMouseUp = (e) => {
      if (e.button !== 0) return;
      // Ignorer le mouseup synthétique émis par Chrome lors de l'acquisition du pointer lock
      if (this._pointerLockPending) return;
      this._mouseFireDown = false;
      this.keys.space     = false;
    };
    const onPointerLockChange = () => {
      // À chaque changement de lock (acquis ou perdu), on remet le tir à zéro.
      // Cela évite le cas où mouseup est arrivé pendant _pointerLockPending
      // et a été ignoré → _mouseFireDown resterait bloqué à true.
      // L'utilisateur doit recliquer après l'acquisition du lock pour tirer en continu.
      this._pointerLockPending = false;
      this._mouseFireDown      = false;
      this.keys.space          = false;
    };
    // Souris :
    //   stickX → yaw (gauche = tourner à gauche, droite = tourner à droite)
    //   stickY → pitch (haut = monter, bas = descendre)
    //   En mode free view (V) → orbite caméra
    const onMouseMove = (e) => {
      if (document.pointerLockElement !== document.body) return;
      if (this.freeView && !this._rsActive) {
        this._fvYaw   -= e.movementX * 0.008;
        this._fvPitch  = Math.max(-1.2, Math.min(1.2, this._fvPitch - e.movementY * 0.008));
      } else {
        // stickX = yaw, stickY = pitch
        this._stickX = THREE.MathUtils.clamp(this._stickX + e.movementX * STICK_SENSITIVITY, -1, 1);
        this._stickY = THREE.MathUtils.clamp(this._stickY + e.movementY * STICK_SENSITIVITY, -1, 1);
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);

    // Conservés pour pouvoir les retirer dans dispose() (sinon l'ancien Player
    // continue de verrouiller la souris quand on revient au menu après une partie)
    this._inputCleanup = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup',   up);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup',   onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }

  // ── Applique les modificateurs issus des améliorations ───────────────────
  applyUpgradeModifiers(mods, missileCount, decoyCount) {
    Object.assign(this._upgMods, mods);
    this._maxMissiles = missileCount;
    this._maxDecoys   = decoyCount;
    this.missileCount = missileCount;
    this.decoyCount   = decoyCount;
    // Appliquer au HP
    this.health = Math.min(100 + (mods.healthBonus ?? 0), this.health + (mods.healthBonus ?? 0));
    // Appliquer au carburant — capacité depuis stats positives, conso depuis stats négatives
    this._maxFuelOverride = MAX_FUEL * (mods.fuelCapMult ?? mods.fuelMult ?? 1.0);
    this.fuel = this._maxFuelOverride;  // toujours plein au départ
    this._fuelBurnMult = mods.fuelBurnMult ?? 1.0;
    // Appliquer aux munitions
    this._maxAmmoOverride = MAX_AMMO + (mods.ammoBonus ?? 0);
    this.ammo = this._maxAmmoOverride;
    // Cadence de tir
    this._fireRate = 0.18 * (mods.fireCooldownMult ?? 1.0);
  }

  // Retire tous les écouteurs globaux — appelé par Game.destroy()
  dispose() {
    if (this._inputCleanup) { this._inputCleanup(); this._inputCleanup = null; }
  }

  // ── Traitement des inputs ────────────────────────────────────────────────
  _handleInput(delta) {
    this._readGamepad(delta);

    // Vue libre clavier (V) : actif pendant la pression + fondu au relâchement
    if (this._vKeyActive) {
      this.freeView = true;
      this._vKeyWasActive = true;
    } else if (this._vKeyWasActive && !this._rsActive) {
      const decay = 1 - Math.exp(-5 * delta);
      this._fvYaw   *= (1 - decay);
      this._fvPitch *= (1 - decay);
      if (Math.abs(this._fvYaw) < 0.008 && Math.abs(this._fvPitch) < 0.008) {
        this._fvYaw   = 0;
        this._fvPitch = 0;
        this.freeView = false;
        this._vKeyWasActive = false;
      }
    }

    // ── Gaz directs style GTA V ──────────────────────────────────────────
    const thrust = this.keys.shift ? 1 : this._gpThrottleUp;
    const brake  = this.keys.ctrl  ? 1 : this._gpThrottleDown;

    // Redémarrage moteur : Shift/RT + carburant dispo
    if (!this.engineOn && (thrust > 0.05) && this.fuel > 0) {
      this.engineOn = true;
      if (this.isLanded) this.isLanded = false;
      if (this.speed < ENGINE_CUTOFF + 2) this.speed = ENGINE_CUTOFF + 2;
    }

    // Drain carburant proportionnel aux gaz utilisés
    if (this.engineOn) {
      const fuelCost = (FUEL_DRAIN + thrust * FUEL_BOOST) * (this._fuelBurnMult ?? 1.0);
      this.fuel = Math.max(0, this.fuel - fuelCost * delta);
      if (this.fuel <= 0) this.engineOn = false;
    }

    // ── Vitesse ──────────────────────────────────────────────────────────
    const effMaxSpeed = MAX_SPEED * (this._upgMods.speedMult ?? 1.0);
    const effAccel    = ACCEL    * (this._upgMods.accelMult  ?? 1.0);
    this._lastDelta   = delta;

    if (this.isLanded) {
      this.speed = Math.max(0, this.speed - GROUND_ROLL_DRAG * delta);
    } else if (this.engineOn) {
      if (thrust > 0) {
        // RT/Shift maintenu → accélérer
        this.speed = Math.min(effMaxSpeed, this.speed + effAccel * thrust * delta);
      } else if (brake > 0) {
        // LT/Ctrl maintenu → freiner (peut descendre sous MIN_SPEED)
        this.speed = Math.max(0, this.speed - DECEL * brake * delta);
        // Moteur cale si vitesse trop basse sans gaz
        if (this.speed < ENGINE_CUTOFF) this.engineOn = false;
      } else {
        // Sans entrée : décelération douce vers la vitesse de croisière MIN_SPEED
        if (this.speed > MIN_SPEED) {
          this.speed = Math.max(MIN_SPEED, this.speed - DRAG * delta);
        }
      }
    } else {
      this.speed = Math.max(0, this.speed - GLIDE_DRAG * delta);
    }

    // Stick souris : retour passif au centre
    const decay = 1 - Math.exp(-STICK_DECAY * delta);
    this._stickX -= this._stickX * decay;
    this._stickY -= this._stickY * decay;

    if (this.isLanded) {
      this._pitchRate = 0;
      this._rollRate  = 0;
      this._yawRate   = ((this.keys.a ? 1 : 0) - (this.keys.d ? 1 : 0)) * MAX_YAW_RATE;
      this._rollInput  = 0;
      this._pitchInput = 0;
      return;
    }

    const simMode  = (localStorage.getItem('ctrlMode') === 'simulator');
    const maneuver = 1 - 0.25 * (this.speed / MAX_SPEED);

    // ── Rampe exponentielle clavier ───────────────────────────────────────
    // Chaque touche est maintenue : l'autorité monte de 0 → 1 sur KEY_RAMP_TIME s,
    // suivant une courbe exponentielle (très lent au début, rapide ensuite).
    // Relâcher la touche remet le timer à 0 instantanément.
    const ramp = (k) => {
      if (this.keys[k]) {
        this._kHold[k] = Math.min(KEY_RAMP_TIME, this._kHold[k] + delta);
        return Math.pow(this._kHold[k] / KEY_RAMP_TIME, KEY_RAMP_EXP);
      }
      this._kHold[k] = 0;
      return 0;
    };
    const kRoll  = ramp('q') - ramp('e');
    const kPitch = ramp('w') - ramp('s');
    const kYaw   = ramp('a') - ramp('d');

    const mousePitch = -this._stickY + (this._touchPitch ?? 0);
    const mouseRoll  = -this._stickX + (this._touchTurn  ?? 0);  // en mode sim : souris X = roulis
    const mouseTurn  = -this._stickX + (this._touchTurn  ?? 0);  // en mode std : souris X = virage coordonné

    // Chaque axe est clampé à [-1, 1] avant d'être multiplié par son taux max.
    // Garantit qu'aucune combinaison de périphériques ne dépasse la maniabilité maximale.
    const C = THREE.MathUtils.clamp;

    const mMult = this._upgMods.maneuverMult ?? 1.0;
    const rMult = this._upgMods.rollMult     ?? 1.0;

    if (simMode) {
      // ── MODE SIMULATEUR — style Battlefield ────────────────────────────────
      const rollIn  = C(mouseRoll  + this._gpTurn  + kRoll,  -1, 1);
      const pitchIn = C(mousePitch + this._gpPitch + kPitch, -1, 1);
      const yawIn   = C(kYaw + this._gpRoll,                 -1, 1);

      this._rollRate  = rollIn  * SIM_ROLL_RATE  * maneuver * mMult * rMult;
      this._pitchRate = pitchIn * SIM_PITCH_RATE * maneuver * mMult;
      this._yawRate   = yawIn   * SIM_YAW_RATE   * maneuver * mMult;

      this._rollInput  = rollIn;
      this._pitchInput = pitchIn;

    } else {
      // ── MODE STANDARD — virage coordonné (style GTA V) ────────────────────
      const turnIn  = C(mouseTurn + this._gpTurn, -1, 1);
      const rollIn  = C(turnIn + kRoll,           -1, 1);
      const pitchIn = C(mousePitch + this._gpPitch + kPitch, -1, 1);
      const yawIn   = C(turnIn + kYaw + this._gpRoll,        -1, 1);

      this._pitchRate = pitchIn * MAX_PITCH_RATE * maneuver * mMult;
      this._rollRate  = rollIn  * MAX_ROLL_RATE   * maneuver * mMult * rMult;
      this._yawRate   = yawIn   * MAX_YAW_RATE    * maneuver * mMult;

      this._rollInput  = rollIn;
      this._pitchInput = pitchIn;
    }
  }

  // ── Lecture Gamepad API ──────────────────────────────────────────────────
  _readGamepad(delta) {
    // Conserver les valeurs lissées entre les frames (reset seulement roll/throttle)
    this._gpRoll = 0;
    this._gpThrottleUp = 0; this._gpThrottleDown = 0;
    if (this._gpTurn  === undefined) this._gpTurn  = 0;
    if (this._gpPitch === undefined) this._gpPitch = 0;

    const gamepads = navigator.getGamepads?.();
    if (!gamepads) { this._gpTurn = 0; this._gpPitch = 0; return; }
    const gp = Array.from(gamepads).find(g => g !== null);
    if (!gp)       { this._gpTurn = 0; this._gpPitch = 0; return; }

    // Deadzone puis courbe cubique — très fine au centre, pleine autorité au max
    const dz = (v) => {
      const a = Math.abs(v);
      if (a < GAMEPAD_DEADZONE) return 0;
      const n = (a - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE); // 0→1 après deadzone
      return Math.sign(v) * n * n * n;                            // cubique : progression exponentielle
    };

    // ── Stick gauche : virage + tangage — lissage exponentiel pour éviter les à-coups ──
    const rawTurn  = -dz(gp.axes[0] ?? 0);
    const rawPitch = -dz(gp.axes[1] ?? 0);
    const sm = 1 - Math.exp(-14 * (delta ?? 0.016));  // ~14 rad/s : réactif mais doux
    this._gpTurn  += (rawTurn  - this._gpTurn)  * sm;
    this._gpPitch += (rawPitch - this._gpPitch) * sm;

    // ── LB / RB → roll manuel acrobatique ────────────────────────────────
    this._gpRoll = 0;
    const lb = gp.buttons[4]?.pressed ?? false;
    const rb = gp.buttons[5]?.pressed ?? false;
    if (lb)  this._gpRoll = +1;  // LB → roll gauche
    if (rb)  this._gpRoll = -1;  // RB → roll droite

    // ── RT / LT → régime moteur progressif ──────────────────────────────
    this._gpThrottleUp   = gp.buttons[7]?.value ?? 0;  // RT → plus de gaz
    this._gpThrottleDown = gp.buttons[6]?.value ?? 0;  // LT → moins de gaz

    // ── Stick droit : free look (sans modifier la trajectoire) ───────────
    // Deadzone linéaire simple pour la caméra (pas de quadratique ici)
    const dzLin = (v) => {
      const a = Math.abs(v);
      return a < GAMEPAD_DEADZONE ? 0 : Math.sign(v) * (a - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE);
    };
    const rsX = dzLin(gp.axes[2] ?? 0);
    const rsY = dzLin(gp.axes[3] ?? 0);
    const rsActive = Math.abs(rsX) > 0.05 || Math.abs(rsY) > 0.05;
    if (rsActive) {
      // Rampe d'entrée progressive
      this._rsRamp = Math.min(1, (this._rsRamp ?? 0) + (delta ?? 0.016) * 3.5);
      this._rsActive = true;
      const rotSpeed = 2.0 * (delta ?? 0.016) * this._rsRamp;
      this._fvYaw   -= rsX * rotSpeed;
      this._fvPitch  = Math.max(-1.2, Math.min(1.2, this._fvPitch - rsY * rotSpeed));
      this.freeView  = true;
    } else if (this._rsActive) {
      // Retour progressif vers angles zéro (= position naturelle du CameraController)
      this._rsRamp = 0;
      const decay = 1 - Math.exp(-5 * (delta ?? 0.016));
      this._fvYaw   *= (1 - decay);
      this._fvPitch *= (1 - decay);
      if (Math.abs(this._fvYaw) < 0.008 && Math.abs(this._fvPitch) < 0.008) {
        this._fvYaw   = 0;
        this._fvPitch = 0;
        this.freeView = false;
        this._rsActive = false;
      }
    } else {
      this._rsRamp = 0;
    }

    // ── L3 (clic stick gauche, btn 10) → regarder derrière (si équipement installé) ──
    this.keys.lookBack = this._tailCamEnabled && (gp.buttons[10]?.pressed ?? false);

    // ── A (btn 0) → tir ─────────────────────────────────────────────────
    const btnA = gp.buttons[0]?.pressed ?? false;
    if (btnA && !this._gpBtnA_prev) this.keys.space = true;
    if (!btnA) this.keys.space = false;
    this._gpBtnA_prev = btnA;

    // ── B (btn 1) → défense : déployer leurre / contre-mesure ───────────
    const btnB = gp.buttons[1]?.pressed ?? false;
    if (btnB && !this._gpBtnB_prev && this.onDeployDecoy) this.onDeployDecoy();
    this._gpBtnB_prev = btnB;

    // ── Y (btn 3) → changer de caméra ───────────────────────────────────
    const btnY = gp.buttons[3]?.pressed ?? false;
    if (btnY && !this._gpBtnY_prev && this.onCameraChange) this.onCameraChange();
    this._gpBtnY_prev = btnY;

    // ── X (btn 2) → missile ──────────────────────────────────────────────────
    const btnX = gp.buttons[2]?.pressed ?? false;
    if (btnX && !this._gpBtnX_prev && this.onFireMissile) this.onFireMissile();
    this._gpBtnX_prev = btnX;

    // ── Menu / Start (btn 9) → pause ─────────────────────────────────────
    const btnMenu = gp.buttons[9]?.pressed ?? false;
    if (btnMenu && !this._gpBtnMenu_prev && this.onPause) this.onPause();
    this._gpBtnMenu_prev = btnMenu;

    // ── Select / View (btn 8) → tableau des scores (maintenir) ───────────
    const btnSelect = gp.buttons[8]?.pressed ?? false;
    if (btnSelect !== this._gpBtnSelect_prev && this.onScoreboardShow) this.onScoreboardShow(btnSelect);
    this._gpBtnSelect_prev = btnSelect;
  }

  // ── Physique ─────────────────────────────────────────────────────────────
  _applyPhysics(delta) {
    if (this.isLanded) {
      // Au sol : aplatir progressivement vers le quaternion de cap seul
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._yaw);
      this.pivot.quaternion.slerp(qYaw, 1 - Math.exp(-5 * delta));
      this._yaw += this._yawRate * delta;

      if (this.speed > 0) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(qYaw);
        fwd.y = 0; fwd.normalize();
        this.pivot.position.addScaledVector(fwd, this.speed * delta);
      }
      return;
    }

    // ── Rotations en espace local (postmultiply = local body frame) ────────
    // Pitch autour de l'axe X local, Roll autour de l'axe Z local, Yaw autour de Y local
    // Cette approche supporte les tonneaux complets et le vol inversé.
    if (this._pitchRate !== 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this._pitchRate * delta);
      this.pivot.quaternion.multiply(q);
    }
    if (this._rollRate !== 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this._rollRate * delta);
      this.pivot.quaternion.multiply(q);
    }
    if (this._yawRate !== 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._yawRate * delta);
      this.pivot.quaternion.multiply(q);
    }
    this.pivot.quaternion.normalize();

    // Déplacement le long de l'axe avant local (inclut roll et pitch)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.pivot.quaternion);
    this.pivot.position.addScaledVector(fwd, this.speed * delta);

    // Gravité (espace monde -Y), modulée par la portance des ailes
    if (!this.engineOn) {
      const localUp    = new THREE.Vector3(0, 1, 0).applyQuaternion(this.pivot.quaternion);
      const liftFactor = THREE.MathUtils.clamp(this.speed / LIFT_SPEED, 0, 1);
      const gravAccel  = GRAVITY * (1 - liftFactor * 0.85 * Math.max(0, localUp.y));
      const maxSink    = 5 + (1 - liftFactor) * 18;
      this._sinkRate   = THREE.MathUtils.clamp(this._sinkRate + gravAccel * delta, -18, maxSink);
      this.pivot.position.y -= this._sinkRate * delta;
    } else {
      this._sinkRate = Math.max(0, this._sinkRate - 20 * delta);
    }

    if (this.pivot.position.y > MAX_ALT) this.pivot.position.y = MAX_ALT;

    // Extraire les angles Euler pour le HUD, les bones et le déplacement au sol
    const euler = new THREE.Euler().setFromQuaternion(this.pivot.quaternion, 'YXZ');
    this._yaw   = euler.y;
    this._pitch = euler.x;
    this._roll  = euler.z;
  }

  // ── Animation procédurale des bones ─────────────────────────────────────
  _animateBones(delta) {
    const t = performance.now() * 0.001;

    // Vibration moteur
    if (this.model) {
      if (this.engineOn) {
        const intensity = 0.001 + (this.speed / MAX_SPEED) * 0.002;
        this.model.position.y = Math.sin(t * 47.3) * intensity;
        this.model.position.x = Math.cos(t * 61.7) * intensity * 0.5;
      } else {
        this.model.position.y *= 0.9;
        this.model.position.x *= 0.9;
      }
    }

    // Hélice — ralentit progressivement quand moteur coupé
    if (this.bones.propeller) {
      if (this.engineOn) {
        const boost = (this.keys.shift || this._gpThrottleUp > 0.5) ? 1.5 : 1.0;
        const rpm = (22 + (this.speed / MAX_SPEED) * 55) * boost;
        // Capper à π*0.6 par frame pour éviter l'effet wagon-wheel (aliasing stroboscopique)
        const maxPerFrame = Math.PI * 0.6;
        const frameRot = rpm * delta;
        this.bones.propeller.rotation.y += Math.max(-maxPerFrame, Math.min(maxPerFrame, frameRot));
        this._propSpeed = rpm;
      } else {
        this._propSpeed = Math.max(0, (this._propSpeed ?? 0) - 12 * delta);
        this.bones.propeller.rotation.y += this._propSpeed * delta;
      }
    }

    // Entrées de contrôle normalisées (pas l'angle accumulé)
    const rollNorm  = this._rollInput;
    const pitchNorm = this._pitchInput;
    const adInput   = this.keys.a ? 1 : this.keys.d ? -1 : 0;
    const lerpCtrl  = 1 - Math.exp(-8 * delta);
    const lerpElev  = 1 - Math.exp(-14 * delta);

    // Ailerons aile gauche (fl) :
    //   virage droite (rollNorm < 0) → descend → +rotation.x
    //   virage gauche (rollNorm > 0) → monte  → -rotation.x
    const aileronLeft = -rollNorm * 0.85;
    if (this.bones.flapFl01) {
      this.bones.flapFl01.rotation.z = THREE.MathUtils.lerp(
        this.bones.flapFl01.rotation.z, aileronLeft, lerpCtrl
      );
    }
    if (this.bones.flapFl02) {
      this.bones.flapFl02.rotation.z = THREE.MathUtils.lerp(
        this.bones.flapFl02.rotation.z, aileronLeft, lerpCtrl
      );
    }

    // Ailerons aile droite (fr) : sens opposé à l'aile gauche
    const aileronRight = rollNorm * 0.85;
    if (this.bones.flapFr01) {
      this.bones.flapFr01.rotation.z = THREE.MathUtils.lerp(
        this.bones.flapFr01.rotation.z, aileronRight, lerpCtrl
      );
    }
    if (this.bones.flapFr02) {
      this.bones.flapFr02.rotation.z = THREE.MathUtils.lerp(
        this.bones.flapFr02.rotation.z, aileronRight, lerpCtrl
      );
    }

    // Empennage horizontal (rl / rr) :
    //   monter (pitchNorm > 0) → monte
    //   descendre (pitchNorm < 0) → descend
    //   en virage : légère montée des deux côtés
    const elevTarget = pitchNorm * 0.70 + Math.abs(rollNorm) * 0.10;
    if (this.bones.flapRl01) {
      this.bones.flapRl01.rotation.z = THREE.MathUtils.lerp(
        this.bones.flapRl01.rotation.z, elevTarget, lerpElev
      );
    }
    if (this.bones.flapRr01) {
      this.bones.flapRr01.rotation.z = THREE.MathUtils.lerp(
        this.bones.flapRr01.rotation.z, elevTarget, lerpElev
      );
    }

    // Gouvernail vertical (Tail) :
    //   virage droite (rollNorm < 0) → tourne à droite → rotation.y négative
    //   A/D ajoutent un lacet direct
    const rudderTarget = (-rollNorm * 0.4 + adInput) * 0.28;
    if (this.bones.flapTail) {
      this.bones.flapTail.rotation.x = THREE.MathUtils.lerp(
        this.bones.flapTail.rotation.x, rudderTarget, lerpElev
      );
    }
  }

  // ── Débogage : affiche toute la hiérarchie du modèle ────────────────────
  _debugModel(gltf) {
    console.group('%c[DEBUG] Analyse du modèle GLB', 'color:#4fc3f7;font-weight:bold');

    const allObjects     = [];
    const allMeshes      = [];
    const allSkinnedMesh = [];
    const allBones       = [];

    gltf.scene.traverse((node) => {
      allObjects.push(node);
      if (node.isMesh)        allMeshes.push(node);
      if (node.isSkinnedMesh) allSkinnedMesh.push(node);
      if (node.isBone)        allBones.push(node);
    });

    console.log(`Objets totaux     : ${allObjects.length}`);
    console.log(`Meshes            : ${allMeshes.length}`);
    console.log(`SkinnedMeshes     : ${allSkinnedMesh.length}`);
    console.log(`Bones (isBone)    : ${allBones.length}`);

    if (allSkinnedMesh.length > 0) {
      console.group('Skeletons détectés');
      allSkinnedMesh.forEach((sm) => {
        console.group(`SkinnedMesh : "${sm.name}"`);
        const skeleton = sm.skeleton;
        if (skeleton) {
          console.log(`  Nombre de bones : ${skeleton.bones.length}`);
          skeleton.bones.forEach((bone, i) => {
            const parentName = bone.parent?.isBone ? bone.parent.name : '(root)';
            console.log(`  [${String(i).padStart(3,'0')}] ${bone.name}  ←  parent: ${parentName}`);
          });

          // Hiérarchie en arbre
          console.group('Hiérarchie complète');
          this._printBoneTree(skeleton.bones[0], 0, skeleton.bones);
          console.groupEnd();
        }
        console.groupEnd();
      });
      console.groupEnd();
    } else {
      console.warn('Aucun SkinnedMesh trouvé — le modèle est peut-être un StaticMesh converti.');
      console.log('Bones via isBone :');
      allBones.forEach((b) => console.log(`  • ${b.name}`));
    }

    console.log('Animations :', gltf.animations?.map(a => a.name) ?? 'aucune');
    console.groupEnd();
  }

  // ── Affichage récursif de l'arbre de bones ───────────────────────────────
  _printBoneTree(bone, depth, allBones) {
    if (!bone) return;
    console.log('  ' + '  '.repeat(depth) + '└─ ' + bone.name);
    bone.children
      .filter((c) => c.isBone)
      .forEach((child) => this._printBoneTree(child, depth + 1, allBones));
  }

  // ── Mapping des bones par nom ─────────────────────────────────────────────
  _mapBones() {
    const findBone = (names) => {
      for (const name of names) {
        let found = null;
        this.model.traverse((node) => {
          if ((node.isBone || node.isObject3D) && node.name === name) found = node;
        });
        if (found) return found;
      }
      return null;
    };

    this.bones.propeller = findBone(this._boneNames.propeller);
    this.bones.flapFl01  = findBone(this._boneNames.flapFl01);
    this.bones.flapFl02  = findBone(this._boneNames.flapFl02);
    this.bones.flapFr01  = findBone(this._boneNames.flapFr01);
    this.bones.flapFr02  = findBone(this._boneNames.flapFr02);
    this.bones.flapRl01  = findBone(this._boneNames.flapRl01);
    this.bones.flapRr01  = findBone(this._boneNames.flapRr01);
    this.bones.flapTail  = findBone(this._boneNames.flapTail);

    console.group('%c[Player] Bones mappés', 'color:#a5d6a7;font-weight:bold');
    Object.entries(this.bones).forEach(([k, v]) => {
      console.log(`  ${k.padEnd(12)} : ${v ? v.name : '⚠ non trouvé'}`);
    });
    console.groupEnd();
  }

  // ── SkeletonHelper visuel ─────────────────────────────────────────────────
  _addSkeletonHelper() {
    let hasSkinnedMesh = false;
    this.model.traverse((node) => {
      if (node.isSkinnedMesh) hasSkinnedMesh = true;
    });

    if (hasSkinnedMesh) {
      const helper = new THREE.SkeletonHelper(this.model);
      helper.visible = false; // masqué en jeu — passer à true pour déboguer les bones
      this.scene.add(helper);
      console.log('[Player] SkeletonHelper créé (caché). Mettre helper.visible=true pour déboguer.');
    } else {
      console.warn('[Player] Pas de SkinnedMesh → SkeletonHelper non créé.');
    }
  }
}

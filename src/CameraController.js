import * as THREE from 'three';

const BASE_BACK       = 2.4;   // distance de base (vitesse min)
const MAX_BACK        = 6.5;   // distance max (vitesse max / boost)
const BASE_UP         = 0.5;
const CAM_LERP        = 5.0;
const DIST_LERP_OUT   = 12.0;  // lerp très rapide en éloignement (accélération)
const DIST_LERP_IN    = 3.0;   // lerp lent en rapprochement (décélération)
export class CameraController {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    this._initialized = false;
    this._camQ      = new THREE.Quaternion();
    this._curBack   = BASE_BACK;
  }

  init() {
    this._camQ.copy(this.player.quaternion);
    const offset = new THREE.Vector3(0, BASE_UP, BASE_BACK).applyQuaternion(this._camQ);
    this.camera.position.copy(this.player.position).add(offset);
    this._initialized = true;
  }

  update(delta) {
    if (!this._initialized) return;

    const planePos = this.player.position;
    const planeQ   = this.player.quaternion;

    // Lerp l'orientation de l'offset → smooth en virage, pas de lag en distance
    this._camQ.slerp(planeQ, 1 - Math.exp(-CAM_LERP * delta));

    // Distance cible : interpolation exponentielle entre BASE_BACK et MAX_BACK
    const r = this.player.speed / 120;
    const curve = (1 - Math.exp(-3.5 * r)) / (1 - Math.exp(-3.5));
    const targetBack = BASE_BACK + (MAX_BACK - BASE_BACK) * curve;

    // Lerp rapide en éloignement, lent en rapprochement — accentue la sensation
    const lerpSpeed = targetBack > this._curBack ? DIST_LERP_OUT : DIST_LERP_IN;
    this._curBack += (targetBack - this._curBack) * (1 - Math.exp(-lerpSpeed * delta));

    const offset = new THREE.Vector3(0, BASE_UP, this._curBack).applyQuaternion(this._camQ);
    const camPos = planePos.clone().add(offset);
    camPos.y = Math.max(1.5, camPos.y);
    this.camera.position.copy(camPos);

    // ── Look-ahead : la caméra anticipe le pitch et le virage ─────────────
    // Lissage indépendant pour éviter les à-coups
    const lSmooth = 1 - Math.exp(-3.5 * delta);
    this._laP = (this._laP ?? 0) + (((this.player._pitchInput ?? 0) *  0.8) - (this._laP ?? 0)) * lSmooth;
    this._laR = (this._laR ?? 0) + (((this.player._rollInput  ?? 0) * -0.5) - (this._laR ?? 0)) * lSmooth;

    const planeUp    = new THREE.Vector3(0, 1, 0).applyQuaternion(this._camQ);
    const planeRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this._camQ);
    const lookTarget = planePos.clone()
      .addScaledVector(planeUp,    this._laP)
      .addScaledVector(planeRight, this._laR);

    // Vecteur "haut" local de l'avion → la caméra suit le roll (vol inversé, tonneaux)
    this.camera.up.copy(planeUp);
    this.camera.lookAt(lookTarget);
  }
}

import * as THREE from 'three';

const TRAIL_LENGTH  = 60;   // nombre de points dans l'historique
const HALF_WINGSPAN = 1.95; // demi-envergure en unités monde (modèle ~4u)

// Crée une ligne avec dégradé d'opacité (blanc → transparent vers la queue)
function makeTrailLine(length) {
  const positions = new Float32Array(length * 3);
  const colors    = new Float32Array(length * 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3).setUsage(THREE.DynamicDrawUsage));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  return { line: new THREE.Line(geo, mat), positions, colors };
}

export class Trail {
  constructor(scene) {
    this._scene = scene;

    // Deux lignes — une par bout d'aile
    this._left  = makeTrailLine(TRAIL_LENGTH);
    this._right = makeTrailLine(TRAIL_LENGTH);
    this._left.line.renderOrder  = 1;
    this._right.line.renderOrder = 1;
    scene.add(this._left.line);
    scene.add(this._right.line);

    // Historique de positions world-space
    this._histL = [];
    this._histR = [];
  }

  update(delta, player) {
    const pos = player.position;
    const speed = player.speed;
    const maxSpeed = 120;
    const intensity = Math.min(1, speed / maxSpeed);

    // Direction droite de l'avion dans le monde (axe X du pivot après yaw+roll)
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(player.quaternion);

    const leftTip  = pos.clone().addScaledVector(rightVec, -HALF_WINGSPAN);
    const rightTip = pos.clone().addScaledVector(rightVec,  HALF_WINGSPAN);

    // Ajouter en tête de l'historique
    this._histL.unshift(leftTip.clone());
    this._histR.unshift(rightTip.clone());

    // Limiter la longueur
    if (this._histL.length > TRAIL_LENGTH) this._histL.pop();
    if (this._histR.length > TRAIL_LENGTH) this._histR.pop();

    // Toujours écrire les buffers — l'opacité via vertexColors contrôle la visibilité
    const showIntensity = this._histL.length >= 4 ? intensity : 0;
    this._writeBuffer(this._left,  this._histL, showIntensity, speed);
    this._writeBuffer(this._right, this._histR, showIntensity, speed);
  }

  _writeBuffer(trail, history, intensity, speed) {
    const len = history.length;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const i3 = i * 3;
      if (i < len) {
        trail.positions[i3]     = history[i].x;
        trail.positions[i3 + 1] = history[i].y;
        trail.positions[i3 + 2] = history[i].z;
        // Fondu : pleine opacité en tête, transparent en queue
        const t = i / (len - 1);
        const alpha = (1 - t) * intensity * (speed >= 110 ? 1 : 0);
        trail.colors[i3]     = alpha;
        trail.colors[i3 + 1] = alpha;
        trail.colors[i3 + 2] = alpha;
      } else {
        trail.positions[i3] = trail.positions[i3 + 1] = trail.positions[i3 + 2] = 0;
        trail.colors[i3] = trail.colors[i3 + 1] = trail.colors[i3 + 2] = 0;
      }
    }
    trail.line.geometry.attributes.position.needsUpdate = true;
    trail.line.geometry.attributes.color.needsUpdate    = true;
  }
}

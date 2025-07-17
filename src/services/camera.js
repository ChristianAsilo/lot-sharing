import * as THREE from "three";

let camera;
let scene;
const centerLat = 14.233539920666581;
const centerLon = 121.15133389733768;
const scale = 385000;

function convertToXY([lon, lat]) {
  const x = (lon - centerLon) * scale;
  const y = (lat - centerLat) * scale;
  return { x, y };
}
const gateCoord = [121.149852, 14.234344];

export function resetCamera() {
  if (!camera || !scene) return;

  // Reset rotation first
  scene.rotation.z = 0;

  // Convert gateCoord to world XY
  const { x, y } = convertToXY(gateCoord);

  // Recenter camera directly on the actual point
  camera.position.set(x, y, 10);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}

export function clampCameraToRedCircle(center, radius) {
  const dx = camera.position.x - center.x;
  const dy = camera.position.y - center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Clamp position if outside the circle
  if (dist > radius) {
    const angle = Math.atan2(dy, dx);
    camera.position.x = center.x + radius * Math.cos(angle);
    camera.position.y = center.y + radius * Math.sin(angle);
  }

  // Clamp zoom if view edges extend beyond circle
  const halfViewSize = Math.sqrt(
    (window.innerWidth / 2 / camera.zoom) ** 2 +
      (window.innerHeight / 2 / camera.zoom) ** 2
  );

  const maxAllowedZoomOut = radius / halfViewSize;

  if (camera.zoom < 1 / maxAllowedZoomOut) {
    camera.zoom = 1 / maxAllowedZoomOut;
    camera.updateProjectionMatrix();
  }
}
export function rotateCameraToRedCircle(center, radius) {
  // Step 1: Rotate camera position into scene-local space
  const inverseRotation = new THREE.Quaternion();
  inverseRotation.setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    -scene.rotation.z
  );

  const camPos = camera.position.clone().sub(center);
  camPos.applyQuaternion(inverseRotation);

  // Step 2: Clamp to radius if needed
  const distance = camPos.length();
  if (distance > radius) {
    camPos.setLength(radius);
  }

  // Step 3: Re-rotate the clamped position back to world space
  camPos.applyQuaternion(scene.quaternion); // or applyAxisAngle again if needed
  camPos.add(center);

  // Step 4: Move the camera
  camera.position.x = camPos.x;
  camera.position.y = camPos.y;
}

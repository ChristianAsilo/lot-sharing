// mapInteractions.js
import * as THREE from "three";

export function mapInteractions(
  canvas,
  camera,
  scene,
  mapWidth,
  mapHeight,
  mapCenter
) {
  let isDragging = false;
  let isRotating = false;
  let lastMouse = { x: 0, y: 0 };
  let lastAngle = null;
  let lastPinchDistance = null;
  let userMovedCamera = false;

  window.addEventListener("mouseup", () => {
    isDragging = false;
    isRotating = false;
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      camera.zoom += e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
      camera.zoom = Math.max(0.5, Math.min(5, camera.zoom));
      camera.updateProjectionMatrix();
    },
    { passive: false }
  );

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function startDrag(x, y, button = 0) {
    lastMouse.x = x;
    lastMouse.y = y;
    if (button === 0) isDragging = true;
    else if (button === 2) isRotating = true;
  }

  function stopDrag() {
    isDragging = false;
    isRotating = false;
  }

  function moveDrag(x, y) {
    const dx = x - lastMouse.x;
    const dy = y - lastMouse.y;
    lastMouse.x = x;
    lastMouse.y = y;

    if (isDragging) {
      camera.position.x -= dx / camera.zoom;
      camera.position.y += dy / camera.zoom;

      const halfWidth = window.innerWidth / 2 / camera.zoom;
      const halfHeight = window.innerHeight / 2 / camera.zoom;
      const xLimit = mapWidth / 2 - halfWidth;
      const yLimit = mapHeight / 2 - halfHeight;

      camera.position.x = Math.max(
        -xLimit,
        Math.min(xLimit, camera.position.x)
      );
      camera.position.y = Math.max(
        -yLimit,
        Math.min(yLimit, camera.position.y)
      );
    }

    if (isRotating) {
      scene.rotation.z += dx * 0.005;
    }
  }
  //   function moveDrag(x, y) {
  //   const dx = x - lastMouse.x
  //   const dy = y - lastMouse.y
  //   lastMouse.x = x
  //   lastMouse.y = y

  //   if (isDragging) {
  //     camera.position.x -= dx / camera.zoom
  //     camera.position.y += dy / camera.zoom

  //     const halfWidth = (window.innerWidth / 2) / camera.zoom
  //     const halfHeight = (window.innerHeight / 2) / camera.zoom
  //     const xLimit = mapWidth / 2 - halfWidth
  //     const yLimit = mapHeight / 2 - halfHeight

  //     camera.position.x = Math.max(-xLimit, Math.min(xLimit, camera.position.x))
  //     camera.position.y = Math.max(-yLimit, Math.min(yLimit, camera.position.y))
  //   }
  //   if (isRotating) {
  //     scene.rotation.z += dx * 0.005
  //   }
  // }

  function getAngle(touches) {
    const [touch1, touch2] = touches;
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx);
  }

  canvas.addEventListener(
    "touchstart",
    (e) => {
      userMovedCamera = true;
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY, 0);
      } else if (e.touches.length === 2) {
        lastAngle = getAngle(e.touches);
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      userMovedCamera = true;

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY);
      } else if (e.touches.length === 2) {
        const newAngle = getAngle(e.touches);

        if (lastAngle !== null) {
          const delta = newAngle - lastAngle;
          const center = new THREE.Vector3(mapCenter.x, mapCenter.y, 0);

          scene.position.sub(center);
          scene.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), delta);
          scene.position.add(center);

          scene.rotation.z += delta;
        }

        lastAngle = newAngle;

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (lastPinchDistance !== null) {
          const zoomFactor = distance / lastPinchDistance;
          camera.zoom *= zoomFactor;
          camera.zoom = Math.max(0.5, Math.min(5, camera.zoom));
          camera.updateProjectionMatrix();
        }

        lastPinchDistance = distance;
      }
    },
    { passive: false }
  );

  canvas.addEventListener("touchend", () => {
    stopDrag();
    lastAngle = null;
    lastPinchDistance = null;
  });
}

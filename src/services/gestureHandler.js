// mapInteractions.js
import * as THREE from "three";
export function mapInteractions(canvas, camera, scene, zoomVal) {
  let isDragging = false;
  let isRotating = false;
  let lastMouse = { x: 0, y: 0 };
  let lastAngle = null;
  let lastPinchDistance = null;

  const MAP_BOUNDS = {
    minX: -900,
    maxX: 900,
    minY: -450,
    maxY: 450,
  };

  canvas.addEventListener("mousedown", (e) => {
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
    if (e.button === 0) isDragging = true;
    else if (e.button === 2) {
      isRotating = true;
    }
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    isRotating = false;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging && !isRotating) return;

    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;

    handleMove(dx, dy);

    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
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

  function stopDrag() {
    isDragging = false;
    isRotating = false;
  }

  function handleMove(dx, dy) {
    if (isDragging) {
      scene.position.x += dx;
      scene.position.y -= dy;
    }

    if (isRotating) {
      const deltaAngle = -dx * 0.005;

      const screenCenter = new THREE.Vector2(
        window.innerWidth / 2,
        window.innerHeight / 2
      );
      const ndc = new THREE.Vector3(
        (screenCenter.x / window.innerWidth) * 2 - 1,
        -(screenCenter.y / window.innerHeight) * 2 + 1,
        0
      );
      ndc.unproject(camera);
      const pivot = new THREE.Vector3(ndc.x, ndc.y, 0);
      scene.position.sub(pivot);
      scene.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), deltaAngle);
      scene.position.add(pivot);
      scene.rotation.z += deltaAngle;
    }

    const unrotatedScenePos = scene.position
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), -scene.rotation.z);

    unrotatedScenePos.x = Math.min(
      Math.max(unrotatedScenePos.x, MAP_BOUNDS.minX),
      MAP_BOUNDS.maxX
    );
    unrotatedScenePos.y = Math.min(
      Math.max(unrotatedScenePos.y, MAP_BOUNDS.minY),
      MAP_BOUNDS.maxY
    );

    const clamped = unrotatedScenePos.applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      scene.rotation.z
    );

    scene.position.copy(clamped);
  }

  function getAngle(touches) {
    const [touch1, touch2] = touches;
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx);
  }

  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastMouse.x = touch.clientX;
        lastMouse.y = touch.clientY;
        isDragging = true;
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

      if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0];
        const dx = (touch.clientX - lastMouse.x) * 1.5;
        const dy = (lastMouse.y - touch.clientY) * 1.5;

        handleMove(dx, -dy);

        lastMouse.x = touch.clientX;
        lastMouse.y = touch.clientY;
      }

      if (e.touches.length === 2) {
        const [touch1, touch2] = e.touches;
        const angleNow = getAngle(e.touches);
        let deltaAngle = 0;

        if (lastAngle !== null) {
          deltaAngle = -(angleNow - lastAngle); // Invert rotation for mobile
        }
        lastAngle = angleNow;

        // Zoom
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (lastPinchDistance !== null) {
          const deltaZoom = (distance - lastPinchDistance) * 0.003;
          camera.zoom += deltaZoom;
          camera.zoom = Math.max(0.5, Math.min(4, camera.zoom));
          camera.updateProjectionMatrix();
        }
        lastPinchDistance = distance;

        // Rotate around screen center
        const screenCenter = new THREE.Vector2(
          window.innerWidth / 2,
          window.innerHeight / 2
        );
        const ndc = new THREE.Vector3(
          (screenCenter.x / window.innerWidth) * 2 - 1,
          -(screenCenter.y / window.innerHeight) * 2 + 1,
          0
        );
        ndc.unproject(camera);
        const pivot = new THREE.Vector3(ndc.x, ndc.y, 0);

        scene.position.sub(pivot);
        scene.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), deltaAngle);
        scene.position.add(pivot);
        scene.rotation.z += deltaAngle;
      }

      // // Clamp inside epicycloid shape
      // const R = 2000;
      // const r = 800;
      // const rotatedPos = scene.position.clone();
      // const unrotated = rotatedPos
      //   .clone()
      //   .applyAxisAngle(new THREE.Vector3(0, 0, 1), -scene.rotation.z);

      // const angle = Math.atan2(unrotated.y, unrotated.x);
      // const maxRadius = R + r - r * Math.cos(((R + r) / r) * angle);

      // if (unrotated.length() > maxRadius) {
      //   unrotated.setLength(maxRadius);
      //   const clamped = unrotated.applyAxisAngle(
      //     new THREE.Vector3(0, 0, 1),
      //     scene.rotation.z
      //   );
      //   scene.position.copy(clamped);
      // }
    },
    { passive: false }
  );

  canvas.addEventListener("touchend", () => {
    stopDrag();
    lastAngle = null;
    lastPinchDistance = null;
  });
}

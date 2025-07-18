import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { watchUserLocation } from "@/services/locationService";
import { clampCameraToRedCircle } from "./camera";
import { mapInteractions } from "./gestureHandler";

let camera;
let scene;
let locationDot;
let mapWidth;
let mapHeight;
const centerLat = 14.233539920666581;
const centerLon = 121.15133389733768;
const scale = 385000;
const mapCenter = convertToXY([centerLon, centerLat]);
const targetCoord = [121.152172, 14.233072];
const gateCoord = [121.149852, 14.234344];
let liveCoords;
let coordMap;
let redCircleCenter = new THREE.Vector2(mapCenter.x + 120, mapCenter.y);
let redCircleRadius = 0;
let userMovedCamera = false;
const defaultCameraState = {
  position: new THREE.Vector3(),
  zoom: 1,
  rotation: 0,
};

export function checkPermissionAndInit() {
  navigator.permissions.query({ name: "geolocation" }).then((result) => {
    handlePermissionState(result.state);

    result.onchange = () => {
      handlePermissionState(result.state);
    };
  });
}

export function handlePermissionState(state) {
  if (state === "granted") {
    initiateMap();
  } else if (state === "prompt") {
    navigator.geolocation.getCurrentPosition(
      () => {
        initiateMap();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          console.log("User denied location permission.");
        }
      }
    );
  } else if (state === "denied") {
    console.log("Permission denied");
    mapInitialized.value = false;
  }
}

export function initiateMap(canvas, mapInitialized) {
  mapInitialized.value = true;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  let lineMaterial;
  let pinSprite;
  let lastPinchDistance = null;

  camera = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    0.1,
    1000
  );
  camera.position.z = 10;
  let routeGroup = new THREE.Group();
  scene.add(routeGroup);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  defaultCameraState.position.copy(camera.position);
  defaultCameraState.zoom = camera.zoom;
  defaultCameraState.rotation = scene.rotation.z;
  const loader = new THREE.TextureLoader();
  loader.load("/assets/images/cabuyao_map_2000m.jpg", (texture) => {
    mapWidth = texture.image.width;
    mapHeight = texture.image.height;

    const geometry = new THREE.PlaneGeometry(mapWidth, mapHeight);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mapPlane = new THREE.Mesh(geometry, material);
    scene.add(mapPlane);
    if (mapInitialized.value) {
    }

    watchUserLocation((pos) => {
      const { longitude, latitude, heading } = pos.coords;
      liveCoords = [longitude, latitude];
      fetch("/assets/json/points.json")
        .then((res) => res.json())
        .then((data) => {
          coordMap = new Map();
          data.points.forEach((p) => {
            coordMap.set(p.id, p.coordinates);
          });

          const threshold = 0.0003; // ~30 meters
          const distToNearest = findNearestPoint(liveCoords, coordMap);

          const coords = distToNearest < threshold ? liveCoords : gateCoord;
          const { x, y } = convertToXY(coords);

          // --- everything that uses coords, x, y should be inside here ---
          if (!locationDot) {
            const dot = new THREE.Mesh(
              new THREE.CircleGeometry(8, 32),
              new THREE.MeshBasicMaterial({ color: 0x4285f4 })
            );

            const beamShape = new THREE.Shape();
            const radius = 30;
            const angleSpan = Math.PI;

            beamShape.moveTo(0, 0);
            beamShape.absarc(0, 0, radius, -angleSpan, angleSpan, false);
            beamShape.lineTo(0, 0);

            const beamGeo = new THREE.ShapeGeometry(beamShape);
            const beamMat = new THREE.MeshBasicMaterial({
              color: 0x4285f4,
              transparent: true,
              opacity: 0.3,
              depthWrite: false,
            });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.name = "directionBeam";
            beam.rotation.z = Math.PI / 2;

            locationDot = new THREE.Group();
            locationDot.add(dot);
            locationDot.add(beam);
            locationDot.position.set(x, y, 1.5);
            scene.add(locationDot);
          } else {
            locationDot.position.set(x, y, 1.5);
          }

          if (!userMovedCamera) {
            camera.position.set(x, y, 10);
          }

          if (
            !userMovedCamera &&
            typeof heading === "number" &&
            !isNaN(heading)
          ) {
            scene.rotation.z = -THREE.MathUtils.degToRad(heading);
          }
          loadAndDrawPoints(coords);
        });
    });
  });

  function loadAndDrawPoints(startCoord) {
    if (userMovedCamera) return;

    while (routeGroup.children.length > 0) {
      routeGroup.remove(routeGroup.children[0]);
    }

    fetch("/assets/json/points.json")
      .then((res) => res.json())
      .then((data) => {
        const points = data.points;
        const pointMap = new Map();
        const coordMap = new Map();

        points.forEach((p) => {
          pointMap.set(p.id, p.points);
          coordMap.set(p.id, p.coordinates);
        });

        // --- 🔁 Dijkstra Route Drawing ---
        function findNearestPointId(coord) {
          let nearestId = null;
          let minDist = Infinity;
          for (const [id, coords] of coordMap.entries()) {
            if (!coords || coords.length < 2) continue;
            const [lon, lat] = coords;
            const dx = lon - coord[0];
            const dy = lat - coord[1];
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
              minDist = dist;
              nearestId = id;
            }
          }
          return nearestId;
        }

        const startId = findNearestPointId(startCoord);
        const targetId = findNearestPointId(targetCoord);

        const visited = new Set();
        const parent = new Map();
        const queue = [startId];
        visited.add(startId);

        while (queue.length > 0) {
          const current = queue.shift();
          if (current === targetId) break;
          const neighbors = pointMap.get(current) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              parent.set(neighbor, current);
              queue.push(neighbor);
            }
          }
        }

        const path = [];
        let node = targetId;
        while (node !== undefined) {
          path.unshift(node);
          node = parent.get(node);
        }

        const linePoints = path.map((id) => {
          const [lon, lat] = coordMap.get(id);
          const { x, y } = convertToXY([lon, lat]);
          return new THREE.Vector3(x, y, 0);
        });

        const positions = [];
        linePoints.forEach((p) => positions.push(p.x, p.y, p.z));

        const lineGeometry = new LineGeometry();
        lineGeometry.setPositions(positions);

        lineMaterial = new LineMaterial({
          color: 0x4285f4,
          linewidth: 8,
          worldUnits: false,
        });
        lineMaterial.resolution.set(window.innerWidth, window.innerHeight);

        const thickLine = new Line2(lineGeometry, lineMaterial);
        thickLine.computeLineDistances();
        routeGroup.add(thickLine);

        const { x: tx, y: ty } = convertToXY(targetCoord);
        const texture = new THREE.TextureLoader().load(
          "/assets/stickers/location_pin.png"
        );
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
        });
        const geometry = new THREE.PlaneGeometry(36, 36);
        geometry.translate(0, 18, 0);
        pinSprite = new THREE.Mesh(geometry, material);
        pinSprite.position.set(tx, ty, 3);
        routeGroup.add(pinSprite);

        // --- 🔴 Circular red line using mapCenter ---
        redCircleCenter = new THREE.Vector2(mapCenter.x + 120, mapCenter.y);
        let maxDist = 0;
        linePoints.forEach((p) => {
          const dx = p.x - redCircleCenter.x;
          const dy = p.y - redCircleCenter.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxDist) maxDist = dist;
        });

        const padding = 600; // Add extra buffer around
        const radius = maxDist + padding;
        const segments = 128;
        const circlePoints = [];

        redCircleRadius = radius;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const x = redCircleCenter.x + radius * Math.cos(theta);
          const y = redCircleCenter.y + radius * Math.sin(theta);
          circlePoints.push(new THREE.Vector3(x, y, 0.5));
        }

        const circleGeo = new THREE.BufferGeometry().setFromPoints(
          circlePoints
        );
        const circleMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const circleLine = new THREE.LineLoop(circleGeo, circleMat);
        routeGroup.add(circleLine);
      });
  }

  function animate() {
    requestAnimationFrame(animate);

    if (lineMaterial) {
      lineMaterial.resolution.set(window.innerWidth, window.innerHeight);
    }
    renderer.render(scene, camera);

    if (locationDot) {
      locationDot.rotation.z = -scene.rotation.z;
    }
    if (pinSprite) {
      pinSprite.rotation.z = -scene.rotation.z;
    }
  }

  animate();
  mapInteractions(canvas, camera, scene, mapWidth, mapHeight, mapCenter);
}

export function convertToXY([lon, lat]) {
  const x = (lon - centerLon) * scale;
  const y = (lat - centerLat) * scale;
  return { x, y };
}

export function findNearestPoint(coord, coordMap) {
  let minDist = Infinity;
  for (const coords of coordMap.values()) {
    if (!coords || coords.length < 2) continue;
    const dx = coords[0] - coord[0];
    const dy = coords[1] - coord[1];
    const dist = dx * dx + dy * dy;
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

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

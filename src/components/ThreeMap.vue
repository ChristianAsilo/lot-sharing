
<template>
    <div class="map-wrapper">
      <canvas ref="canvas" id="webgl"></canvas>
    </div>
  </template>
  
  <script setup>
  import { onMounted, ref } from 'vue'
  import * as THREE from 'three'
  import { MeshLine, MeshLineMaterial } from 'three.meshline';

  const canvas = ref(null)
  
  onMounted(() => {
    const wrapper = document.querySelector('.map-wrapper')
    const width = window.innerWidth
    const height = window.innerHeight

    const renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
    alpha: true,
    })
  renderer.setSize(width, height)
  
    const scene = new THREE.Scene()
  
    const camera = new THREE.OrthographicCamera(
      window.innerWidth / -1,
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerHeight / -2,
      0.1,
      1000
    )
    camera.position.z = 10
  
    // Map bounds based on known coordinates
    const mapBounds = {
      north: 14.3000,
      south: 14.2500,
      west: 121.1000,
      east: 121.1500,
    }
  
    const loader = new THREE.TextureLoader()
    loader.load('/assets/images/cabuyao_map_4000m.jpg', (texture) => {
      const mapWidth = texture.image.width
      const mapHeight = texture.image.height
  
      const geometry = new THREE.PlaneGeometry(mapWidth, mapHeight)
      const material = new THREE.MeshBasicMaterial({ map: texture })
      const mapPlane = new THREE.Mesh(geometry, material)
      scene.add(mapPlane)
  
      mapPlane.position.set(0, 0, 0)
  
      // Drag to rotate map
      let isDragging = false
      let lastX = 0
  
      window.addEventListener('mousedown', (e) => {
        isDragging = true
        lastX = e.clientX
      })
      window.addEventListener('resize', () => {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h)
  camera.left = w / -1
  camera.right = w / 2
  camera.top = h / 2
  camera.bottom = h / -2
  camera.updateProjectionMatrix()
})
      window.addEventListener('mouseup', () => (isDragging = false))
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return
        const delta = e.clientX - lastX
        lastX = e.clientX
        mapPlane.rotation.z += delta * 0.005
      })
  
      // Fetch point data
   // Fetch pin data
   fetch('/assets/json/points.json')
  .then((res) => res.json())
  .then((data) => {
    const pointMap = new Map();
    const coordMap = new Map();

    const convertToXY = ([lng, lat]) => {
      const xRatio = (lng - mapBounds.west) / (mapBounds.east - mapBounds.west);
      const yRatio = (mapBounds.north - lat) / (mapBounds.north - mapBounds.south);
      const x = xRatio * mapWidth - mapWidth / 2;
      const y = yRatio * mapHeight - mapHeight / 2;
      return { x, y };
    };

    data.points.forEach((point) => {
      pointMap.set(point.id, point.points);
      coordMap.set(point.id, point.coordinates);
    });

    // ✅ Wait for user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;

          // ✅ Find nearest point to user location
          let nearestId = null;
          let minDist = Infinity;
          for (const [id, [lng, lat]] of coordMap.entries()) {
            const dx = lng - userLng;
            const dy = lat - userLat;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
              minDist = dist;
              nearestId = id;
            }
          }

          const startId = nearestId;
          const targetId = 664; // 🔁 Change this to your destination point ID

          // ✅ BFS pathfinding
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

          // ✅ Backtrack path
          const path = [];
          let node = targetId;
          while (node !== undefined) {
            path.unshift(node);
            node = parent.get(node);
          }

          // ✅ Convert to 3D vectors
          const linePoints = path.map((id) => {
            const [lng, lat] = coordMap.get(id);
            const { x, y } = convertToXY([lng, lat]);
            return new THREE.Vector3(x, y, 1);
          });

          // ✅ Draw path line
          const positions = [];
        linePoints.forEach(v => {
          positions.push(v.x, v.y, v.z);
        });

        const meshLine = new MeshLine();
        meshLine.setPoints(positions);

        const meshLineMaterial = new MeshLineMaterial({
          color: new THREE.Color(0x63C8FF ),
          lineWidth: 0.01, // ✅ Thickness — adjust as needed
          resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
        });

        const meshLineObject = new THREE.Mesh(meshLine, meshLineMaterial);
        scene.add(meshLineObject);


          // ✅ Add pin or marker at destination
          const [txLng, txLat] = coordMap.get(targetId);
          const { x: tx, y: ty } = convertToXY([txLng, txLat]);

          const pinTexture = new THREE.TextureLoader().load('/assets/stickers/location_pin.png');
          const pinMaterial = new THREE.SpriteMaterial({ map: pinTexture, transparent: true });
          const pin = new THREE.Sprite(pinMaterial);
          pin.scale.set(32, 32, 1);
          pin.position.set(tx, ty + 15, 2.5);
          scene.add(pin);
        },
        (err) => {
          console.warn('Could not get location:', err.message);
        }
      );
    } else {
      console.warn('Geolocation not supported.');
    }
  });


  
      const animate = () => {
        requestAnimationFrame(animate)
        renderer.render(scene, camera)
      }
  
      animate()
  
      window.addEventListener('resize', () => {
        const w = window.innerWidth
        const h = window.innerHeight
        renderer.setSize(w, h)
        camera.left = w / -2
        camera.right = w / 2
        camera.top = h / 2
        camera.bottom = h / -2
        camera.updateProjectionMatrix()
      })
    })
  })
  </script>

<style scoped>
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.map-wrapper {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}


</style>

  
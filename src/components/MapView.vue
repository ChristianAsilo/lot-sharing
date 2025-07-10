<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { watchUserLocation, clearWatch } from '@/services/locationService'

const canvasRef = ref(null)
let watchId = null
let camera
let scene
let greenDot
const centerLat = 14.233539920666581
const centerLon = 121.15133389733768
const scale = 385000

///Taget Coordinates
const targetCoord = [121.14994, 14.232900]
const gateCoord = [121.149852, 14.234344]
function convertToXY([lon, lat]) {
    const x = (lon - centerLon) * scale
    const y = (lat - centerLat) * scale
    return { x, y }
  }

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)

  scene = new THREE.Scene()
  let mapWidth;
  let mapHeight;
  camera = new THREE.OrthographicCamera(
    window.innerWidth / -2, window.innerWidth / 2,
    window.innerHeight / 2, window.innerHeight / -2,
    0.1, 1000
  )
  camera.position.z = 10



  let routeGroup = new THREE.Group()
  scene.add(routeGroup)

  const { x, y } = convertToXY([121.14994, 14.232900])
  camera.position.set(x, y, 10)
  const loader = new THREE.TextureLoader()
  loader.load('/assets/images/cabuyao_map_2000m.jpg', (texture) => {
     mapWidth = texture.image.width
     mapHeight = texture.image.height

    const geometry = new THREE.PlaneGeometry(mapWidth, mapHeight)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mapPlane = new THREE.Mesh(geometry, material)
    scene.add(mapPlane)

    // Start watching location
    watchId = watchUserLocation((pos) => {
      const { longitude, latitude } = pos.coords
      const livecoords = [longitude, latitude]
      const coords = gateCoord /// change to livecoords for more accuracy
      const { x, y } = convertToXY(coords)
      const coneGeo = new THREE.ConeGeometry(6,18,32)
      const coneMaterial = new THREE.MeshBasicMaterial({
        color:0x4285f4,
        transparent: true,
        opacity: 0.9
      })
      const directionCone = new THREE.Mesh(coneGeo, coneMaterial)

      if (!greenDot) {
        const inner = new THREE.Mesh(
          new THREE.CircleGeometry(8, 32),
          new THREE.MeshBasicMaterial({ color: 0x4285F4 })
        )
        const outer = new THREE.Mesh(
          new THREE.RingGeometry(12, 18, 32),
          new THREE.MeshBasicMaterial({
            color: 0x4285F4,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
          })
        )
        greenDot = new THREE.Group()
        greenDot.add(inner)
        greenDot.add(outer)
        greenDot.position.set(x, y, 1.5)
        directionCone.position.set(0,16,2)
        directionCone.rotation.z = Math.PI
        greenDot.add(directionCone)
        scene.add(greenDot)

      } else {
        greenDot.position.set(x, y, 1.5)
      }

      loadAndDrawPoints(coords)
    })
  })

  function loadAndDrawPoints(startCoord) {
    while (routeGroup.children.length > 0) {
      routeGroup.remove(routeGroup.children[0])
    }

    fetch('/assets/json/points.json')
      .then(res => res.json())
      .then(data => {
        const points = data.points
        const pointMap = new Map()
        const coordMap = new Map()

        points.forEach(p => {
          pointMap.set(p.id, p.points)
          coordMap.set(p.id, p.coordinates)
        })


        function findNearestPointId(coord) {
          let nearestId = null
          let minDist = Infinity
          for (const [id, coords] of coordMap.entries()) {
            if (!coords || coords.length < 2) continue
            const [lon, lat] = coords
            const dx = lon - coord[0]
            const dy = lat - coord[1]
            const dist = dx * dx + dy * dy
            if (dist < minDist) {
              minDist = dist
              nearestId = id
            }
          }
          return nearestId
        }

        const startId = findNearestPointId(startCoord)
        const targetId = findNearestPointId(targetCoord)

        const visited = new Set()
        const parent = new Map()
        const queue = [startId]
        visited.add(startId)

        while (queue.length > 0) {
          const current = queue.shift()
          if (current === targetId) break
          const neighbors = pointMap.get(current) || []
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor)
              parent.set(neighbor, current)
              queue.push(neighbor)
            }
          }
        }

        const path = []
        let node = targetId
        while (node !== undefined) {
          path.unshift(node)
          node = parent.get(node)
        }

        const linePoints = path.map(id => {
          const [lon, lat] = coordMap.get(id)
          const { x, y } = convertToXY([lon, lat])
          return new THREE.Vector3(x, y, 0)
        })

        const positions = []
        linePoints.forEach(p => positions.push(p.x, p.y, p.z))

        const lineGeometry = new LineGeometry()
        lineGeometry.setPositions(positions)

        const lineMaterial = new LineMaterial({
          color: 0x4285F4,
          linewidth: 8,
          worldUnits: false
        })
        lineMaterial.resolution.set(window.innerWidth, window.innerHeight)

        const thickLine = new Line2(lineGeometry, lineMaterial)
        thickLine.computeLineDistances()
        routeGroup.add(thickLine)

        const { x: tx, y: ty } = convertToXY(targetCoord)
        const spriteMap = new THREE.TextureLoader().load('/assets/stickers/location_pin.png')
        const spriteMaterial = new THREE.SpriteMaterial({ map: spriteMap, transparent: true })
        const pinSprite = new THREE.Sprite(spriteMaterial)
        pinSprite.scale.set(32, 32, 1)
        pinSprite.position.set(tx, ty + 15, 3)
        routeGroup.add(pinSprite)
      })
  }

  function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
  }
  animate()

  // Drag and Rotate Events For Web
  let isDragging = false
  let isRotating = false
  let lastMouse = { x: 0, y: 0 }
  let lastAngle = null

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

  canvas.addEventListener('mousedown', (e) => {
    lastMouse.x = e.clientX
    lastMouse.y = e.clientY
    if (e.button === 0) isDragging = true
    else if (e.button === 2) isRotating = true
  })

  window.addEventListener('mouseup', () => {
    isDragging = false
    isRotating = false
  })

  window.addEventListener('mousemove', (e) => {
    const dx = e.clientX - lastMouse.x
    const dy = e.clientY - lastMouse.y
    lastMouse.x = e.clientX
    lastMouse.y = e.clientY
    if (isDragging) {
      camera.position.x -= dx / camera.zoom
      camera.position.y += dy / camera.zoom

      const halfWidth = (window.innerWidth / 2) / camera.zoom
      const halfHeight = (window.innerHeight / 2) / camera.zoom

      const xLimit = mapWidth / 2 - halfWidth
      const yLimit = mapHeight / 2 - halfHeight

      camera.position.x = Math.max(-xLimit, Math.min(xLimit, camera.position.x))
      camera.position.y = Math.max(-yLimit, Math.min(yLimit, camera.position.y))
    }
    if (isRotating) {
      scene.rotation.z += dx * 0.005
    }
  })

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const zoomSpeed = 0.1
      camera.zoom += e.deltaY > 0 ? -zoomSpeed : zoomSpeed
      camera.zoom = Math.max(0.5, Math.min(5, camera.zoom))
      camera.updateProjectionMatrix()
    },
    { passive: false }
  )
    
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  
  
  // Drag and Rotate Events For Mobile
  function startDrag(x,y, button = 0) {
    lastMouse.x = x
    lastMouse.y = y
    if (button === 0) isDragging = true
    else if (button === 2) isRotating = true
  }

  function stopDrag() {
    isDragging = false
    isRotating = false
  }
  function moveDrag(x,y){
    const dx = x - lastMouse.x
    const dy = y - lastMouse.y
    lastMouse.x = x
    lastMouse.y = y

    if (isDragging){
      camera.position.x -= dx / camera.zoom
      camera.position.y += dy / camera.zoom

      const halfWidth = (window.innerWidth / 2 ) / camera.zoom
      const halfHeight = (window.innerHeight / 2) / camera.zoom
      const xLimit = mapWidth / 2 - halfWidth
      const yLimit = mapHeight / 2 - halfHeight

      camera.position.x = Math.max(-xLimit, Math.min(xLimit, camera.position.x))
    camera.position.y = Math.max(-yLimit, Math.min(yLimit, camera.position.y))
  }
  
  if (isRotating) {
    scene.rotation.z += dx * 0.005
  }
  }
  canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    startDrag(touch.clientX, touch.clientY)
  } else if (e.touches.length === 2){
    lastAngle = getAngle(e.touches)
  }
})
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    moveDrag(touch.clientX, touch.clientY)
  } else if (e.touches.length === 2) {
    const newAngle = getAngle(e.touches)
    if(lastAngle !== null){
      const delta = newAngle - lastAngle
      scene.rotation.z += delta 
    }
    lastAngle = newAngle
  }
}, { passive: false})
canvas.addEventListener('touchend', (e) => {
  stopDrag()
  lastAngle = null
})

function getAngle(touches) {
  const [touch1, touch2] = touches
  const dx = touch2.clientX - touch1.clientX
  const dy = touch2.clientY - touch1.clientY
  return Math.atan2(dy, dx)
}


})

function resetCamera() {
  if (!camera || !scene) return

  ///Used the long lat from gate
  const userCoord = convertToXY([121.149856, 14.234339]);
  const targetCoord = convertToXY([121.14994, 14.232900]) // your fixed target location

  if (!userCoord) return

  // Midpoint between current and target position
  const midX = (userCoord.x + targetCoord.x) / 2
  const midY = (userCoord.y + targetCoord.y) / 2

  camera.position.set(midX, midY, 10)
  camera.zoom = 1
  camera.updateProjectionMatrix()
  scene.rotation.z = 0
}



onBeforeUnmount(() => {
  clearWatch(watchId)
})
</script>

<style scoped>
.map-wrapper,
canvas {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  display: block;
  overflow: hidden;
}
.home-btn {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;    
  outline: none;
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;
  width: 60px;
  height: 60px;
  font-size: 24px;
  background: rgba(255, 255, 255, 0.7);
  border: none;
  border-radius: 50%;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.3s ease,
    box-shadow 0.3s ease,
    transform 0.1s ease;
}

.home-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
}

.home-btn:active {
  transform: scale(0.95);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}
.home-btn:focus,
.home-btn:focus-visible {
  outline: none;
  box-shadow: none;
}


</style>
<template>
  <div class="map-wrapper">
    <canvas ref="canvasRef" id="webgl"></canvas>
    <button class="home-btn" @click="resetCamera" title="My Location">
      <span class="material-icons">my_location</span>
    </button>
  </div>
</template>


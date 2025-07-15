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
let locationDot
const centerLat = 14.233539920666581
const centerLon = 121.15133389733768
const scale = 385000

const targetCoord = [121.152172, 14.233072]
const gateCoord = [121.149852, 14.234344]
let liveCoords;
let coordMap; 
let userMovedCamera = false
const defaultCameraState = {
  position: new THREE.Vector3(),
  zoom: 1,
  rotation: 0,
}


function convertToXY([lon, lat]) {
  const x = (lon - centerLon) * scale
  const y = (lat - centerLat) * scale
  return { x, y }
}
  function findNearestPoint(coord, coordMap) {
    let minDist = Infinity
    for (const coords of coordMap.values()) {
      if (!coords || coords.length < 2) continue
      const dx = coords[0] - coord[0]
      const dy = coords[1] - coord[1]
      const dist = dx * dx + dy * dy
      if (dist < minDist) minDist = dist
    }
    return minDist
  }

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  
  scene = new THREE.Scene()
  let mapWidth
  let mapHeight
  let lineMaterial
  let pinSprite
  let lastPinchDistance = null

  camera = new THREE.OrthographicCamera(
    window.innerWidth / -2, window.innerWidth / 2,
    window.innerHeight / 2, window.innerHeight / -2,
    0.1, 1000
  )
  camera.position.z = 10

  let routeGroup = new THREE.Group()
  scene.add(routeGroup)

  // const { x, y } = convertToXY([121.14994, 14.232900])
  // camera.position.set(x, y, 10)
  camera.zoom = 1
  camera.updateProjectionMatrix()
  defaultCameraState.position.copy(camera.position)
  defaultCameraState.zoom = camera.zoom
  defaultCameraState.rotation = scene.rotation.z
  const loader = new THREE.TextureLoader()
  loader.load('/assets/images/cabuyao_map_2000m.jpg', (texture) => {
    mapWidth = texture.image.width
    mapHeight = texture.image.height

    const mapCenter = new THREE.Vector3(0, 0, 0) 
    const geometry = new THREE.PlaneGeometry(mapWidth, mapHeight)
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const mapPlane = new THREE.Mesh(geometry, material)
    scene.add(mapPlane)
    watchId = watchUserLocation((pos) => {
  const { longitude, latitude, heading } = pos.coords
  liveCoords = [longitude, latitude]


  fetch('/assets/json/points.json')
    .then(res => res.json())
    .then(data => {
       coordMap = new Map()
      data.points.forEach(p => {
        coordMap.set(p.id, p.coordinates)
      })

      const threshold = 0.0003 // ~30 meters
      const distToNearest = findNearestPoint(liveCoords, coordMap)

      const coords = distToNearest < threshold ? liveCoords : gateCoord
      const { x, y } = convertToXY(coords)

      // --- everything that uses coords, x, y should be inside here ---
      if (!locationDot) {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(8, 32),
          new THREE.MeshBasicMaterial({ color: 0x4285F4 })
        )

        const beamShape = new THREE.Shape()
        const radius = 30
        const angleSpan = Math.PI 

        beamShape.moveTo(0, 0)
        beamShape.absarc(0, 0, radius, -angleSpan, angleSpan, false)
        beamShape.lineTo(0, 0)

        const beamGeo = new THREE.ShapeGeometry(beamShape)
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0x4285f4,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        })
        const beam = new THREE.Mesh(beamGeo, beamMat)
        beam.name = 'directionBeam'
        beam.rotation.z = Math.PI / 2

        locationDot = new THREE.Group()
        locationDot.add(dot)
        locationDot.add(beam)
        locationDot.position.set(x, y, 1.5)
        scene.add(locationDot)
      } else {
        locationDot.position.set(x, y, 1.5)
      }

      if (!userMovedCamera) {
        camera.position.set(x, y, 10)
      }

      if (typeof heading === 'number' && !isNaN(heading)) {
        scene.rotation.z = -THREE.MathUtils.degToRad(heading)
      }

      loadAndDrawPoints(coords)
    })
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

        lineMaterial = new LineMaterial({
          color: 0x4285F4,
          linewidth: 8,
          worldUnits: false
        })
        lineMaterial.resolution.set(window.innerWidth, window.innerHeight)

        const thickLine = new Line2(lineGeometry, lineMaterial)
        thickLine.computeLineDistances()
        routeGroup.add(thickLine)

        const { x: tx, y: ty } = convertToXY(targetCoord)
        const texture = new THREE.TextureLoader().load('/assets/stickers/location_pin.png')
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true
        })
        const geometry = new THREE.PlaneGeometry(36, 36) 
        geometry.translate(0, 18, 0)
        pinSprite = new THREE.Mesh(geometry, material)
        pinSprite.position.set(tx, ty, 3) 
        routeGroup.add(pinSprite)
      })
  }

  function animate() {
  requestAnimationFrame(animate)

  if (lineMaterial) {
    lineMaterial.resolution.set(window.innerWidth, window.innerHeight)
  }

  renderer.render(scene, camera)

  if (locationDot) {
  locationDot.rotation.z = -scene.rotation.z
  }
  if (pinSprite) {
    pinSprite.rotation.z = -scene.rotation.z 
  }
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
      clampCameraToRadius(new THREE.Vector3(0, 0, 0), 500)
      const halfWidth = (window.innerWidth / 2) / camera.zoom
      const halfHeight = (window.innerHeight / 2) / camera.zoom

      const xLimit = mapWidth / 2 - halfWidth
      const yLimit = mapHeight / 2 - halfHeight

      camera.position.x = Math.max(-xLimit, Math.min(xLimit, camera.position.x))
      camera.position.y = Math.max(-yLimit, Math.min(yLimit, camera.position.y))
    }
      if (isRotating) {
      const angle = dx * 0.005
      const center = new THREE.Vector3(0, 0, 0)

      scene.position.sub(center)
      scene.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
      scene.position.add(center)

      scene.rotation.z += angle
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
      clampCameraToRadius(new THREE.Vector3(0, 0, 0), 500)
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
    userMovedCamera = true
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    startDrag(touch.clientX, touch.clientY)
  } else if (e.touches.length === 2) {
    lastAngle = getAngle(e.touches)

    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    lastPinchDistance = Math.sqrt(dx * dx + dy * dy)
  }
})
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
  userMovedCamera = true
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    moveDrag(touch.clientX, touch.clientY)
  } else if (e.touches.length === 2) {
    const newAngle = getAngle(e.touches)
    if (lastAngle !== null) {
      const delta = newAngle - lastAngle
      scene.rotation.z += delta
    }
    lastAngle = newAngle

    // 🔍 Pinch-to-zoom logic
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (lastPinchDistance !== null) {
      const zoomFactor = distance / lastPinchDistance
      camera.zoom *= zoomFactor
      camera.zoom = Math.max(0.5, Math.min(5, camera.zoom))
      camera.updateProjectionMatrix()
    }
    lastPinchDistance = distance
  }
}, { passive: false })

canvas.addEventListener('touchend', () => {
  stopDrag()
  lastAngle = null
  lastPinchDistance = null
})

window.addEventListener('mouseup', () => {
  isDragging = false
  isRotating = false
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

  // Reset rotation first
  scene.rotation.z = 0

  // Convert gateCoord to world XY
  const { x, y } = convertToXY(gateCoord)

  // Recenter camera directly on the actual point
  camera.position.set(x, y, 10)
  camera.zoom = 1
  camera.updateProjectionMatrix()
  userMovedCamera = false
}

function clampCameraToRadius(center, radius) {
  const dx = camera.position.x - center.x
  const dy = camera.position.y - center.y
  const distSq = dx * dx + dy * dy
  const radiusSq = radius * radius

  if (distSq > radiusSq) {
    const dist = Math.sqrt(distSq)
    const scale = radius / dist
    camera.position.x = center.x + dx * scale
    camera.position.y = center.y + dy * scale
  }
}


onBeforeUnmount(() => {
  clearWatch(watchId)
})
</script>

<style scoped>
@media (max-width: 500px) {
  .home-btn {
    bottom: 2vh;
    right: 2vw;
    font-size: 20px;
  }
}

.map-wrapper {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  z-index: 0;
}
.home-btn {
  position: absolute;
  bottom: 4vh;        
  right: 4vw;      
  width: 12vw;       
  height: 12vw;    
  max-width: 60px;
  max-height: 60px;
  min-width: 40px;
  min-height: 40px;
  font-size: 6vw;     
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
  transition: background 0.3s ease, box-shadow 0.3s ease, transform 0.1s ease;
  z-index: 10;
}


.home-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
}

.home-btn:active {
  transform: scale(0.95);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}
canvas {
  touch-action: none;
  pointer-events: auto;
  display: block;
  width: 100%;
  height: 100%;
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


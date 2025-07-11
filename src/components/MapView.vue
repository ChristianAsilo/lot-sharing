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
let rotationCenter = null
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
  let mapWidth
  let mapHeight
  let lineMaterial
  let pinSprite

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

    watchId = watchUserLocation((pos) => {
  const { longitude, latitude, heading } = pos.coords
  const liveCoords = [longitude, latitude]

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

  fetch('/assets/json/points.json')
    .then(res => res.json())
    .then(data => {
      const coordMap = new Map()
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
        const radius = 50
        const angleSpan = Math.PI / 2

        beamShape.moveTo(0, 0)
        beamShape.absarc(0, 0, radius, -angleSpan / 2, angleSpan / 2, false)
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

      camera.position.set(x, y, 10)

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
        const spriteMap = new THREE.TextureLoader().load('/assets/stickers/location_pin.png')
        const spriteMaterial = new THREE.SpriteMaterial({ map: spriteMap, transparent: true })
        pinSprite = new THREE.Sprite(spriteMaterial)
        pinSprite.scale.set(32, 32, 1)
        pinSprite.position.set(tx, ty + 15, 3)
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
  const beam = locationDot.getObjectByName('directionBeam')
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
    rotationCenter = screenToWorld(e.clientX, e.clientY)
  
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
    if (isRotating && rotationCenter) {
      const angle = dx * 0.005

      scene.position.sub(rotationCenter)
      scene.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
      scene.position.add(rotationCenter)

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
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
    rotationCenter = screenToWorld(midX, midY)
  }
})
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    moveDrag(touch.clientX, touch.clientY)
  } else if (e.touches.length === 2 && rotationCenter) {
    const newAngle = getAngle(e.touches)
    if(lastAngle !== null){

    const delta = newAngle - lastAngle
    scene.position.sub(rotationCenter)
    scene.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), delta)
    scene.position.add(rotationCenter)

    scene.rotation.z += delta
    }
    lastAngle = newAngle
  }
}, { passive: false})
canvas.addEventListener('touchend', (e) => {
  stopDrag()
  lastAngle = null
  rotationCenter = null
})

window.addEventListener('mouseup', () => {
  isDragging = false
  isRotating = false
  rotationCenter = null
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

  // Convert both coordinates to XY first
  const gate = convertToXY(gateCoord)
  const target = convertToXY(targetCoord)

  // Calculate midpoint between gate and target
  const midX = (gate.x + target.x) / 2
  const midY = (gate.y + target.y) / 2

  camera.position.set(midX, midY, 10)
  camera.zoom = 1
  camera.updateProjectionMatrix()

  scene.rotation.z = 0
}


function screenToWorld(x,y){
  const ndcX = (x / window.innerWidth) * 2 - 1
  const ndcY = -(y / window.innerHeight) * 2 + 1
  const vector =new THREE.Vector3(ndcX, ndcY, 0)
  vector.unproject(camera)
  return vector
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


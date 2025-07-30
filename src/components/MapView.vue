<script setup>
import { ref, onMounted, onBeforeUnmount  } from 'vue'
import { resetCamera, initiateMap } from '@/services/scene'
import { fetchMapData } from '@/services/mapService'

const showError = ref(false)
const errorMsg = ref('')
const canvasRef = ref(null)
const mapInitialized = ref(true)
const loading = ref(true)
const lotId = window.location.pathname.split('/').pop()
let data = []

function handleResetCamera() {
  resetCamera()
}

function triggerSnackbar(message) {
  errorMsg.value = message
  showError.value = true
  setTimeout(() => {
    showError.value = false
  }, 3000)
}

let permissionStatus = null

function handlePermissionState(state) {
  if (state === 'granted') {
    mapInitialized.value = true
    initiateMap(canvasRef.value, data, () => {}, triggerSnackbar)
  } else if (state === 'prompt') {
    navigator.geolocation.getCurrentPosition(
      () => {
        mapInitialized.value = true
        initiateMap(canvasRef.value, data, () => {}, triggerSnackbar)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          console.log('User denied location permission.')
          mapInitialized.value = false
        }
      }
    )
  } else if (state === 'denied') {
    console.log('Permission denied')
    mapInitialized.value = false
  }
}

async function checkPermissionAndInit() {
  if (!navigator.permissions) {
    console.warn('Permissions API not supported.')
    return
  }

  try {
    permissionStatus = await navigator.permissions.query({ name: 'geolocation' })
    handlePermissionState(permissionStatus.state)

    permissionStatus.onchange = () => {
      console.log('Permission changed to:', permissionStatus.state)
      handlePermissionState(permissionStatus.state)
    }
  } catch (err) {
    console.error('Failed to query permissions:', err)
  }
}

onMounted(async () => {
  data = await fetchMapData(lotId)
    requestAnimationFrame(() => {
    checkPermissionAndInit()
    loading.value = false
  })
})

onBeforeUnmount(() => {
  if (permissionStatus) {
    permissionStatus.onchange = null
  }
})
</script>

<style scoped>
@media (max-width: 500px) {
  .home-btn {
    bottom: 80px;
    right: 2vw;
    font-size: 24px;
    width: 48px;
    height: 48px;
  }
}
.snackbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #e53935;
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
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
  bottom: 30mm;
  right: 2vw;
  width: 14vw;
  height: 14vw;
  max-width: 64px;
  max-height: 64px;
  min-width: 44px;
  min-height: 44px;
  font-size: 6vw;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  color: #4285F4;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease, box-shadow 0.3s ease, transform 0.1s ease;
  z-index: 9999;
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
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.dialog-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.dialog-content h3, p {
  color: black;
  margin-bottom: 12px;
}

.dialog-actions {
  margin-top: 20px;
}

.dialog-actions button {
  background: #4285f4;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.loading-screen {
  position: fixed;
  inset: 0;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 6px solid #ccc;
  border-top-color: #4285f4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

</style>
<template>
  <!-- LOADING SCREEN -->
  <div v-if="loading" class="loading-screen">
    <div class="spinner"></div>
    <p>Loading map...</p>
  </div>

  <!-- MAP + CONTROLS -->
  <div v-else class="map-wrapper">
    <canvas ref="canvasRef" id="webgl"></canvas>
    <button class="home-btn" @click="handleResetCamera" title="My Location">
      <span class="material-icons">my_location</span>
    </button>

    <!-- Permission Dialog -->
    <div v-if="!mapInitialized" class="dialog-overlay">
      <div class="dialog-content">
        <h3>Location Permission Needed</h3>
        <p>This app uses your location to show where you are and help guide your route. Please enable location access in your browser settings.</p>
      </div>
    </div>

    <!-- Snackbar Error -->
    <div v-if="showError" class="snackbar">
      {{ errorMsg }}
    </div>
  </div>
</template>




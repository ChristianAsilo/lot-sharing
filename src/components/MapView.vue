<script setup>
import { ref, onMounted } from 'vue'
import { resetCamera } from '@/services/scene' 
import { initiateMap } from '@/services/scene'

const canvasRef = ref(null)
const mapInitialized = ref(false)

onMounted(async () => {
    initiateMap(canvasRef.value, mapInitialized,() => {
    });    
});

</script>

<style scoped>
@media (max-width: 500px) {wa
  .home-btn {
    bottom: 80px;
    right: 2vw;
    font-size: 24px;
    width: 48px;
    height: 48px;
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
</style>
<template>
  <div class="map-wrapper">
    <canvas ref="canvasRef" id="webgl"></canvas>
    <button class="home-btn" @click="resetCamera" title="My Location">
      <span class="material-icons">my_location</span>
    </button>
  </div>

  <div v-if="!mapInitialized" class="dialog-overlay">
    <div class="dialog-content">
      <h3>Location Permission Needed</h3>
      <p>This app uses your location to show where you are and help guide your route. Please enable location access in your browser settings.</p>
      <div class="dialog-actions">
        <button @click="retryRequest">Try Again</button>
      </div>
    </div>
  </div>
</template>



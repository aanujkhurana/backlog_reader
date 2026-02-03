<template>
  <div class="setup-container">
    <!-- Header -->
    <div class="setup-header">
      <h1 class="setup-title">{{ documentTitle }}</h1>
      <p class="setup-subtitle">
        {{ totalWords }} words • Estimated {{ estimatedTime }} reading time
      </p>
    </div>

    <!-- Speed Selection -->
    <div class="setup-section">
      <h2 class="section-title">Reading Speed</h2>
      <div class="speed-options">
        <button
          v-for="speed in speedOptions"
          :key="speed.value"
          @click="selectedSpeed = speed.value"
          :class="['speed-button', { active: selectedSpeed === speed.value }]"
        >
          <div class="speed-label">{{ speed.label }}</div>
          <div class="speed-description">{{ speed.description }}</div>
        </button>
      </div>
    </div>

    <!-- Feature Toggles -->
    <div class="setup-section">
      <h2 class="section-title">Reading Features</h2>
      
      <div class="toggle-option">
        <label class="toggle-label">
          <input
            type="checkbox"
            v-model="autoPacingEnabled"
            class="toggle-input"
          >
          <span class="toggle-slider"></span>
          <div class="toggle-content">
            <div class="toggle-title">Auto Pacing</div>
            <div class="toggle-description">
              Automatically adjusts speed for punctuation and long words
            </div>
          </div>
        </label>
      </div>

      <div class="toggle-option">
        <label class="toggle-label">
          <input
            type="checkbox"
            v-model="summariesEnabled"
            class="toggle-input"
          >
          <span class="toggle-slider"></span>
          <div class="toggle-content">
            <div class="toggle-title">Section Summaries</div>
            <div class="toggle-description">
              Brief confirmations of what you've read after each section
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="setup-actions">
      <button @click="startReading" class="start-button">
        Start Reading
      </button>
      <button @click="previewDocument" class="preview-button">
        Preview Document
      </button>
      <button @click="skipSetup" class="skip-button">
        Skip Setup
      </button>
    </div>

    <!-- Quick Setup Indicator -->
    <div class="setup-timer">
      <div class="timer-text">Setup completes in under 5 seconds</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { progressManager } from '../services'
import type { DocumentSummary, SetupConfig, SpeedOption } from '../types'

const router = useRouter()
const route = useRoute()

// Props from route params
const documentId = route.params.documentId as string

// Reactive state
const selectedSpeed = ref(250) // Default to Normal (250 WPM)
const autoPacingEnabled = ref(true) // Default enabled
const summariesEnabled = ref(false) // Default disabled
const documentTitle = ref('Document')
const totalWords = ref(0)

// Speed options
const speedOptions: SpeedOption[] = [
  {
    label: 'Slow',
    value: 180,
    description: '180 words per minute'
  },
  {
    label: 'Normal',
    value: 250,
    description: '250 words per minute'
  },
  {
    label: 'Fast',
    value: 350,
    description: '350 words per minute'
  }
]

// Computed properties
const estimatedTime = computed(() => {
  if (totalWords.value === 0) return '0 min'
  
  const minutes = Math.ceil(totalWords.value / selectedSpeed.value)
  if (minutes < 1) return '< 1 min'
  if (minutes === 1) return '1 min'
  return `${minutes} min`
})

// Load document data
onMounted(() => {
  loadDocumentData()
  loadUserPreferences()
})

function loadDocumentData() {
  // Load document data from progress manager
  const document = progressManager.getDocumentById(documentId)
  const documentStructure = progressManager.getDocumentStructure(documentId)
  
  if (document && documentStructure) {
    documentTitle.value = document.title
    totalWords.value = document.totalWords
  } else if (document) {
    // Fallback to document summary if structure not available
    documentTitle.value = document.title
    totalWords.value = document.totalWords
  } else {
    // Fallback if document not found
    documentTitle.value = 'Document'
    totalWords.value = 0
    console.warn('Document not found:', documentId)
  }
}

function loadUserPreferences() {
  // Load user's previous settings
  const settings = progressManager.getSettings()
  selectedSpeed.value = settings.baseSpeed
  summariesEnabled.value = settings.summariesEnabled
  // Auto pacing remains enabled by default
}

function startReading() {
  // Create reading configuration
  const config: SetupConfig = {
    baseSpeed: selectedSpeed.value,
    autoPacingEnabled: autoPacingEnabled.value,
    summariesEnabled: summariesEnabled.value
  }
  
  // Save user preferences
  progressManager.updateSettings({
    baseSpeed: config.baseSpeed,
    summariesEnabled: config.summariesEnabled
  })
  
  // Navigate to reading interface with configuration
  router.push({
    name: 'reading',
    params: { documentId },
    query: {
      baseSpeed: config.baseSpeed.toString(),
      autoPacingEnabled: config.autoPacingEnabled.toString(),
      summariesEnabled: config.summariesEnabled.toString(),
      ...(route.query.customStart === 'true' && route.query.startPosition ? {
        customStart: 'true',
        startPosition: route.query.startPosition
      } : {})
    }
  })
}

function skipSetup() {
  // Use default settings and start reading immediately
  const defaultConfig: SetupConfig = {
    baseSpeed: 250,
    autoPacingEnabled: true,
    summariesEnabled: false
  }
  
  // Save default preferences
  progressManager.updateSettings({
    baseSpeed: defaultConfig.baseSpeed,
    summariesEnabled: defaultConfig.summariesEnabled
  })
  
  // Navigate to reading interface with defaults
  router.push({
    name: 'reading',
    params: { documentId },
    query: {
      baseSpeed: defaultConfig.baseSpeed.toString(),
      autoPacingEnabled: defaultConfig.autoPacingEnabled.toString(),
      summariesEnabled: defaultConfig.summariesEnabled.toString(),
      ...(route.query.customStart === 'true' && route.query.startPosition ? {
        customStart: 'true',
        startPosition: route.query.startPosition
      } : {})
    }
  })
}

function previewDocument() {
  // Navigate to preview screen
  router.push({
    name: 'preview',
    params: { documentId }
  })
}
</script>

<style scoped>
.setup-container {
  min-height: 100vh;
  background: #000;
  color: #fff;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
  margin: 0 auto;
}

/* Header */
.setup-header {
  text-align: center;
  margin-bottom: 3rem;
  width: 100%;
}

.setup-title {
  font-size: 1.8rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
  color: #fff;
}

.setup-subtitle {
  font-size: 1rem;
  color: #aaa;
  margin: 0;
  font-weight: 300;
}

/* Sections */
.setup-section {
  width: 100%;
  margin-bottom: 2.5rem;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 500;
  margin: 0 0 1rem 0;
  color: #ccc;
}

/* Speed Options */
.speed-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.speed-button {
  background: #111;
  border: 2px solid #333;
  color: #fff;
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.speed-button:hover {
  border-color: #555;
  background: #1a1a1a;
}

.speed-button.active {
  border-color: #fff;
  background: #222;
}

.speed-label {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.speed-description {
  font-size: 0.85rem;
  color: #aaa;
}

/* Toggle Options */
.toggle-option {
  margin-bottom: 1.5rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  padding: 1rem;
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.toggle-label:hover {
  background: #1a1a1a;
  border-color: #444;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: #333;
  border-radius: 12px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #666;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.toggle-input:checked + .toggle-slider {
  background: #fff;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: #000;
}

.toggle-content {
  flex: 1;
}

.toggle-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.toggle-description {
  font-size: 0.85rem;
  color: #aaa;
  line-height: 1.3;
}

/* Action Buttons */
.setup-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.start-button {
  background: #fff;
  border: none;
  color: #000;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.start-button:hover {
  background: #f0f0f0;
}

.preview-button {
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.skip-button {
  background: transparent;
  border: 1px solid #555;
  color: #ccc;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.skip-button:hover {
  border-color: #777;
  color: #fff;
}

/* Timer Indicator */
.setup-timer {
  text-align: center;
  margin-top: auto;
}

.timer-text {
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}

/* Responsive */
@media (max-width: 768px) {
  .setup-container {
    padding: 1rem;
  }
  
  .speed-options {
    grid-template-columns: 1fr;
  }
  
  .setup-actions {
    position: sticky;
    bottom: 1rem;
    background: #000;
    padding: 1rem 0;
  }
}
</style>
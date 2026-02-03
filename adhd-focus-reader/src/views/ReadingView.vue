<template>
  <div 
    class="reading-interface"
    :class="{ 'is-reading': isReading, 'is-paused': isPaused }"
    tabindex="0"
    ref="readingContainer"
    role="application"
    aria-label="RSVP Reading Interface"
    :aria-describedby="isPaused ? 'pause-instructions' : 'reading-instructions'"
  >
    <!-- Hidden instructions for screen readers -->
    <div id="reading-instructions" class="sr-only">
      Reading interface. Press spacebar to pause, arrow keys to navigate, F1 for help.
    </div>
    <div id="pause-instructions" class="sr-only">
      Reading is paused. Press spacebar to resume, use controls below, or press F1 for help.
    </div>

    <!-- Main word display area - Requirement 2.1: Centered word display -->
    <div class="word-display-container">
      <div 
        class="word-display"
        v-if="displayState.isVisible"
        role="main"
        aria-live="off"
        aria-label="Current reading word"
        :style="{
          backgroundColor: accessibilityColors.background,
          color: accessibilityColors.text
        }"
      >
        <span class="word-text">
          <!-- Display word with ORP highlighting - Requirements 2.2, 2.3 -->
          <span 
            v-for="(char, index) in currentWordChars" 
            :key="index"
            :class="{ 'orp-highlight': index === displayState.orp }"
            :style="{ color: index === displayState.orp ? accessibilityColors.orp : accessibilityColors.text }"
          >
            {{ char }}
          </span>
        </span>
      </div>
    </div>

    <!-- Subtle progress bar at bottom - Requirement: Add subtle progress bar -->
    <div class="progress-container" v-if="!isPaused">
      <div 
        class="progress-bar"
        :style="{ 
          width: progressPercentage + '%',
          backgroundColor: accessibilityColors.progress
        }"
        role="progressbar"
        :aria-valuenow="Math.round(progressPercentage)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Reading progress: ${Math.round(progressPercentage)}% complete`"
      ></div>
    </div>

    <!-- Pause overlay (only visible when paused) - Requirements 4.1, 4.4 -->
    <div 
      class="pause-overlay"
      v-if="isPaused"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div class="pause-content">
        <h2 id="pause-title">Reading Paused</h2>
        <p>Press spacebar to continue or use the controls below</p>
        
        <!-- Speed adjustment slider - Requirement 4.4 -->
        <div class="speed-control">
          <label for="speed-slider" class="speed-label">Reading Speed</label>
          <div class="speed-slider-container">
            <span class="speed-indicator">Slow</span>
            <input
              id="speed-slider"
              type="range"
              min="100"
              max="600"
              step="25"
              :value="currentSpeed"
              @input="adjustSpeed"
              class="speed-slider"
              aria-label="Adjust reading speed"
            />
            <span class="speed-indicator">Fast</span>
          </div>
          <div class="speed-value">{{ currentSpeed }} WPM</div>
        </div>

        <div class="pause-controls">
          <button 
            @click="resumeReading" 
            class="resume-btn primary-btn" 
            ref="resumeButton"
            aria-describedby="resume-help"
          >
            Resume Reading
          </button>
          <div id="resume-help" class="sr-only">
            Resume reading from current position. You can also press spacebar.
          </div>
          
          <button 
            @click="restartSection" 
            class="restart-btn secondary-btn"
            aria-describedby="restart-help"
          >
            Restart Section
          </button>
          <div id="restart-help" class="sr-only">
            Go back to the beginning of the current section and resume reading.
          </div>
          
          <button 
            @click="exitReading" 
            class="exit-btn secondary-btn"
            aria-describedby="exit-help"
          >
            Exit Reading
          </button>
          <div id="exit-help" class="sr-only">
            Stop reading and return to the home screen. Progress will be saved.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createReadingSession } from '../services/readingSession'
import { documentProcessor } from '../services/documentProcessor'
import { progressManager } from '../services/progressManager'
import { accessibilityService } from '../services/accessibilityService'
import type { DisplayState, WordDisplay } from '../types/rsvp'
import type { ProcessedDocument } from '../types/document'

// Router setup
const route = useRoute()
const router = useRouter()

// Template refs
const readingContainer = ref<HTMLElement>()
const resumeButton = ref<HTMLElement>()

// Reactive state
const displayState = ref<DisplayState>({
  currentWord: '',
  orp: 0,
  wordIndex: 0,
  totalWords: 0,
  isVisible: false,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  orpColor: '#ff0000'
})

const isReading = ref(false)
const isPaused = ref(false)
const currentSpeed = ref(250) // Current reading speed in WPM
const readingSession = ref(createReadingSession())
const accessibilityColors = ref(accessibilityService.getAccessibleColorScheme())

// Computed properties
const currentWordChars = computed(() => {
  return displayState.value.currentWord.split('')
})

const progressPercentage = computed(() => {
  if (displayState.value.totalWords === 0) return 0
  return (displayState.value.wordIndex / displayState.value.totalWords) * 100
})

// Methods
const handleClick = () => {
  // Prevent accidental clicks during reading - Requirement 4.5
  if (isReading.value) {
    return
  }
}

const resumeReading = () => {
  if (readingSession.value.isPaused()) {
    readingSession.value.getRSVPEngine().resumeReading()
    accessibilityService.announceStateChange('resumed', {
      currentPosition: displayState.value.wordIndex,
      totalWords: displayState.value.totalWords
    })
  }
}

const adjustSpeed = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newSpeed = parseInt(target.value)
  
  // Update the RSVP engine speed directly
  const rsvpEngine = readingSession.value.getRSVPEngine()
  rsvpEngine.setSpeed(newSpeed)
  
  // Update our local speed tracking
  currentSpeed.value = newSpeed
  
  // Announce speed change for accessibility
  accessibilityService.announceStateChange('speed_changed', { speed: newSpeed })
}

const restartSection = () => {
  const rsvpEngine = readingSession.value.getRSVPEngine()
  const currentPosition = rsvpEngine.getCurrentPosition()
  
  // Get the document structure to find the current section
  // For now, we'll implement a simple section restart by going back to the nearest paragraph start
  // In a real implementation, this would use the document sections from the processed document
  
  // Simple heuristic: go back to the start of the current "section" (every 100 words or document start)
  const sectionSize = 100 // words per section
  const currentSection = Math.floor(currentPosition / sectionSize)
  const sectionStart = Math.max(0, currentSection * sectionSize)
  
  rsvpEngine.jumpToPosition(sectionStart)
  
  // Resume reading from the section start
  if (readingSession.value.isPaused()) {
    rsvpEngine.resumeReading()
  }
}

const exitReading = () => {
  readingSession.value.stopSession()
  router.push('/')
}

const setupReadingCallbacks = () => {
  const rsvpEngine = readingSession.value.getRSVPEngine()
  
  rsvpEngine.setCallbacks({
    onWordDisplay: (wordDisplay: WordDisplay) => {
      displayState.value.currentWord = wordDisplay.word
      displayState.value.orp = wordDisplay.orp
    },
    onPositionChange: (position: number, totalWords: number) => {
      displayState.value.wordIndex = position
      displayState.value.totalWords = totalWords
      
      // Announce progress milestones for accessibility
      accessibilityService.announceProgress(position, totalWords)
    },
    onSessionEnd: () => {
      // Announce completion
      accessibilityService.announceStateChange('completed')
      
      // Mark as completed and navigate to completion screen
      readingSession.value.markCompleted()
      router.push({ 
        name: 'completion', 
        params: { documentId: route.params.documentId } 
      })
    },
    onSectionComplete: (sectionIndex: number, position: number) => {
      // Check if summaries are enabled
      const summariesEnabled = route.query.summariesEnabled === 'true'
      
      if (summariesEnabled) {
        // Pause reading and navigate to summary screen
        readingSession.value.getRSVPEngine().pauseReading()
        
        router.push({
          name: 'summary',
          params: { documentId: route.params.documentId as string },
          query: {
            sectionIndex: sectionIndex.toString(),
            position: position.toString(),
            totalWords: displayState.value.totalWords.toString()
          }
        })
      }
      // If summaries disabled, continue reading without interruption
    }
  })
}

const startReading = async () => {
  try {
    const documentId = route.params.documentId as string
    if (!documentId) {
      throw new Error('No document ID provided')
    }

    // Get configuration from query parameters (from setup screen)
    const baseSpeed = parseInt(route.query.baseSpeed as string) || 250
    const autoPacingEnabled = route.query.autoPacingEnabled === 'true'
    const summariesEnabled = route.query.summariesEnabled === 'true'
    const resumeFromSummary = route.query.resumeFromSummary === 'true'
    const resumePosition = parseInt(route.query.position as string) || 0
    const customStart = route.query.customStart === 'true'
    const customStartPosition = parseInt(route.query.startPosition as string) || 0

    // Update current speed from setup configuration
    currentSpeed.value = baseSpeed

    // Get the actual document structure from storage
    const documentStructure = progressManager.getDocumentStructure(documentId)
    if (!documentStructure) {
      throw new Error('Document not found. Please upload or paste text again.')
    }

    // Create ProcessedDocument from stored structure
    const processedDocument: ProcessedDocument = {
      content: documentStructure.words.map(word => word.text).join(' '),
      sections: documentStructure.sections,
      metadata: {
        title: documentStructure.title,
        fileType: 'text', // We'll assume text for now since we have the processed content
        originalSize: documentStructure.words.length,
        processedAt: documentStructure.createdAt
      }
    }

    // Determine starting position
    let startPosition = 0
    if (customStart && customStartPosition >= 0) {
      // Use custom starting position from preview selection
      startPosition = customStartPosition
      // Save this as the new position for this document
      progressManager.savePosition(documentId, startPosition)
    } else if (resumeFromSummary) {
      // Resume from summary screen
      startPosition = resumePosition
    } else {
      // Get last reading position if available
      startPosition = progressManager.getLastPosition(documentId) || 0
    }

    // Setup callbacks before starting
    setupReadingCallbacks()

    // Create reading session with configuration from setup
    const sessionConfig = {
      rsvp: {
        baseSpeed: baseSpeed,
        longWordThreshold: 8,
        longWordMultiplier: 1.5,
        commaPause: autoPacingEnabled ? 150 : 0,
        periodPause: autoPacingEnabled ? 300 : 0,
        bulletPause: autoPacingEnabled ? 200 : 0,
        paragraphPause: autoPacingEnabled ? 400 : 0
      }
    }

    // Create new reading session with configuration
    readingSession.value = createReadingSession(sessionConfig)
    
    // Re-setup callbacks for the new session
    setupReadingCallbacks()

    // Start the reading session (this will bind keyboard controls automatically)
    readingSession.value.startSession(processedDocument, startPosition)
    
    // Update display state
    displayState.value.isVisible = true
    isReading.value = true
    
    // Focus the reading container for keyboard events - Requirement 4.5
    await nextTick()
    readingContainer.value?.focus()
    
    // Start auto reading
    readingSession.value.getRSVPEngine().startAutoReading()
    
    // Announce reading start for accessibility
    accessibilityService.announceStateChange('started', {
      totalWords: displayState.value.totalWords
    })
    
    // Setup keyboard navigation with accessibility service
    // Note: We don't use accessibilityService.setupKeyboardNavigation here
    // because the KeyboardController already handles all keyboard events
    // We just need to ensure accessibility announcements work
    
    // The keyboard controller is already bound by the reading session
    // and will handle all keyboard events properly
    
  } catch (error) {
    console.error('Error starting reading session:', error)
    // Show user-friendly error and redirect to home
    alert(error instanceof Error ? error.message : 'Failed to start reading session')
    router.push('/')
  }
}

// Watch for reading state changes
watch(() => readingSession.value.getRSVPEngine().isPaused(), async (paused) => {
  isPaused.value = paused
  isReading.value = !paused && readingSession.value.isActive()
  
  // Announce state change for accessibility
  if (paused) {
    accessibilityService.announceStateChange('paused', {
      currentPosition: displayState.value.wordIndex,
      totalWords: displayState.value.totalWords
    })
  }
  
  // Focus management for accessibility
  if (paused) {
    // When paused, focus the resume button for keyboard navigation
    await nextTick()
    resumeButton.value?.focus()
  } else if (isReading.value) {
    // When resuming, focus back to the reading container
    await nextTick()
    readingContainer.value?.focus()
  }
}, { immediate: true })

// Lifecycle hooks
onMounted(() => {
  startReading()
  
  // Set up state synchronization polling to ensure UI stays in sync
  const stateSync = setInterval(() => {
    if (readingSession.value && readingSession.value.isActive()) {
      const enginePaused = readingSession.value.getRSVPEngine().isPaused()
      const engineReading = readingSession.value.getRSVPEngine().isReading()
      
      // Update local state if it's out of sync
      if (isPaused.value !== enginePaused) {
        isPaused.value = enginePaused
      }
      if (isReading.value !== engineReading) {
        isReading.value = engineReading
      }
    }
  }, 100) // Check every 100ms
  
  // Listen for keyboard-triggered events
  const handleExitRequest = () => {
    exitReading()
  }
  
  const handleHelpRequest = () => {
    // accessibilityService.announceKeyboardShortcuts()
    console.log('Help requested - keyboard shortcuts available')
  }
  
  window.addEventListener('reading-exit-requested', handleExitRequest)
  window.addEventListener('reading-help-requested', handleHelpRequest)
  
  // Clean up polling and event listeners on unmount
  onUnmounted(() => {
    clearInterval(stateSync)
    window.removeEventListener('reading-exit-requested', handleExitRequest)
    window.removeEventListener('reading-help-requested', handleHelpRequest)
  })
})

onUnmounted(() => {
  if (readingSession.value.isActive()) {
    readingSession.value.stopSession()
  }
  
  // Clean up accessibility service - but don't call removeKeyboardNavigation 
  // since we're not using it for keyboard handling
  // accessibilityService.removeKeyboardNavigation()
})
</script>

<style scoped>
/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Full-screen black background reading interface - Requirement 2.1 */
.reading-interface {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000000; /* Requirement 2.1: black background */
  color: #ffffff; /* Requirement 2.1: white text */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  cursor: none; /* Hide cursor during reading - Requirement 4.5 */
  user-select: none; /* Prevent text selection */
  outline: none; /* Remove focus outline since it's invisible during reading */
  z-index: 9999; /* Ensure full-screen coverage */
}

.reading-interface.is-reading {
  cursor: none; /* Requirement 4.5: No interface elements during reading */
}

.reading-interface.is-paused {
  cursor: default;
}

/* Centered word display - Requirements 2.1, 2.4 */
.word-display-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 100vw;
}

.word-display {
  text-align: center;
  font-size: 3.5rem; /* Large, readable font - Requirement 2.4 */
  font-weight: 400;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.2;
  letter-spacing: 0.02em;
  min-height: 4.5rem; /* Prevent layout shift */
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 2rem; /* Prevent text from touching edges */
}

.word-text {
  display: inline-block;
  position: relative;
  white-space: nowrap; /* Prevent word wrapping */
}

/* ORP highlighting in red - Requirement 2.2 */
.orp-highlight {
  color: #ff0000; /* Requirement 2.2: red ORP highlighting */
  font-weight: 600;
  text-shadow: 0 0 1px #ff0000; /* Subtle glow for better visibility */
}

/* Subtle progress bar at bottom */
.progress-container {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px; /* Subtle height */
  background-color: rgba(255, 255, 255, 0.08); /* Very subtle background */
  z-index: 10000;
}

.progress-bar {
  height: 100%;
  background-color: rgba(255, 255, 255, 0.25); /* Subtle but visible */
  transition: width 0.1s ease-out;
  border-radius: 0 2px 2px 0; /* Slight rounding on the right */
}

/* Pause overlay - Requirements 4.1, 4.4: Dimmed background with frozen word display */
.pause-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.85); /* Dimmed but allows frozen word to show through */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10001;
  backdrop-filter: blur(1px); /* Subtle blur effect */
}

.pause-content {
  text-align: center;
  padding: 2.5rem;
  max-width: 500px;
  background-color: rgba(0, 0, 0, 0.9);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.pause-content h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  font-weight: 300;
  color: #ffffff;
}

.pause-content p {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  opacity: 0.8;
  color: #ffffff;
}

/* Speed control section - Requirement 4.4: Speed adjustment slider */
.speed-control {
  margin-bottom: 2.5rem;
  padding: 1.5rem;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.speed-label {
  display: block;
  font-size: 1.1rem;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 1rem;
}

.speed-slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.speed-indicator {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  min-width: 40px;
  text-align: center;
}

.speed-slider {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.speed-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.speed-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.speed-value {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
}

.pause-controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.primary-btn,
.secondary-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: 2px solid #ffffff;
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  min-width: 140px;
  font-weight: 500;
}

.primary-btn {
  background-color: #ffffff;
  color: #000000;
}

.primary-btn:hover,
.primary-btn:focus {
  background-color: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.secondary-btn:hover,
.secondary-btn:focus {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.primary-btn:focus-visible,
.secondary-btn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

/* Ensure high contrast ratios for accessibility - Requirement 2.5 */
@media (prefers-contrast: high) {
  .word-display {
    font-weight: 600;
    text-shadow: 0 0 2px #ffffff;
  }
  
  .orp-highlight {
    text-shadow: 0 0 2px #ff0000;
  }
  
  .progress-bar {
    background-color: rgba(255, 255, 255, 0.6);
  }
}

/* Responsive font sizing - Requirement 2.4 */
@media (max-width: 1200px) {
  .word-display {
    font-size: 3rem;
    min-height: 4rem;
  }
}

@media (max-width: 768px) {
  .word-display {
    font-size: 2.5rem;
    min-height: 3.5rem;
    padding: 0 1rem;
  }
  
  .pause-content {
    padding: 2rem 1.5rem;
    max-width: 90vw;
  }
  
  .pause-content h2 {
    font-size: 1.5rem;
  }
  
  .speed-control {
    padding: 1rem;
    margin-bottom: 2rem;
  }
  
  .speed-slider-container {
    gap: 0.5rem;
  }
  
  .speed-indicator {
    font-size: 0.8rem;
    min-width: 35px;
  }
  
  .pause-controls {
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  
  .primary-btn,
  .secondary-btn {
    width: 100%;
    max-width: 200px;
  }
}

@media (max-width: 480px) {
  .word-display {
    font-size: 2rem;
    min-height: 3rem;
  }
  
  .pause-content {
    padding: 1.5rem 1rem;
  }
  
  .pause-content h2 {
    font-size: 1.3rem;
  }
  
  .pause-content p {
    font-size: 1rem;
  }
  
  .speed-control {
    padding: 0.75rem;
  }
  
  .speed-label {
    font-size: 1rem;
  }
  
  .progress-container {
    height: 4px; /* Slightly thicker on mobile for better visibility */
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .progress-bar {
    transition: none;
  }
  
  .resume-btn,
  .exit-btn {
    transition: none;
  }
  
  .resume-btn:hover,
  .resume-btn:focus,
  .exit-btn:hover,
  .exit-btn:focus {
    transform: none;
  }
}

/* Print styles (hide everything for print) */
@media print {
  .reading-interface {
    display: none;
  }
}
</style>
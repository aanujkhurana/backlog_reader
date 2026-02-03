<template>
  <div class="summary-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="summary-loading">
      <div class="loading-spinner"></div>
      <p class="loading-text">Generating quick recap...</p>
    </div>

    <!-- Summary display -->
    <div v-else-if="summary" class="summary-content">
      <!-- Header -->
      <div class="summary-header">
        <h1 class="summary-title">Quick Recap</h1>
        <p class="summary-subtitle">{{ summary.sectionTitle }}</p>
      </div>

      <!-- Summary text -->
      <div class="summary-text-container">
        <div class="summary-icon">✓</div>
        <p class="summary-text">{{ summary.summary }}</p>
      </div>

      <!-- Continue button -->
      <div class="summary-actions">
        <button 
          @click="continueReading" 
          class="continue-button"
          ref="continueButton"
          :disabled="isLoading"
        >
          Continue Reading
        </button>
        
        <button 
          @click="pauseForReflection" 
          class="pause-button"
          :disabled="isLoading"
        >
          Pause to Reflect
        </button>
      </div>

      <!-- Progress indicator -->
      <div class="progress-info">
        <div class="progress-text">
          {{ Math.round(progressPercentage) }}% complete
        </div>
        <div class="progress-bar-container">
          <div 
            class="progress-bar"
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="summary-error">
      <div class="error-icon">⚠</div>
      <h2 class="error-title">Summary Unavailable</h2>
      <p class="error-message">{{ error }}</p>
      <button @click="continueReading" class="continue-button">
        Continue Reading
      </button>
    </div>

    <!-- Fallback state -->
    <div v-else class="summary-fallback">
      <div class="fallback-icon">📖</div>
      <h2 class="fallback-title">Section Complete</h2>
      <p class="fallback-message">You've finished reading this section.</p>
      <button @click="continueReading" class="continue-button">
        Continue Reading
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { summaryService } from '../services/summaryService'
import { progressManager } from '../services/progressManager'
import type { SectionSummary, Section } from '../types'

// Router setup
const router = useRouter()
const route = useRoute()

// Template refs
const continueButton = ref<HTMLElement>()

// Props from route
const documentId = route.params.documentId as string
const sectionIndex = parseInt(route.query.sectionIndex as string) || 0
const currentPosition = parseInt(route.query.position as string) || 0
const totalWords = parseInt(route.query.totalWords as string) || 0

// Reactive state
const isLoading = ref(true)
const summary = ref<SectionSummary | null>(null)
const error = ref<string | null>(null)

// Computed properties
const progressPercentage = computed(() => {
  if (totalWords === 0) return 0
  return (currentPosition / totalWords) * 100
})

// Methods
const generateSummary = async () => {
  try {
    isLoading.value = true
    error.value = null

    // Get document structure
    const documentStructure = progressManager.getDocumentStructure(documentId)
    if (!documentStructure) {
      throw new Error('Document not found')
    }

    // Get the current section
    const section = documentStructure.sections[sectionIndex]
    if (!section) {
      throw new Error('Section not found')
    }

    // Extract section content
    const sectionWords = documentStructure.words.slice(
      section.startWordIndex,
      section.endWordIndex + 1
    )
    const sectionContent = sectionWords.map(word => word.text).join(' ')

    // Check if summaries are enabled
    if (!summaryService.isEnabled()) {
      // Use fallback summary
      summary.value = summaryService.createFallbackSummary(section)
      return
    }

    // Generate AI summary
    summary.value = await summaryService.generateSummary(section, sectionContent)

  } catch (err) {
    console.error('Error generating summary:', err)
    error.value = err instanceof Error ? err.message : 'Failed to generate summary'
    
    // Try to create fallback summary
    try {
      const documentStructure = progressManager.getDocumentStructure(documentId)
      const section = documentStructure?.sections[sectionIndex]
      if (section) {
        summary.value = summaryService.createFallbackSummary(section)
        error.value = null // Clear error if fallback works
      }
    } catch (fallbackError) {
      console.error('Fallback summary failed:', fallbackError)
    }
  } finally {
    isLoading.value = false
    
    // Focus the continue button for accessibility
    await nextTick()
    continueButton.value?.focus()
  }
}

const continueReading = () => {
  // Return to reading view with current position
  router.push({
    name: 'reading',
    params: { documentId },
    query: {
      position: currentPosition.toString(),
      resumeFromSummary: 'true'
    }
  })
}

const pauseForReflection = () => {
  // Save current position and return to home
  progressManager.savePosition(documentId, currentPosition)
  router.push({
    name: 'home',
    query: {
      message: 'Reading paused for reflection. You can resume anytime.'
    }
  })
}

// Lifecycle
onMounted(() => {
  generateSummary()
})
</script>

<style scoped>
.summary-container {
  min-height: 100vh;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Loading state */
.summary-loading {
  text-align: center;
  max-width: 400px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1.5rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 1.1rem;
  color: #ccc;
  margin: 0;
}

/* Summary content */
.summary-content {
  text-align: center;
  max-width: 600px;
  width: 100%;
}

.summary-header {
  margin-bottom: 2.5rem;
}

.summary-title {
  font-size: 2rem;
  font-weight: 300;
  margin: 0 0 0.5rem 0;
  color: #fff;
}

.summary-subtitle {
  font-size: 1.1rem;
  color: #aaa;
  margin: 0;
  font-weight: 400;
}

/* Summary text display */
.summary-text-container {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2.5rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  text-align: left;
}

.summary-icon {
  font-size: 1.5rem;
  color: #4ade80;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.summary-text {
  font-size: 1.2rem;
  line-height: 1.5;
  color: #fff;
  margin: 0;
  font-weight: 400;
}

/* Action buttons */
.summary-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.continue-button {
  background: #fff;
  border: none;
  color: #000;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 160px;
}

.continue-button:hover:not(:disabled) {
  background: #f0f0f0;
  transform: translateY(-1px);
}

.continue-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pause-button {
  background: transparent;
  border: 1px solid #555;
  color: #ccc;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 160px;
}

.pause-button:hover:not(:disabled) {
  border-color: #777;
  color: #fff;
  transform: translateY(-1px);
}

.pause-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Progress indicator */
.progress-info {
  text-align: center;
}

.progress-text {
  font-size: 0.9rem;
  color: #aaa;
  margin-bottom: 0.5rem;
}

.progress-bar-container {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
  transition: width 0.3s ease;
  border-radius: 2px;
}

/* Error state */
.summary-error {
  text-align: center;
  max-width: 400px;
}

.error-icon {
  font-size: 3rem;
  color: #fbbf24;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 400;
  margin: 0 0 1rem 0;
  color: #fff;
}

.error-message {
  font-size: 1rem;
  color: #ccc;
  margin: 0 0 2rem 0;
  line-height: 1.4;
}

/* Fallback state */
.summary-fallback {
  text-align: center;
  max-width: 400px;
}

.fallback-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.fallback-title {
  font-size: 1.5rem;
  font-weight: 400;
  margin: 0 0 1rem 0;
  color: #fff;
}

.fallback-message {
  font-size: 1rem;
  color: #ccc;
  margin: 0 0 2rem 0;
  line-height: 1.4;
}

/* Responsive design */
@media (max-width: 768px) {
  .summary-container {
    padding: 1rem;
  }
  
  .summary-title {
    font-size: 1.5rem;
  }
  
  .summary-text-container {
    padding: 1.5rem;
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }
  
  .summary-text {
    font-size: 1.1rem;
  }
  
  .summary-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .continue-button,
  .pause-button {
    width: 100%;
    max-width: 280px;
  }
}

@media (max-width: 480px) {
  .summary-container {
    padding: 1rem 0.5rem;
  }
  
  .summary-title {
    font-size: 1.3rem;
  }
  
  .summary-text {
    font-size: 1rem;
  }
  
  .summary-text-container {
    padding: 1rem;
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none;
  }
  
  .continue-button:hover,
  .pause-button:hover {
    transform: none;
  }
  
  .progress-bar {
    transition: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .summary-text-container {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .summary-text {
    font-weight: 500;
  }
  
  .progress-bar {
    background: rgba(255, 255, 255, 0.6);
  }
}
</style>
<template>
  <div class="completion-container">
    <!-- Calm success message -->
    <div class="completion-content">
      <div class="success-icon">✓</div>
      <h1 class="completion-title">Document Complete</h1>
      <p class="completion-message">
        You've successfully finished reading "{{ documentTitle }}". 
        Well done on maintaining your focus throughout.
      </p>
      
      <!-- Action buttons -->
      <div class="completion-actions">
        <button 
          @click="returnHome" 
          class="primary-action"
          ref="primaryButton"
        >
          Read Another Document
        </button>
        <button 
          @click="readAgain" 
          class="secondary-action"
          v-if="canReadAgain"
        >
          Read This Again
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { progressManager } from '../services'

const route = useRoute()
const router = useRouter()

// Template refs
const primaryButton = ref<HTMLElement>()

// Reactive state
const documentTitle = ref('your document')
const canReadAgain = ref(true)

// Load document information
onMounted(() => {
  const documentId = route.params.documentId as string
  if (documentId) {
    const document = progressManager.getDocumentById(documentId)
    if (document) {
      documentTitle.value = document.title
    }
  }
  
  // Focus the primary button for keyboard navigation
  primaryButton.value?.focus()
})

// Action handlers
function returnHome() {
  router.push('/')
}

function readAgain() {
  const documentId = route.params.documentId as string
  if (documentId) {
    // Reset progress to beginning and go to setup
    progressManager.savePosition(documentId, 0)
    router.push({ 
      name: 'setup', 
      params: { documentId } 
    })
  }
}
</script>

<style scoped>
.completion-container {
  min-height: 100vh;
  background: #000;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.completion-content {
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.success-icon {
  font-size: 4rem;
  color: #4ade80;
  margin-bottom: 1.5rem;
  display: block;
}

.completion-title {
  font-size: 2.5rem;
  font-weight: 300;
  margin: 0 0 1.5rem 0;
  color: #fff;
  line-height: 1.2;
}

.completion-message {
  font-size: 1.2rem;
  color: #ccc;
  margin: 0 0 3rem 0;
  line-height: 1.5;
  font-weight: 300;
}

.completion-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.primary-action,
.secondary-action {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 200px;
  font-weight: 500;
}

.primary-action {
  background: #333;
  border: 2px solid #555;
  color: #fff;
}

.primary-action:hover,
.primary-action:focus {
  background: #444;
  border-color: #666;
  transform: translateY(-1px);
}

.secondary-action {
  background: transparent;
  border: 1px solid #555;
  color: #ccc;
}

.secondary-action:hover,
.secondary-action:focus {
  border-color: #777;
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.primary-action:focus-visible,
.secondary-action:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* Responsive design */
@media (max-width: 768px) {
  .completion-container {
    padding: 1rem;
  }
  
  .completion-title {
    font-size: 2rem;
  }
  
  .completion-message {
    font-size: 1.1rem;
    margin-bottom: 2rem;
  }
  
  .success-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .primary-action,
  .secondary-action {
    width: 100%;
    max-width: 280px;
  }
}

@media (max-width: 480px) {
  .completion-title {
    font-size: 1.8rem;
  }
  
  .completion-message {
    font-size: 1rem;
  }
  
  .success-icon {
    font-size: 2.5rem;
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .primary-action:hover,
  .primary-action:focus,
  .secondary-action:hover,
  .secondary-action:focus {
    transform: none;
  }
}
</style>
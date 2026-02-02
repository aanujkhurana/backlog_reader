<template>
  <div class="landing-container">
    <!-- Main Headline -->
    <div class="hero-section">
      <h1 class="hero-title">Finish documents without losing focus</h1>
      <p class="hero-subtitle">Upload a document or paste text to start reading with RSVP technology</p>
    </div>

    <!-- Continue Reading Section (if available) -->
    <div v-if="mostRecentUnfinished" class="continue-section">
      <h2 class="continue-title">Continue Reading</h2>
      <button 
        @click="continueReading" 
        class="continue-button"
        :disabled="isProcessing"
        ref="continueButton"
      >
        <div class="continue-info">
          <span class="document-title">{{ mostRecentUnfinished.title }}</span>
          <span class="progress-text">
            Resume from where you left off
          </span>
        </div>
        <div class="continue-arrow">→</div>
      </button>
    </div>

    <!-- Upload Section -->
    <div class="upload-section">
      <!-- Drag and Drop Area -->
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragOver, 'processing': isProcessing }"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div class="drop-zone-content">
          <div class="upload-icon">📄</div>
          <p class="drop-text">
            <span v-if="!isProcessing">Drop PDF or DOCX files here, or click to browse</span>
            <span v-else>Processing document...</span>
          </p>
          <p class="supported-formats">Supports PDF and DOCX files</p>
        </div>
      </div>

      <!-- Hidden File Input -->
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        @change="handleFileSelect"
        style="display: none"
      >

      <!-- Paste Text Button -->
      <div class="paste-section">
        <button 
          @click="showPasteModal = true" 
          class="paste-button"
          :disabled="isProcessing"
        >
          Paste Text Instead
        </button>
      </div>
    </div>

    <!-- Recent Documents -->
    <div v-if="recentDocuments.length > 0" class="recent-section">
      <h2 class="recent-title">Recent Documents</h2>
      <div class="recent-list">
        <div 
          v-for="doc in recentDocuments" 
          :key="doc.id"
          class="recent-item"
          @click="resumeDocument(doc)"
        >
          <div class="recent-info">
            <h3 class="recent-doc-title">{{ doc.title }}</h3>
            <div class="recent-meta">
              <span class="word-count">{{ doc.totalWords }} words</span>
              <span v-if="!doc.isCompleted" class="status-incomplete">
                In progress
              </span>
              <span v-else class="completed">✓ Completed</span>
            </div>
          </div>
          <div class="recent-action">
            <span v-if="!doc.isCompleted">Continue</span>
            <span v-else>Read Again</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Paste Text Modal -->
    <div v-if="showPasteModal" class="modal-overlay" @click="closePasteModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Paste Your Text</h2>
          <button @click="closePasteModal" class="close-button">×</button>
        </div>
        <div class="modal-body">
          <input
            v-model="pasteTitle"
            type="text"
            placeholder="Document title (optional)"
            class="title-input"
          >
          <textarea
            v-model="pasteText"
            placeholder="Paste your text here..."
            class="paste-textarea"
            rows="15"
            @keydown.ctrl.enter="processPastedText"
            @keydown.meta.enter="processPastedText"
          ></textarea>
          <div class="modal-actions">
            <button 
              @click="processPastedText" 
              class="process-button"
              :disabled="!pasteText.trim() || isProcessing"
            >
              {{ isProcessing ? 'Processing...' : 'Start Reading' }}
            </button>
            <button @click="closePasteModal" class="cancel-button">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { documentProcessor, progressManager } from '../services'
import type { DocumentSummary } from '../types'

const router = useRouter()

// Reactive state
const isDragOver = ref(false)
const isProcessing = ref(false)
const showPasteModal = ref(false)
const pasteText = ref('')
const pasteTitle = ref('')
const errorMessage = ref('')
const recentDocuments = ref<DocumentSummary[]>([])
const mostRecentUnfinished = ref<DocumentSummary | null>(null)

// Refs
const fileInput = ref<HTMLInputElement>()
const continueButton = ref<HTMLElement>()

// Computed
const hasUnfinishedDocument = computed(() => !!mostRecentUnfinished.value)

// Load initial data
onMounted(() => {
  loadRecentDocuments()
  loadMostRecentUnfinished()
  
  // Focus continue button if available for immediate access
  setTimeout(() => {
    if (mostRecentUnfinished.value) {
      continueButton.value?.focus()
    }
  }, 100)
})

function loadRecentDocuments() {
  recentDocuments.value = progressManager.getRecentDocuments()
}

function loadMostRecentUnfinished() {
  mostRecentUnfinished.value = progressManager.getMostRecentUnfinished()
}

// File upload handlers
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0 && files[0]) {
    processFile(files[0])
  }
}

function triggerFileInput() {
  if (!isProcessing.value) {
    fileInput.value?.click()
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processFile(file)
  }
}

async function processFile(file: File) {
  if (isProcessing.value) return
  
  try {
    isProcessing.value = true
    errorMessage.value = ''
    
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const validExtensions = ['.pdf', '.docx']
    const isValidType = validTypes.includes(file.type) || 
                       validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
    
    if (!isValidType) {
      throw new Error('Please upload a PDF or DOCX file')
    }
    
    // Process document
    const processedDoc = await documentProcessor.parseDocument(file)
    const documentStructure = documentProcessor.extractStructure(processedDoc)
    
    // Store document for recent list
    const documentSummary: DocumentSummary = {
      id: documentStructure.id,
      title: documentStructure.title,
      lastPosition: 0,
      totalWords: documentStructure.totalWords,
      uploadedAt: new Date(),
      isCompleted: false
    }
    
    progressManager.storeDocument(documentSummary)
    progressManager.storeDocumentStructure(documentStructure)
    
    // Navigate to setup screen
    router.push({ 
      name: 'setup', 
      params: { documentId: documentStructure.id } 
    })
    
    // Refresh recent documents
    loadRecentDocuments()
    loadMostRecentUnfinished()
    
  } catch (error) {
    console.error('Error processing file:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Failed to process document'
  } finally {
    isProcessing.value = false
    // Clear file input
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

// Paste text handlers
function closePasteModal() {
  showPasteModal.value = false
  pasteText.value = ''
  pasteTitle.value = ''
  errorMessage.value = ''
}

async function processPastedText() {
  if (!pasteText.value.trim() || isProcessing.value) return
  
  try {
    isProcessing.value = true
    errorMessage.value = ''
    
    const title = pasteTitle.value.trim() || 'Pasted Text'
    const processedDoc = await documentProcessor.processPastedText(pasteText.value, title)
    const documentStructure = documentProcessor.extractStructure(processedDoc)
    
    // Store document for recent list
    const documentSummary: DocumentSummary = {
      id: documentStructure.id,
      title: documentStructure.title,
      lastPosition: 0,
      totalWords: documentStructure.totalWords,
      uploadedAt: new Date(),
      isCompleted: false
    }
    
    progressManager.storeDocument(documentSummary)
    progressManager.storeDocumentStructure(documentStructure)
    
    // Navigate to setup screen
    router.push({ 
      name: 'setup', 
      params: { documentId: documentStructure.id } 
    })
    
    // Close modal and refresh
    closePasteModal()
    loadRecentDocuments()
    loadMostRecentUnfinished()
    
  } catch (error) {
    console.error('Error processing pasted text:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Failed to process text'
  } finally {
    isProcessing.value = false
  }
}

// Resume reading handlers
function continueReading() {
  if (mostRecentUnfinished.value) {
    resumeDocument(mostRecentUnfinished.value)
  }
}

function resumeDocument(doc: DocumentSummary) {
  // Navigate to setup screen for document configuration
  router.push({ 
    name: 'setup', 
    params: { documentId: doc.id } 
  })
}
</script>

<style scoped>
.landing-container {
  min-height: 100vh;
  background: #000;
  color: #fff;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Hero Section */
.hero-section {
  text-align: center;
  margin-bottom: 3rem;
  max-width: 600px;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 300;
  margin: 0 0 1rem 0;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: #ccc;
  margin: 0;
  font-weight: 300;
}

/* Continue Reading Section */
.continue-section {
  margin-bottom: 3rem;
  width: 100%;
  max-width: 500px;
}

.continue-title {
  font-size: 1.5rem;
  font-weight: 400;
  margin: 0 0 1rem 0;
  color: #fff;
  text-align: center;
}

.continue-button {
  width: 100%;
  background: linear-gradient(135deg, #333 0%, #444 100%);
  border: 2px solid #4ade80;
  color: #fff;
  padding: 1.5rem;
  border-radius: 12px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(74, 222, 128, 0.2);
}

.continue-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #444 0%, #555 100%);
  border-color: #4ade80;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(74, 222, 128, 0.3);
}

.continue-button:focus {
  outline: 2px solid #4ade80;
  outline-offset: 2px;
}

.continue-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.continue-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  flex: 1;
}

.document-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
}

.progress-text {
  font-size: 0.95rem;
  color: #4ade80;
  font-weight: 400;
}

.continue-arrow {
  font-size: 1.5rem;
  color: #4ade80;
  transition: transform 0.2s ease;
}

.continue-button:hover:not(:disabled) .continue-arrow {
  transform: translateX(4px);
}

/* Upload Section */
.upload-section {
  width: 100%;
  max-width: 500px;
  margin-bottom: 3rem;
}

.drop-zone {
  border: 2px dashed #555;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #111;
}

.drop-zone:hover {
  border-color: #777;
  background: #1a1a1a;
}

.drop-zone.drag-over {
  border-color: #fff;
  background: #222;
}

.drop-zone.processing {
  border-color: #666;
  background: #1a1a1a;
  cursor: not-allowed;
}

.drop-zone-content {
  pointer-events: none;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.drop-text {
  font-size: 1.1rem;
  margin: 0 0 0.5rem 0;
  color: #fff;
}

.supported-formats {
  font-size: 0.9rem;
  color: #aaa;
  margin: 0;
}

.paste-section {
  margin-top: 1.5rem;
  text-align: center;
}

.paste-button {
  background: transparent;
  border: 1px solid #555;
  color: #ccc;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.paste-button:hover:not(:disabled) {
  border-color: #777;
  color: #fff;
}

.paste-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Recent Documents */
.recent-section {
  width: 100%;
  max-width: 600px;
}

.recent-title {
  font-size: 1.3rem;
  font-weight: 400;
  margin: 0 0 1rem 0;
  color: #ccc;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recent-item {
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recent-item:hover {
  background: #1a1a1a;
  border-color: #444;
}

.recent-info {
  flex: 1;
}

.recent-doc-title {
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.25rem 0;
  color: #fff;
}

.recent-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #aaa;
}

.completed {
  color: #4ade80;
}

.status-incomplete {
  color: #fbbf24;
}

.recent-action {
  color: #ccc;
  font-size: 0.9rem;
  padding-left: 1rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  color: #ccc;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  color: #fff;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  overflow: hidden;
}

.title-input {
  background: #222;
  border: 1px solid #444;
  color: #fff;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 1rem;
}

.title-input::placeholder {
  color: #666;
}

.paste-textarea {
  background: #222;
  border: 1px solid #444;
  color: #fff;
  padding: 1rem;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  flex: 1;
  min-height: 300px;
}

.paste-textarea::placeholder {
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.process-button {
  background: #333;
  border: 1px solid #555;
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.process-button:hover:not(:disabled) {
  background: #444;
}

.process-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-button {
  background: transparent;
  border: 1px solid #555;
  color: #ccc;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-button:hover {
  border-color: #777;
  color: #fff;
}

/* Error Message */
.error-message {
  position: fixed;
  top: 2rem;
  right: 2rem;
  background: #dc2626;
  color: #fff;
  padding: 1rem 1.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  z-index: 1001;
  max-width: 400px;
}

/* Responsive */
@media (max-width: 768px) {
  .landing-container {
    padding: 1rem;
  }
  
  .hero-title {
    font-size: 2rem;
  }
  
  .continue-title {
    font-size: 1.3rem;
  }
  
  .continue-button {
    padding: 1.25rem;
  }
  
  .document-title {
    font-size: 1.1rem;
  }
  
  .progress-text {
    font-size: 0.9rem;
  }
  
  .drop-zone {
    padding: 2rem 1rem;
  }
  
  .modal-overlay {
    padding: 1rem;
  }
  
  .recent-meta {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
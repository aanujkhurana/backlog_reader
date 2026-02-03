<template>
  <div class="preview-container">
    <!-- Header -->
    <div class="preview-header">
      <h1 class="preview-title">{{ documentTitle }}</h1>
      <p class="preview-subtitle">
        {{ totalWords }} words • Click any paragraph to start reading from there
      </p>
      <div class="preview-actions">
        <button @click="startFromBeginning" class="start-button primary">
          Start from Beginning
        </button>
        <button @click="goBack" class="back-button secondary">
          Back
        </button>
      </div>
    </div>

    <!-- Document Content -->
    <div class="preview-content" v-if="documentStructure">
      <div 
        v-for="(section, sectionIndex) in documentStructure.sections" 
        :key="sectionIndex"
        class="section"
        :class="{ 
          'section-heading': section.type === 'heading',
          'section-bullet': section.type === 'bullet',
          'section-paragraph': section.type === 'paragraph',
          'section-normal': section.type === 'normal',
          'section-selected': selectedSection === sectionIndex
        }"
        @click="selectSection(sectionIndex, section)"
        :data-section-index="sectionIndex"
        :data-word-start="section.startWordIndex"
        :data-word-end="section.endWordIndex"
      >
        <div class="section-indicator">
          <span class="section-type-icon">
            {{ getSectionIcon(section.type) }}
          </span>
          <span class="section-info">
            {{ section.type === 'heading' ? 'Heading' : 
               section.type === 'bullet' ? 'Bullet Points' : 'Paragraph' }}
          </span>
        </div>
        
        <div class="section-content">
          <h3 v-if="section.type === 'heading'" class="section-title">
            {{ section.title }}
          </h3>
          <div class="section-text">
            {{ getSectionText(section) }}
          </div>
          <div class="section-meta">
            Words {{ section.startWordIndex + 1 }}-{{ section.endWordIndex + 1 }} 
            ({{ section.endWordIndex - section.startWordIndex + 1 }} words)
          </div>
        </div>

        <div class="section-action">
          <span class="start-here-text">Start here</span>
          <span class="start-arrow">→</span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading document preview...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMessage" class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>Unable to load document</h3>
      <p>{{ errorMessage }}</p>
      <button @click="goBack" class="back-button">Go Back</button>
    </div>

    <!-- Selection Confirmation Modal -->
    <div v-if="showConfirmation" class="modal-overlay" @click="cancelSelection">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Start Reading From Here?</h2>
        </div>
        <div class="modal-body">
          <div class="selected-section-preview">
            <div class="section-highlight">
              <div class="section-type">
                {{ getSectionIcon(selectedSectionData?.type || 'normal') }}
                {{ selectedSectionData?.type === 'heading' ? 'Heading' : 
                   selectedSectionData?.type === 'bullet' ? 'Bullet Points' : 'Paragraph' }}
              </div>
              <div class="section-preview-text">
                {{ getSelectedSectionPreview() }}
              </div>
              <div class="section-position">
                Starting at word {{ (selectedSectionData?.startWordIndex || 0) + 1 }} of {{ totalWords }}
              </div>
            </div>
          </div>
          <p class="confirmation-text">
            You'll start reading from this section. Your progress will be saved automatically.
          </p>
        </div>
        <div class="modal-actions">
          <button @click="confirmSelection" class="confirm-button primary">
            Start Reading
          </button>
          <button @click="cancelSelection" class="cancel-button secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { progressManager } from '../services'
import type { DocumentStructure, Section } from '../types'

const router = useRouter()
const route = useRoute()

// Props from route params
const documentId = route.params.documentId as string

// Reactive state
const documentStructure = ref<DocumentStructure | null>(null)
const isLoading = ref(true)
const errorMessage = ref('')
const selectedSection = ref<number | null>(null)
const selectedSectionData = ref<Section | null>(null)
const showConfirmation = ref(false)

// Computed properties
const documentTitle = computed(() => documentStructure.value?.title || 'Document')
const totalWords = computed(() => documentStructure.value?.totalWords || 0)

// Load document data
onMounted(() => {
  loadDocumentData()
})

async function loadDocumentData() {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    // Get document structure from progress manager
    const structure = progressManager.getDocumentStructure(documentId)
    
    if (!structure) {
      throw new Error('Document not found. Please upload the document again.')
    }
    
    documentStructure.value = structure
  } catch (error) {
    console.error('Error loading document:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load document'
  } finally {
    isLoading.value = false
  }
}

function getSectionIcon(type: string): string {
  switch (type) {
    case 'heading':
      return '📋'
    case 'bullet':
      return '•'
    case 'paragraph':
      return '📄'
    default:
      return '📄'
  }
}

function getSectionText(section: Section): string {
  if (!documentStructure.value) return ''
  
  // Get the words for this section
  const sectionWords = documentStructure.value.words
    .slice(section.startWordIndex, section.endWordIndex + 1)
    .map(word => word.text)
    .join(' ')
  
  // Truncate if too long for preview
  if (sectionWords.length > 200) {
    return sectionWords.substring(0, 200) + '...'
  }
  
  return sectionWords
}

function selectSection(sectionIndex: number, section: Section) {
  selectedSection.value = sectionIndex
  selectedSectionData.value = section
  showConfirmation.value = true
}

function getSelectedSectionPreview(): string {
  if (!selectedSectionData.value || !documentStructure.value) return ''
  
  const sectionWords = documentStructure.value.words
    .slice(selectedSectionData.value.startWordIndex, selectedSectionData.value.endWordIndex + 1)
    .map(word => word.text)
    .join(' ')
  
  // Show first 100 characters for confirmation
  if (sectionWords.length > 100) {
    return sectionWords.substring(0, 100) + '...'
  }
  
  return sectionWords
}

function confirmSelection() {
  if (!selectedSectionData.value) return
  
  // Save the custom starting position
  progressManager.savePosition(documentId, selectedSectionData.value.startWordIndex)
  
  // Navigate to setup screen with the custom position
  router.push({
    name: 'setup',
    params: { documentId },
    query: { 
      customStart: 'true',
      startPosition: selectedSectionData.value.startWordIndex.toString()
    }
  })
}

function cancelSelection() {
  selectedSection.value = null
  selectedSectionData.value = null
  showConfirmation.value = false
}

function startFromBeginning() {
  // Navigate to setup screen without custom position
  router.push({
    name: 'setup',
    params: { documentId }
  })
}

function goBack() {
  // Go back to the previous page (likely landing or setup)
  router.back()
}
</script>

<style scoped>
.preview-container {
  min-height: 100vh;
  background: #000;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.preview-header {
  position: sticky;
  top: 0;
  background: #000;
  border-bottom: 1px solid #333;
  padding: 2rem;
  z-index: 100;
}

.preview-title {
  font-size: 1.8rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  color: #fff;
}

.preview-subtitle {
  font-size: 1rem;
  color: #aaa;
  margin: 0 0 1.5rem 0;
}

.preview-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.start-button,
.back-button {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.primary {
  background: #fff;
  color: #000;
}

.primary:hover {
  background: #f0f0f0;
}

.secondary {
  background: transparent;
  color: #ccc;
  border: 1px solid #555;
}

.secondary:hover {
  border-color: #777;
  color: #fff;
}

/* Content */
.preview-content {
  padding: 0 2rem 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.section {
  background: #111;
  border: 2px solid #333;
  border-radius: 8px;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.section:hover {
  border-color: #555;
  background: #1a1a1a;
}

.section-selected {
  border-color: #4ade80 !important;
  background: #1a2e1a !important;
}

.section-heading {
  border-left: 4px solid #60a5fa;
}

.section-bullet {
  border-left: 4px solid #fbbf24;
}

.section-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid #333;
  font-size: 0.85rem;
  color: #aaa;
}

.section-type-icon {
  font-size: 1rem;
}

.section-content {
  padding: 1rem;
  flex: 1;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #fff;
}

.section-text {
  font-size: 0.95rem;
  line-height: 1.5;
  color: #ccc;
  margin-bottom: 0.75rem;
}

.section-meta {
  font-size: 0.8rem;
  color: #666;
}

.section-action {
  position: absolute;
  top: 50%;
  right: 1rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0;
  transition: all 0.2s ease;
  color: #4ade80;
  font-size: 0.9rem;
  font-weight: 500;
}

.section {
  position: relative;
  display: flex;
  flex-direction: column;
}

.section:hover .section-action {
  opacity: 1;
}

.start-arrow {
  font-size: 1.2rem;
  transition: transform 0.2s ease;
}

.section:hover .start-arrow {
  transform: translateX(4px);
}

/* Loading and Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  text-align: center;
  padding: 2rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 2rem;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #333;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
}

.modal-body {
  padding: 1.5rem;
}

.selected-section-preview {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.section-highlight {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-type {
  font-size: 0.85rem;
  color: #4ade80;
  font-weight: 500;
}

.section-preview-text {
  font-size: 0.95rem;
  line-height: 1.4;
  color: #ccc;
}

.section-position {
  font-size: 0.8rem;
  color: #666;
}

.confirmation-text {
  font-size: 0.95rem;
  color: #aaa;
  margin: 0;
  line-height: 1.4;
}

.modal-actions {
  padding: 1.5rem;
  border-top: 1px solid #333;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.confirm-button,
.cancel-button {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.confirm-button.primary {
  background: #4ade80;
  color: #000;
}

.confirm-button.primary:hover {
  background: #22c55e;
}

.cancel-button.secondary {
  background: transparent;
  color: #ccc;
  border: 1px solid #555;
}

.cancel-button.secondary:hover {
  border-color: #777;
  color: #fff;
}

/* Responsive */
@media (max-width: 768px) {
  .preview-header {
    padding: 1rem;
  }
  
  .preview-title {
    font-size: 1.5rem;
  }
  
  .preview-actions {
    flex-direction: column;
  }
  
  .preview-content {
    padding: 0 1rem 1rem;
  }
  
  .section-content {
    padding: 0.75rem;
  }
  
  .section-action {
    position: static;
    transform: none;
    opacity: 1;
    padding: 0.75rem 1rem;
    border-top: 1px solid #333;
    justify-content: center;
    background: rgba(74, 222, 128, 0.1);
  }
  
  .modal-overlay {
    padding: 1rem;
  }
  
  .modal-actions {
    flex-direction: column;
  }
}
</style>
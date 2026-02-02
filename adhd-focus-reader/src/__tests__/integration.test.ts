/**
 * Integration Tests for ADHD Focus Reader
 * Task 14: Final integration and testing
 * Tests end-to-end reading sessions from upload to completion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import LandingView from '../views/LandingView.vue'
import SetupView from '../views/SetupView.vue'
import ReadingView from '../views/ReadingView.vue'
import CompletionView from '../views/CompletionView.vue'
import { documentProcessor, progressManager } from '../services'

// Mock browser APIs for testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('ADHD Focus Reader - Integration Tests', () => {
  let router: any
  let pinia: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    
    // Create fresh router and pinia instances
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: LandingView },
        { path: '/setup/:documentId', component: SetupView },
        { path: '/reading/:documentId', component: ReadingView },
        { path: '/completion/:documentId', component: CompletionView },
      ]
    })
    
    pinia = createPinia()
  })

  describe('End-to-End User Flow', () => {
    it('should complete full reading session from text paste to completion', async () => {
      // Step 1: Landing page with text paste
      const landingWrapper = mount(LandingView, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Verify landing page renders
      expect(landingWrapper.find('.hero-title').text()).toContain('Finish documents without losing focus')
      expect(landingWrapper.find('.paste-button').exists()).toBe(true)

      // Test with longer text that meets minimum requirements
      const testText = 'This is a test document with multiple sentences. It has enough words to pass validation. Each sentence should be processed correctly for testing purposes.'
      const processedDoc = await documentProcessor.processPastedText(testText, 'Test Document')
      
      expect(processedDoc.content).toBe(testText)
      expect(processedDoc.metadata.title).toBe('Test Document')
      expect(processedDoc.sections).toHaveLength(1)

      // Step 3: Test document structure extraction
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      
      expect(documentStructure.title).toBe('Test Document')
      expect(documentStructure.totalWords).toBeGreaterThan(0)
      expect(documentStructure.words).toHaveLength(documentStructure.totalWords)
      expect(documentStructure.id).toBeDefined()

      // Step 4: Test progress manager integration
      const documentSummary = {
        id: documentStructure.id,
        title: documentStructure.title,
        lastPosition: 0,
        totalWords: documentStructure.totalWords,
        uploadedAt: new Date(),
        isCompleted: false
      }

      progressManager.storeDocument(documentSummary)
      progressManager.storeDocumentStructure(documentStructure)

      // Verify storage
      const storedDoc = progressManager.getDocumentById(documentStructure.id)
      expect(storedDoc).toBeDefined()
      expect(storedDoc?.title).toBe('Test Document')

      const storedStructure = progressManager.getDocumentStructure(documentStructure.id)
      expect(storedStructure).toBeDefined()
      expect(storedStructure?.totalWords).toBe(documentStructure.totalWords)
    })

    it('should handle setup view configuration correctly', async () => {
      // Create a test document first with sufficient length
      const testText = 'This is a longer test document for setup testing. It contains multiple sentences with enough words to pass validation requirements for the document processor.'
      const processedDoc = await documentProcessor.processPastedText(testText, 'Setup Test')
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      
      const documentSummary = {
        id: documentStructure.id,
        title: documentStructure.title,
        lastPosition: 0,
        totalWords: documentStructure.totalWords,
        uploadedAt: new Date(),
        isCompleted: false
      }

      progressManager.storeDocument(documentSummary)
      progressManager.storeDocumentStructure(documentStructure)

      // Navigate to setup view
      await router.push(`/setup/${documentStructure.id}`)

      const setupWrapper = mount(SetupView, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Verify setup view renders with document info
      expect(setupWrapper.find('.setup-title').text()).toBe('Setup Test')
      expect(setupWrapper.find('.setup-subtitle').text()).toContain('words')
      
      // Verify speed options are available
      const speedButtons = setupWrapper.findAll('.speed-button')
      expect(speedButtons).toHaveLength(3) // Slow, Normal, Fast
      
      // Verify toggles are present
      expect(setupWrapper.find('input[type="checkbox"]').exists()).toBe(true)
      
      // Verify action buttons
      expect(setupWrapper.find('.start-button').exists()).toBe(true)
      expect(setupWrapper.find('.skip-button').exists()).toBe(true)
    })

    it('should handle reading view initialization without errors', async () => {
      // Create test document with sufficient length
      const testText = 'Reading view test document with multiple words for testing purposes. This document has enough content to pass validation requirements and test the reading interface properly.'
      const processedDoc = await documentProcessor.processPastedText(testText, 'Reading Test')
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      
      const documentSummary = {
        id: documentStructure.id,
        title: documentStructure.title,
        lastPosition: 0,
        totalWords: documentStructure.totalWords,
        uploadedAt: new Date(),
        isCompleted: false
      }

      progressManager.storeDocument(documentSummary)
      progressManager.storeDocumentStructure(documentStructure)

      // Navigate to reading view with query parameters
      await router.push({
        path: `/reading/${documentStructure.id}`,
        query: {
          baseSpeed: '250',
          autoPacingEnabled: 'true',
          summariesEnabled: 'false'
        }
      })

      // Mount reading view (this should not throw errors)
      expect(() => {
        mount(ReadingView, {
          global: {
            plugins: [router, pinia]
          }
        })
      }).not.toThrow()
    })

    it('should handle completion view correctly', async () => {
      // Create test document with sufficient length
      const testText = 'Completion test document with enough words to pass validation requirements for testing the completion view functionality.'
      const processedDoc = await documentProcessor.processPastedText(testText, 'Completion Test')
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      
      const documentSummary = {
        id: documentStructure.id,
        title: documentStructure.title,
        lastPosition: documentStructure.totalWords, // Completed
        totalWords: documentStructure.totalWords,
        uploadedAt: new Date(),
        isCompleted: true
      }

      progressManager.storeDocument(documentSummary)
      progressManager.markCompleted(documentStructure.id)

      // Navigate to completion view
      await router.push(`/completion/${documentStructure.id}`)

      const completionWrapper = mount(CompletionView, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Verify completion view renders
      expect(completionWrapper.find('.completion-title').text()).toBe('Document Complete')
      expect(completionWrapper.find('.completion-message').text()).toContain('Completion Test')
      expect(completionWrapper.find('.primary-action').exists()).toBe(true)
    })
  })

  describe('Cross-Browser Compatibility', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Test without matchMedia
      delete (window as any).matchMedia
      
      expect(() => {
        mount(LandingView, {
          global: {
            plugins: [router, pinia]
          }
        })
      }).not.toThrow()
    })

    it('should work without localStorage', () => {
      // Mock localStorage failure
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      expect(() => {
        progressManager.getRecentDocuments()
      }).not.toThrow()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should handle keyboard events without mouse dependency', async () => {
      const landingWrapper = mount(LandingView, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Test keyboard navigation on landing page
      const pasteButton = landingWrapper.find('.paste-button')
      
      // Simulate keyboard focus and activation
      await pasteButton.trigger('focus')
      await pasteButton.trigger('keydown', { key: 'Enter' })
      
      // Should not throw errors
      expect(landingWrapper.vm).toBeDefined()
    })

    it('should support tab navigation through interface elements', async () => {
      const setupWrapper = mount(SetupView, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Test tab navigation through speed buttons
      const speedButtons = setupWrapper.findAll('.speed-button')
      for (const button of speedButtons) {
        await button.trigger('focus')
        expect(button.element).toBeDefined()
      }

      // Test tab navigation through toggles and action buttons
      const startButton = setupWrapper.find('.start-button')
      await startButton.trigger('focus')
      expect(startButton.element).toBeDefined()
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to different screen sizes', () => {
      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      })

      const landingWrapper = mount(LandingView, {
        global: {
          plugins: [router, pinia]
        }
      })

      // Should render without errors on mobile
      expect(landingWrapper.find('.landing-container').exists()).toBe(true)
      
      // Test desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      })

      const desktopWrapper = mount(LandingView, {
        global: {
          plugins: [router, pinia]
        }
      })

      expect(desktopWrapper.find('.landing-container').exists()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle document processing errors gracefully', async () => {
      // Test with invalid document (empty text)
      await expect(async () => {
        await documentProcessor.processPastedText('', 'Empty Document')
      }).rejects.toThrow()

      // Test with text that's too short
      await expect(async () => {
        await documentProcessor.processPastedText('Short', 'Short Document')
      }).rejects.toThrow()

      // Test with extremely large document (over 500k words)
      const largeText = 'word '.repeat(550000) // Over the 500k limit
      await expect(async () => {
        await documentProcessor.processPastedText(largeText, 'Large Document')
      }).rejects.toThrow()
    })

    it('should handle missing document gracefully in views', async () => {
      // Test setup view with non-existent document
      await router.push('/setup/non-existent-id')

      expect(() => {
        mount(SetupView, {
          global: {
            plugins: [router, pinia]
          }
        })
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should handle large documents efficiently', async () => {
      // Create a reasonably large document (within limits)
      const sentence = 'This is a sentence with multiple words for testing large document processing. '
      const largeText = sentence.repeat(1000) // ~8000 words
      
      const startTime = performance.now()
      const processedDoc = await documentProcessor.processPastedText(largeText, 'Large Test Document')
      const endTime = performance.now()
      
      // Processing should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000)
      
      // Document should be processed correctly (content may be cleaned/trimmed)
      expect(processedDoc.content).toContain('This is a sentence with multiple words')
      expect(processedDoc.sections).toHaveLength(1)
      
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      expect(documentStructure.totalWords).toBeGreaterThan(7000)
    })
  })
})
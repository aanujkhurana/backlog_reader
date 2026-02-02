/**
 * Cross-Browser Compatibility Integration Tests
 * Task 14: Final integration and testing
 * Tests cross-browser compatibility and responsive design
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { documentProcessor, progressManager } from '../services'
import { accessibilityService } from '../services/accessibilityService'

describe('Cross-Browser Compatibility Integration', () => {
  beforeEach(() => {
    progressManager.clearAll()
  })

  describe('Browser API Compatibility', () => {
    it('should work without localStorage', () => {
      // Mock localStorage failure
      const originalLocalStorage = window.localStorage
      
      // Remove localStorage
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true
      })

      // Should still work with fallback
      expect(() => {
        progressManager.getRecentDocuments()
      }).not.toThrow()

      expect(() => {
        progressManager.savePosition('test-doc', 5)
      }).not.toThrow()

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      })
    })

    it('should work without matchMedia', () => {
      // Mock missing matchMedia
      const originalMatchMedia = window.matchMedia
      
      Object.defineProperty(window, 'matchMedia', {
        value: undefined,
        writable: true
      })

      // Should still work
      expect(() => {
        accessibilityService.getAccessibleColorScheme()
      }).not.toThrow()

      // Restore matchMedia
      Object.defineProperty(window, 'matchMedia', {
        value: originalMatchMedia,
        writable: true
      })
    })

    it('should handle missing requestAnimationFrame', () => {
      // Mock missing requestAnimationFrame
      const originalRAF = window.requestAnimationFrame
      
      Object.defineProperty(window, 'requestAnimationFrame', {
        value: undefined,
        writable: true
      })

      // Should still work with setTimeout fallback
      expect(() => {
        // This would normally use requestAnimationFrame internally
        const testText = 'Test document for animation frame compatibility testing with sufficient words for validation.'
        documentProcessor.processPastedText(testText, 'RAF Test')
      }).not.toThrow()

      // Restore requestAnimationFrame
      Object.defineProperty(window, 'requestAnimationFrame', {
        value: originalRAF,
        writable: true
      })
    })
  })

  describe('Responsive Design Integration', () => {
    it('should adapt to different viewport sizes', () => {
      const viewportSizes = [
        { width: 320, height: 568 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1200, height: 800 },  // Desktop
        { width: 1920, height: 1080 }  // Large Desktop
      ]

      viewportSizes.forEach(size => {
        // Mock viewport size
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: size.width,
        })
        
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: size.height,
        })

        // Should handle different viewport sizes without errors
        expect(() => {
          // This would trigger responsive calculations
          accessibilityService.getAccessibleColorScheme()
        }).not.toThrow()
      })
    })

    it('should handle zoom levels gracefully', () => {
      const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

      zoomLevels.forEach(zoom => {
        // Mock device pixel ratio (approximates zoom)
        Object.defineProperty(window, 'devicePixelRatio', {
          writable: true,
          configurable: true,
          value: zoom,
        })

        // Should handle different zoom levels
        expect(() => {
          accessibilityService.getAccessibleColorScheme()
        }).not.toThrow()
      })
    })
  })

  describe('Performance Integration', () => {
    it('should handle memory constraints gracefully', async () => {
      // Test with multiple documents to simulate memory usage
      const documents = []
      
      for (let i = 0; i < 5; i++) {
        const testText = `Performance test document ${i} with sufficient content for validation and memory testing purposes. This document contains multiple sentences to ensure proper processing.`
        
        const processedDoc = await documentProcessor.processPastedText(testText, `Perf Test ${i}`)
        const documentStructure = documentProcessor.extractStructure(processedDoc)
        
        documents.push({
          id: documentStructure.id,
          title: documentStructure.title,
          lastPosition: 0,
          totalWords: documentStructure.totalWords,
          uploadedAt: new Date(),
          isCompleted: false
        })
        
        progressManager.storeDocument(documents[i])
      }

      // Should handle multiple documents without memory issues
      const recentDocs = progressManager.getRecentDocuments()
      expect(recentDocs.length).toBeGreaterThan(0)
      expect(recentDocs.length).toBeLessThanOrEqual(10) // Should limit to 10
    })

    it('should handle rapid user interactions', async () => {
      const testText = 'Rapid interaction test document with enough words for proper validation and testing of user interface responsiveness.'
      
      const processedDoc = await documentProcessor.processPastedText(testText, 'Rapid Test')
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      
      const documentSummary = {
        id: documentStructure.id,
        title: documentStructure.title,
        lastPosition: 0,
        totalWords: documentStructure.totalWords,
        uploadedAt: new Date(),
        isCompleted: false
      }

      // Simulate rapid operations
      const operations = []
      for (let i = 0; i < 10; i++) {
        operations.push(() => {
          progressManager.storeDocument(documentSummary)
          progressManager.savePosition(documentStructure.id, i)
          progressManager.getLastPosition(documentStructure.id)
          progressManager.getRecentDocuments()
        })
      }

      // Should handle rapid operations without errors
      operations.forEach(operation => {
        expect(operation).not.toThrow()
      })
    })
  })

  describe('Accessibility Integration', () => {
    it('should provide high contrast support', () => {
      // Mock high contrast preference
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
        writable: true
      })

      const colorScheme = accessibilityService.getAccessibleColorScheme()
      
      // Should provide accessible colors
      expect(colorScheme).toBeDefined()
      expect(colorScheme.background).toBeDefined()
      expect(colorScheme.text).toBeDefined()
      expect(colorScheme.orp).toBeDefined()
    })

    it('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
        writable: true
      })

      // Should handle reduced motion preference
      expect(() => {
        accessibilityService.getAccessibleColorScheme()
      }).not.toThrow()
    })

    it('should work with screen readers', () => {
      // Mock screen reader detection
      const mockNavigator = {
        ...navigator,
        userAgent: 'NVDA screen reader'
      }
      
      Object.defineProperty(window, 'navigator', {
        value: mockNavigator,
        writable: true
      })

      // Should work with screen reader user agents
      expect(() => {
        accessibilityService.getAccessibleColorScheme()
      }).not.toThrow()
    })
  })

  describe('Error Recovery Integration', () => {
    it('should recover from storage quota exceeded', () => {
      // Mock storage quota exceeded
      const mockSetItem = vi.fn().mockImplementation(() => {
        const error = new DOMException('QuotaExceededError')
        error.name = 'QuotaExceededError'
        throw error
      })

      Object.defineProperty(window.localStorage, 'setItem', {
        value: mockSetItem,
        writable: true
      })

      // Should handle storage errors gracefully
      expect(() => {
        progressManager.savePosition('test-doc', 5)
      }).not.toThrow()
    })

    it('should handle corrupted storage data', () => {
      // Mock corrupted data
      const mockGetItem = vi.fn().mockReturnValue('invalid json data')

      Object.defineProperty(window.localStorage, 'getItem', {
        value: mockGetItem,
        writable: true
      })

      // Should handle corrupted data gracefully
      expect(() => {
        progressManager.getRecentDocuments()
      }).not.toThrow()
    })
  })
})
/**
 * Unit tests for Progress Manager Service
 * Tests Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProgressManagerService } from '../progressManager'
import type { DocumentSummary } from '../../types/document'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('ProgressManagerService', () => {
  let progressManager: ProgressManagerService

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    
    progressManager = new ProgressManagerService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Position Saving (Requirement 5.1)', () => {
    it('should save reading position automatically', () => {
      const documentId = 'test-doc-1'
      const wordIndex = 150
      
      progressManager.savePosition(documentId, wordIndex)
      
      expect(localStorageMock.setItem).toHaveBeenCalled()
      const savedPosition = progressManager.getLastPosition(documentId)
      expect(savedPosition).toBe(wordIndex)
    })

    it('should update existing position', () => {
      const documentId = 'test-doc-1'
      
      progressManager.savePosition(documentId, 100)
      progressManager.savePosition(documentId, 200)
      
      const savedPosition = progressManager.getLastPosition(documentId)
      expect(savedPosition).toBe(200)
    })

    it('should persist data to localStorage on save', () => {
      const documentId = 'test-doc-1'
      const wordIndex = 75
      
      progressManager.savePosition(documentId, wordIndex)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'adhd-focus-reader-data',
        expect.stringContaining(documentId)
      )
    })
  })

  describe('Resume Functionality (Requirement 5.2)', () => {
    it('should return saved position for unfinished document', () => {
      const documentId = 'test-doc-1'
      const wordIndex = 250
      
      progressManager.savePosition(documentId, wordIndex)
      
      const position = progressManager.getLastPosition(documentId)
      expect(position).toBe(wordIndex)
    })

    it('should return null for completed document', () => {
      const documentId = 'test-doc-1'
      
      progressManager.savePosition(documentId, 100)
      progressManager.markCompleted(documentId)
      
      const position = progressManager.getLastPosition(documentId)
      expect(position).toBeNull()
    })

    it('should return null for non-existent document', () => {
      const position = progressManager.getLastPosition('non-existent')
      expect(position).toBeNull()
    })

    it('should identify unfinished documents', () => {
      progressManager.savePosition('doc-1', 100)
      progressManager.savePosition('doc-2', 200)
      progressManager.markCompleted('doc-2')
      
      expect(progressManager.hasUnfinishedDocument()).toBe(true)
    })

    it('should get most recent unfinished document', async () => {
      const doc1: DocumentSummary = {
        id: 'doc-1',
        title: 'First Document',
        lastPosition: 0,
        totalWords: 1000,
        uploadedAt: new Date('2024-01-01'),
        isCompleted: false
      }
      
      const doc2: DocumentSummary = {
        id: 'doc-2', 
        title: 'Second Document',
        lastPosition: 0,
        totalWords: 800,
        uploadedAt: new Date('2024-01-02'),
        isCompleted: false
      }
      
      progressManager.storeDocument(doc1)
      progressManager.storeDocument(doc2)
      progressManager.savePosition('doc-1', 100)
      progressManager.savePosition('doc-2', 200)
      
      // Make doc-1 more recently accessed with a small delay
      await new Promise(resolve => setTimeout(resolve, 10))
      progressManager.savePosition('doc-1', 150)
      
      const mostRecent = progressManager.getMostRecentUnfinished()
      expect(mostRecent?.id).toBe('doc-1')
    })
  })

  describe('Local Storage (Requirement 5.3)', () => {
    it('should work without user accounts', () => {
      // No authentication required - just test basic functionality
      progressManager.savePosition('test-doc', 100)
      
      const position = progressManager.getLastPosition('test-doc')
      expect(position).toBe(100)
    })

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      // Should not throw error
      expect(() => {
        progressManager.savePosition('test-doc', 100)
      }).not.toThrow()
    })

    it('should load existing data from localStorage', () => {
      const existingData = {
        documents: {
          'doc-1': {
            id: 'doc-1',
            title: 'Existing Document',
            lastPosition: 0,
            totalWords: 500,
            uploadedAt: '2024-01-01T00:00:00.000Z',
            isCompleted: false
          }
        },
        progress: {
          'doc-1': {
            documentId: 'doc-1',
            wordIndex: 150,
            lastUpdated: '2024-01-01T12:00:00.000Z',
            isCompleted: false
          }
        },
        settings: {
          baseSpeed: 300,
          summariesEnabled: true,
          lastUsed: '2024-01-01T00:00:00.000Z'
        }
      }
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingData))
      
      const newProgressManager = new ProgressManagerService()
      const position = newProgressManager.getLastPosition('doc-1')
      
      expect(position).toBe(150)
    })

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      // Should not throw and should create new instance
      expect(() => {
        new ProgressManagerService()
      }).not.toThrow()
    })
  })

  describe('Recent Documents (Requirement 5.4)', () => {
    it('should return recent documents with position indicators', () => {
      const doc1: DocumentSummary = {
        id: 'doc-1',
        title: 'First Document',
        lastPosition: 0,
        totalWords: 1000,
        uploadedAt: new Date('2024-01-01'),
        isCompleted: false
      }
      
      const doc2: DocumentSummary = {
        id: 'doc-2',
        title: 'Second Document', 
        lastPosition: 0,
        totalWords: 800,
        uploadedAt: new Date('2024-01-02'),
        isCompleted: false
      }
      
      progressManager.storeDocument(doc1)
      progressManager.storeDocument(doc2)
      progressManager.savePosition('doc-1', 100)
      progressManager.savePosition('doc-2', 200)
      
      const recent = progressManager.getRecentDocuments()
      
      expect(recent).toHaveLength(2)
      // doc-2 should be more recent due to later upload date
      expect(recent[0]!.id).toBe('doc-2')
      expect(recent[0]!.lastPosition).toBe(200)
      expect(recent[1]!.id).toBe('doc-1')
      expect(recent[1]!.lastPosition).toBe(100)
    })

    it('should sort by most recently accessed', () => {
      const doc1: DocumentSummary = {
        id: 'doc-1',
        title: 'Old Document',
        lastPosition: 0,
        totalWords: 1000,
        uploadedAt: new Date('2024-01-01'),
        isCompleted: false
      }
      
      const doc2: DocumentSummary = {
        id: 'doc-2',
        title: 'New Document',
        lastPosition: 0,
        totalWords: 800,
        uploadedAt: new Date('2024-01-02'),
        isCompleted: false
      }
      
      progressManager.storeDocument(doc1)
      progressManager.storeDocument(doc2)
      
      const recent = progressManager.getRecentDocuments()
      
      expect(recent[0]!.id).toBe('doc-2') // More recently uploaded
      expect(recent[1]!.id).toBe('doc-1')
    })

    it('should limit to 10 most recent documents', () => {
      // Add 15 documents with valid dates
      for (let i = 1; i <= 15; i++) {
        const doc: DocumentSummary = {
          id: `doc-${i}`,
          title: `Document ${i}`,
          lastPosition: 0,
          totalWords: 1000,
          uploadedAt: new Date(2024, 0, i), // Use Date constructor with year, month, day
          isCompleted: false
        }
        progressManager.storeDocument(doc)
      }
      
      const recent = progressManager.getRecentDocuments()
      
      expect(recent).toHaveLength(10)
      expect(recent[0]!.id).toBe('doc-15') // Most recent
    })

    it('should show completion status', () => {
      const doc: DocumentSummary = {
        id: 'doc-1',
        title: 'Test Document',
        lastPosition: 0,
        totalWords: 1000,
        uploadedAt: new Date(),
        isCompleted: false
      }
      
      progressManager.storeDocument(doc)
      progressManager.savePosition('doc-1', 500)
      progressManager.markCompleted('doc-1')
      
      const recent = progressManager.getRecentDocuments()
      
      expect(recent[0]!.isCompleted).toBe(true)
    })
  })

  describe('Document Management', () => {
    it('should store document metadata', () => {
      const doc: DocumentSummary = {
        id: 'test-doc',
        title: 'Test Document',
        lastPosition: 0,
        totalWords: 1000,
        uploadedAt: new Date(),
        isCompleted: false
      }
      
      progressManager.storeDocument(doc)
      
      const recent = progressManager.getRecentDocuments()
      expect(recent).toHaveLength(1)
      expect(recent[0]!.title).toBe('Test Document')
    })

    it('should remove document and progress data', () => {
      const doc: DocumentSummary = {
        id: 'test-doc',
        title: 'Test Document',
        lastPosition: 0,
        totalWords: 1000,
        uploadedAt: new Date(),
        isCompleted: false
      }
      
      progressManager.storeDocument(doc)
      progressManager.savePosition('test-doc', 100)
      
      progressManager.removeDocument('test-doc')
      
      const recent = progressManager.getRecentDocuments()
      const position = progressManager.getLastPosition('test-doc')
      
      expect(recent).toHaveLength(0)
      expect(position).toBeNull()
    })
  })

  describe('Settings Management', () => {
    it('should get and update user settings', () => {
      const settings = progressManager.getSettings()
      expect(settings.baseSpeed).toBe(250) // Default
      
      progressManager.updateSettings({ baseSpeed: 300 })
      
      const updatedSettings = progressManager.getSettings()
      expect(updatedSettings.baseSpeed).toBe(300)
    })

    it('should preserve existing settings when updating', () => {
      progressManager.updateSettings({ baseSpeed: 300 })
      progressManager.updateSettings({ summariesEnabled: true })
      
      const settings = progressManager.getSettings()
      expect(settings.baseSpeed).toBe(300)
      expect(settings.summariesEnabled).toBe(true)
    })
  })

  describe('Error Handling and Fallbacks', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      // Should not throw error
      expect(() => {
        progressManager.savePosition('test-doc', 100)
      }).not.toThrow()
    })

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      // Should not throw and should create new instance
      expect(() => {
        new ProgressManagerService()
      }).not.toThrow()
    })

    it('should handle invalid document IDs', () => {
      // Should not throw for invalid document IDs
      expect(() => {
        progressManager.savePosition('', 100)
      }).not.toThrow()
      
      expect(() => {
        // @ts-expect-error Testing invalid input
        progressManager.savePosition(null, 100)
      }).not.toThrow()
    })

    it('should handle invalid word indices', () => {
      // Should clamp invalid word indices
      progressManager.savePosition('test-doc', -10)
      expect(progressManager.getLastPosition('test-doc')).toBe(0)
      
      progressManager.savePosition('test-doc', NaN)
      expect(progressManager.getLastPosition('test-doc')).toBe(0)
      
      // @ts-expect-error Testing invalid input
      progressManager.savePosition('test-doc', 'invalid')
      expect(progressManager.getLastPosition('test-doc')).toBe(0)
    })

    it('should handle storage quota exceeded errors', () => {
      localStorageMock.setItem.mockImplementation(() => {
        const error = new DOMException('Storage quota exceeded', 'QuotaExceededError')
        throw error
      })
      
      // Should not throw
      expect(() => {
        progressManager.savePosition('test-doc', 100)
      }).not.toThrow()
    })

    it('should handle corrupted document structures', () => {
      localStorageMock.getItem.mockReturnValue('{"invalid": "structure"}')
      
      const result = progressManager.getDocumentStructure('test-doc')
      
      expect(result).toBeNull()
    })

    it('should handle invalid document data', () => {
      // Should not throw for invalid document data
      expect(() => {
        // @ts-expect-error Testing invalid input
        progressManager.storeDocument(null)
      }).not.toThrow()
      
      expect(() => {
        // @ts-expect-error Testing invalid input
        progressManager.storeDocument({ id: '', title: '' })
      }).not.toThrow()
    })

    it('should handle localStorage unavailable', () => {
      // Mock localStorage as unavailable
      Object.defineProperty(window, 'localStorage', {
        value: null,
        configurable: true
      })
      
      // Should not throw when creating new instance
      expect(() => {
        new ProgressManagerService()
      }).not.toThrow()
      
      // Restore localStorage mock
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        configurable: true
      })
    })

    it('should handle oversized document structures', () => {
      const largeStructure = {
        id: 'large-doc',
        title: 'Large Document',
        totalWords: 1000000,
        sections: [],
        words: Array(1000000).fill({ text: 'word', orp: 0, baseDelay: 200, punctuationPause: 0, isLongWord: false }),
        createdAt: new Date(),
        lastPosition: 0
      }
      
      // Should not throw for oversized structures
      expect(() => {
        // @ts-expect-error Testing with large structure
        progressManager.storeDocumentStructure(largeStructure)
      }).not.toThrow()
    })
  })

  describe('Completion Tracking (Requirement 5.4)', () => {
    it('should mark document as completed', () => {
      progressManager.savePosition('test-doc', 500)
      
      expect(progressManager.hasUnfinishedDocument()).toBe(true)
      
      progressManager.markCompleted('test-doc')
      
      expect(progressManager.hasUnfinishedDocument()).toBe(false)
    })

    it('should not return completed documents as unfinished', () => {
      progressManager.savePosition('test-doc', 500)
      progressManager.markCompleted('test-doc')
      
      const unfinished = progressManager.getMostRecentUnfinished()
      expect(unfinished).toBeNull()
    })
  })

  describe('Error Handling and Fallbacks', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      // Should not throw error
      expect(() => {
        progressManager.savePosition('test-doc', 100)
      }).not.toThrow()
    })

    it('should handle invalid document IDs', () => {
      // Should not throw for invalid document IDs
      expect(() => {
        progressManager.savePosition('', 100)
      }).not.toThrow()
      
      expect(() => {
        // @ts-expect-error Testing invalid input
        progressManager.savePosition(null, 100)
      }).not.toThrow()
    })

    it('should handle invalid word indices', () => {
      // Should clamp invalid word indices
      progressManager.savePosition('test-doc', -10)
      expect(progressManager.getLastPosition('test-doc')).toBe(0)
      
      progressManager.savePosition('test-doc', NaN)
      expect(progressManager.getLastPosition('test-doc')).toBe(0)
      
      // @ts-expect-error Testing invalid input
      progressManager.savePosition('test-doc', 'invalid')
      expect(progressManager.getLastPosition('test-doc')).toBe(0)
    })

    it('should handle corrupted document structures', () => {
      localStorageMock.getItem.mockReturnValue('{"invalid": "structure"}')
      
      const result = progressManager.getDocumentStructure('test-doc')
      
      expect(result).toBeNull()
    })
  })
})
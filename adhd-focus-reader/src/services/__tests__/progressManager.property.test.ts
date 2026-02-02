/**
 * Property-based tests for Progress Manager Service
 * Tests Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
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

describe('ProgressManagerService Property Tests', () => {
  let progressManager: ProgressManagerService

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    progressManager = new ProgressManagerService()
  })

  /**
   * **Feature: adhd-focus-reader, Property 6: Position Persistence Accuracy**
   * For any reading session, stopping and resuming should restore the exact word position 
   * without data loss or authentication requirements
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
   */
  it('should preserve exact word positions across save/load cycles', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 50 }), // documentId
      fc.integer({ min: 0, max: 10000 }), // wordIndex
      (documentId, wordIndex) => {
        // Save position
        progressManager.savePosition(documentId, wordIndex)
        
        // Retrieve position
        const retrievedPosition = progressManager.getLastPosition(documentId)
        
        // Should return exact same position
        expect(retrievedPosition).toBe(wordIndex)
      }
    ), { numRuns: 100 })
  })

  it('should handle multiple documents without position interference', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        position: fc.integer({ min: 0, max: 5000 })
      }), { minLength: 1, maxLength: 10 }),
      (documents) => {
        // Save all positions
        documents.forEach(doc => {
          progressManager.savePosition(doc.id, doc.position)
        })
        
        // Verify all positions are preserved correctly
        documents.forEach(doc => {
          const retrievedPosition = progressManager.getLastPosition(doc.id)
          expect(retrievedPosition).toBe(doc.position)
        })
      }
    ), { numRuns: 50 })
  })

  it('should maintain position accuracy after completion status changes', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), // Avoid empty/whitespace-only IDs
      fc.integer({ min: 1, max: 1000 }),
      (documentId, wordIndex) => {
        // Save position
        progressManager.savePosition(documentId, wordIndex)
        
        // Verify position exists before completion
        expect(progressManager.getLastPosition(documentId)).toBe(wordIndex)
        
        // Mark as completed
        progressManager.markCompleted(documentId)
        
        // Position should return null for completed documents
        expect(progressManager.getLastPosition(documentId)).toBeNull()
        
        // But document should still be in recent list if it was stored
        const recent = progressManager.getRecentDocuments()
        const doc = recent.find(d => d.id === documentId)
        if (doc) {
          expect(doc.isCompleted).toBe(true)
        }
      }
    ), { numRuns: 100 })
  })

  it('should correctly identify unfinished documents across various scenarios', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0 && !['toString', 'valueOf', 'constructor'].includes(s)),
        position: fc.integer({ min: 1, max: 2000 }), // Start from 1, not 0
        shouldComplete: fc.boolean()
      }), { minLength: 1, maxLength: 8 }),
      (documents) => {
        let expectedUnfinished = 0
        
        documents.forEach(doc => {
          progressManager.savePosition(doc.id, doc.position)
          if (doc.shouldComplete) {
            progressManager.markCompleted(doc.id)
          } else {
            expectedUnfinished++
          }
        })
        
        const hasUnfinished = progressManager.hasUnfinishedDocument()
        expect(hasUnfinished).toBe(expectedUnfinished > 0)
      }
    ), { numRuns: 50 })
  })

  it('should maintain document ordering consistency in recent documents list', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        totalWords: fc.integer({ min: 10, max: 5000 }),
        uploadTime: fc.integer({ min: 1000000000000, max: Date.now() }) // Valid timestamps
      }), { minLength: 2, maxLength: 15 }),
      (documents) => {
        // Store documents with different upload times
        documents.forEach(doc => {
          const docSummary: DocumentSummary = {
            id: doc.id,
            title: doc.title,
            lastPosition: 0,
            totalWords: doc.totalWords,
            uploadedAt: new Date(doc.uploadTime),
            isCompleted: false
          }
          progressManager.storeDocument(docSummary)
        })
        
        const recent = progressManager.getRecentDocuments()
        
        // Should be sorted by most recent first
        for (let i = 0; i < recent.length - 1; i++) {
          const current = recent[i]!
          const next = recent[i + 1]!
          
          expect(current.uploadedAt.getTime()).toBeGreaterThanOrEqual(next.uploadedAt.getTime())
        }
        
        // Should not exceed 10 documents
        expect(recent.length).toBeLessThanOrEqual(10)
      }
    ), { numRuns: 30 })
  })

  it('should handle settings updates without affecting document data', () => {
    fc.assert(fc.property(
      fc.record({
        baseSpeed: fc.integer({ min: 50, max: 1000 }),
        summariesEnabled: fc.boolean()
      }),
      fc.array(fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        position: fc.integer({ min: 0, max: 3000 })
      }), { minLength: 1, maxLength: 5 }),
      (settings, documents) => {
        // Save some document positions
        documents.forEach(doc => {
          progressManager.savePosition(doc.id, doc.position)
        })
        
        // Update settings
        progressManager.updateSettings(settings)
        
        // Verify settings were updated
        const updatedSettings = progressManager.getSettings()
        expect(updatedSettings.baseSpeed).toBe(settings.baseSpeed)
        expect(updatedSettings.summariesEnabled).toBe(settings.summariesEnabled)
        
        // Verify document positions are unchanged
        documents.forEach(doc => {
          const position = progressManager.getLastPosition(doc.id)
          expect(position).toBe(doc.position)
        })
      }
    ), { numRuns: 50 })
  })

  it('should handle position updates without losing document metadata', () => {
    fc.assert(fc.property(
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 20 }),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        totalWords: fc.integer({ min: 10, max: 5000 })
      }),
      fc.array(fc.integer({ min: 0, max: 2000 }), { minLength: 1, maxLength: 10 }),
      (document, positions) => {
        // Store document
        const docSummary: DocumentSummary = {
          id: document.id,
          title: document.title,
          lastPosition: 0,
          totalWords: document.totalWords,
          uploadedAt: new Date(),
          isCompleted: false
        }
        progressManager.storeDocument(docSummary)
        
        // Update position multiple times
        positions.forEach(position => {
          progressManager.savePosition(document.id, position)
        })
        
        // Verify final position is correct
        const finalPosition = positions[positions.length - 1]!
        expect(progressManager.getLastPosition(document.id)).toBe(finalPosition)
        
        // Verify document metadata is preserved
        const recent = progressManager.getRecentDocuments()
        const storedDoc = recent.find(d => d.id === document.id)
        expect(storedDoc?.title).toBe(document.title)
        expect(storedDoc?.totalWords).toBe(document.totalWords)
        expect(storedDoc?.lastPosition).toBe(finalPosition)
      }
    ), { numRuns: 50 })
  })

  it('should maintain data consistency after clear operations', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        id: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0 && !['toString', 'valueOf', 'constructor'].includes(s)),
        position: fc.integer({ min: 0, max: 1000 })
      }), { minLength: 1, maxLength: 5 }),
      (documents) => {
        // Add some data
        documents.forEach(doc => {
          progressManager.savePosition(doc.id, doc.position)
        })
        
        // Clear all data
        progressManager.clearAll()
        
        // Verify everything is cleared
        documents.forEach(doc => {
          expect(progressManager.getLastPosition(doc.id)).toBeNull()
        })
        
        expect(progressManager.getRecentDocuments()).toHaveLength(0)
        expect(progressManager.hasUnfinishedDocument()).toBe(false)
        expect(progressManager.getMostRecentUnfinished()).toBeNull()
        
        // Verify settings are reset to defaults
        const settings = progressManager.getSettings()
        expect(settings.baseSpeed).toBe(250)
        expect(settings.summariesEnabled).toBe(false)
      }
    ), { numRuns: 30 })
  })
})
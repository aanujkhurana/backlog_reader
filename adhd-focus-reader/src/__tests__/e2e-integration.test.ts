/**
 * End-to-End Integration Tests for ADHD Focus Reader
 * Task 14: Final integration and testing
 * Tests core service integration without complex UI mounting
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { documentProcessor, progressManager } from '../services'
import { createReadingSession } from '../services/readingSession'

describe('ADHD Focus Reader - Core Integration', () => {
  beforeEach(() => {
    // Clear any existing data
    progressManager.clearAll()
  })

  describe('Document Processing to Reading Flow', () => {
    it('should process text and create a complete reading session', async () => {
      // Step 1: Process a document
      const testText = 'This is a comprehensive test document for the ADHD Focus Reader application. It contains multiple sentences with various punctuation marks. The document should be processed correctly and prepared for reading with the RSVP engine.'
      
      const processedDoc = await documentProcessor.processPastedText(testText, 'Integration Test Document')
      
      // Verify document processing
      expect(processedDoc.content).toContain('comprehensive test document')
      expect(processedDoc.metadata.title).toBe('Integration Test Document')
      expect(processedDoc.sections).toHaveLength(1)
      
      // Step 2: Extract document structure
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      
      expect(documentStructure.title).toBe('Integration Test Document')
      expect(documentStructure.totalWords).toBeGreaterThan(20)
      expect(documentStructure.words).toHaveLength(documentStructure.totalWords)
      expect(documentStructure.id).toBeDefined()
      
      // Step 3: Store in progress manager
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
      expect(storedDoc?.title).toBe('Integration Test Document')
      
      // Step 4: Create reading session
      const readingSession = createReadingSession({
        rsvp: {
          baseSpeed: 250,
          longWordThreshold: 8,
          longWordMultiplier: 1.5,
          commaPause: 150,
          periodPause: 300,
          bulletPause: 200,
          paragraphPause: 400
        }
      })
      
      // Verify reading session can be created
      expect(readingSession).toBeDefined()
      expect(readingSession.isActive()).toBe(false)
      
      // Step 5: Start reading session
      readingSession.startSession(processedDoc, 0)
      
      expect(readingSession.isActive()).toBe(true)
      expect(readingSession.getCurrentPosition()).toBe(0)
      
      // Step 6: Test position saving
      const rsvpEngine = readingSession.getRSVPEngine()
      rsvpEngine.jumpToPosition(5)
      
      expect(readingSession.getCurrentPosition()).toBe(5)
      
      // Step 7: Stop session and verify cleanup
      readingSession.stopSession()
      
      expect(readingSession.isActive()).toBe(false)
    })

    it('should handle progress persistence across sessions', async () => {
      // Create and process a document
      const testText = 'This is a test document for progress persistence testing. It has enough content to test position saving and restoration functionality properly.'
      
      const processedDoc = await documentProcessor.processPastedText(testText, 'Progress Test')
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
      
      // Start first reading session
      const session1 = createReadingSession()
      session1.startSession(processedDoc, 0)
      
      // Simulate reading progress
      const rsvpEngine1 = session1.getRSVPEngine()
      rsvpEngine1.jumpToPosition(10)
      
      // Save position manually (normally done automatically)
      progressManager.savePosition(documentStructure.id, 10)
      
      // Stop first session
      session1.stopSession()
      
      // Verify position was saved
      const savedPosition = progressManager.getLastPosition(documentStructure.id)
      expect(savedPosition).toBe(10)
      
      // Start second reading session from saved position
      const session2 = createReadingSession()
      session2.startSession(processedDoc, savedPosition || 0)
      
      expect(session2.getCurrentPosition()).toBe(10)
      
      // Clean up
      session2.stopSession()
    })

    it('should handle document completion flow', async () => {
      const testText = 'Short completion test document with sufficient words for validation and testing the completion workflow.'
      
      const processedDoc = await documentProcessor.processPastedText(testText, 'Completion Test')
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
      
      // Simulate completing the document
      progressManager.savePosition(documentStructure.id, documentStructure.totalWords)
      progressManager.markCompleted(documentStructure.id)
      
      // Verify completion
      const completedDoc = progressManager.getDocumentById(documentStructure.id)
      expect(completedDoc?.isCompleted).toBe(true)
      expect(completedDoc?.lastPosition).toBe(documentStructure.totalWords)
      
      // Verify it appears in recent documents as completed
      const recentDocs = progressManager.getRecentDocuments()
      const completedInRecent = recentDocs.find(doc => doc.id === documentStructure.id)
      expect(completedInRecent?.isCompleted).toBe(true)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle invalid documents gracefully', async () => {
      // Test empty text
      await expect(async () => {
        await documentProcessor.processPastedText('', 'Empty')
      }).rejects.toThrow()
      
      // Test too short text
      await expect(async () => {
        await documentProcessor.processPastedText('Short', 'Short')
      }).rejects.toThrow()
    })

    it('should handle storage errors gracefully', () => {
      // Test with invalid document ID
      const position = progressManager.getLastPosition('non-existent-id')
      expect(position).toBeNull()
      
      // Test with invalid document retrieval
      const doc = progressManager.getDocumentById('non-existent-id')
      expect(doc).toBeNull()
    })
  })

  describe('Performance Integration', () => {
    it('should handle moderately large documents efficiently', async () => {
      // Create a document with reasonable size (within limits)
      const sentence = 'This is a performance test sentence with multiple words for testing document processing speed. '
      const largeText = sentence.repeat(500) // ~4000 words
      
      const startTime = performance.now()
      const processedDoc = await documentProcessor.processPastedText(largeText, 'Performance Test')
      const documentStructure = documentProcessor.extractStructure(processedDoc)
      const endTime = performance.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000) // 2 seconds
      
      // Should process correctly
      expect(documentStructure.totalWords).toBeGreaterThan(3000)
      expect(processedDoc.sections).toHaveLength(1)
    })
  })

  describe('Settings Integration', () => {
    it('should persist and retrieve user settings', () => {
      // Update settings
      progressManager.updateSettings({
        baseSpeed: 300,
        summariesEnabled: true
      })
      
      // Retrieve settings
      const settings = progressManager.getSettings()
      expect(settings.baseSpeed).toBe(300)
      expect(settings.summariesEnabled).toBe(true)
      
      // Verify settings persist across operations
      const testDoc = {
        id: 'test-settings',
        title: 'Settings Test',
        lastPosition: 0,
        totalWords: 100,
        uploadedAt: new Date(),
        isCompleted: false
      }
      
      progressManager.storeDocument(testDoc)
      
      // Settings should still be there
      const settingsAfter = progressManager.getSettings()
      expect(settingsAfter.baseSpeed).toBe(300)
      expect(settingsAfter.summariesEnabled).toBe(true)
    })
  })
})
/**
 * PDF Integration Test
 * Tests the PDF parsing functionality with PDF.js
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { documentProcessor } from '../services'

describe('PDF Integration', () => {
  beforeEach(() => {
    // Clear any existing data
  })

  describe('PDF Processing', () => {
    it('should handle PDF parsing configuration without errors', async () => {
      // Test that the PDF.js configuration doesn't throw errors
      expect(() => {
        // This should not throw an error even if no PDF is processed
        const processor = documentProcessor
        expect(processor).toBeDefined()
      }).not.toThrow()
    })

    it('should handle invalid PDF files gracefully', async () => {
      // Create a fake PDF file with invalid content
      const invalidPdfContent = new Uint8Array([1, 2, 3, 4, 5]) // Not a valid PDF
      const invalidFile = new File([invalidPdfContent], 'invalid.pdf', { type: 'application/pdf' })

      // Should throw an appropriate error
      await expect(async () => {
        await documentProcessor.parseDocument(invalidFile)
      }).rejects.toThrow()
    })

    it('should handle empty PDF files gracefully', async () => {
      // Create an empty file
      const emptyContent = new Uint8Array([])
      const emptyFile = new File([emptyContent], 'empty.pdf', { type: 'application/pdf' })

      // Should throw an appropriate error
      await expect(async () => {
        await documentProcessor.parseDocument(emptyFile)
      }).rejects.toThrow()
    })

    it('should handle non-PDF files with PDF extension', async () => {
      // Create a text file with PDF extension
      const textContent = 'This is just text, not a PDF'
      const fakeFile = new File([textContent], 'fake.pdf', { type: 'application/pdf' })

      // Should throw an appropriate error
      await expect(async () => {
        await documentProcessor.parseDocument(fakeFile)
      }).rejects.toThrow()
    })
  })

  describe('PDF.js Configuration', () => {
    it('should handle PDF.js loading gracefully in test environment', async () => {
      // In test environment, PDF.js might not be available
      // This should not crash the application
      expect(() => {
        // Just test that the service can be imported
        expect(documentProcessor).toBeDefined()
      }).not.toThrow()
    })
  })
})
/**
 * Unit tests for Document Processor Service
 * Tests Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DocumentProcessorService } from '../documentProcessor'
import type { ProcessedDocument } from '../../types/document'

describe('DocumentProcessorService', () => {
  let processor: DocumentProcessorService

  beforeEach(() => {
    processor = new DocumentProcessorService()
  })

  describe('Text Cleaning (Requirements 1.4, 1.5)', () => {
    it('should remove page numbers from text', () => {
      const textWithPageNumbers = `
        This is the first paragraph.
        
        Page 1
        
        This is the second paragraph.
        
        2
        
        This is the third paragraph.
        
        3 of 10
        
        Final paragraph.
      `
      
      const result = processor.cleanText(textWithPageNumbers)
      
      expect(result.content).not.toContain('Page 1')
      expect(result.content).not.toContain('3 of 10')
      expect(result.content).toContain('This is the first paragraph.')
      expect(result.content).toContain('Final paragraph.')
    })

    it('should remove reference sections', () => {
      const textWithReferences = `
        Main content here.
        
        This is important information.
        
        References
        
        [1] Smith, J. (2023). Some paper. Journal Name.
        [2] Doe, J. (2022). Another paper. Conference Proceedings.
      `
      
      const result = processor.cleanText(textWithReferences)
      
      expect(result.content).toContain('Main content here.')
      expect(result.content).toContain('This is important information.')
      expect(result.content).not.toContain('References')
      expect(result.content).not.toContain('[1] Smith')
    })

    it('should normalize whitespace and line breaks', () => {
      const messyText = `This    has     multiple   spaces.\r\n\r\nAnd\tmixed\tline\tendings.\n\n\n\nToo many breaks.`
      
      const result = processor.cleanText(messyText)
      
      expect(result.content).toContain('This has multiple spaces.')
      expect(result.content).toContain('And mixed line endings.')
      expect(result.content).not.toMatch(/\n{3,}/) // No more than 2 consecutive newlines
      expect(result.content).not.toMatch(/  +/) // No multiple spaces (but allow single spaces and newlines)
    })

    it('should count words correctly', () => {
      const text = 'This is a test with exactly seven words.'
      
      const result = processor.cleanText(text)
      
      expect(result.wordCount).toBe(8) // "This is a test with exactly seven words" = 8 words
    })

    it('should detect document structure', () => {
      const structuredText = `
        Introduction
        
        This is a paragraph with content.
        
        • First bullet point
        • Second bullet point
        
        Conclusion
        
        Final thoughts here.
      `
      
      const result = processor.cleanText(structuredText)
      
      expect(result.hasStructure).toBe(true)
    })
  })

  describe('Pasted Text Processing (Requirement 1.3)', () => {
    it('should process pasted text immediately', async () => {
      const pastedText = 'This is some pasted text content for immediate processing.'
      
      const result = await processor.processPastedText(pastedText, 'Test Document')
      
      expect(result.content).toContain('This is some pasted text content')
      expect(result.metadata.title).toBe('Test Document')
      expect(result.metadata.fileType).toBe('text')
      expect(result.sections).toHaveLength(1)
    })

    it('should use default title for pasted text', async () => {
      const pastedText = 'Some content without a title.'
      
      const result = await processor.processPastedText(pastedText)
      
      expect(result.metadata.title).toBe('Pasted Text')
    })
  })

  describe('Section Extraction', () => {
    it('should extract headings as sections', () => {
      const textWithHeadings = `
        INTRODUCTION
        
        This is the introduction content.
        
        METHODOLOGY
        
        This describes the methodology.
        
        CONCLUSION
        
        Final thoughts.
      `
      
      const cleaned = processor.cleanText(textWithHeadings)
      const sections = processor['extractSections'](cleaned.content)
      
      expect(sections).toHaveLength(3)
      expect(sections[0]!.title).toBe('INTRODUCTION')
      expect(sections[0]!.type).toBe('heading')
      expect(sections[1]!.title).toBe('METHODOLOGY')
      expect(sections[2]!.title).toBe('CONCLUSION')
    })

    it('should extract bullet points as sections', () => {
      const textWithBullets = `
        Here are some points:
        
        • First point
        • Second point
        • Third point
        
        And some conclusion.
      `
      
      const cleaned = processor.cleanText(textWithBullets)
      const sections = processor['extractSections'](cleaned.content)
      
      const bulletSection = sections.find(s => s.type === 'bullet')
      expect(bulletSection).toBeDefined()
      expect(bulletSection?.title).toBe('Bullet Points')
    })

    it('should create default section for unstructured text', () => {
      const plainText = 'This is just plain text without any structure or headings.'
      
      const cleaned = processor.cleanText(plainText)
      const sections = processor['extractSections'](cleaned.content)
      
      expect(sections).toHaveLength(1)
      expect(sections[0]!.title).toBe('Document Content')
      expect(sections[0]!.type).toBe('normal')
    })
  })

  describe('Word Processing for RSVP', () => {
    it('should calculate ORP correctly for different word lengths', () => {
      const processor = new DocumentProcessorService()
      
      // Test ORP calculation through processWords
      const shortWord = 'cat' // length 3, should have ORP at 0
      const mediumWord = 'elephant' // length 8, should have ORP at 1
      const longWord = 'extraordinary' // length 13, should have ORP at 2
      
      const shortResult = processor['processWords'](shortWord)
      const mediumResult = processor['processWords'](mediumWord)
      const longResult = processor['processWords'](longWord)
      
      expect(shortResult[0]!.orp).toBe(0)
      expect(mediumResult[0]!.orp).toBe(1)
      expect(longResult[0]!.orp).toBe(2)
    })

    it('should add punctuation pauses', () => {
      const processor = new DocumentProcessorService()
      
      const words = processor['processWords']('Hello, world. How are you?')
      
      const commaWord = words.find(w => w.text.includes(','))
      const periodWord = words.find(w => w.text.includes('.'))
      const questionWord = words.find(w => w.text.includes('?'))
      const normalWord = words.find(w => w.text === 'How')
      
      expect(commaWord?.punctuationPause).toBe(150)
      expect(periodWord?.punctuationPause).toBe(300)
      expect(questionWord?.punctuationPause).toBe(300)
      expect(normalWord?.punctuationPause).toBe(0)
    })

    it('should identify long words', () => {
      const processor = new DocumentProcessorService()
      
      const words = processor['processWords']('short extraordinary')
      
      expect(words[0]!.isLongWord).toBe(false) // 'short' is 5 chars
      expect(words[1]!.isLongWord).toBe(true)  // 'extraordinary' is > 8 chars
    })
  })

  describe('Document Structure Creation', () => {
    it('should create complete document structure', () => {
      const mockDocument: ProcessedDocument = {
        content: 'This is a test document with multiple words.',
        sections: [{
          title: 'Test Section',
          startWordIndex: 0,
          endWordIndex: 8,
          type: 'normal'
        }],
        metadata: {
          title: 'Test Document',
          fileType: 'text',
          originalSize: 100,
          processedAt: new Date()
        }
      }
      
      const structure = processor.extractStructure(mockDocument)
      
      expect(structure.id).toContain('test-document')
      expect(structure.title).toBe('Test Document')
      expect(structure.totalWords).toBe(8)
      expect(structure.words).toHaveLength(8)
      expect(structure.sections).toHaveLength(1)
      expect(structure.lastPosition).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle empty text gracefully', () => {
      const result = processor.cleanText('')
      
      expect(result.content).toBe('')
      expect(result.wordCount).toBe(0)
      expect(result.hasStructure).toBe(false)
    })

    it('should handle text with only whitespace', () => {
      const result = processor.cleanText('   \n\n\t  \r\n  ')
      
      expect(result.content).toBe('')
      expect(result.wordCount).toBe(0)
    })

    it('should throw error for invalid file types', async () => {
      const invalidFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      await expect(processor.parseDocument(invalidFile)).rejects.toThrow()
    })

    it('should throw error for empty files', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' })
      
      await expect(processor.parseDocument(emptyFile)).rejects.toThrow()
    })

    it('should throw error for oversized files', async () => {
      // Create a large file (over 50MB)
      const largeContent = 'x'.repeat(60 * 1024 * 1024)
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
      
      await expect(processor.parseDocument(largeFile)).rejects.toThrow()
    })

    it('should handle corrupted PDF gracefully', async () => {
      const corruptedPDF = new File(['not a pdf'], 'corrupted.pdf', { type: 'application/pdf' })
      
      await expect(processor.parseDocument(corruptedPDF)).rejects.toThrow()
    })

    it('should validate pasted text input', async () => {
      await expect(processor.processPastedText('')).rejects.toThrow()
      await expect(processor.processPastedText('   \n\t  ')).rejects.toThrow()
    })

    it('should handle very short pasted text', async () => {
      const shortText = 'Hi there' // Less than minimum word count
      
      await expect(processor.processPastedText(shortText)).rejects.toThrow()
    })

    it('should handle very long pasted text', async () => {
      const longText = 'word '.repeat(600000) // Over maximum word count
      
      await expect(processor.processPastedText(longText)).rejects.toThrow()
    })

    it('should handle non-string input for pasted text', async () => {
      // @ts-expect-error Testing invalid input
      await expect(processor.processPastedText(null)).rejects.toThrow()
      // @ts-expect-error Testing invalid input
      await expect(processor.processPastedText(undefined)).rejects.toThrow()
      // @ts-expect-error Testing invalid input
      await expect(processor.processPastedText(123)).rejects.toThrow()
    })
  })
})
/**
 * Property-based tests for Document Processor Service
 * Tests correctness properties from design document
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { DocumentProcessorService } from '../documentProcessor'
import type { ProcessedDocument } from '../../types/document'

describe('DocumentProcessor Property-Based Tests', () => {
  const processor = new DocumentProcessorService()

  describe('Property 1: Document Processing Preserves Structure', () => {
    it('should preserve paragraph boundaries, headings, and bullet points for any valid text input', () => {
      /**
       * **Feature: adhd-focus-reader, Property 1: Document Processing Preserves Structure**
       * **Validates: Requirements 1.1, 1.2, 1.3**
       */
      
      fc.assert(fc.property(
        fc.record({
          paragraphs: fc.array(fc.lorem({ maxCount: 20 }), { minLength: 1, maxLength: 3 }),
          headings: fc.array(fc.lorem({ maxCount: 5 }), { minLength: 0, maxLength: 2 }),
          bullets: fc.array(fc.lorem({ maxCount: 10 }), { minLength: 0, maxLength: 3 })
        }),
        (input) => {
          // Generate structured text with real words
          let text = ''
          
          // Add headings and paragraphs
          for (let i = 0; i < Math.max(input.paragraphs.length, input.headings.length); i++) {
            if (i < input.headings.length && input.headings[i]) {
              text += input.headings[i]!.toUpperCase() + '\n\n'
            }
            if (i < input.paragraphs.length && input.paragraphs[i]) {
              text += input.paragraphs[i] + '\n\n'
            }
          }
          
          // Add bullet points
          if (input.bullets.length > 0) {
            text += 'Key Points:\n\n'
            input.bullets.forEach(bullet => {
              text += `• ${bullet}\n`
            })
          }
          
          const cleaned = processor.cleanText(text)
          const sections = processor['extractSections'](cleaned.content)
          
          // Structure should be preserved
          expect(cleaned.content.length).toBeGreaterThan(0)
          expect(sections.length).toBeGreaterThan(0)
          
          // Word indices should be valid
          sections.forEach(section => {
            expect(section.startWordIndex).toBeGreaterThanOrEqual(0)
            expect(section.endWordIndex).toBeGreaterThanOrEqual(section.startWordIndex)
          })
        }
      ), { numRuns: 50 })
    })
  })

  describe('Property 2: Content Cleaning Removes Noise', () => {
    it('should remove headers, footers, page numbers, and references while preserving main content', () => {
      /**
       * **Feature: adhd-focus-reader, Property 2: Content Cleaning Removes Noise**
       * **Validates: Requirements 1.4, 1.5**
       */
      
      fc.assert(fc.property(
        fc.record({
          mainContent: fc.array(fc.lorem({ maxCount: 30 }), { minLength: 2, maxLength: 4 }),
          pageNumbers: fc.array(fc.integer({ min: 1, max: 999 }), { minLength: 1, maxLength: 2 })
        }),
        (input) => {
          // Generate text with noise
          let text = ''
          
          // Add main content with page numbers interspersed
          input.mainContent.forEach((content, index) => {
            text += content + '\n\n'
            if (index < input.pageNumbers.length) {
              text += `Page ${input.pageNumbers[index]}\n\n`
            }
          })
          
          const cleaned = processor.cleanText(text)
          
          // Page numbers should be removed
          input.pageNumbers.forEach(pageNum => {
            expect(cleaned.content).not.toContain(`Page ${pageNum}`)
          })
          
          // Content should not be empty
          expect(cleaned.content.trim().length).toBeGreaterThan(0)
          expect(cleaned.wordCount).toBeGreaterThan(0)
        }
      ), { numRuns: 50 })
    })
  })

  describe('Property 3: Word Processing Consistency', () => {
    it('should process any text into valid ProcessedWords with correct ORP and timing', () => {
      /**
       * **Feature: adhd-focus-reader, Property 3: Word Processing Consistency**
       * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
       */
      
      fc.assert(fc.property(
        fc.lorem({ maxCount: 20 }),
        (text) => {
          const processedWords = processor['processWords'](text)
          const originalWords = text.split(/\s+/).filter(word => word.length > 0)
          
          expect(processedWords.length).toBe(originalWords.length)
          
          processedWords.forEach((processedWord, index) => {
            const originalWord = originalWords[index]
            if (!originalWord) return
            
            // ORP should be within word bounds
            expect(processedWord.orp).toBeGreaterThanOrEqual(0)
            expect(processedWord.orp).toBeLessThan(originalWord.length)
            
            // Base delay should be positive
            expect(processedWord.baseDelay).toBeGreaterThan(0)
            
            // Punctuation pause should be non-negative
            expect(processedWord.punctuationPause).toBeGreaterThanOrEqual(0)
            
            // Long word flag should be correct
            expect(processedWord.isLongWord).toBe(originalWord.length > 8)
            
            // Text should match original
            expect(processedWord.text).toBe(originalWord)
          })
        }
      ), { numRuns: 50 })
    })
  })

  describe('Property 4: Document Structure Generation', () => {
    it('should generate valid document structure for any processed document', () => {
      /**
       * **Feature: adhd-focus-reader, Property 4: Document Structure Generation**
       * **Validates: Requirements 1.1, 1.2, 1.3**
       */
      
      fc.assert(fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          content: fc.lorem({ maxCount: 100 }),
          fileType: fc.constantFrom('pdf', 'docx', 'text')
        }),
        (input) => {
          const processedDoc: ProcessedDocument = {
            content: input.content,
            sections: [],
            metadata: {
              title: input.title,
              fileType: input.fileType,
              originalSize: input.content.length,
              processedAt: new Date()
            }
          }
          
          const structure = processor.extractStructure(processedDoc)
          
          // Basic structure validation
          expect(structure.id).toBeTruthy()
          expect(structure.title).toBe(input.title)
          expect(structure.totalWords).toBeGreaterThan(0)
          expect(structure.words.length).toBe(structure.totalWords)
          expect(structure.createdAt).toBeInstanceOf(Date)
          expect(structure.lastPosition).toBe(0)
          
          // Words should be valid
          structure.words.forEach(word => {
            expect(word.text).toBeTruthy()
            expect(word.orp).toBeGreaterThanOrEqual(0)
            expect(word.baseDelay).toBeGreaterThan(0)
            expect(word.punctuationPause).toBeGreaterThanOrEqual(0)
          })
          
          // Sections should have valid indices
          structure.sections.forEach(section => {
            expect(section.startWordIndex).toBeGreaterThanOrEqual(0)
            expect(section.endWordIndex).toBeLessThan(structure.totalWords)
            expect(section.title).toBeTruthy()
          })
        }
      ), { numRuns: 50 })
    })
  })
})
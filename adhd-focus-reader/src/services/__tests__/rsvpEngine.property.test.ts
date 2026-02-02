/**
 * Property-based tests for RSVP Engine Service
 * Tests correctness properties from design document
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { RSVPEngineService } from '../rsvpEngine'
import type { ProcessedDocument, DocumentMetadata } from '../../types/document'

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  return setTimeout(cb, 16) as unknown as number
})
global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id)
})

describe('RSVPEngine Property-Based Tests', () => {
  let engine: RSVPEngineService

  beforeEach(() => {
    engine = new RSVPEngineService()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Property 3: RSVP Display Consistency', () => {
    it('should display exactly one word with correct ORP highlighting and proper contrast for any valid document', () => {
      /**
       * **Feature: adhd-focus-reader, Property 3: RSVP Display Consistency**
       * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
       */
      
      fc.assert(fc.property(
        fc.record({
          content: fc.lorem({ maxCount: 50 }).filter(text => text.trim().length > 0),
          title: fc.string({ minLength: 1, maxLength: 30 }),
          fileType: fc.constantFrom('pdf', 'docx', 'text')
        }),
        (input) => {
          const metadata: DocumentMetadata = {
            title: input.title,
            fileType: input.fileType,
            originalSize: input.content.length,
            processedAt: new Date()
          }

          const document: ProcessedDocument = {
            content: input.content,
            sections: [{
              title: 'Test Section',
              startWordIndex: 0,
              endWordIndex: input.content.split(/\s+/).length - 1,
              type: 'normal'
            }],
            metadata
          }

          engine.startReading(document)
          
          const displayState = engine.getDisplayState()
          
          // Requirement 2.1: Black background with white text
          expect(displayState.backgroundColor).toBe('#000000')
          expect(displayState.textColor).toBe('#ffffff')
          
          // Requirement 2.2: Red ORP highlighting
          expect(displayState.orpColor).toBe('#ff0000')
          
          // Requirement 2.3: No unauthorized animations (display should be stable)
          expect(displayState.isVisible).toBe(true)
          
          // Display should show exactly one word
          expect(displayState.currentWord).toBeTruthy()
          expect(displayState.orp).toBeGreaterThanOrEqual(0)
          expect(displayState.wordIndex).toBeGreaterThanOrEqual(0)
          expect(displayState.totalWords).toBeGreaterThan(0)
          
          engine.stopReading()
        }
      ), { numRuns: 50 })
    })
  })

  describe('Property 4: Adaptive Timing Calculation', () => {
    it('should calculate display duration based on word length, punctuation, and structure relative to base speed', () => {
      /**
       * **Feature: adhd-focus-reader, Property 4: Adaptive Timing Calculation**
       * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
       */
      
      fc.assert(fc.property(
        fc.record({
          words: fc.array(
            fc.record({
              text: fc.string({ minLength: 1, maxLength: 15 }),
              punctuation: fc.constantFrom('', '.', ',', '!', '?', ';', ':')
            }),
            { minLength: 1, maxLength: 20 }
          ),
          baseSpeed: fc.integer({ min: 100, max: 500 })
        }),
        (input) => {
          const content = input.words.map(w => w.text + w.punctuation).join(' ')
          
          const metadata: DocumentMetadata = {
            title: 'Test Document',
            fileType: 'text',
            originalSize: content.length,
            processedAt: new Date()
          }

          const document: ProcessedDocument = {
            content,
            sections: [{
              title: 'Test Section',
              startWordIndex: 0,
              endWordIndex: input.words.length - 1,
              type: 'normal'
            }],
            metadata
          }

          const engineWithSpeed = new RSVPEngineService({ baseSpeed: input.baseSpeed })
          
          if (!content.trim()) return // Skip empty content
          
          const displayedWords: Array<{ word: string; duration: number; pauseAfter: number }> = []
          
          engineWithSpeed.setCallbacks({
            onWordDisplay: (display) => {
              displayedWords.push({
                word: display.word,
                duration: display.duration,
                pauseAfter: display.pauseAfter
              })
            }
          })

          engineWithSpeed.startReading(document)
          
          // Let it process a few words
          vi.advanceTimersByTime(1000)
          
          // Validate all displayed words
          displayedWords.forEach(displayed => {
            // Duration should be positive and reasonable
            expect(displayed.duration).toBeGreaterThan(0)
            expect(displayed.duration).toBeLessThan(10000) // Less than 10 seconds per word
            
            // Pause should be non-negative
            expect(displayed.pauseAfter).toBeGreaterThanOrEqual(0)
            
            // Long words should have longer duration (Requirement 3.1)
            const wordLength = displayed.word.replace(/[^\w]/g, '').length
            const isLongWord = wordLength > 8
            const hasLongWordDuration = displayed.duration > 100
            
            // If it's a long word, it should have reasonable duration
            expect(!isLongWord || hasLongWordDuration).toBe(true)
            
            // Punctuation should add pauses (Requirements 3.2)
            const hasPunctuation = displayed.word.endsWith('.') || displayed.word.endsWith('!') || displayed.word.endsWith('?')
            const hasPause = displayed.pauseAfter > 0
            
            // If it has punctuation, it should have a pause
            expect(!hasPunctuation || hasPause).toBe(true)
          })
          
          engineWithSpeed.stopReading()
        }
      ), { numRuns: 50 })
    })
  })

  describe('Property 5: Keyboard Control Responsiveness', () => {
    it('should respond immediately to keyboard inputs without breaking focus for any valid session state', () => {
      /**
       * **Feature: adhd-focus-reader, Property 5: Keyboard Control Responsiveness**
       * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
       */
      
      fc.assert(fc.property(
        fc.record({
          content: fc.lorem({ maxCount: 30 }).filter(text => text.trim().length > 0),
          initialPosition: fc.integer({ min: 0, max: 10 }),
          speedAdjustment: fc.integer({ min: -5, max: 5 }),
          jumpPosition: fc.integer({ min: 0, max: 20 })
        }),
        (input) => {
          const metadata: DocumentMetadata = {
            title: 'Test Document',
            fileType: 'text',
            originalSize: input.content.length,
            processedAt: new Date()
          }

          const document: ProcessedDocument = {
            content: input.content,
            sections: [{
              title: 'Test Section',
              startWordIndex: 0,
              endWordIndex: input.content.split(/\s+/).length - 1,
              type: 'normal'
            }],
            metadata
          }

          const words = input.content.split(/\s+/).filter(w => w.length > 0)
          const safeInitialPosition = Math.min(input.initialPosition, words.length - 1)
          const safeJumpPosition = Math.min(input.jumpPosition, words.length - 1)

          engine.startReading(document, safeInitialPosition)
          
          // Test pause/resume (Requirement 4.1)
          expect(engine.isReading()).toBe(true)
          engine.pauseReading()
          expect(engine.isPaused()).toBe(true)
          engine.resumeReading()
          expect(engine.isReading()).toBe(true)
          
          // Test speed adjustment (Requirement 4.4)
          const positionBefore = engine.getCurrentPosition()
          engine.adjustSpeed(input.speedAdjustment)
          expect(engine.isReading()).toBe(true) // Should still be reading
          expect(engine.getCurrentPosition()).toBe(positionBefore) // Position shouldn't change
          
          // Test position jumping (Requirements 4.2, 4.3)
          engine.jumpToPosition(safeJumpPosition)
          expect(engine.getCurrentPosition()).toBe(safeJumpPosition)
          expect(engine.isReading()).toBe(true) // Should still be reading
          
          // All operations should maintain reading state without breaking focus
          const displayState = engine.getDisplayState()
          expect(displayState.isVisible).toBe(true)
          
          engine.stopReading()
        }
      ), { numRuns: 50 })
    })
  })

  describe('Property 6: Position Persistence Accuracy', () => {
    it('should accurately track and restore reading position for any valid document and position', () => {
      /**
       * **Feature: adhd-focus-reader, Property 6: Position Persistence Accuracy**
       * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
       */
      
      fc.assert(fc.property(
        fc.record({
          content: fc.lorem({ maxCount: 40 }).filter(text => text.trim().length > 0),
          stopPosition: fc.integer({ min: 0, max: 15 })
        }),
        (input) => {
          const metadata: DocumentMetadata = {
            title: 'Test Document',
            fileType: 'text',
            originalSize: input.content.length,
            processedAt: new Date()
          }

          const document: ProcessedDocument = {
            content: input.content,
            sections: [{
              title: 'Test Section',
              startWordIndex: 0,
              endWordIndex: input.content.split(/\s+/).length - 1,
              type: 'normal'
            }],
            metadata
          }

          if (!input.content.trim()) return // Skip empty content
          
          const words = input.content.split(/\s+/).filter(w => w.length > 0)
          const safeStopPosition = Math.min(input.stopPosition, words.length - 1)

          // Start reading and advance to a position
          engine.startReading(document)
          engine.jumpToPosition(safeStopPosition)
          
          const savedPosition = engine.getCurrentPosition()
          expect(savedPosition).toBe(safeStopPosition)
          
          // Stop and restart - position should be preserved through manual restoration
          engine.stopReading()
          
          // Restart from saved position
          engine.startReading(document, savedPosition)
          
          // Position should be exactly restored
          expect(engine.getCurrentPosition()).toBe(savedPosition)
          
          engine.stopReading()
        }
      ), { numRuns: 50 })
    })
  })

  describe('Error Boundary Properties', () => {
    it('should handle invalid inputs gracefully without corrupting state', () => {
      fc.assert(fc.property(
        fc.record({
          invalidPosition: fc.integer({ min: -100, max: 1000 }),
          invalidSpeed: fc.integer({ min: -1000, max: 2000 })
        }),
        (input) => {
          const validDocument: ProcessedDocument = {
            content: 'This is a valid test document.',
            sections: [{
              title: 'Test Section',
              startWordIndex: 0,
              endWordIndex: 5,
              type: 'normal'
            }],
            metadata: {
              title: 'Test Document',
              fileType: 'text',
              originalSize: 30,
              processedAt: new Date()
            }
          }

          engine.startReading(validDocument)
          
          // Test invalid position - should clamp to valid range
          engine.jumpToPosition(input.invalidPosition)
          const position = engine.getCurrentPosition()
          expect(position).toBeGreaterThanOrEqual(0)
          expect(position).toBeLessThan(6) // Should be within document bounds
          
          // Test invalid speed - should clamp to reasonable range
          engine.adjustSpeed(input.invalidSpeed)
          expect(engine.isReading()).toBe(true) // Should still be functional
          
          engine.stopReading()
        }
      ), { numRuns: 50 })
    })
  })
})
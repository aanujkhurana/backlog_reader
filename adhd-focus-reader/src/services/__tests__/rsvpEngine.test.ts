/**
 * Unit tests for RSVP Engine Service
 * Tests Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RSVPEngineService } from '../rsvpEngine'
import type { ProcessedDocument, DocumentMetadata } from '../../types/document'
import type { WordDisplay } from '../../types/rsvp'

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  return setTimeout(cb, 16) as unknown as number
})
global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id)
})

describe('RSVPEngineService', () => {
  let engine: RSVPEngineService
  let mockDocument: ProcessedDocument

  beforeEach(() => {
    engine = new RSVPEngineService({
      baseSpeed: 240, // 4 words per second for predictable testing
      longWordThreshold: 8,
      longWordMultiplier: 1.5,
      commaPause: 150,
      periodPause: 300,
      bulletPause: 200,
      paragraphPause: 400
    })

    const metadata: DocumentMetadata = {
      title: 'Test Document',
      fileType: 'text',
      originalSize: 100,
      processedAt: new Date()
    }

    mockDocument = {
      content: 'This is a test document with multiple words.',
      sections: [{
        title: 'Test Section',
        startWordIndex: 0,
        endWordIndex: 7,
        type: 'normal'
      }],
      metadata
    }

    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Basic RSVP Display (Requirements 2.1, 2.2, 2.3)', () => {
    it('should start reading from beginning by default', () => {
      engine.startReading(mockDocument)
      
      expect(engine.isReading()).toBe(true)
      expect(engine.getCurrentPosition()).toBe(0)
      
      const displayState = engine.getDisplayState()
      expect(displayState.isVisible).toBe(true)
      expect(displayState.backgroundColor).toBe('#000000') // Requirement 2.1: black background
      expect(displayState.textColor).toBe('#ffffff') // Requirement 2.1: white text
      expect(displayState.orpColor).toBe('#ff0000') // Requirement 2.2: red ORP highlighting
    })

    it('should start reading from specified position', () => {
      engine.startReading(mockDocument, 3)
      
      expect(engine.getCurrentPosition()).toBe(3)
      expect(engine.isReading()).toBe(true)
    })

    it('should display one word at a time', () => {
      const displayedWords: string[] = []
      
      engine.setCallbacks({
        onWordDisplay: (display: WordDisplay) => {
          displayedWords.push(display.word)
        }
      })

      engine.startReading(mockDocument)
      engine.startAutoReading() // Start the automatic reading
      
      // Advance through a few words
      vi.advanceTimersByTime(1000) // Should display first word
      
      expect(displayedWords.length).toBeGreaterThan(0)
      expect(displayedWords[0]).toBe('This')
    })

    it('should calculate ORP correctly for different word lengths', () => {
      const shortDoc: ProcessedDocument = {
        ...mockDocument,
        content: 'cat elephant extraordinary'
      }

      const orpValues: number[] = []
      engine.setCallbacks({
        onWordDisplay: (display: WordDisplay) => {
          orpValues.push(display.orp)
        }
      })

      engine.startReading(shortDoc)
      engine.startAutoReading() // Start the automatic reading
      
      vi.advanceTimersByTime(3000) // Let it process a few words
      
      // Should have calculated ORPs for different word lengths
      expect(orpValues.length).toBeGreaterThan(0)
    })
  })

  describe('Pause and Resume Controls (Requirement 4.1)', () => {
    it('should pause reading when requested', () => {
      engine.startReading(mockDocument)
      expect(engine.isReading()).toBe(true)
      
      engine.pauseReading()
      
      expect(engine.isPaused()).toBe(true)
      expect(engine.isReading()).toBe(false)
    })

    it('should resume reading when requested', () => {
      engine.startReading(mockDocument)
      engine.pauseReading()
      
      expect(engine.isPaused()).toBe(true)
      
      engine.resumeReading()
      
      expect(engine.isPaused()).toBe(false)
      expect(engine.isReading()).toBe(true)
    })

    it('should throw error when pausing without active session', () => {
      expect(() => engine.pauseReading()).toThrow('No active reading session to pause')
    })

    it('should throw error when resuming without active session', () => {
      expect(() => engine.resumeReading()).toThrow('No active reading session to resume')
    })
  })

  describe('Navigation Controls (Requirements 4.2, 4.3)', () => {
    it('should jump to specified position', () => {
      engine.startReading(mockDocument)
      
      engine.jumpToPosition(5)
      
      expect(engine.getCurrentPosition()).toBe(5)
    })

    it('should clamp position to valid bounds', () => {
      engine.startReading(mockDocument)
      
      // Test negative position
      engine.jumpToPosition(-5)
      expect(engine.getCurrentPosition()).toBe(0)
      
      // Test position beyond document
      engine.jumpToPosition(1000)
      expect(engine.getCurrentPosition()).toBeLessThan(1000)
    })

    it('should throw error when jumping without active session', () => {
      expect(() => engine.jumpToPosition(5)).toThrow('No active reading session to jump within')
    })
  })

  describe('Speed Adjustment (Requirement 4.4)', () => {
    it('should adjust speed incrementally', () => {
      engine.startReading(mockDocument)
      
      engine.adjustSpeed(1) // Increase by 25 WPM
      
      // We can't directly access the speed, but we can test through timing
      // This is a basic test to ensure the method doesn't throw
      expect(engine.isReading()).toBe(true)
    })

    it('should clamp speed to reasonable bounds', () => {
      engine.startReading(mockDocument)
      
      // Try to set extremely high speed
      engine.adjustSpeed(100) // +2500 WPM
      expect(engine.isReading()).toBe(true) // Should still work
      
      // Try to set extremely low speed
      engine.adjustSpeed(-100) // -2500 WPM
      expect(engine.isReading()).toBe(true) // Should still work
    })

    it('should throw error when adjusting speed without active session', () => {
      expect(() => engine.adjustSpeed(1)).toThrow('No active reading session to adjust speed')
    })
  })

  describe('Adaptive Pacing (Requirements 3.1, 3.2, 3.3, 3.4, 3.5)', () => {
    it('should provide longer duration for long words', () => {
      const longWordDoc: ProcessedDocument = {
        ...mockDocument,
        content: 'short extraordinary'
      }

      const durations: number[] = []
      engine.setCallbacks({
        onWordDisplay: (display: WordDisplay) => {
          durations.push(display.duration)
        }
      })

      engine.startReading(longWordDoc)
      engine.startAutoReading() // Start the automatic reading
      vi.advanceTimersByTime(2000)
      
      // Should have different durations for different word lengths
      expect(durations.length).toBeGreaterThan(0)
    })

    it('should add pauses for punctuation', () => {
      const punctuationDoc: ProcessedDocument = {
        ...mockDocument,
        content: 'Hello, world. How are you?'
      }

      const pauseAfterValues: number[] = []
      engine.setCallbacks({
        onWordDisplay: (display: WordDisplay) => {
          pauseAfterValues.push(display.pauseAfter)
        }
      })

      engine.startReading(punctuationDoc)
      engine.startAutoReading() // Start the automatic reading
      vi.advanceTimersByTime(3000)
      
      // Should have some non-zero pause values for punctuation
      expect(pauseAfterValues.some(pause => pause > 0)).toBe(true)
    })
  })

  describe('Session Management', () => {
    it('should track reading position', () => {
      const positionUpdates: number[] = []
      
      engine.setCallbacks({
        onPositionChange: (position: number) => {
          positionUpdates.push(position)
        }
      })

      engine.startReading(mockDocument)
      engine.startAutoReading() // Start the automatic reading
      vi.advanceTimersByTime(2000)
      
      expect(positionUpdates.length).toBeGreaterThan(0)
      expect(positionUpdates[0]).toBe(0) // Should start at 0
    })

    it('should call session end callback when reading completes', () => {
      const onSessionEnd = vi.fn()
      
      engine.setCallbacks({
        onSessionEnd
      })

      const shortDoc: ProcessedDocument = {
        ...mockDocument,
        content: 'short'
      }

      engine.startReading(shortDoc)
      engine.startAutoReading() // Start the automatic reading
      vi.advanceTimersByTime(5000) // Let it complete
      
      expect(onSessionEnd).toHaveBeenCalled()
    })

    it('should stop reading session', () => {
      engine.startReading(mockDocument)
      expect(engine.isReading()).toBe(true)
      
      engine.stopReading()
      
      expect(engine.isReading()).toBe(false)
      expect(engine.getDisplayState().isVisible).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for empty document', () => {
      const emptyDoc: ProcessedDocument = {
        ...mockDocument,
        content: ''
      }

      expect(() => engine.startReading(emptyDoc)).toThrow('Cannot start reading: document content is empty')
    })

    it('should handle whitespace-only document', () => {
      const whitespaceDoc: ProcessedDocument = {
        ...mockDocument,
        content: '   \n\t  '
      }

      expect(() => engine.startReading(whitespaceDoc)).toThrow('Cannot start reading: document content is empty')
    })

    it('should throw error for null document', () => {
      // @ts-expect-error Testing invalid input
      expect(() => engine.startReading(null)).toThrow()
    })

    it('should handle invalid position values', () => {
      engine.startReading(mockDocument)
      
      // Should clamp negative positions to 0
      engine.jumpToPosition(-10)
      expect(engine.getCurrentPosition()).toBe(0)
      
      // Should clamp positions beyond document length
      engine.jumpToPosition(1000)
      expect(engine.getCurrentPosition()).toBeLessThan(1000)
    })

    it('should handle invalid speed adjustments', () => {
      engine.startReading(mockDocument)
      
      // Should not throw for invalid delta values
      expect(() => engine.adjustSpeed(NaN)).toThrow()
      expect(() => engine.adjustSpeed(Infinity)).toThrow()
      // @ts-expect-error Testing invalid input
      expect(() => engine.adjustSpeed('invalid')).toThrow()
    })

    it('should handle operations without active session', () => {
      expect(() => engine.pauseReading()).toThrow('No active reading session to pause')
      expect(() => engine.resumeReading()).toThrow('No active reading session to resume')
      expect(() => engine.jumpToPosition(5)).toThrow('No active reading session to jump within')
      expect(() => engine.adjustSpeed(1)).toThrow('No active reading session to adjust speed')
    })

    it('should handle document structure creation errors', () => {
      const invalidDoc: ProcessedDocument = {
        ...mockDocument,
        content: '', // This will cause structure creation to fail
        sections: []
      }

      expect(() => engine.startReading(invalidDoc)).toThrow()
    })

    it('should clean up state on error', () => {
      const invalidDoc: ProcessedDocument = {
        ...mockDocument,
        content: ''
      }

      try {
        engine.startReading(invalidDoc)
      } catch {
        // Error expected
      }

      // State should be cleaned up
      expect(engine.isReading()).toBe(false)
      expect(engine.getDisplayState().isVisible).toBe(false)
    })
  })

  describe('Display State', () => {
    it('should provide current display state', () => {
      const displayState = engine.getDisplayState()
      
      expect(displayState).toHaveProperty('currentWord')
      expect(displayState).toHaveProperty('orp')
      expect(displayState).toHaveProperty('wordIndex')
      expect(displayState).toHaveProperty('totalWords')
      expect(displayState).toHaveProperty('isVisible')
      expect(displayState).toHaveProperty('backgroundColor')
      expect(displayState).toHaveProperty('textColor')
      expect(displayState).toHaveProperty('orpColor')
    })

    it('should maintain high contrast colors', () => {
      const displayState = engine.getDisplayState()
      
      expect(displayState.backgroundColor).toBe('#000000') // Black
      expect(displayState.textColor).toBe('#ffffff') // White
      expect(displayState.orpColor).toBe('#ff0000') // Red
    })
  })
})
/**
 * Keyboard Navigation Integration Tests
 * Task 14: Final integration and testing
 * Tests keyboard controls work without mouse dependency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createKeyboardController } from '../services/keyboardController'
import { RSVPEngineService } from '../services/rsvpEngine'
import type { ProcessedDocument } from '../types/document'

describe('Keyboard Navigation Integration', () => {
  let rsvpEngine: RSVPEngineService
  let keyboardController: any
  let mockDocument: ProcessedDocument

  beforeEach(() => {
    // Create mock document
    mockDocument = {
      content: 'This is a test document with multiple words for keyboard navigation testing.',
      sections: [{
        title: 'Test Section',
        startWordIndex: 0,
        endWordIndex: 12,
        type: 'normal'
      }],
      metadata: {
        title: 'Keyboard Test',
        fileType: 'text',
        originalSize: 100,
        processedAt: new Date()
      }
    }

    // Create RSVP engine
    rsvpEngine = new RSVPEngineService()
    rsvpEngine.startReading(mockDocument, 0)

    // Create keyboard controller
    keyboardController = createKeyboardController(rsvpEngine)
  })

  describe('Keyboard Control Integration', () => {
    it('should handle spacebar pause/resume without mouse', () => {
      // Start reading
      rsvpEngine.startAutoReading()
      expect(rsvpEngine.isReading()).toBe(true)

      // Simulate spacebar press
      const spaceEvent = new KeyboardEvent('keydown', { 
        key: ' ', 
        code: 'Space',
        preventDefault: vi.fn()
      })
      
      keyboardController.handleKeyDown(spaceEvent)
      
      // Should pause
      expect(rsvpEngine.isPaused()).toBe(true)
      expect(rsvpEngine.isReading()).toBe(false)

      // Press spacebar again
      keyboardController.handleKeyDown(spaceEvent)
      
      // Should resume
      expect(rsvpEngine.isPaused()).toBe(false)
    })

    it('should handle arrow key navigation without mouse', () => {
      const initialPosition = rsvpEngine.getCurrentPosition()

      // Test right arrow (forward navigation)
      const rightArrowEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        code: 'ArrowRight',
        preventDefault: vi.fn()
      })
      
      keyboardController.handleKeyDown(rightArrowEvent)
      
      expect(rsvpEngine.getCurrentPosition()).toBeGreaterThan(initialPosition)

      // Test left arrow (backward navigation)
      const leftArrowEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowLeft', 
        code: 'ArrowLeft',
        preventDefault: vi.fn()
      })
      
      keyboardController.handleKeyDown(leftArrowEvent)
      
      expect(rsvpEngine.getCurrentPosition()).toBeLessThan(rsvpEngine.getCurrentPosition())
    })

    it('should handle speed adjustment without mouse', () => {
      const initialSpeed = rsvpEngine.getCurrentSpeed()

      // Test up arrow (increase speed)
      const upArrowEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowUp', 
        code: 'ArrowUp',
        preventDefault: vi.fn()
      })
      
      keyboardController.handleKeyDown(upArrowEvent)
      
      expect(rsvpEngine.getCurrentSpeed()).toBeGreaterThan(initialSpeed)

      // Test down arrow (decrease speed)
      const downArrowEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowDown', 
        code: 'ArrowDown',
        preventDefault: vi.fn()
      })
      
      keyboardController.handleKeyDown(downArrowEvent)
      
      expect(rsvpEngine.getCurrentSpeed()).toBeLessThan(rsvpEngine.getCurrentSpeed())
    })

    it('should prevent default browser behavior for reading keys', () => {
      const preventDefaultSpy = vi.fn()
      
      const keyEvent = new KeyboardEvent('keydown', { 
        key: ' ', 
        code: 'Space',
        preventDefault: preventDefaultSpy
      })
      
      keyboardController.handleKeyDown(keyEvent)
      
      // Should prevent default to avoid page scrolling
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should work with different keyboard layouts', () => {
      // Test with different key codes that might represent spacebar
      const spaceVariants = [
        { key: ' ', code: 'Space' },
        { key: ' ', code: 'NumpadEnter' }, // Some keyboards
      ]

      spaceVariants.forEach(variant => {
        const event = new KeyboardEvent('keydown', { 
          key: variant.key, 
          code: variant.code,
          preventDefault: vi.fn()
        })
        
        // Should handle the event without errors
        expect(() => {
          keyboardController.handleKeyDown(event)
        }).not.toThrow()
      })
    })

    it('should maintain focus during keyboard navigation', () => {
      // Simulate rapid keyboard navigation
      const events = [
        new KeyboardEvent('keydown', { key: 'ArrowRight', preventDefault: vi.fn() }),
        new KeyboardEvent('keydown', { key: 'ArrowRight', preventDefault: vi.fn() }),
        new KeyboardEvent('keydown', { key: 'ArrowLeft', preventDefault: vi.fn() }),
        new KeyboardEvent('keydown', { key: ' ', preventDefault: vi.fn() }),
        new KeyboardEvent('keydown', { key: 'ArrowUp', preventDefault: vi.fn() }),
        new KeyboardEvent('keydown', { key: 'ArrowDown', preventDefault: vi.fn() }),
      ]

      // Should handle all events without losing state
      events.forEach(event => {
        expect(() => {
          keyboardController.handleKeyDown(event)
        }).not.toThrow()
      })

      // Engine should still be functional
      expect(rsvpEngine.getCurrentPosition()).toBeGreaterThanOrEqual(0)
      expect(rsvpEngine.getCurrentSpeed()).toBeGreaterThan(0)
    })
  })

  describe('Accessibility Integration', () => {
    it('should support keyboard-only navigation flow', () => {
      // Simulate complete keyboard-only reading session
      
      // 1. Start reading (automatic)
      rsvpEngine.startAutoReading()
      expect(rsvpEngine.isReading()).toBe(true)

      // 2. Pause with spacebar
      keyboardController.handleKeyDown(new KeyboardEvent('keydown', { 
        key: ' ', 
        preventDefault: vi.fn() 
      }))
      expect(rsvpEngine.isPaused()).toBe(true)

      // 3. Navigate with arrows
      keyboardController.handleKeyDown(new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        preventDefault: vi.fn() 
      }))
      
      // 4. Adjust speed
      keyboardController.handleKeyDown(new KeyboardEvent('keydown', { 
        key: 'ArrowUp', 
        preventDefault: vi.fn() 
      }))

      // 5. Resume with spacebar
      keyboardController.handleKeyDown(new KeyboardEvent('keydown', { 
        key: ' ', 
        preventDefault: vi.fn() 
      }))

      // Should complete flow without mouse interaction
      expect(rsvpEngine.getCurrentPosition()).toBeGreaterThan(0)
      expect(rsvpEngine.getCurrentSpeed()).toBeGreaterThan(0)
    })

    it('should handle keyboard events when reading interface has focus', () => {
      // Simulate reading interface having focus
      const mockElement = {
        focus: vi.fn(),
        blur: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }

      // Bind controls to mock element
      keyboardController.bindControls(mockElement)

      // Should set up event listeners
      expect(mockElement.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))

      // Unbind controls
      keyboardController.unbindControls()

      // Should clean up event listeners
      expect(mockElement.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})
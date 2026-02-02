/**
 * Unit tests for Keyboard Controller Service
 * Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KeyboardControllerService } from '../keyboardController'
import type { RSVPEngine } from '../../types/rsvp'
import type { ControlConfig } from '../../types/controls'

// Mock RSVP Engine
const createMockRSVPEngine = (): RSVPEngine => ({
  startReading: vi.fn(),
  pauseReading: vi.fn(),
  resumeReading: vi.fn(),
  adjustSpeed: vi.fn(),
  jumpToPosition: vi.fn(),
  getCurrentPosition: vi.fn().mockReturnValue(10),
  getCurrentSpeed: vi.fn().mockReturnValue(250),
  setSpeed: vi.fn(),
  isReading: vi.fn().mockReturnValue(true),
  isPaused: vi.fn().mockReturnValue(false)
})

describe('KeyboardControllerService', () => {
  let mockRSVPEngine: RSVPEngine
  let keyboardController: KeyboardControllerService
  let mockEvent: KeyboardEvent

  beforeEach(() => {
    mockRSVPEngine = createMockRSVPEngine()
    keyboardController = new KeyboardControllerService(mockRSVPEngine)
    
    // Mock KeyboardEvent
    mockEvent = {
      key: '',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as KeyboardEvent
  })

  afterEach(() => {
    keyboardController.unbindControls()
    vi.clearAllMocks()
  })

  describe('Control Binding', () => {
    it('should bind controls successfully', () => {
      expect(keyboardController.isControlsBound()).toBe(false)
      
      keyboardController.bindControls()
      
      expect(keyboardController.isControlsBound()).toBe(true)
    })

    it('should unbind controls successfully', () => {
      keyboardController.bindControls()
      expect(keyboardController.isControlsBound()).toBe(true)
      
      keyboardController.unbindControls()
      
      expect(keyboardController.isControlsBound()).toBe(false)
    })

    it('should not bind controls twice', () => {
      keyboardController.bindControls()
      const firstBindState = keyboardController.isControlsBound()
      
      keyboardController.bindControls() // Second bind attempt
      
      expect(keyboardController.isControlsBound()).toBe(firstBindState)
    })
  })

  describe('Spacebar Pause/Resume - Requirement 4.1', () => {
    beforeEach(() => {
      keyboardController.bindControls()
    })

    it('should pause reading when spacebar is pressed and currently reading', () => {
      vi.mocked(mockRSVPEngine.isPaused).mockReturnValue(false)
      
      // Simulate keydown event
      const event = new KeyboardEvent('keydown', { key: ' ' })
      document.dispatchEvent(event)
      
      expect(mockRSVPEngine.pauseReading).toHaveBeenCalled()
    })

    it('should resume reading when spacebar is pressed and currently paused', () => {
      vi.mocked(mockRSVPEngine.isPaused).mockReturnValue(true)
      
      // Simulate keydown event
      const event = new KeyboardEvent('keydown', { key: ' ' })
      document.dispatchEvent(event)
      
      expect(mockRSVPEngine.resumeReading).toHaveBeenCalled()
    })
  })

  describe('Arrow Navigation - Requirements 4.2, 4.3', () => {
    beforeEach(() => {
      keyboardController.bindControls()
      vi.mocked(mockRSVPEngine.getCurrentPosition).mockReturnValue(10)
    })

    it('should jump back when left arrow is pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      document.dispatchEvent(event)
      
      // Should jump back 5 words (default jump distance) from position 10
      expect(mockRSVPEngine.jumpToPosition).toHaveBeenCalledWith(5)
    })

    it('should jump forward when right arrow is pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
      document.dispatchEvent(event)
      
      // Should jump forward 5 words (default jump distance) from position 10
      expect(mockRSVPEngine.jumpToPosition).toHaveBeenCalledWith(15)
    })

    it('should not jump to negative position when jumping back from beginning', () => {
      vi.mocked(mockRSVPEngine.getCurrentPosition).mockReturnValue(2)
      
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      document.dispatchEvent(event)
      
      // Should jump to position 0 (not negative)
      expect(mockRSVPEngine.jumpToPosition).toHaveBeenCalledWith(0)
    })
  })

  describe('Speed Adjustment - Requirement 4.4', () => {
    beforeEach(() => {
      keyboardController.bindControls()
    })

    it('should increase speed when up arrow is pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      document.dispatchEvent(event)
      
      expect(mockRSVPEngine.adjustSpeed).toHaveBeenCalledWith(1)
    })

    it('should decrease speed when down arrow is pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      document.dispatchEvent(event)
      
      expect(mockRSVPEngine.adjustSpeed).toHaveBeenCalledWith(-1)
    })
  })

  describe('Interface Invisibility - Requirement 4.5', () => {
    it('should only respond to controls when RSVP engine is active', () => {
      vi.mocked(mockRSVPEngine.isReading).mockReturnValue(false)
      vi.mocked(mockRSVPEngine.isPaused).mockReturnValue(false)
      
      keyboardController.bindControls()
      
      const event = new KeyboardEvent('keydown', { key: ' ' })
      document.dispatchEvent(event)
      
      // Should not call any RSVP engine methods when not active
      expect(mockRSVPEngine.pauseReading).not.toHaveBeenCalled()
      expect(mockRSVPEngine.resumeReading).not.toHaveBeenCalled()
    })

    it('should prevent default browser behavior for reading control keys', () => {
      keyboardController.bindControls()
      
      const preventDefault = vi.fn()
      const stopPropagation = vi.fn()
      
      const event = new KeyboardEvent('keydown', { key: ' ' })
      Object.defineProperty(event, 'preventDefault', { value: preventDefault })
      Object.defineProperty(event, 'stopPropagation', { value: stopPropagation })
      
      document.dispatchEvent(event)
      
      expect(preventDefault).toHaveBeenCalled()
      expect(stopPropagation).toHaveBeenCalled()
    })

    it('should ignore non-control keys', () => {
      keyboardController.bindControls()
      
      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)
      
      // Should not call any RSVP engine methods for non-control keys
      expect(mockRSVPEngine.pauseReading).not.toHaveBeenCalled()
      expect(mockRSVPEngine.adjustSpeed).not.toHaveBeenCalled()
      expect(mockRSVPEngine.jumpToPosition).not.toHaveBeenCalled()
    })
  })

  describe('Configuration', () => {
    it('should use custom control configuration', () => {
      const customConfig: Partial<ControlConfig> = {
        jumpDistance: 10,
        speedIncrement: 2
      }
      
      const customController = new KeyboardControllerService(mockRSVPEngine, customConfig)
      customController.bindControls()
      
      vi.mocked(mockRSVPEngine.getCurrentPosition).mockReturnValue(15)
      
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
      document.dispatchEvent(event)
      
      // Should use custom jump distance of 10
      expect(mockRSVPEngine.jumpToPosition).toHaveBeenCalledWith(5)
      
      customController.unbindControls()
    })

    it('should update configuration dynamically', () => {
      const newConfig: Partial<ControlConfig> = {
        jumpDistance: 3
      }
      
      keyboardController.updateConfig(newConfig)
      const config = keyboardController.getConfig()
      
      expect(config.jumpDistance).toBe(3)
    })

    it('should return current configuration', () => {
      const config = keyboardController.getConfig()
      
      expect(config).toHaveProperty('pauseResumeKey', ' ')
      expect(config).toHaveProperty('jumpBackKey', 'ArrowLeft')
      expect(config).toHaveProperty('jumpForwardKey', 'ArrowRight')
      expect(config).toHaveProperty('speedUpKey', 'ArrowUp')
      expect(config).toHaveProperty('speedDownKey', 'ArrowDown')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      keyboardController.bindControls()
    })

    it('should handle RSVP engine errors gracefully', () => {
      vi.mocked(mockRSVPEngine.pauseReading).mockImplementation(() => {
        throw new Error('RSVP engine error')
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const event = new KeyboardEvent('keydown', { key: ' ' })
      document.dispatchEvent(event)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error executing keyboard control action:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })
})
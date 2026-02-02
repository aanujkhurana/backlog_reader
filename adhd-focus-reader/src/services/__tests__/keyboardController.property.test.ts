/**
 * Property-based tests for Keyboard Controller Service
 * Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
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
  getCurrentPosition: vi.fn().mockReturnValue(0),
  getCurrentSpeed: vi.fn().mockReturnValue(250),
  setSpeed: vi.fn(),
  isReading: vi.fn().mockReturnValue(true),
  isPaused: vi.fn().mockReturnValue(false)
})

describe('KeyboardController Property-Based Tests', () => {
  let mockRSVPEngine: RSVPEngine
  let keyboardController: KeyboardControllerService

  beforeEach(() => {
    mockRSVPEngine = createMockRSVPEngine()
    keyboardController = new KeyboardControllerService(mockRSVPEngine)
  })

  afterEach(() => {
    keyboardController.unbindControls()
    vi.clearAllMocks()
  })

  /**
   * **Validates: Requirements 4.2, 4.3**
   * Property 5: Keyboard Control Responsiveness
   * For any keyboard input during reading, the system should respond immediately 
   * with the correct action without breaking focus
   */
  it('Property 5: Navigation commands should always result in valid positions', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 1000 }), // current position
      fc.integer({ min: 1, max: 20 }),   // jump distance
      (currentPosition, jumpDistance) => {
        // Setup
        vi.mocked(mockRSVPEngine.getCurrentPosition).mockReturnValue(currentPosition)
        
        const config: Partial<ControlConfig> = {
          jumpDistance: jumpDistance
        }
        
        const controller = new KeyboardControllerService(mockRSVPEngine, config)
        controller.bindControls()
        
        // Test jump back
        const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
        document.dispatchEvent(leftEvent)
        
        // Test jump forward  
        const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' })
        document.dispatchEvent(rightEvent)
        
        controller.unbindControls()
        
        // Verify calls were made with valid positions
        const jumpCalls = vi.mocked(mockRSVPEngine.jumpToPosition).mock.calls
        
        if (jumpCalls.length >= 2) {
          const backCall = jumpCalls[0]
          const forwardCall = jumpCalls[1]
          
          if (backCall && forwardCall) {
            const backPosition = backCall[0]
            const forwardPosition = forwardCall[0]
            
            // Jump back should never go below 0
            expect(backPosition).toBeGreaterThanOrEqual(0)
            
            // Jump forward should be greater than current position
            expect(forwardPosition).toBeGreaterThan(currentPosition)
            
            // Jump distances should match configuration
            const expectedBack = Math.max(0, currentPosition - jumpDistance)
            const expectedForward = currentPosition + jumpDistance
            
            expect(backPosition).toBe(expectedBack)
            expect(forwardPosition).toBe(expectedForward)
          }
        }
      }
    ), { numRuns: 100 })
  })

  /**
   * **Validates: Requirements 4.4**
   * Property: Speed adjustment should always stay within reasonable bounds
   */
  it('Property: Speed adjustments should be applied correctly', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 10 }), // speed increment
      fc.integer({ min: 1, max: 20 }), // number of adjustments
      (speedIncrement, numAdjustments) => {
        const config: Partial<ControlConfig> = {
          speedIncrement: speedIncrement
        }
        
        const controller = new KeyboardControllerService(mockRSVPEngine, config)
        controller.bindControls()
        
        // Apply multiple speed adjustments
        for (let i = 0; i < numAdjustments; i++) {
          const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' })
          document.dispatchEvent(upEvent)
          
          const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' })
          document.dispatchEvent(downEvent)
        }
        
        controller.unbindControls()
        
        // Verify speed adjustments were called correctly
        const adjustCalls = vi.mocked(mockRSVPEngine.adjustSpeed).mock.calls
        
        // Should have 2 calls per iteration (up and down)
        expect(adjustCalls.length).toBe(numAdjustments * 2)
        
        // Check that adjustments alternate between positive and negative
        for (let i = 0; i < adjustCalls.length; i += 2) {
          const upCall = adjustCalls[i]
          const downCall = adjustCalls[i + 1]
          
          if (upCall && downCall) {
            expect(upCall[0]).toBe(speedIncrement) // up arrow
            expect(downCall[0]).toBe(-speedIncrement) // down arrow
          }
        }
      }
    ), { numRuns: 50 })
  })

  /**
   * **Validates: Requirements 4.1**
   * Property: Pause/resume should always toggle correctly based on current state
   */
  it('Property: Pause/resume should toggle correctly for any reading state', () => {
    fc.assert(fc.property(
      fc.boolean(), // initial paused state
      fc.integer({ min: 1, max: 10 }), // number of spacebar presses
      (initialPaused, numPresses) => {
        vi.mocked(mockRSVPEngine.isPaused).mockReturnValue(initialPaused)
        
        keyboardController.bindControls()
        
        let currentPaused = initialPaused
        
        for (let i = 0; i < numPresses; i++) {
          vi.mocked(mockRSVPEngine.isPaused).mockReturnValue(currentPaused)
          
          const spaceEvent = new KeyboardEvent('keydown', { key: ' ' })
          document.dispatchEvent(spaceEvent)
          
          // Toggle the state for next iteration
          currentPaused = !currentPaused
        }
        
        keyboardController.unbindControls()
        
        // Verify correct pause/resume calls were made
        const pauseCalls = vi.mocked(mockRSVPEngine.pauseReading).mock.calls.length
        const resumeCalls = vi.mocked(mockRSVPEngine.resumeReading).mock.calls.length
        
        // Total calls should equal number of presses
        expect(pauseCalls + resumeCalls).toBe(numPresses)
        
        // If started paused, first call should be resume
        if (numPresses > 0) {
          if (initialPaused) {
            expect(resumeCalls).toBeGreaterThan(0)
          } else {
            expect(pauseCalls).toBeGreaterThan(0)
          }
        }
      }
    ), { numRuns: 50 })
  })

  /**
   * **Validates: Requirements 4.5**
   * Property: Controls should only respond when RSVP engine is active
   */
  it('Property: Controls should be ignored when RSVP engine is inactive', () => {
    fc.assert(fc.property(
      fc.boolean(), // isReading state
      fc.boolean(), // isPaused state
      fc.constantFrom(' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'), // control key
      (isReading, isPaused, controlKey) => {
        // Set up inactive state (not reading and not paused)
        const isActive = isReading || isPaused
        vi.mocked(mockRSVPEngine.isReading).mockReturnValue(isReading)
        vi.mocked(mockRSVPEngine.isPaused).mockReturnValue(isPaused)
        
        keyboardController.bindControls()
        
        const event = new KeyboardEvent('keydown', { key: controlKey })
        document.dispatchEvent(event)
        
        keyboardController.unbindControls()
        
        if (!isActive) {
          // When inactive, no RSVP engine methods should be called
          expect(mockRSVPEngine.pauseReading).not.toHaveBeenCalled()
          expect(mockRSVPEngine.resumeReading).not.toHaveBeenCalled()
          expect(mockRSVPEngine.adjustSpeed).not.toHaveBeenCalled()
          expect(mockRSVPEngine.jumpToPosition).not.toHaveBeenCalled()
        }
      }
    ), { numRuns: 100 })
  })

  /**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   * Property: Configuration changes should be applied consistently
   */
  it('Property: Configuration updates should affect behavior correctly', () => {
    fc.assert(fc.property(
      fc.record({
        jumpDistance: fc.integer({ min: 1, max: 50 }),
        speedIncrement: fc.integer({ min: 1, max: 5 })
      }),
      (config) => {
        keyboardController.updateConfig(config)
        const updatedConfig = keyboardController.getConfig()
        
        // Configuration should be updated
        expect(updatedConfig.jumpDistance).toBe(config.jumpDistance)
        expect(updatedConfig.speedIncrement).toBe(config.speedIncrement)
        
        // Test that the new configuration is used
        vi.mocked(mockRSVPEngine.getCurrentPosition).mockReturnValue(20)
        keyboardController.bindControls()
        
        const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
        document.dispatchEvent(leftEvent)
        
        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' })
        document.dispatchEvent(upEvent)
        
        keyboardController.unbindControls()
        
        // Verify the configuration was applied
        const jumpCalls = vi.mocked(mockRSVPEngine.jumpToPosition).mock.calls
        const speedCalls = vi.mocked(mockRSVPEngine.adjustSpeed).mock.calls
        
        if (jumpCalls.length > 0 && jumpCalls[0]) {
          const expectedPosition = Math.max(0, 20 - config.jumpDistance)
          expect(jumpCalls[0][0]).toBe(expectedPosition)
        }
        
        if (speedCalls.length > 0 && speedCalls[0]) {
          expect(speedCalls[0][0]).toBe(config.speedIncrement)
        }
      }
    ), { numRuns: 30 })
  })
})
/**
 * Keyboard Controller Service for ADHD Focus Reader
 * Implements keyboard control system for RSVP reading
 * Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type { KeyboardController, ControlAction, ControlConfig } from '../types/controls'
import type { RSVPEngine } from '../types/rsvp'

export class KeyboardControllerService implements KeyboardController {
  private rsvpEngine: RSVPEngine
  private config: ControlConfig
  private isActive: boolean = false
  private boundHandler: ((event: KeyboardEvent) => void) | null = null

  constructor(rsvpEngine: RSVPEngine, config?: Partial<ControlConfig>) {
    this.rsvpEngine = rsvpEngine
    this.config = {
      pauseResumeKey: ' ', // spacebar
      jumpBackKey: 'ArrowLeft',
      jumpForwardKey: 'ArrowRight',
      speedUpKey: 'ArrowUp',
      speedDownKey: 'ArrowDown',
      jumpDistance: 5, // words to jump back/forward
      speedIncrement: 1, // speed adjustment multiplier (25 WPM per increment)
      ...config
    }
  }

  /**
   * Bind keyboard controls for reading mode
   * Requirement 4.5: No interface elements appear during active reading
   */
  bindControls(): void {
    if (this.isActive) {
      return // Already bound
    }

    this.boundHandler = this.handleKeyboardEvent.bind(this)
    document.addEventListener('keydown', this.boundHandler, { capture: true })
    this.isActive = true
  }

  /**
   * Unbind keyboard controls when exiting reading mode
   */
  unbindControls(): void {
    if (!this.isActive || !this.boundHandler) {
      return
    }

    document.removeEventListener('keydown', this.boundHandler, { capture: true })
    this.boundHandler = null
    this.isActive = false
  }

  /**
   * Check if controls are currently bound
   */
  isControlsBound(): boolean {
    return this.isActive
  }

  /**
   * Handle keyboard events during reading
   * Requirements 4.1, 4.2, 4.3, 4.4: Process all keyboard controls
   */
  private handleKeyboardEvent(event: KeyboardEvent): void {
    // Only handle events when RSVP engine has an active session
    if (!this.rsvpEngine.isReading() && !this.rsvpEngine.isPaused()) {
      return
    }

    const action = this.mapKeyToAction(event.key)
    if (!action) {
      return // Not a reading control key
    }

    // Prevent default browser behavior for reading controls
    event.preventDefault()
    event.stopPropagation()

    this.executeAction(action)
  }

  /**
   * Map keyboard input to control actions
   */
  private mapKeyToAction(key: string): ControlAction | null {
    switch (key) {
      case this.config.pauseResumeKey:
        // Requirement 4.1: Spacebar toggles between pause and resume
        return {
          type: this.rsvpEngine.isPaused() ? 'resume' : 'pause'
        }

      case this.config.jumpBackKey:
        // Requirement 4.2: Left arrow jumps back several words
        return {
          type: 'jump-back',
          payload: this.config.jumpDistance
        }

      case this.config.jumpForwardKey:
        // Requirement 4.3: Right arrow skips forward past current position
        return {
          type: 'jump-forward',
          payload: this.config.jumpDistance
        }

      case this.config.speedUpKey:
        // Requirement 4.4: Up arrow increases reading speed
        return {
          type: 'speed-up',
          payload: this.config.speedIncrement
        }

      case this.config.speedDownKey:
        // Requirement 4.4: Down arrow decreases reading speed
        return {
          type: 'speed-down',
          payload: -this.config.speedIncrement
        }

      default:
        return null
    }
  }

  /**
   * Execute the mapped control action
   */
  private executeAction(action: ControlAction): void {
    try {
      switch (action.type) {
        case 'pause':
          this.rsvpEngine.pauseReading()
          break

        case 'resume':
          this.rsvpEngine.resumeReading()
          break

        case 'speed-up':
        case 'speed-down':
          if (action.payload !== undefined) {
            this.rsvpEngine.adjustSpeed(action.payload)
          }
          break

        case 'jump-back':
          if (action.payload !== undefined) {
            const currentPosition = this.rsvpEngine.getCurrentPosition()
            const newPosition = Math.max(0, currentPosition - action.payload)
            this.rsvpEngine.jumpToPosition(newPosition)
          }
          break

        case 'jump-forward':
          if (action.payload !== undefined) {
            const currentPosition = this.rsvpEngine.getCurrentPosition()
            const newPosition = currentPosition + action.payload
            this.rsvpEngine.jumpToPosition(newPosition)
          }
          break

        default:
          console.warn(`Unknown control action: ${action.type}`)
      }
    } catch (error) {
      console.error('Error executing keyboard control action:', error)
    }
  }

  /**
   * Update control configuration
   */
  updateConfig(newConfig: Partial<ControlConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current control configuration
   */
  getConfig(): ControlConfig {
    return { ...this.config }
  }
}

// Factory function to create keyboard controller with RSVP engine
export function createKeyboardController(
  rsvpEngine: RSVPEngine,
  config?: Partial<ControlConfig>
): KeyboardController {
  return new KeyboardControllerService(rsvpEngine, config)
}
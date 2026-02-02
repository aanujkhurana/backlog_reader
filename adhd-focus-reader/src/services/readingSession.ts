/**
 * Reading Session Service - Integrates RSVP Engine with Keyboard Controls
 * Provides a unified interface for managing reading sessions with keyboard controls
 * Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { RSVPEngineService } from './rsvpEngine'
import { KeyboardControllerService } from './keyboardController'
import { progressManager } from './progressManager'
import type { ProcessedDocument } from '../types/document'
import type { RSVPConfig } from '../types/rsvp'
import type { ControlConfig } from '../types/controls'

export interface ReadingSessionConfig {
  rsvp?: Partial<RSVPConfig>
  controls?: Partial<ControlConfig>
}

export class ReadingSessionService {
  private rsvpEngine: RSVPEngineService
  private keyboardController: KeyboardControllerService
  private isSessionActive: boolean = false
  private currentDocumentId: string | null = null
  private progressSaveInterval: number | null = null

  constructor(config?: ReadingSessionConfig) {
    this.rsvpEngine = new RSVPEngineService(config?.rsvp)
    this.keyboardController = new KeyboardControllerService(this.rsvpEngine, config?.controls)
  }

  /**
   * Start a new reading session with keyboard controls
   * Requirement 4.5: Ensure no interface elements appear during active reading
   * Requirement 5.1: Automatically save position during reading
   */
  startSession(document: ProcessedDocument, position: number = 0): void {
    if (this.isSessionActive) {
      throw new Error('A reading session is already active')
    }

    try {
      // Store document ID for progress tracking
      this.currentDocumentId = document.metadata?.title || `doc-${Date.now()}`
      
      // Start RSVP engine
      this.rsvpEngine.startReading(document, position)
      
      // Bind keyboard controls
      this.keyboardController.bindControls()
      
      // Start automatic progress saving
      this.startProgressSaving()
      
      this.isSessionActive = true
    } catch (error) {
      // Clean up on error
      this.cleanup()
      throw error
    }
  }

  /**
   * Stop the current reading session and clean up
   * Requirement 5.1: Save final position when stopping
   */
  stopSession(): void {
    if (!this.isSessionActive) {
      return
    }

    // Save final position before cleanup
    this.saveCurrentProgress()
    this.cleanup()
  }

  /**
   * Check if a reading session is currently active
   */
  isActive(): boolean {
    return this.isSessionActive
  }

  /**
   * Get the RSVP engine instance for advanced control
   */
  getRSVPEngine(): RSVPEngineService {
    return this.rsvpEngine
  }

  /**
   * Get the keyboard controller instance for configuration
   */
  getKeyboardController(): KeyboardControllerService {
    return this.keyboardController
  }

  /**
   * Update keyboard control configuration
   */
  updateControlConfig(config: Partial<ControlConfig>): void {
    this.keyboardController.updateConfig(config)
  }

  /**
   * Get current reading position
   */
  getCurrentPosition(): number {
    return this.rsvpEngine.getCurrentPosition()
  }

  /**
   * Check if reading is currently paused
   */
  isPaused(): boolean {
    return this.rsvpEngine.isPaused()
  }

  /**
   * Check if currently reading (not paused)
   */
  isReading(): boolean {
    return this.rsvpEngine.isReading()
  }

  /**
   * Mark current document as completed
   * Requirement 5.4: Track completion status
   */
  markCompleted(): void {
    if (this.currentDocumentId) {
      progressManager.markCompleted(this.currentDocumentId)
    }
  }

  /**
   * Start automatic progress saving
   * Requirement 5.1: Automatic persistence during reading
   */
  private startProgressSaving(): void {
    // Save progress every 5 seconds during active reading
    this.progressSaveInterval = window.setInterval(() => {
      this.saveCurrentProgress()
    }, 5000)
  }

  /**
   * Save current reading progress
   */
  private saveCurrentProgress(): void {
    if (this.currentDocumentId && this.isSessionActive) {
      const position = this.rsvpEngine.getCurrentPosition()
      progressManager.savePosition(this.currentDocumentId, position)
    }
  }

  private cleanup(): void {
    try {
      // Stop progress saving
      if (this.progressSaveInterval) {
        clearInterval(this.progressSaveInterval)
        this.progressSaveInterval = null
      }
      
      this.keyboardController.unbindControls()
      this.rsvpEngine.stopReading()
    } catch (error) {
      console.warn('Error during reading session cleanup:', error)
    } finally {
      this.isSessionActive = false
      this.currentDocumentId = null
    }
  }
}

/**
 * Factory function to create a reading session with default configuration
 */
export function createReadingSession(config?: ReadingSessionConfig): ReadingSessionService {
  return new ReadingSessionService(config)
}
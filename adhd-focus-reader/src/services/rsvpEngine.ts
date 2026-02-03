/**
 * RSVP Engine Service for ADHD Focus Reader
 * Implements core RSVP display logic with adaptive pacing
 * Validates Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5
 * Implements comprehensive error handling and edge cases
 */

import type {
  RSVPEngine,
  WordDisplay,
  ReadingSession,
  RSVPConfig,
  DisplayState
} from '../types/rsvp'
import type { ProcessedDocument, DocumentStructure } from '../types/document'
import type { AppError } from '../types/errors'
import { errorHandler } from './errorHandler'
import { ErrorType, ErrorSeverity, createAppError } from '../types/errors'

export class RSVPEngineService implements RSVPEngine {
  private currentSession: ReadingSession | null = null
  private documentStructure: DocumentStructure | null = null
  private displayState: DisplayState
  private animationFrameId: number | null = null
  private config: RSVPConfig
  private callbacks: {
    onWordDisplay?: (display: WordDisplay) => void
    onPositionChange?: (position: number, totalWords: number) => void
    onSessionEnd?: () => void
    onSectionComplete?: (sectionIndex: number, position: number) => void
  } = {}

  constructor(config?: Partial<RSVPConfig>) {
    this.config = {
      baseSpeed: 250, // words per minute
      longWordThreshold: 8, // characters
      longWordMultiplier: 1.5, // speed reduction factor for long words
      commaPause: 150, // milliseconds
      periodPause: 300, // milliseconds
      bulletPause: 200, // milliseconds
      paragraphPause: 400, // milliseconds
      ...config
    }

    this.displayState = {
      currentWord: '',
      orp: 0,
      wordIndex: 0,
      totalWords: 0,
      isVisible: false,
      backgroundColor: '#000000', // Requirement 2.1: black background
      textColor: '#ffffff', // Requirement 2.1: white text
      orpColor: '#ff0000' // Requirement 2.2: red ORP highlighting
    }
  }

  /**
   * Start reading a document from a specific position with comprehensive validation
   * Requirement 2.1: Show one word at a time on black background with white text
   */
  startReading(document: ProcessedDocument, position: number = 0): void {
    try {
      // Validate document
      if (!document) {
        throw createAppError(
          ErrorType.INVALID_READING_SESSION,
          'No document provided',
          ErrorSeverity.HIGH,
          {
            userMessage: 'Unable to start reading: no document provided.',
            recoverable: false
          }
        )
      }

      if (!document.content || document.content.trim().length === 0) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'Cannot start reading: document content is empty',
          ErrorSeverity.HIGH,
          {
            userMessage: 'Cannot start reading: the document appears to be empty.',
            recoverable: false
          }
        )
      }

      // Create document structure with error handling
      try {
        this.documentStructure = this.createDocumentStructure(document)
      } catch (error) {
        throw createAppError(
          ErrorType.PARSING_FAILED,
          'Failed to create document structure',
          ErrorSeverity.HIGH,
          {
            userMessage: 'Unable to prepare document for reading. Please try again.',
            context: { originalError: error },
            recoverable: true
          }
        )
      }

      // Validate and clamp position
      const validPosition = this.validatePosition(position)

      this.currentSession = {
        documentId: this.documentStructure.id,
        startTime: new Date(),
        currentPosition: validPosition,
        baseSpeed: this.config.baseSpeed,
        isPaused: false,
        summariesEnabled: false
      }

      this.displayState.wordIndex = this.currentSession.currentPosition
      this.displayState.totalWords = this.documentStructure.totalWords
      this.displayState.isVisible = true

      // Display the first word immediately
      this.displayCurrentWord()
    } catch (error) {
      // Clean up any partial state
      this.currentSession = null
      this.documentStructure = null
      this.displayState.isVisible = false

      if (error && typeof error === 'object' && 'type' in error) {
        throw error // Re-throw AppErrors
      }

      throw errorHandler.handleError(error, { 
        documentTitle: document.metadata?.title,
        position 
      })
    }
  }

  /**
   * Pause the current reading session with validation
   * Requirement 4.1: Spacebar toggles between pause and resume states
   */
  pauseReading(): void {
    if (!this.currentSession) {
      throw createAppError(
        ErrorType.INVALID_READING_SESSION,
        'No active reading session to pause',
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Cannot pause: no active reading session.',
          recoverable: false
        }
      )
    }

    try {
      this.currentSession.isPaused = true
      this.stopDisplayLoop()
    } catch (error) {
      throw errorHandler.handleError(error, { 
        action: 'pause',
        sessionId: this.currentSession.documentId 
      })
    }
  }

  /**
   * Resume the paused reading session with validation
   * Requirement 4.1: Spacebar toggles between pause and resume states
   */
  resumeReading(): void {
    if (!this.currentSession) {
      throw createAppError(
        ErrorType.INVALID_READING_SESSION,
        'No active reading session to resume',
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Cannot resume: no active reading session.',
          recoverable: false
        }
      )
    }

    try {
      this.currentSession.isPaused = false
      this.startDisplayLoop()
    } catch (error) {
      throw errorHandler.handleError(error, { 
        action: 'resume',
        sessionId: this.currentSession.documentId 
      })
    }
  }

  /**
   * Start automatic reading loop
   */
  startAutoReading(): void {
    if (!this.currentSession || this.currentSession.isPaused) {
      return
    }
    this.startDisplayLoop()
  }

  /**
   * Adjust reading speed incrementally with validation
   * Requirement 4.4: Up/down arrows adjust reading speed incrementally
   */
  adjustSpeed(delta: number): void {
    if (!this.currentSession) {
      throw createAppError(
        ErrorType.INVALID_READING_SESSION,
        'No active reading session to adjust speed',
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Cannot adjust speed: no active reading session.',
          recoverable: false
        }
      )
    }

    try {
      // Validate delta
      if (typeof delta !== 'number' || !isFinite(delta)) {
        throw createAppError(
          ErrorType.VALIDATION_ERROR,
          'Invalid speed adjustment value',
          ErrorSeverity.LOW,
          {
            userMessage: 'Invalid speed adjustment.',
            context: { delta }
          }
        )
      }

      // Adjust by 25 WPM increments, with reasonable bounds
      const newSpeed = Math.max(100, Math.min(600, this.currentSession.baseSpeed + (delta * 25)))
      this.currentSession.baseSpeed = newSpeed
      this.config.baseSpeed = newSpeed
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error // Re-throw AppErrors
      }

      throw errorHandler.handleError(error, { 
        action: 'adjustSpeed',
        delta,
        currentSpeed: this.currentSession.baseSpeed
      })
    }
  }

  /**
   * Jump to a specific word position with bounds checking
   * Requirement 4.2: Left arrow jumps back several words for re-reading
   * Requirement 4.3: Right arrow skips forward past current position
   */
  jumpToPosition(wordIndex: number): void {
    if (!this.currentSession || !this.documentStructure) {
      throw createAppError(
        ErrorType.INVALID_READING_SESSION,
        'No active reading session to jump within',
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Cannot jump to position: no active reading session.',
          recoverable: false
        }
      )
    }

    try {
      const validPosition = this.validatePosition(wordIndex)
      this.currentSession.currentPosition = validPosition
      this.displayState.wordIndex = validPosition

      // If currently reading, update display immediately
      if (!this.currentSession.isPaused) {
        this.displayCurrentWord()
      }
    } catch (error) {
      throw errorHandler.handleError(error, { 
        action: 'jump',
        targetPosition: wordIndex,
        currentPosition: this.currentSession.currentPosition,
        totalWords: this.documentStructure.totalWords
      })
    }
  }

  /**
   * Get current reading speed
   */
  getCurrentSpeed(): number {
    return this.currentSession?.baseSpeed ?? this.config.baseSpeed
  }

  /**
   * Set reading speed directly
   */
  setSpeed(speed: number): void {
    if (!this.currentSession) {
      throw new Error('No active reading session to set speed')
    }

    const newSpeed = Math.max(100, Math.min(600, speed))
    this.currentSession.baseSpeed = newSpeed
    this.config.baseSpeed = newSpeed
  }

  /**
   * Get current reading position
   */
  getCurrentPosition(): number {
    return this.currentSession?.currentPosition ?? 0
  }

  /**
   * Check if currently reading (not paused)
   */
  isReading(): boolean {
    return this.currentSession !== null && !this.currentSession.isPaused
  }

  /**
   * Check if session is paused
   */
  isPaused(): boolean {
    return this.currentSession?.isPaused ?? false
  }

  /**
   * Set callbacks for display events
   */
  setCallbacks(callbacks: {
    onWordDisplay?: (display: WordDisplay) => void
    onPositionChange?: (position: number, totalWords: number) => void
    onSessionEnd?: () => void
    onSectionComplete?: (sectionIndex: number, position: number) => void
  }): void {
    this.callbacks = callbacks
  }

  /**
   * Get current display state
   */
  getDisplayState(): DisplayState {
    return { ...this.displayState }
  }

  /**
   * Stop current reading session
   */
  stopReading(): void {
    this.stopDisplayLoop()
    this.currentSession = null
    this.displayState.isVisible = false
    this.callbacks.onSessionEnd?.()
  }

  // Private methods

  /**
   * Validate and clamp position to valid bounds
   */
  private validatePosition(position: number): number {
    if (!this.documentStructure) {
      throw createAppError(
        ErrorType.INVALID_READING_SESSION,
        'No document structure available for position validation',
        ErrorSeverity.HIGH
      )
    }

    if (typeof position !== 'number' || !isFinite(position)) {
      console.warn('Invalid position provided, defaulting to 0:', position)
      return 0
    }

    const maxPosition = Math.max(0, this.documentStructure.totalWords - 1)
    return Math.max(0, Math.min(position, maxPosition))
  }

  private createDocumentStructure(document: ProcessedDocument): DocumentStructure {
    try {
      // Simple structure creation with error handling
      const words = document.content.split(/\s+/).filter(word => word.length > 0)
      
      if (words.length === 0) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'Cannot create document structure: no words found',
          ErrorSeverity.HIGH,
          {
            userMessage: 'Document contains no readable words.',
            recoverable: false
          }
        )
      }
      
      const processedWords = words.map((word, index) => {
        try {
          return {
            text: word,
            orp: this.calculateORP(word),
            baseDelay: this.calculateBaseDelay(word),
            punctuationPause: this.calculatePunctuationPause(word),
            isLongWord: word.length > this.config.longWordThreshold
          }
        } catch (error) {
          // If individual word processing fails, use safe defaults
          console.warn(`Failed to process word at index ${index}:`, word, error)
          return {
            text: word,
            orp: 0,
            baseDelay: 250,
            punctuationPause: 0,
            isLongWord: false
          }
        }
      })

      return {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        title: document.metadata.title,
        totalWords: processedWords.length,
        sections: document.sections,
        words: processedWords,
        createdAt: new Date(),
        lastPosition: 0
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error // Re-throw AppErrors
      }

      throw createAppError(
        ErrorType.PARSING_FAILED,
        'Failed to create document structure',
        ErrorSeverity.HIGH,
        {
          userMessage: 'Unable to prepare document for reading.',
          context: { originalError: error },
          recoverable: true
        }
      )
    }
  }

  private startDisplayLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }

    let lastFrameTime = 0
    const targetFrameRate = 60 // FPS
    const frameInterval = 1000 / targetFrameRate

    const displayNextWord = (currentTime: number) => {
      if (!this.currentSession || this.currentSession.isPaused) {
        return
      }

      // Throttle to target frame rate for smooth performance
      if (currentTime - lastFrameTime < frameInterval) {
        this.animationFrameId = requestAnimationFrame(displayNextWord)
        return
      }

      lastFrameTime = currentTime

      this.displayCurrentWord()
      
      // Calculate timing for current word
      const wordDisplay = this.getCurrentWordDisplay()
      const totalDelay = wordDisplay.duration + wordDisplay.pauseAfter

      // Schedule next word using high-precision timing
      setTimeout(() => {
        if (this.currentSession && !this.currentSession.isPaused) {
          this.advanceToNextWord()
          if (this.currentSession.currentPosition < this.displayState.totalWords) {
            this.animationFrameId = requestAnimationFrame(displayNextWord)
          } else {
            // Reading complete
            this.stopReading()
          }
        }
      }, totalDelay)
    }

    this.animationFrameId = requestAnimationFrame(displayNextWord)
  }

  private stopDisplayLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private displayCurrentWord(): void {
    if (!this.documentStructure || !this.currentSession) return

    const word = this.documentStructure.words[this.currentSession.currentPosition]
    if (!word) return

    this.displayState.currentWord = word.text
    this.displayState.orp = word.orp
    this.displayState.wordIndex = this.currentSession.currentPosition

    const wordDisplay = this.getCurrentWordDisplay()
    
    // Notify callbacks
    this.callbacks.onWordDisplay?.(wordDisplay)
    this.callbacks.onPositionChange?.(
      this.currentSession.currentPosition,
      this.displayState.totalWords
    )
  }

  private getCurrentWordDisplay(): WordDisplay {
    if (!this.documentStructure || !this.currentSession) {
      return { word: '', orp: 0, duration: 0, pauseAfter: 0 }
    }

    const word = this.documentStructure.words[this.currentSession.currentPosition]
    if (!word) {
      return { word: '', orp: 0, duration: 0, pauseAfter: 0 }
    }

    const duration = this.calculateWordDuration(word)
    const pauseAfter = this.calculatePauseAfter(word)

    return {
      word: word.text,
      orp: word.orp,
      duration,
      pauseAfter
    }
  }

  private advanceToNextWord(): void {
    if (!this.currentSession) return

    const previousPosition = this.currentSession.currentPosition
    this.currentSession.currentPosition++
    
    // Check if we've completed a section
    this.checkForSectionCompletion(previousPosition, this.currentSession.currentPosition)
  }

  /**
   * Calculate display duration for a word based on adaptive pacing
   * Requirement 3.1: Automatically reduce speed for long words
   * Requirement 3.5: Apply adaptive adjustments relative to baseline
   */
  private calculateWordDuration(word: { text: string; isLongWord: boolean }): number {
    const baseWPM = this.currentSession?.baseSpeed ?? this.config.baseSpeed
    const baseDuration = (60 / baseWPM) * 1000 // Convert WPM to milliseconds per word

    // Requirement 3.1: Long words get extra time
    if (word.isLongWord) {
      return baseDuration * this.config.longWordMultiplier
    }

    return baseDuration
  }

  /**
   * Calculate pause after word based on punctuation and structure
   * Requirement 3.2: Extra pause for commas and periods
   * Requirement 3.3: Slight pause before bullet points
   * Requirement 3.4: Brief pause between paragraphs
   */
  private calculatePauseAfter(word: { text: string; punctuationPause: number }): number {
    let pause = word.punctuationPause

    // Check for structural pauses
    if (this.isAtBulletPoint()) {
      pause += this.config.bulletPause
    }

    if (this.isAtParagraphEnd()) {
      pause += this.config.paragraphPause
    }

    return pause
  }

  private isAtBulletPoint(): boolean {
    if (!this.documentStructure || !this.currentSession) return false

    const currentSection = this.getCurrentSection()
    return currentSection?.type === 'bullet'
  }

  private isAtParagraphEnd(): boolean {
    if (!this.documentStructure || !this.currentSession) return false

    const currentWord = this.documentStructure.words[this.currentSession.currentPosition]
    if (!currentWord) return false
    
    return currentWord.text.endsWith('.') || currentWord.text.endsWith('!') || currentWord.text.endsWith('?')
  }

  private getCurrentSection() {
    if (!this.documentStructure || !this.currentSession) return null

    return this.documentStructure.sections.find(section =>
      this.currentSession!.currentPosition >= section.startWordIndex &&
      this.currentSession!.currentPosition <= section.endWordIndex
    )
  }

  /**
   * Check if we've completed a section and trigger summary if enabled
   */
  private checkForSectionCompletion(previousPosition: number, currentPosition: number): void {
    if (!this.documentStructure || !this.currentSession) return

    // Find if we've crossed a section boundary
    const previousSection = this.documentStructure.sections.find(section =>
      previousPosition >= section.startWordIndex && previousPosition <= section.endWordIndex
    )
    
    const currentSection = this.documentStructure.sections.find(section =>
      currentPosition >= section.startWordIndex && currentPosition <= section.endWordIndex
    )

    // If we've moved from one section to another, the previous section is complete
    if (previousSection && currentSection && previousSection !== currentSection) {
      const sectionIndex = this.documentStructure.sections.indexOf(previousSection)
      this.callbacks.onSectionComplete?.(sectionIndex, currentPosition)
    }
    
    // Also check if we've just finished the last section
    if (previousSection && !currentSection && currentPosition >= this.documentStructure.totalWords) {
      const sectionIndex = this.documentStructure.sections.indexOf(previousSection)
      this.callbacks.onSectionComplete?.(sectionIndex, currentPosition)
    }
  }

  /**
   * Calculate Optimal Recognition Point for a word
   * Requirement 2.2: Highlight ORP in red color
   * Fixed to properly center the focus point for all word lengths
   */
  private calculateORP(word: string): number {
    const cleanWord = word.replace(/[^\w]/g, '') // Remove punctuation
    const length = cleanWord.length

    if (length === 0) return 0
    
    // Improved ORP calculation for better centering
    if (length === 1) return 0
    if (length === 2) return 0  // First character for 2-letter words
    if (length === 3) return 1  // Middle character for 3-letter words (THE -> T[H]E)
    if (length === 4) return 1  // Second character for 4-letter words (WORD -> W[O]RD)
    if (length === 5) return 2  // Third character for 5-letter words (HELLO -> HE[L]LO)
    if (length <= 8) return 2   // Third character for 6-8 letter words
    if (length <= 12) return 3  // Fourth character for 9-12 letter words
    if (length <= 16) return 4  // Fifth character for 13-16 letter words
    return Math.floor(length * 0.3) // For very long words, use 30% position
  }

  private calculateBaseDelay(word: string): number {
    const length = word.length
    if (length <= 3) return 200
    if (length <= 6) return 250
    if (length <= 9) return 300
    return 350
  }

  private calculatePunctuationPause(word: string): number {
    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
      return this.config.periodPause
    }
    if (word.endsWith(',') || word.endsWith(';') || word.endsWith(':')) {
      return this.config.commaPause
    }
    return 0
  }
}

// Export singleton instance
export const rsvpEngine = new RSVPEngineService()
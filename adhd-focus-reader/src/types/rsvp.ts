/**
 * RSVP Engine interfaces for ADHD Focus Reader
 * Validates Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { ProcessedDocument } from './document'

export interface RSVPEngine {
  startReading(document: ProcessedDocument, position?: number): void
  pauseReading(): void
  resumeReading(): void
  adjustSpeed(delta: number): void
  jumpToPosition(wordIndex: number): void
  getCurrentPosition(): number
  getCurrentSpeed(): number
  setSpeed(speed: number): void
  isReading(): boolean
  isPaused(): boolean
}

export interface WordDisplay {
  word: string
  orp: number // Optimal Recognition Point index
  duration: number // Display time in milliseconds
  pauseAfter: number // Additional pause duration
}

export interface ReadingSession {
  documentId: string
  startTime: Date
  currentPosition: number
  baseSpeed: number // words per minute
  isPaused: boolean
  summariesEnabled: boolean
}

export interface RSVPConfig {
  baseSpeed: number // words per minute
  longWordThreshold: number // characters
  longWordMultiplier: number // speed reduction factor
  commaPause: number // milliseconds
  periodPause: number // milliseconds
  bulletPause: number // milliseconds
  paragraphPause: number // milliseconds
}

export interface DisplayState {
  currentWord: string
  orp: number
  wordIndex: number
  totalWords: number
  isVisible: boolean
  backgroundColor: string
  textColor: string
  orpColor: string
}
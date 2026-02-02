/**
 * Setup screen interfaces for ADHD Focus Reader
 * Validates Requirements: 3.5, 6.3, 6.4
 */

export interface SetupConfig {
  baseSpeed: number // words per minute
  autoPacingEnabled: boolean
  summariesEnabled: boolean
}

export interface SpeedOption {
  label: string
  value: number
  description: string
}

export interface SetupState {
  documentId: string
  documentTitle: string
  totalWords: number
  selectedSpeed: number
  autoPacingEnabled: boolean
  summariesEnabled: boolean
}
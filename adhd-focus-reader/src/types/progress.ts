/**
 * Progress management interfaces for ADHD Focus Reader
 * Validates Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import type { DocumentSummary } from './document'

export interface ProgressManager {
  savePosition(documentId: string, wordIndex: number): void
  getLastPosition(documentId: string): number | null
  markCompleted(documentId: string): void
  getRecentDocuments(): DocumentSummary[]
  hasUnfinishedDocument(): boolean
  getMostRecentUnfinished(): DocumentSummary | null
}

export interface StoredProgress {
  documentId: string
  wordIndex: number
  lastUpdated: Date
  isCompleted: boolean
}

export interface LocalStorageData {
  documents: Record<string, DocumentSummary>
  progress: Record<string, StoredProgress>
  settings: UserSettings
}

export interface UserSettings {
  baseSpeed: number
  summariesEnabled: boolean
  lastUsed: Date
}
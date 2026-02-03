/**
 * Progress Manager Service for ADHD Focus Reader
 * Handles position saving, resume functionality, and local storage
 * Validates Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 * Implements comprehensive error handling and fallback mechanisms
 */

import type { 
  ProgressManager, 
  StoredProgress, 
  LocalStorageData, 
  UserSettings 
} from '../types/progress'
import type { DocumentSummary, DocumentStructure } from '../types/document'
import type { AppError, StorageHealthCheck } from '../types/errors'
import { errorHandler } from './errorHandler'
import { ErrorType, ErrorSeverity, createAppError } from '../types/errors'

const STORAGE_KEY = 'adhd-focus-reader-data'
const DEFAULT_SETTINGS: UserSettings = {
  baseSpeed: 250, // words per minute
  summariesEnabled: false,
  lastUsed: new Date()
}

export class ProgressManagerService implements ProgressManager {
  private data: LocalStorageData
  private storageAvailable: boolean = true
  private fallbackData: LocalStorageData | null = null

  constructor() {
    this.data = this.loadFromStorage()
    this.checkStorageHealth()
  }

  /**
   * Save current reading position for a document with error handling
   * Requirement 5.1: Automatically save exact word position
   */
  savePosition(documentId: string, wordIndex: number): void {
    try {
      // Validate inputs
      if (!documentId || typeof documentId !== 'string') {
        throw createAppError(
          ErrorType.VALIDATION_ERROR,
          'Invalid document ID provided',
          ErrorSeverity.LOW,
          {
            userMessage: 'Unable to save reading position.',
            context: { documentId, wordIndex }
          }
        )
      }

      if (typeof wordIndex !== 'number' || !isFinite(wordIndex) || wordIndex < 0) {
        console.warn('Invalid word index provided, using 0:', wordIndex)
        wordIndex = 0
      }

      this.data.progress[documentId] = {
        documentId,
        wordIndex,
        lastUpdated: new Date(),
        isCompleted: false
      }
      
      this.persistToStorage()
    } catch (error) {
      // Don't throw errors for position saving - just log and continue
      console.error('Failed to save reading position:', error)
      
      // Try to recover from storage errors
      if (error && typeof error === 'object' && 'type' in error) {
        const appError = error as AppError
        if (appError.type === ErrorType.LOCAL_STORAGE_FULL) {
          this.handleStorageFullError()
        }
      }
    }
  }

  /**
   * Get last saved position for a document
   * Requirement 5.2: Resume from exact saved position
   */
  getLastPosition(documentId: string): number | null {
    const progress = this.data.progress[documentId]
    return progress && !progress.isCompleted ? progress.wordIndex : null
  }

  /**
   * Mark document as completed
   * Requirement 5.4: Track completion without guilt metrics
   */
  markCompleted(documentId: string): void {
    const progress = this.data.progress[documentId]
    if (progress) {
      progress.isCompleted = true
      progress.lastUpdated = new Date()
      this.persistToStorage()
    }
  }

  /**
   * Get list of recent documents with position indicators
   * Requirement 5.4: Show recent documents with last position
   */
  getRecentDocuments(): DocumentSummary[] {
    const documents = Object.values(this.data.documents)
    
    // Sort by most recently accessed (either uploaded or read)
    return documents
      .map(doc => {
        const progress = this.data.progress[doc.id]
        return {
          ...doc,
          lastPosition: progress?.wordIndex || 0,
          isCompleted: progress?.isCompleted || false
        }
      })
      .sort((a, b) => {
        const aProgress = this.data.progress[a.id]
        const bProgress = this.data.progress[b.id]
        const aDate = aProgress?.lastUpdated ? new Date(aProgress.lastUpdated) : new Date(a.uploadedAt)
        const bDate = bProgress?.lastUpdated ? new Date(bProgress.lastUpdated) : new Date(b.uploadedAt)
        return bDate.getTime() - aDate.getTime()
      })
      .slice(0, 10) // Limit to 10 most recent
  }

  /**
   * Check if user has any unfinished documents
   * Requirement 5.2: Immediate continue reading option
   */
  hasUnfinishedDocument(): boolean {
    return Object.values(this.data.progress).some(
      progress => !progress.isCompleted && progress.wordIndex > 0
    )
  }

  /**
   * Get the most recently accessed unfinished document
   * Requirement 5.2: Show continue reading immediately
   */
  getMostRecentUnfinished(): DocumentSummary | null {
    const unfinishedProgress = Object.values(this.data.progress)
      .filter(progress => !progress.isCompleted && progress.wordIndex > 0)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())

    if (unfinishedProgress.length === 0) {
      return null
    }

    const mostRecent = unfinishedProgress[0]
    if (!mostRecent) {
      return null
    }
    
    const document = this.data.documents[mostRecent.documentId]
    
    if (!document) {
      return null
    }

    return {
      ...document,
      lastPosition: mostRecent.wordIndex,
      isCompleted: false
    }
  }

  /**
   * Get document by ID
   */
  getDocumentById(documentId: string): DocumentSummary | null {
    const document = this.data.documents[documentId]
    if (!document) {
      return null
    }

    const progress = this.data.progress[documentId]
    return {
      ...document,
      lastPosition: progress?.wordIndex || 0,
      isCompleted: progress?.isCompleted || false
    }
  }

  /**
   * Store document metadata for recent documents list with validation
   */
  storeDocument(document: DocumentSummary): void {
    try {
      // Validate document
      if (!document || !document.id || !document.title) {
        throw createAppError(
          ErrorType.VALIDATION_ERROR,
          'Invalid document data provided',
          ErrorSeverity.LOW,
          {
            userMessage: 'Unable to store document information.',
            context: { document }
          }
        )
      }

      this.data.documents[document.id] = {
        ...document,
        uploadedAt: new Date()
      }
      this.persistToStorage()
    } catch (error) {
      console.error('Failed to store document:', error)
      // Don't throw - this is not critical for app functionality
    }
  }

  /**
   * Store full document structure for reading with error handling
   */
  storeDocumentStructure(documentStructure: DocumentStructure): void {
    if (!this.storageAvailable) {
      console.warn('Storage not available, cannot store document structure')
      return
    }

    const fullDocKey = `full_doc_${documentStructure.id}`
    try {
      const serialized = JSON.stringify(documentStructure)
      
      // Check if the serialized data is too large
      if (serialized.length > 5 * 1024 * 1024) { // 5MB limit
        throw createAppError(
          ErrorType.OVERSIZED_FILE,
          'Document structure too large to store',
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'Document is too large to save for later. You can still read it now.',
            context: { documentId: documentStructure.id, size: serialized.length }
          }
        )
      }

      localStorage.setItem(fullDocKey, serialized)
    } catch (error) {
      console.error('Failed to store document structure:', error)
      
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.handleStorageFullError()
      }
      
      // Don't throw - user can still read the document
    }
  }

  /**
   * Get full document structure for reading with error recovery
   */
  getDocumentStructure(documentId: string): DocumentStructure | null {
    if (!this.storageAvailable) {
      return null
    }

    const fullDocKey = `full_doc_${documentId}`
    try {
      const stored = localStorage.getItem(fullDocKey)
      if (!stored) {
        return null
      }
      
      const parsed = JSON.parse(stored) as DocumentStructure
      
      // Validate the parsed structure
      if (!parsed.id || !parsed.words || !Array.isArray(parsed.words)) {
        throw createAppError(
          ErrorType.DATA_CORRUPTION,
          'Document structure is corrupted',
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'Document data is corrupted. Please upload the document again.',
            context: { documentId }
          }
        )
      }
      
      return parsed
    } catch (error) {
      console.error('Failed to retrieve document structure:', error)
      
      // Try to clean up corrupted data
      try {
        localStorage.removeItem(fullDocKey)
      } catch {
        // Ignore cleanup errors
      }
      
      return null
    }
  }

  /**
   * Remove document and its progress data
   */
  removeDocument(documentId: string): void {
    // Use hasOwnProperty to avoid prototype pollution
    if (Object.prototype.hasOwnProperty.call(this.data.documents, documentId)) {
      delete this.data.documents[documentId]
    }
    if (Object.prototype.hasOwnProperty.call(this.data.progress, documentId)) {
      delete this.data.progress[documentId]
    }
    
    // Also remove the full document structure
    const fullDocKey = `full_doc_${documentId}`
    try {
      localStorage.removeItem(fullDocKey)
    } catch (error) {
      console.warn('Failed to remove document structure:', error)
    }
    
    this.persistToStorage()
  }

  /**
   * Get user settings
   */
  getSettings(): UserSettings {
    return { ...this.data.settings }
  }

  /**
   * Update user settings
   */
  updateSettings(settings: Partial<UserSettings>): void {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
      lastUsed: new Date()
    }
    this.persistToStorage()
  }

  /**
   * Clear all stored data (for testing or reset)
   */
  clearAll(): void {
    this.data = {
      documents: Object.create(null),
      progress: Object.create(null),
      settings: { ...DEFAULT_SETTINGS }
    }
    this.persistToStorage()
  }

  /**
   * Check storage health and availability
   */
  private checkStorageHealth(): void {
    const healthCheck = errorHandler.checkStorageHealth()
    this.storageAvailable = healthCheck.available
    
    if (!healthCheck.available && healthCheck.error) {
      console.warn('Storage unavailable:', healthCheck.error.message)
      // Initialize fallback data for session-only storage
      this.fallbackData = this.createDefaultData()
    }
  }

  /**
   * Handle storage full errors by cleaning up old data
   */
  private handleStorageFullError(): void {
    try {
      // Remove old document structures
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('full_doc_')) {
          keysToRemove.push(key)
        }
      }
      
      // Remove oldest documents (keep last 3)
      if (keysToRemove.length > 3) {
        const toRemove = keysToRemove.slice(0, keysToRemove.length - 3)
        toRemove.forEach(key => {
          try {
            localStorage.removeItem(key)
          } catch {
            // Ignore individual removal errors
          }
        })
      }
      
      // Try to save again
      this.persistToStorage()
    } catch (error) {
      console.error('Failed to clean up storage:', error)
      // Fall back to session-only storage
      this.storageAvailable = false
      this.fallbackData = { ...this.data }
    }
  }
  /**
   * Load data from localStorage with error recovery
   * Requirement 5.3: Local storage without user accounts
   */
  private loadFromStorage(): LocalStorageData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return this.createDefaultData()
      }

      const parsed = JSON.parse(stored) as LocalStorageData
      
      // Validate and migrate data structure if needed
      const validatedData = this.validateAndMigrateData(parsed)
      return validatedData
    } catch (error) {
      console.warn('Failed to load progress data from localStorage:', error)
      
      // Try to recover from corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Ignore cleanup errors
      }
      
      return this.createDefaultData()
    }
  }

  /**
   * Validate and migrate data structure
   */
  private validateAndMigrateData(data: any): LocalStorageData {
    try {
      return {
        documents: data.documents && typeof data.documents === 'object' 
          ? Object.assign(Object.create(null), data.documents) 
          : Object.create(null),
        progress: data.progress && typeof data.progress === 'object'
          ? Object.assign(Object.create(null), data.progress)
          : Object.create(null),
        settings: { 
          ...DEFAULT_SETTINGS, 
          ...(data.settings && typeof data.settings === 'object' ? data.settings : {})
        }
      }
    } catch (error) {
      console.warn('Data validation failed, using defaults:', error)
      return this.createDefaultData()
    }
  }

  /**
   * Persist data to localStorage with error handling and fallback
   * Requirement 5.1: Automatic persistence
   */
  private persistToStorage(): void {
    if (!this.storageAvailable) {
      // Use fallback data for session-only storage
      if (this.fallbackData) {
        this.fallbackData = { ...this.data }
      }
      return
    }

    try {
      const serialized = JSON.stringify(this.data)
      
      // Check size before storing
      if (serialized.length > 10 * 1024 * 1024) { // 10MB limit
        throw createAppError(
          ErrorType.LOCAL_STORAGE_FULL,
          'Data too large to store',
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'Too much data to save. Some older documents may be removed.',
          }
        )
      }
      
      localStorage.setItem(STORAGE_KEY, serialized)
    } catch (error) {
      console.error('Failed to save progress data to localStorage:', error)
      
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.handleStorageFullError()
      } else {
        // Fall back to session-only storage
        this.storageAvailable = false
        this.fallbackData = { ...this.data }
      }
    }
  }

  /**
   * Create default data structure
   */
  private createDefaultData(): LocalStorageData {
    return {
      documents: Object.create(null), // Avoid prototype pollution
      progress: Object.create(null),  // Avoid prototype pollution
      settings: { ...DEFAULT_SETTINGS }
    }
  }
}

// Export singleton instance
export const progressManager = new ProgressManagerService()
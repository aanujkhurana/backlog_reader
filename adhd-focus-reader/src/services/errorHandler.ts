/**
 * Error Handler Service for ADHD Focus Reader
 * Provides centralized error handling, logging, and recovery mechanisms
 */

import type {
  AppError,
  ErrorHandlingConfig,
  ErrorRecoveryOptions,
  FileValidationResult,
  StorageHealthCheck,
  ProgressiveLoadingState
} from '../types/errors'
import {
  ErrorType,
  ErrorSeverity,
  createAppError,
  isAppError,
  getErrorMessage,
  shouldRetry,
  isRecoverable,
  DEFAULT_ERROR_CONFIG
} from '../types/errors'

export class ErrorHandlerService {
  private config: ErrorHandlingConfig
  private errorLog: AppError[] = []
  private retryAttempts: Map<string, number> = new Map()

  constructor(config: Partial<ErrorHandlingConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config }
  }

  /**
   * Handle and process errors with appropriate recovery strategies
   */
  handleError(error: unknown, context?: Record<string, unknown>): AppError {
    const appError = this.normalizeError(error, context)
    
    if (this.config.logErrors) {
      this.logError(appError)
    }
    
    return appError
  }

  /**
   * Validate file before processing
   */
  validateFile(file: File): FileValidationResult {
    const result: FileValidationResult = {
      isValid: true,
      fileInfo: {
        size: file.size,
        type: file.type,
        name: file.name
      }
    }

    // Check file size
    if (file.size > this.config.maxFileSize) {
      result.isValid = false
      result.error = createAppError(
        ErrorType.OVERSIZED_FILE,
        `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.config.maxFileSize)})`,
        ErrorSeverity.HIGH,
        {
          userMessage: `File is too large. Maximum size allowed is ${this.formatFileSize(this.config.maxFileSize)}.`,
          context: { fileSize: file.size, maxSize: this.config.maxFileSize },
          recoverable: false
        }
      )
      return result
    }

    // Check file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
    const validExtensions = ['.pdf', '.docx', '.txt']
    
    const hasValidType = validTypes.includes(file.type)
    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    )

    if (!hasValidType && !hasValidExtension) {
      result.isValid = false
      result.error = createAppError(
        ErrorType.INVALID_FILE_FORMAT,
        `Unsupported file format: ${file.type || 'unknown'}`,
        ErrorSeverity.HIGH,
        {
          userMessage: 'Please upload a PDF, DOCX, or text file.',
          context: { fileType: file.type, fileName: file.name },
          recoverable: false
        }
      )
      return result
    }

    // Check for empty file
    if (file.size === 0) {
      result.isValid = false
      result.error = createAppError(
        ErrorType.EMPTY_DOCUMENT,
        'File is empty',
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'The selected file appears to be empty. Please choose a different file.',
          recoverable: false
        }
      )
      return result
    }

    // Add warnings for large files
    if (file.size > 10 * 1024 * 1024) { // 10MB
      result.warnings = result.warnings || []
      result.warnings.push('Large file detected. Processing may take longer than usual.')
    }

    return result
  }

  /**
   * Check local storage health and availability
   */
  checkStorageHealth(): StorageHealthCheck {
    try {
      // Test if localStorage is available
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)

      // Get storage quota information
      let quotaUsed = 0
      let quotaTotal = 0

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          quotaUsed = estimate.usage || 0
          quotaTotal = estimate.quota || 0
        }).catch(() => {
          // Quota estimation not available
        })
      }

      return {
        available: true,
        quotaUsed,
        quotaTotal
      }
    } catch (error) {
      const appError = createAppError(
        ErrorType.LOCAL_STORAGE_UNAVAILABLE,
        'Local storage is not available',
        ErrorSeverity.HIGH,
        {
          userMessage: 'Unable to save your progress. You can still use the app, but your reading position won\'t be saved.',
          context: { originalError: error },
          recoverable: true
        }
      )

      return {
        available: false,
        quotaUsed: 0,
        quotaTotal: 0,
        error: appError
      }
    }
  }

  /**
   * Attempt to recover from storage errors
   */
  async recoverFromStorageError(error: AppError): Promise<boolean> {
    if (error.type === ErrorType.LOCAL_STORAGE_FULL) {
      try {
        // Try to clear old data
        this.clearOldStorageData()
        return true
      } catch {
        return false
      }
    }

    if (error.type === ErrorType.DATA_CORRUPTION) {
      try {
        // Clear corrupted data and start fresh
        localStorage.clear()
        return true
      } catch {
        return false
      }
    }

    return false
  }

  /**
   * Create progressive loading state for large documents
   */
  createProgressiveLoader(totalSize: number, chunkSize: number = 1024 * 1024): {
    getState: () => ProgressiveLoadingState
    updateProgress: (loaded: number) => void
    setError: (error: AppError) => void
    complete: () => void
  } {
    const totalChunks = Math.ceil(totalSize / chunkSize)
    let currentChunk = 0
    let progress = 0
    let isLoading = true
    let error: AppError | undefined

    return {
      getState: () => ({
        isLoading,
        progress,
        currentChunk,
        totalChunks,
        error
      }),
      updateProgress: (loaded: number) => {
        progress = Math.min(100, (loaded / totalSize) * 100)
        currentChunk = Math.min(totalChunks, Math.ceil(loaded / chunkSize))
      },
      setError: (err: AppError) => {
        error = err
        isLoading = false
      },
      complete: () => {
        progress = 100
        currentChunk = totalChunks
        isLoading = false
      }
    }
  }

  /**
   * Retry mechanism with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationId: string,
    options: {
      maxRetries?: number
      baseDelay?: number
      onRetry?: (attempt: number, error: unknown) => void
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.config.maxRetries
    const baseDelay = options.baseDelay ?? this.config.retryDelay
    
    let lastError: unknown
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        // Reset retry count on success
        this.retryAttempts.delete(operationId)
        return result
      } catch (error) {
        lastError = error
        
        if (attempt === maxRetries || !shouldRetry(error)) {
          break
        }
        
        // Track retry attempts
        this.retryAttempts.set(operationId, attempt + 1)
        
        // Call retry callback
        options.onRetry?.(attempt + 1, error)
        
        // Wait with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        await this.delay(delay)
      }
    }
    
    throw this.handleError(lastError, { operationId, attempts: maxRetries + 1 })
  }

  /**
   * Timeout wrapper for operations
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.config.timeoutDuration
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(createAppError(
            ErrorType.TIMEOUT_ERROR,
            `Operation timed out after ${timeoutMs}ms`,
            ErrorSeverity.MEDIUM,
            {
              userMessage: 'The operation is taking longer than expected. Please try again.',
              retryable: true
            }
          ))
        }, timeoutMs)
      })
    ])
  }

  /**
   * Get error recovery options based on error type
   */
  getRecoveryOptions(error: AppError): ErrorRecoveryOptions {
    const options: ErrorRecoveryOptions = {}

    switch (error.type) {
      case ErrorType.INVALID_FILE_FORMAT:
        options.userGuidance = 'Please select a PDF, DOCX, or text file.'
        options.alternativeFlow = 'paste-text'
        break

      case ErrorType.OVERSIZED_FILE:
        options.userGuidance = 'Try uploading a smaller file or use the paste text option.'
        options.alternativeFlow = 'paste-text'
        break

      case ErrorType.LOCAL_STORAGE_FULL:
        options.userGuidance = 'Clear some browser data or use private browsing mode.'
        options.fallbackAction = () => this.clearOldStorageData()
        break

      case ErrorType.AI_SERVICE_UNAVAILABLE:
        options.userGuidance = 'AI summaries are temporarily unavailable. You can continue reading without them.'
        options.fallbackAction = () => {
          // Disable AI summaries
          console.log('Disabling AI summaries due to service unavailability')
        }
        break

      case ErrorType.NETWORK_ERROR:
        options.userGuidance = 'Check your internet connection and try again.'
        options.retryAction = async () => {
          // Could implement network connectivity check here
        }
        break

      default:
        options.userGuidance = 'Please try again or refresh the page.'
        break
    }

    return options
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 10): AppError[] {
    return this.errorLog.slice(-limit)
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = []
  }

  // Private helper methods

  private normalizeError(error: unknown, context?: Record<string, unknown>): AppError {
    if (isAppError(error)) {
      // Add additional context if provided
      if (context) {
        error.context = { ...error.context, ...context }
      }
      return error
    }

    if (error instanceof Error) {
      return createAppError(
        ErrorType.UNKNOWN_ERROR,
        error.message,
        ErrorSeverity.MEDIUM,
        {
          context: { ...context, originalError: error.name },
          cause: error
        }
      )
    }

    return createAppError(
      ErrorType.UNKNOWN_ERROR,
      'An unknown error occurred',
      ErrorSeverity.MEDIUM,
      { context }
    )
  }

  private logError(error: AppError): void {
    this.errorLog.push(error)
    
    // Keep only last 100 errors to prevent memory issues
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100)
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.error('App Error:', {
        type: error.type,
        severity: error.severity,
        message: error.message,
        context: error.context,
        timestamp: error.timestamp
      })
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  private clearOldStorageData(): void {
    try {
      // Remove old document structures (keep only recent ones)
      const keysToRemove: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('full_doc_')) {
          keysToRemove.push(key)
        }
      }
      
      // Remove oldest document structures (keep last 5)
      if (keysToRemove.length > 5) {
        const toRemove = keysToRemove.slice(0, keysToRemove.length - 5)
        toRemove.forEach(key => localStorage.removeItem(key))
      }
    } catch (error) {
      console.warn('Failed to clear old storage data:', error)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandlerService()
/**
 * Unit tests for Error Handler Service
 * Tests comprehensive error handling and recovery mechanisms
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ErrorHandlerService } from '../errorHandler'
import { ErrorType, ErrorSeverity, createAppError } from '../../types/errors'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('ErrorHandlerService', () => {
  let errorHandler: ErrorHandlerService

  beforeEach(() => {
    vi.clearAllMocks()
    errorHandler = new ErrorHandlerService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('File Validation', () => {
    it('should validate PDF files correctly', () => {
      const pdfFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      
      const result = errorHandler.validateFile(pdfFile)
      
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.fileInfo?.type).toBe('application/pdf')
    })

    it('should validate DOCX files correctly', () => {
      const docxFile = new File(['test content'], 'test.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      })
      
      const result = errorHandler.validateFile(docxFile)
      
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid file types', () => {
      const invalidFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = errorHandler.validateFile(invalidFile)
      
      expect(result.isValid).toBe(false)
      expect(result.error?.type).toBe(ErrorType.INVALID_FILE_FORMAT)
      expect(result.error?.userMessage).toContain('PDF, DOCX, or text file')
    })

    it('should reject oversized files', () => {
      const largeContent = 'x'.repeat(60 * 1024 * 1024) // 60MB
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
      
      const result = errorHandler.validateFile(largeFile)
      
      expect(result.isValid).toBe(false)
      expect(result.error?.type).toBe(ErrorType.OVERSIZED_FILE)
      expect(result.error?.userMessage).toContain('too large')
    })

    it('should reject empty files', () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' })
      
      const result = errorHandler.validateFile(emptyFile)
      
      expect(result.isValid).toBe(false)
      expect(result.error?.type).toBe(ErrorType.EMPTY_DOCUMENT)
    })

    it('should add warnings for large files', () => {
      const largeContent = 'x'.repeat(15 * 1024 * 1024) // 15MB
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
      
      const result = errorHandler.validateFile(largeFile)
      
      expect(result.isValid).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.[0]).toContain('Large file detected')
    })
  })

  describe('Storage Health Check', () => {
    it('should detect available localStorage', () => {
      localStorageMock.setItem.mockImplementation(() => {})
      localStorageMock.removeItem.mockImplementation(() => {})
      
      const health = errorHandler.checkStorageHealth()
      
      expect(health.available).toBe(true)
      expect(health.error).toBeUndefined()
    })

    it('should detect unavailable localStorage', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })
      
      const health = errorHandler.checkStorageHealth()
      
      expect(health.available).toBe(false)
      expect(health.error?.type).toBe(ErrorType.LOCAL_STORAGE_UNAVAILABLE)
    })
  })

  describe('Progressive Loading', () => {
    it('should create progressive loader with correct initial state', () => {
      const totalSize = 1000
      const chunkSize = 100
      
      const loader = errorHandler.createProgressiveLoader(totalSize, chunkSize)
      const state = loader.getState()
      
      expect(state.isLoading).toBe(true)
      expect(state.progress).toBe(0)
      expect(state.currentChunk).toBe(0)
      expect(state.totalChunks).toBe(10)
    })

    it('should update progress correctly', () => {
      const loader = errorHandler.createProgressiveLoader(1000, 100)
      
      loader.updateProgress(300)
      const state = loader.getState()
      
      expect(state.progress).toBe(30)
      expect(state.currentChunk).toBe(3)
    })

    it('should handle completion', () => {
      const loader = errorHandler.createProgressiveLoader(1000, 100)
      
      loader.complete()
      const state = loader.getState()
      
      expect(state.isLoading).toBe(false)
      expect(state.progress).toBe(100)
      expect(state.currentChunk).toBe(10)
    })

    it('should handle errors', () => {
      const loader = errorHandler.createProgressiveLoader(1000, 100)
      const error = createAppError(ErrorType.PARSING_FAILED, 'Test error', ErrorSeverity.HIGH)
      
      loader.setError(error)
      const state = loader.getState()
      
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe(error)
    })
  })

  describe('Retry Mechanism', () => {
    it('should retry failed operations', async () => {
      let attempts = 0
      const operation = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const result = await errorHandler.withRetry(operation, 'test-op', { maxRetries: 3 })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = createAppError(
        ErrorType.INVALID_FILE_FORMAT,
        'Invalid file',
        ErrorSeverity.HIGH,
        { retryable: false }
      )
      
      const operation = vi.fn().mockRejectedValue(nonRetryableError)

      await expect(
        errorHandler.withRetry(operation, 'test-op', { maxRetries: 3 })
      ).rejects.toThrow()
      
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should call retry callback', async () => {
      const onRetry = vi.fn()
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')

      await errorHandler.withRetry(operation, 'test-op', { 
        maxRetries: 2,
        onRetry 
      })
      
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      const slowOperation = () => new Promise(resolve => setTimeout(resolve, 2000))

      await expect(
        errorHandler.withTimeout(slowOperation, 100)
      ).rejects.toThrow()
    })

    it('should complete fast operations', async () => {
      const fastOperation = () => Promise.resolve('success')

      const result = await errorHandler.withTimeout(fastOperation, 1000)
      
      expect(result).toBe('success')
    })
  })

  describe('Error Recovery Options', () => {
    it('should provide recovery options for invalid file format', () => {
      const error = createAppError(ErrorType.INVALID_FILE_FORMAT, 'Invalid file', ErrorSeverity.HIGH)
      
      const options = errorHandler.getRecoveryOptions(error)
      
      expect(options.userGuidance).toContain('PDF, DOCX, or text file')
      expect(options.alternativeFlow).toBe('paste-text')
    })

    it('should provide recovery options for oversized files', () => {
      const error = createAppError(ErrorType.OVERSIZED_FILE, 'File too large', ErrorSeverity.HIGH)
      
      const options = errorHandler.getRecoveryOptions(error)
      
      expect(options.userGuidance).toContain('smaller file')
      expect(options.alternativeFlow).toBe('paste-text')
    })

    it('should provide recovery options for storage full', () => {
      const error = createAppError(ErrorType.LOCAL_STORAGE_FULL, 'Storage full', ErrorSeverity.MEDIUM)
      
      const options = errorHandler.getRecoveryOptions(error)
      
      expect(options.userGuidance).toContain('Clear some browser data')
      expect(options.fallbackAction).toBeDefined()
    })

    it('should provide recovery options for AI service unavailable', () => {
      const error = createAppError(ErrorType.AI_SERVICE_UNAVAILABLE, 'AI unavailable', ErrorSeverity.MEDIUM)
      
      const options = errorHandler.getRecoveryOptions(error)
      
      expect(options.userGuidance).toContain('AI summaries are temporarily unavailable')
      expect(options.fallbackAction).toBeDefined()
    })
  })

  describe('Error Logging', () => {
    it('should log errors', () => {
      const error = new Error('Test error')
      
      const appError = errorHandler.handleError(error)
      const recentErrors = errorHandler.getRecentErrors()
      
      expect(recentErrors).toHaveLength(1)
      expect(recentErrors[0]).toBe(appError)
    })

    it('should limit error log size', () => {
      // Add more than 100 errors
      for (let i = 0; i < 150; i++) {
        errorHandler.handleError(new Error(`Error ${i}`))
      }
      
      const recentErrors = errorHandler.getRecentErrors(200)
      
      expect(recentErrors.length).toBeLessThanOrEqual(100)
    })

    it('should clear error log', () => {
      errorHandler.handleError(new Error('Test error'))
      expect(errorHandler.getRecentErrors()).toHaveLength(1)
      
      errorHandler.clearErrorLog()
      
      expect(errorHandler.getRecentErrors()).toHaveLength(0)
    })
  })

  describe('Error Normalization', () => {
    it('should normalize regular errors to AppErrors', () => {
      const regularError = new Error('Regular error')
      
      const appError = errorHandler.handleError(regularError)
      
      expect(appError.type).toBe(ErrorType.UNKNOWN_ERROR)
      expect(appError.severity).toBe(ErrorSeverity.MEDIUM)
      expect(appError.message).toBe('Regular error')
    })

    it('should preserve AppErrors', () => {
      const originalError = createAppError(
        ErrorType.INVALID_FILE_FORMAT,
        'Invalid file',
        ErrorSeverity.HIGH
      )
      
      const handledError = errorHandler.handleError(originalError)
      
      expect(handledError).toBe(originalError)
    })

    it('should handle non-Error objects', () => {
      const stringError = 'String error'
      
      const appError = errorHandler.handleError(stringError)
      
      expect(appError.type).toBe(ErrorType.UNKNOWN_ERROR)
      expect(appError.message).toBe('An unknown error occurred')
    })
  })
})
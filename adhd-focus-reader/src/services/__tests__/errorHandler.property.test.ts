/**
 * Property-based tests for Error Handler Service
 * Tests error handling properties across all valid inputs
 * **Feature: adhd-focus-reader, Property 8: Error Handling Consistency**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
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

describe('ErrorHandlerService Property Tests', () => {
  let errorHandler: ErrorHandlerService

  beforeEach(() => {
    vi.clearAllMocks()
    errorHandler = new ErrorHandlerService()
  })

  describe('Property 8: Error Handling Consistency', () => {
    it('should always return AppError for any input error', () => {
      /**
       * **Validates: Requirements All requirements - error conditions**
       * For any error input, the error handler should always return a valid AppError
       */
      fc.assert(fc.property(
        fc.oneof(
          fc.string(),
          fc.record({
            message: fc.string(),
            name: fc.string()
          }),
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.boolean()
        ),
        (errorInput) => {
          const result = errorHandler.handleError(errorInput)
          
          // Should always return an AppError
          expect(result).toHaveProperty('type')
          expect(result).toHaveProperty('severity')
          expect(result).toHaveProperty('timestamp')
          expect(result.timestamp).toBeInstanceOf(Date)
          
          // Should have valid error type
          expect(Object.values(ErrorType)).toContain(result.type)
          
          // Should have valid severity
          expect(Object.values(ErrorSeverity)).toContain(result.severity)
          
          // Should have a message
          expect(typeof result.message).toBe('string')
          expect(result.message.length).toBeGreaterThan(0)
        }
      ), { numRuns: 100 })
    })

    it('should validate files consistently for any file input', () => {
      /**
       * **Validates: Requirements 1.1, 1.2, 1.3 - file validation**
       * For any file input, validation should return consistent results
       */
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 255 }),
          size: fc.integer({ min: 0, max: 100 * 1024 * 1024 }), // 0 to 100MB
          type: fc.oneof(
            fc.constant('application/pdf'),
            fc.constant('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
            fc.constant('text/plain'),
            fc.constant('image/jpeg'),
            fc.constant('application/zip'),
            fc.string()
          )
        }),
        (fileProps) => {
          // Create a mock file
          const file = new File(['content'], fileProps.name, { 
            type: fileProps.type 
          })
          
          // Override size property
          Object.defineProperty(file, 'size', { value: fileProps.size })
          
          const result = errorHandler.validateFile(file)
          
          // Should always return a validation result
          expect(result).toHaveProperty('isValid')
          expect(typeof result.isValid).toBe('boolean')
          
          // Should have file info
          expect(result.fileInfo).toBeDefined()
          expect(result.fileInfo?.size).toBe(fileProps.size)
          expect(result.fileInfo?.name).toBe(fileProps.name)
          
          // If invalid, should have error
          if (!result.isValid) {
            expect(result.error).toBeDefined()
            expect(result.error?.type).toBeDefined()
            expect(result.error?.userMessage).toBeDefined()
            expect(typeof result.error?.userMessage).toBe('string')
          }
          
          // Specific validation rules
          if (fileProps.size === 0) {
            expect(result.isValid).toBe(false)
            // Empty files might fail format check first if they have invalid type
            expect([ErrorType.EMPTY_DOCUMENT, ErrorType.INVALID_FILE_FORMAT]).toContain(result.error?.type)
          }
          
          if (fileProps.size > 50 * 1024 * 1024) { // 50MB limit
            expect(result.isValid).toBe(false)
            expect(result.error?.type).toBe(ErrorType.OVERSIZED_FILE)
          }
        }
      ), { numRuns: 50 })
    })

    it('should handle retry operations consistently', async () => {
      /**
       * **Validates: Requirements All requirements - retry mechanisms**
       * Retry mechanism should behave consistently for any operation
       */
      await fc.assert(fc.asyncProperty(
        fc.boolean(),
        async (isRetryable) => {
          let attempts = 0
          const operation = vi.fn().mockImplementation(() => {
            attempts++
            const error = createAppError(
              ErrorType.NETWORK_ERROR,
              'Test failure',
              ErrorSeverity.MEDIUM,
              { retryable: isRetryable }
            )
            return Promise.reject(error)
          })

          try {
            await errorHandler.withRetry(
              operation,
              'test-operation',
              { maxRetries: 2, baseDelay: 1 } // Very short delay for testing
            )
            // Should not reach here since operation always fails
            expect(true).toBe(false) // Force failure
          } catch (error) {
            // Operation failed as expected
            if (isRetryable) {
              // Should have retried (1 initial + 2 retries = 3 total)
              expect(attempts).toBe(3)
            } else {
              // Should not have retried (1 attempt only)
              expect(attempts).toBe(1)
            }
          }
        }
      ), { numRuns: 10 }) // Reduce number of runs for faster testing
    }, 10000) // 10 second timeout

    it('should create progressive loaders with valid state', () => {
      /**
       * **Validates: Requirements All requirements - progressive loading**
       * Progressive loaders should maintain valid state for any input
       */
      fc.assert(fc.property(
        fc.record({
          totalSize: fc.integer({ min: 1, max: 1000000 }),
          chunkSize: fc.integer({ min: 1, max: 100000 }),
          progressUpdates: fc.array(fc.integer({ min: 0, max: 1000000 }), { maxLength: 10 })
        }),
        (testCase) => {
          const loader = errorHandler.createProgressiveLoader(
            testCase.totalSize,
            testCase.chunkSize
          )
          
          // Initial state should be valid
          let state = loader.getState()
          expect(state.isLoading).toBe(true)
          expect(state.progress).toBe(0)
          expect(state.currentChunk).toBe(0)
          expect(state.totalChunks).toBe(Math.ceil(testCase.totalSize / testCase.chunkSize))
          
          // Apply progress updates
          for (const loaded of testCase.progressUpdates) {
            loader.updateProgress(loaded)
            state = loader.getState()
            
            // Progress should be valid
            expect(state.progress).toBeGreaterThanOrEqual(0)
            expect(state.progress).toBeLessThanOrEqual(100)
            
            // Current chunk should be valid
            expect(state.currentChunk).toBeGreaterThanOrEqual(0)
            expect(state.currentChunk).toBeLessThanOrEqual(state.totalChunks)
            
            // If loaded exceeds total, progress should be capped at 100
            if (loaded >= testCase.totalSize) {
              expect(state.progress).toBe(100)
              expect(state.currentChunk).toBe(state.totalChunks)
            }
          }
          
          // Complete should set final state
          loader.complete()
          state = loader.getState()
          expect(state.isLoading).toBe(false)
          expect(state.progress).toBe(100)
          expect(state.currentChunk).toBe(state.totalChunks)
        }
      ), { numRuns: 50 })
    })

    it('should provide recovery options for any error type', () => {
      /**
       * **Validates: Requirements All requirements - error recovery**
       * Recovery options should be provided for any error type
       */
      fc.assert(fc.property(
        fc.constantFrom(...Object.values(ErrorType)),
        fc.constantFrom(...Object.values(ErrorSeverity)),
        fc.string({ minLength: 1, maxLength: 100 }),
        (errorType, severity, message) => {
          const error = createAppError(errorType, message, severity)
          
          const options = errorHandler.getRecoveryOptions(error)
          
          // Should always return recovery options
          expect(options).toBeDefined()
          expect(typeof options).toBe('object')
          
          // Should have at least one recovery mechanism
          const hasRecovery = !!(
            options.userGuidance ||
            options.fallbackAction ||
            options.retryAction ||
            options.alternativeFlow
          )
          expect(hasRecovery).toBe(true)
          
          // User guidance should be helpful if provided
          if (options.userGuidance) {
            expect(typeof options.userGuidance).toBe('string')
            expect(options.userGuidance.length).toBeGreaterThan(0)
          }
        }
      ), { numRuns: 50 })
    })
  })
})
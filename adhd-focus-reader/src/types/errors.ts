/**
 * Error handling types for ADHD Focus Reader
 * Implements comprehensive error handling for all requirements
 */

export enum ErrorType {
  // Document processing errors
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  CORRUPTED_DOCUMENT = 'CORRUPTED_DOCUMENT',
  EMPTY_DOCUMENT = 'EMPTY_DOCUMENT',
  OVERSIZED_FILE = 'OVERSIZED_FILE',
  PARSING_FAILED = 'PARSING_FAILED',
  
  // Storage errors
  LOCAL_STORAGE_FULL = 'LOCAL_STORAGE_FULL',
  LOCAL_STORAGE_UNAVAILABLE = 'LOCAL_STORAGE_UNAVAILABLE',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  
  // RSVP engine errors
  INVALID_READING_SESSION = 'INVALID_READING_SESSION',
  POSITION_OUT_OF_BOUNDS = 'POSITION_OUT_OF_BOUNDS',
  TIMING_CALCULATION_ERROR = 'TIMING_CALCULATION_ERROR',
  
  // AI/API errors
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_GENERATION_TIMEOUT = 'AI_GENERATION_TIMEOUT',
  AI_CONTENT_ERROR = 'AI_CONTENT_ERROR',
  
  // Network/connectivity errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',           // User can continue with degraded functionality
  MEDIUM = 'MEDIUM',     // Feature unavailable but app still usable
  HIGH = 'HIGH',         // Major functionality broken
  CRITICAL = 'CRITICAL'  // App unusable
}

export interface AppError extends Error {
  type: ErrorType
  severity: ErrorSeverity
  code?: string
  context?: Record<string, unknown>
  userMessage?: string
  recoverable?: boolean
  retryable?: boolean
  timestamp: Date
}

export interface ErrorRecoveryOptions {
  fallbackAction?: () => void
  retryAction?: () => Promise<void>
  userGuidance?: string
  alternativeFlow?: string
}

export interface ErrorHandlingConfig {
  maxFileSize: number // bytes
  maxRetries: number
  retryDelay: number // milliseconds
  timeoutDuration: number // milliseconds
  enableFallbacks: boolean
  logErrors: boolean
}

export interface FileValidationResult {
  isValid: boolean
  error?: AppError
  warnings?: string[]
  fileInfo?: {
    size: number
    type: string
    name: string
  }
}

export interface StorageHealthCheck {
  available: boolean
  quotaUsed: number
  quotaTotal: number
  error?: AppError
}

export interface ProgressiveLoadingState {
  isLoading: boolean
  progress: number // 0-100
  currentChunk: number
  totalChunks: number
  error?: AppError
}

// Error factory functions
export function createAppError(
  type: ErrorType,
  message: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  options: {
    code?: string
    context?: Record<string, unknown>
    userMessage?: string
    recoverable?: boolean
    retryable?: boolean
    cause?: Error
  } = {}
): AppError {
  const error = new Error(message) as AppError
  error.type = type
  error.severity = severity
  error.code = options.code
  error.context = options.context
  error.userMessage = options.userMessage || message
  error.recoverable = options.recoverable ?? true
  error.retryable = options.retryable ?? false
  error.timestamp = new Date()
  
  if (options.cause) {
    (error as any).cause = options.cause
  }
  
  return error
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && 'type' in error && 'severity' in error
}

export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.userMessage || error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unknown error occurred'
}

export function shouldRetry(error: unknown): boolean {
  if (isAppError(error)) {
    return error.retryable === true
  }
  // Regular errors are retryable by default unless explicitly marked as non-retryable
  if (error instanceof Error) {
    return true
  }
  return false
}

export function isRecoverable(error: unknown): boolean {
  if (isAppError(error)) {
    return error.recoverable !== false
  }
  return true
}

// Default error handling configuration
export const DEFAULT_ERROR_CONFIG: ErrorHandlingConfig = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  timeoutDuration: 30000, // 30 seconds
  enableFallbacks: true,
  logErrors: true
}
/**
 * Main types export for ADHD Focus Reader
 * Consolidates all TypeScript interfaces and types
 */

// Document processing types
export type {
  DocumentProcessor,
  ProcessedDocument,
  CleanedText,
  DocumentMetadata,
  Section,
  DocumentStructure,
  ProcessedWord,
  DocumentSummary
} from './document'

// RSVP engine types
export type {
  RSVPEngine,
  WordDisplay,
  ReadingSession,
  RSVPConfig,
  DisplayState
} from './rsvp'

// Progress management types
export type {
  ProgressManager,
  StoredProgress,
  LocalStorageData,
  UserSettings
} from './progress'

// Keyboard controls types
export type {
  KeyboardController,
  KeyboardEvent,
  ControlAction,
  ControlConfig
} from './controls'

// AI summary types
export type {
  SummaryGenerator,
  SectionSummary,
  SummaryConfig
} from './summary'

// Setup screen types
export type {
  SetupConfig,
  SpeedOption,
  SetupState
} from './setup'

// Error handling types
export type {
  AppError,
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryOptions,
  ErrorHandlingConfig,
  FileValidationResult,
  StorageHealthCheck,
  ProgressiveLoadingState
} from './errors'

// Error utility functions
export {
  createAppError,
  isAppError,
  getErrorMessage,
  shouldRetry,
  isRecoverable,
  DEFAULT_ERROR_CONFIG
} from './errors'
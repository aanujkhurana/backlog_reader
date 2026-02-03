/**
 * Services exports for ADHD Focus Reader
 */

export { DocumentProcessorService, documentProcessor } from './documentProcessor'
export { RSVPEngineService, rsvpEngine } from './rsvpEngine'
export { KeyboardControllerService, createKeyboardController } from './keyboardController'
export { ReadingSessionService, createReadingSession } from './readingSession'
export { ProgressManagerService, progressManager } from './progressManager'
export { ErrorHandlerService, errorHandler } from './errorHandler'
export { SummaryService, summaryService, createSummaryService } from './summaryService'

export type { 
  DocumentProcessor,
  ProcessedDocument,
  CleanedText,
  DocumentStructure,
  DocumentMetadata,
  Section,
  ProcessedWord,
  DocumentSummary
} from '../types/document'

export type {
  RSVPEngine,
  WordDisplay,
  ReadingSession,
  RSVPConfig,
  DisplayState
} from '../types/rsvp'

export type {
  KeyboardController,
  ControlAction,
  ControlConfig
} from '../types/controls'

export type {
  ProgressManager,
  StoredProgress,
  LocalStorageData,
  UserSettings
} from '../types/progress'

export type {
  AppError,
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryOptions,
  ErrorHandlingConfig,
  FileValidationResult,
  StorageHealthCheck,
  ProgressiveLoadingState
} from '../types/errors'

export type {
  SummaryGenerator,
  SectionSummary,
  SummaryConfig
} from '../types/summary'
/**
 * Document processing interfaces for ADHD Focus Reader
 * Validates Requirements: 1.1, 1.2, 1.3
 */

export interface DocumentProcessor {
  parseDocument(file: File): Promise<ProcessedDocument>
  cleanText(rawText: string): CleanedText
  extractStructure(document: ProcessedDocument): DocumentStructure
}

export interface ProcessedDocument {
  content: string
  sections: Section[]
  metadata: DocumentMetadata
}

export interface CleanedText {
  content: string
  wordCount: number
  hasStructure: boolean
}

export interface DocumentMetadata {
  title: string
  fileType: 'pdf' | 'docx' | 'text'
  originalSize: number
  processedAt: Date
}

export interface Section {
  title: string
  startWordIndex: number
  endWordIndex: number
  type: 'heading' | 'paragraph' | 'bullet' | 'normal'
}

export interface DocumentStructure {
  id: string
  title: string
  totalWords: number
  sections: Section[]
  words: ProcessedWord[]
  createdAt: Date
  lastPosition: number
}

export interface ProcessedWord {
  text: string
  orp: number // Optimal Recognition Point index
  baseDelay: number
  punctuationPause: number
  isLongWord: boolean
}

export interface DocumentSummary {
  id: string
  title: string
  lastPosition: number
  totalWords: number
  uploadedAt: Date
  isCompleted: boolean
}
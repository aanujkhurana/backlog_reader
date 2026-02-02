/**
 * Document Processing Service for ADHD Focus Reader
 * Handles PDF, DOCX, and text document parsing with cleaning algorithms
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * Implements comprehensive error handling and edge cases
 */

import mammoth from 'mammoth'
import type {
  DocumentProcessor,
  ProcessedDocument,
  CleanedText,
  DocumentStructure,
  Section,
  ProcessedWord,
  DocumentMetadata
} from '../types/document'
import type { AppError, ProgressiveLoadingState } from '../types/errors'
import { errorHandler } from './errorHandler'
import { ErrorType, ErrorSeverity, createAppError } from '../types/errors'

// PDF.js will be loaded dynamically when needed
let pdfjsLib: any = null

// Configure PDF.js worker when in browser environment
async function configurePDFJS() {
  if (typeof window === 'undefined') {
    return null // Not in browser environment
  }

  if (pdfjsLib) {
    return pdfjsLib // Already loaded
  }

  try {
    pdfjsLib = await import('pdfjs-dist')
    
    // Set the worker source for PDF.js
    try {
      // Try to use the worker from node_modules first
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    } catch {
      // Fallback to CDN if local worker fails
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
    }
    
    return pdfjsLib
  } catch (error) {
    console.error('Failed to load PDF.js:', error)
    return null
  }
}

export class DocumentProcessorService implements DocumentProcessor {
  private readonly MAX_CHUNK_SIZE = 1024 * 1024 // 1MB chunks for progressive loading
  private readonly MIN_WORD_COUNT = 10 // Minimum words for valid document
  private readonly MAX_WORD_COUNT = 500000 // Maximum words to prevent memory issues

  /**
   * Parse uploaded document files (PDF, DOCX, or text) with comprehensive error handling
   * Requirement 1.1: Extract and clean PDF text content while preserving paragraph structure
   * Requirement 1.2: Convert DOCX to clean text while maintaining headings and bullet points
   * Requirement 1.3: Accept pasted text content immediately and prepare it for reading
   */
  async parseDocument(file: File): Promise<ProcessedDocument> {
    // Validate file before processing
    const validation = errorHandler.validateFile(file)
    if (!validation.isValid && validation.error) {
      throw validation.error
    }

    const fileType = this.getFileType(file)
    const title: string = file.name.replace(/\.[^/.]+$/, '') // Remove extension

    try {
      // Use progressive loading for large files
      const shouldUseProgressiveLoading = file.size > 5 * 1024 * 1024 // 5MB
      let rawText: string

      if (shouldUseProgressiveLoading) {
        rawText = await this.parseDocumentProgressively(file, fileType)
      } else {
        rawText = await this.parseDocumentDirect(file, fileType)
      }

      // Validate extracted text
      if (!rawText || rawText.trim().length === 0) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'No readable text found in document',
          ErrorSeverity.HIGH,
          {
            userMessage: 'The document appears to be empty or contains no readable text.',
            context: { fileName: file.name, fileSize: file.size },
            recoverable: false
          }
        )
      }

      const cleanedText = this.cleanText(rawText)
      
      // Validate word count
      if (cleanedText.wordCount < this.MIN_WORD_COUNT) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          `Document too short: ${cleanedText.wordCount} words (minimum ${this.MIN_WORD_COUNT})`,
          ErrorSeverity.MEDIUM,
          {
            userMessage: `Document is too short (${cleanedText.wordCount} words). Please upload a document with at least ${this.MIN_WORD_COUNT} words.`,
            recoverable: false
          }
        )
      }

      if (cleanedText.wordCount > this.MAX_WORD_COUNT) {
        throw createAppError(
          ErrorType.OVERSIZED_FILE,
          `Document too long: ${cleanedText.wordCount} words (maximum ${this.MAX_WORD_COUNT})`,
          ErrorSeverity.HIGH,
          {
            userMessage: `Document is too long (${cleanedText.wordCount} words). Please upload a document with fewer than ${this.MAX_WORD_COUNT} words.`,
            recoverable: false
          }
        )
      }

      const metadata: DocumentMetadata = {
        title,
        fileType,
        originalSize: file.size,
        processedAt: new Date()
      }

      const processedDocument: ProcessedDocument = {
        content: cleanedText.content,
        sections: this.extractSections(cleanedText.content),
        metadata
      }

      return processedDocument
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw createAppError(
          ErrorType.PARSING_FAILED,
          'Document processing was cancelled',
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'Document processing was cancelled. Please try again.',
            retryable: true
          }
        )
      }

      // Re-throw AppErrors as-is
      if (error && typeof error === 'object' && 'type' in error) {
        throw error
      }

      throw createAppError(
        ErrorType.PARSING_FAILED,
        `Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorSeverity.HIGH,
        {
          userMessage: 'Unable to process this document. Please try a different file or use the paste text option.',
          context: { fileName: file.name, fileType, originalError: error },
          recoverable: true
        }
      )
    }
  }

  /**
   * Clean text content by removing headers, footers, page numbers, and references
   * Requirement 1.4: Remove headers, footers, and page numbers automatically
   * Requirement 1.5: Ignore reference sections by default while preserving main content
   */
  cleanText(rawText: string): CleanedText {
    let content = rawText

    // Remove common header/footer patterns
    content = this.removeHeadersFooters(content)
    
    // Remove page numbers
    content = this.removePageNumbers(content)
    
    // Remove reference sections
    content = this.removeReferenceSections(content)
    
    // Clean up extra whitespace and normalize line breaks
    content = this.normalizeWhitespace(content)
    
    // Remove empty lines and excessive spacing
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    const wordCount = this.countWords(content)
    const hasStructure = this.detectStructure(content)

    return {
      content: content.trim(),
      wordCount,
      hasStructure
    }
  }

  /**
   * Extract document structure and create processed words
   * Used by the RSVP engine for adaptive pacing
   */
  extractStructure(document: ProcessedDocument): DocumentStructure {
    const words = this.processWords(document.content)
    const id = this.generateDocumentId(document.metadata.title)

    return {
      id,
      title: document.metadata.title,
      totalWords: words.length,
      sections: document.sections,
      words,
      createdAt: document.metadata.processedAt,
      lastPosition: 0
    }
  }

  /**
   * Process pasted text content immediately with validation
   * Requirement 1.3: Accept pasted text content immediately and prepare it for reading
   */
  async processPastedText(text: string, title: string = 'Pasted Text'): Promise<ProcessedDocument> {
    try {
      // Validate input text
      if (!text || typeof text !== 'string') {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'No text provided',
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'Please paste some text to continue.',
            recoverable: false
          }
        )
      }

      const trimmedText = text.trim()
      if (trimmedText.length === 0) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'Text is empty or contains only whitespace',
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'The pasted text appears to be empty. Please paste some readable content.',
            recoverable: false
          }
        )
      }

      // Check text length limits
      if (trimmedText.length > 10 * 1024 * 1024) { // 10MB text limit
        throw createAppError(
          ErrorType.OVERSIZED_FILE,
          'Pasted text is too long',
          ErrorSeverity.HIGH,
          {
            userMessage: 'The pasted text is too long. Please paste a shorter text.',
            recoverable: false
          }
        )
      }

      const cleanedText = this.cleanText(trimmedText)
      
      // Validate word count
      if (cleanedText.wordCount < this.MIN_WORD_COUNT) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          `Text too short: ${cleanedText.wordCount} words (minimum ${this.MIN_WORD_COUNT})`,
          ErrorSeverity.MEDIUM,
          {
            userMessage: `Text is too short (${cleanedText.wordCount} words). Please paste text with at least ${this.MIN_WORD_COUNT} words.`,
            recoverable: false
          }
        )
      }

      const metadata: DocumentMetadata = {
        title: title.trim() || 'Pasted Text',
        fileType: 'text',
        originalSize: text.length,
        processedAt: new Date()
      }

      return {
        content: cleanedText.content,
        sections: this.extractSections(cleanedText.content),
        metadata
      }
    } catch (error) {
      // Re-throw AppErrors as-is
      if (error && typeof error === 'object' && 'type' in error) {
        throw error
      }

      throw createAppError(
        ErrorType.PARSING_FAILED,
        `Failed to process pasted text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Unable to process the pasted text. Please try again.',
          context: { textLength: text.length, originalError: error },
          recoverable: true
        }
      )
    }
  }

  // Private helper methods

  /**
   * Parse document with progressive loading for large files
   */
  private async parseDocumentProgressively(file: File, fileType: 'pdf' | 'docx' | 'text'): Promise<string> {
    const loader = errorHandler.createProgressiveLoader(file.size, this.MAX_CHUNK_SIZE)
    
    try {
      // For now, we'll use the direct parsing method but with timeout and progress tracking
      // In a real implementation, this would process the file in chunks
      const result = await errorHandler.withTimeout(
        () => this.parseDocumentDirect(file, fileType),
        60000 // 60 second timeout for large files
      )
      
      loader.complete()
      return result
    } catch (error) {
      const appError = errorHandler.handleError(error, { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType 
      })
      loader.setError(appError)
      throw appError
    }
  }

  /**
   * Parse document directly (for smaller files)
   */
  private async parseDocumentDirect(file: File, fileType: 'pdf' | 'docx' | 'text'): Promise<string> {
    switch (fileType) {
      case 'pdf':
        return await this.parsePDF(file)
      case 'docx':
        return await this.parseDOCX(file)
      case 'text':
        return await this.parseText(file)
      default:
        throw createAppError(
          ErrorType.INVALID_FILE_FORMAT,
          `Unsupported file type: ${fileType}`,
          ErrorSeverity.HIGH,
          {
            userMessage: 'This file format is not supported. Please upload a PDF, DOCX, or text file.',
            recoverable: false
          }
        )
    }
  }

  private getFileType(file: File): 'pdf' | 'docx' | 'text' {
    const mimeType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return 'pdf'
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileName.endsWith('.docx')) {
      return 'docx'
    }
    return 'text'
  }

  private async parsePDF(file: File): Promise<string> {
    // Load PDF.js dynamically
    const pdfjsLib = await configurePDFJS()
    
    if (!pdfjsLib) {
      throw createAppError(
        ErrorType.CORRUPTED_DOCUMENT,
        'PDF parsing is not available in this environment',
        ErrorSeverity.HIGH,
        {
          userMessage: 'PDF parsing is not supported in this environment. Please try pasting the text instead.',
          recoverable: false
        }
      )
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: false,
        verbosity: 0 // Reduce console output
      })
      
      const pdf = await loadingTask.promise
      let fullText = ''
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()
          
          // Combine text items with proper spacing
          const pageText = textContent.items
            .map((item: any) => {
              if ('str' in item) {
                return item.str
              }
              return ''
            })
            .join(' ')
          
          fullText += pageText + '\n\n'
          
          // Clean up page resources
          page.cleanup()
        } catch (pageError) {
          console.warn(`Error processing page ${pageNum}:`, pageError)
          // Continue with other pages
        }
      }
      
      // Clean up PDF resources
      await pdf.destroy()
      
      if (!fullText || fullText.trim().length === 0) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'PDF contains no readable text',
          ErrorSeverity.HIGH,
          {
            userMessage: 'This PDF appears to contain no readable text. It may be an image-based PDF or corrupted.',
            recoverable: false
          }
        )
      }
      
      return fullText.trim()
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error // Re-throw AppErrors
      }

      throw createAppError(
        ErrorType.CORRUPTED_DOCUMENT,
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorSeverity.HIGH,
        {
          userMessage: 'Unable to read this PDF file. It may be corrupted or password-protected.',
          context: { originalError: error },
          recoverable: false
        }
      )
    }
  }

  private async parseDOCX(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      
      if (result.messages && result.messages.length > 0) {
        // Log warnings but don't fail
        console.warn('DOCX parsing warnings:', result.messages)
      }
      
      if (!result.value || result.value.trim().length === 0) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'DOCX contains no readable text',
          ErrorSeverity.HIGH,
          {
            userMessage: 'This Word document appears to contain no readable text.',
            recoverable: false
          }
        )
      }
      
      return result.value
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error // Re-throw AppErrors
      }

      throw createAppError(
        ErrorType.CORRUPTED_DOCUMENT,
        `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorSeverity.HIGH,
        {
          userMessage: 'Unable to read this Word document. It may be corrupted or in an unsupported format.',
          context: { originalError: error },
          recoverable: false
        }
      )
    }
  }

  private async parseText(file: File): Promise<string> {
    try {
      const text = await file.text()
      
      if (!text || text.trim().length === 0) {
        throw createAppError(
          ErrorType.EMPTY_DOCUMENT,
          'Text file is empty',
          ErrorSeverity.MEDIUM,
          {
            userMessage: 'This text file appears to be empty.',
            recoverable: false
          }
        )
      }
      
      return text
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error) {
        throw error // Re-throw AppErrors
      }

      throw createAppError(
        ErrorType.PARSING_FAILED,
        `Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Unable to read this text file. Please try a different file.',
          context: { originalError: error },
          recoverable: false
        }
      )
    }
  }

  private removeHeadersFooters(text: string): string {
    // Remove common header patterns (page numbers at top, repeated headers)
    const lines = text.split('\n')
    const filteredLines = lines.filter((line, index) => {
      const trimmed = line.trim()
      
      // Skip very short lines at the beginning/end that might be headers/footers
      if ((index < 3 || index > lines.length - 4) && trimmed.length < 50) {
        // Check if it's just a page number or common header pattern
        if (/^\d+$/.test(trimmed) || 
            /^page \d+/i.test(trimmed) ||
            /^\d+ of \d+$/.test(trimmed)) {
          return false
        }
      }
      
      return true
    })
    
    return filteredLines.join('\n')
  }

  private removePageNumbers(text: string): string {
    // Remove standalone page numbers and page indicators
    return text
      .replace(/^\s*\d+\s*$/gm, '') // Standalone numbers on their own line
      .replace(/^\s*Page \d+.*$/gmi, '') // "Page X" patterns
      .replace(/^\s*\d+ of \d+\s*$/gm, '') // "X of Y" patterns
      .replace(/\n\s*\d+\s*\n/g, '\n\n') // Numbers between paragraphs
  }

  private removeReferenceSections(text: string): string {
    // Find and remove reference sections
    const referencePatterns = [
      /\n\s*(references?|bibliography|works cited|citations?)\s*\n[\s\S]*$/i,
      /\n\s*\[\d+\][\s\S]*?(?=\n\s*\[\d+\]|\n\s*$)/g, // Numbered references
      /\n\s*\d+\.\s+[A-Z][^.]*\.\s+[A-Z][^.]*\.\s+\d{4}[\s\S]*?(?=\n\s*\d+\.|\n\s*$)/g // Academic citations
    ]
    
    let cleanedText = text
    referencePatterns.forEach(pattern => {
      cleanedText = cleanedText.replace(pattern, '')
    })
    
    return cleanedText
  }

  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ') // Convert tabs to spaces
      .replace(/ +/g, ' ') // Collapse multiple spaces
      .replace(/\n +/g, '\n') // Remove leading spaces on lines
      .replace(/ +\n/g, '\n') // Remove trailing spaces on lines
      .replace(/\n{3,}/g, '\n\n') // Limit to max 2 consecutive newlines
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  private detectStructure(text: string): boolean {
    // Check for common structural elements
    const hasHeadings = /^[A-Z][^.!?]*$|^\d+\.\s+[A-Z]/m.test(text)
    const hasBullets = /^\s*[•\-\*]\s+/m.test(text)
    const hasParagraphs = text.includes('\n\n')
    
    return hasHeadings || hasBullets || hasParagraphs
  }

  private extractSections(content: string): Section[] {
    const sections: Section[] = []
    const lines = content.split('\n')
    let currentWordIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || ''
      
      if (this.isHeading(line)) {
        // End previous section if exists
        if (sections.length > 0) {
          const lastSection = sections[sections.length - 1]
          if (lastSection) {
            lastSection.endWordIndex = currentWordIndex - 1
          }
        }
        
        // Start new section
        sections.push({
          title: line || `Section ${sections.length + 1}`,
          startWordIndex: currentWordIndex,
          endWordIndex: 0, // Will be set when next section starts or at end
          type: 'heading'
        })
      } else if (this.isBulletPoint(line)) {
        // Create bullet section if not already in one
        const lastSection = sections[sections.length - 1]
        if (sections.length === 0 || lastSection?.type !== 'bullet') {
          if (sections.length > 0 && lastSection) {
            lastSection.endWordIndex = currentWordIndex - 1
          }
          
          sections.push({
            title: 'Bullet Points',
            startWordIndex: currentWordIndex,
            endWordIndex: 0,
            type: 'bullet'
          })
        }
      }
      
      // Count words in this line
      if (line.length > 0) {
        currentWordIndex += line.split(/\s+/).filter(word => word.length > 0).length
      }
    }

    // Close the last section
    if (sections.length > 0) {
      const lastSection = sections[sections.length - 1]
      if (lastSection) {
        lastSection.endWordIndex = currentWordIndex - 1
      }
    }

    // If no sections found, create a default one
    if (sections.length === 0) {
      sections.push({
        title: 'Document Content',
        startWordIndex: 0,
        endWordIndex: currentWordIndex - 1,
        type: 'normal'
      })
    }

    return sections
  }

  private isHeading(line: string): boolean {
    // Check for common heading patterns
    return /^[A-Z][^.!?]*$/.test(line) || // All caps or title case without punctuation
           /^\d+\.\s+[A-Z]/.test(line) || // Numbered headings
           /^[A-Z\s]{3,}$/.test(line) // Short all-caps lines
  }

  private isBulletPoint(line: string): boolean {
    return /^\s*[•\-\*]\s+/.test(line)
  }

  private processWords(content: string): ProcessedWord[] {
    const words = content.split(/\s+/).filter(word => word.length > 0)
    
    return words.map(word => {
      const cleanWord = word.replace(/[^\w\s]/g, '') // Remove punctuation for ORP calculation
      const orp = this.calculateORP(cleanWord)
      const isLongWord = word.length > 8
      const punctuationPause = this.calculatePunctuationPause(word)
      
      return {
        text: word,
        orp,
        baseDelay: this.calculateBaseDelay(word),
        punctuationPause,
        isLongWord
      }
    })
  }

  private calculateORP(word: string): number {
    // Optimal Recognition Point calculation
    // For words 1-5 chars: ORP at position 1
    // For words 6-9 chars: ORP at position 2  
    // For words 10-13 chars: ORP at position 3
    // For words 14+ chars: ORP at position 4
    const length = word.length
    if (length <= 5) return 0
    if (length <= 9) return 1
    if (length <= 13) return 2
    return 3
  }

  private calculateBaseDelay(word: string): number {
    // Base delay in milliseconds - will be adjusted by RSVP engine based on speed settings
    const length = word.length
    if (length <= 3) return 200
    if (length <= 6) return 250
    if (length <= 9) return 300
    return 350
  }

  private calculatePunctuationPause(word: string): number {
    // Additional pause for punctuation in milliseconds
    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) return 300
    if (word.endsWith(',') || word.endsWith(';') || word.endsWith(':')) return 150
    return 0
  }

  private generateDocumentId(title: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)
    return `${titleSlug}-${timestamp}-${random}`
  }
}

// Export singleton instance
export const documentProcessor = new DocumentProcessorService()
/**
 * Integration tests for Document Processor Service
 * Tests real file processing scenarios
 */

import { describe, it, expect } from 'vitest'
import { DocumentProcessorService } from '../documentProcessor'

describe('DocumentProcessor Integration Tests', () => {
  const processor = new DocumentProcessorService()

  describe('Real Document Processing', () => {
    it('should process a complete document workflow', async () => {
      // Simulate a real document with various elements
      const documentText = `
        EXECUTIVE SUMMARY
        
        This document outlines the key findings from our research study conducted over the past six months.
        
        Page 1
        
        INTRODUCTION
        
        The purpose of this study was to analyze user behavior patterns in digital reading environments.
        Our research team collected data from over 1,000 participants across different demographics.
        
        Key findings include:
        • Improved focus with RSVP technology
        • Reduced eye strain during extended reading sessions
        • Higher comprehension rates for ADHD users
        
        Page 2
        
        METHODOLOGY
        
        We employed a mixed-methods approach combining quantitative metrics and qualitative feedback.
        The study duration was 12 weeks with weekly check-ins.
        
        RESULTS AND DISCUSSION
        
        Our analysis revealed significant improvements in reading completion rates.
        Users reported 40% better focus when using adaptive pacing features.
        
        References
        
        [1] Smith, J. (2023). Digital Reading Patterns. Journal of UX Research, 15(3), 45-62.
        [2] Johnson, M. (2022). ADHD and Technology Interfaces. Cognitive Science Review, 8(2), 123-140.
      `
      
      // Process the pasted text
      const processedDoc = await processor.processPastedText(documentText, 'Research Study Report')
      
      // Verify basic processing
      expect(processedDoc.metadata.title).toBe('Research Study Report')
      expect(processedDoc.metadata.fileType).toBe('text')
      expect(processedDoc.content.length).toBeGreaterThan(0)
      
      // Verify cleaning worked
      expect(processedDoc.content).not.toContain('Page 1')
      expect(processedDoc.content).not.toContain('Page 2')
      expect(processedDoc.content).not.toContain('References')
      expect(processedDoc.content).not.toContain('[1] Smith')
      
      // Verify content preservation
      expect(processedDoc.content).toContain('EXECUTIVE SUMMARY')
      expect(processedDoc.content).toContain('research study')
      expect(processedDoc.content).toContain('Improved focus with RSVP')
      expect(processedDoc.content).toContain('40% better focus')
      
      // Verify sections were extracted
      expect(processedDoc.sections.length).toBeGreaterThan(0)
      const headingSections = processedDoc.sections.filter(s => s.type === 'heading')
      expect(headingSections.length).toBeGreaterThan(0)
      
      // Create document structure
      const structure = processor.extractStructure(processedDoc)
      
      // Verify structure
      expect(structure.totalWords).toBeGreaterThan(50)
      expect(structure.words.length).toBe(structure.totalWords)
      expect(structure.sections.length).toBeGreaterThan(0)
      
      // Verify word processing
      const firstWord = structure.words[0]
      expect(firstWord).toBeDefined()
      expect(firstWord!.text).toBeTruthy()
      expect(firstWord!.orp).toBeGreaterThanOrEqual(0)
      expect(firstWord!.baseDelay).toBeGreaterThan(0)
      
      // Verify punctuation handling
      const wordsWithPunctuation = structure.words.filter(w => w.punctuationPause > 0)
      expect(wordsWithPunctuation.length).toBeGreaterThan(0)
      
      // Verify long word detection
      const longWords = structure.words.filter(w => w.isLongWord)
      expect(longWords.length).toBeGreaterThan(0)
    })

    it('should handle empty and minimal content gracefully', async () => {
      const emptyDoc = await processor.processPastedText('', 'Empty Document')
      expect(emptyDoc.content).toBe('')
      expect(emptyDoc.sections.length).toBe(1) // Default section
      
      const minimalDoc = await processor.processPastedText('Hello world.', 'Minimal Document')
      expect(minimalDoc.content).toBe('Hello world.')
      expect(minimalDoc.sections.length).toBe(1)
      
      const structure = processor.extractStructure(minimalDoc)
      expect(structure.totalWords).toBe(2)
      expect(structure.words[0]!.text).toBe('Hello')
      expect(structure.words[1]!.text).toBe('world.')
      expect(structure.words[1]!.punctuationPause).toBe(300) // Period pause
    })

    it('should process structured documents with bullets and headings', async () => {
      const structuredText = `
        PROJECT OVERVIEW
        
        This project aims to improve reading efficiency for professionals with ADHD.
        
        FEATURES
        
        The application includes several key features:
        • RSVP reading technology
        • Adaptive pacing algorithms
        • Progress tracking and resume functionality
        • Document cleaning and processing
        
        TECHNICAL REQUIREMENTS
        
        The system must support:
        • PDF document parsing
        • DOCX file processing
        • Real-time text cleaning
        • Cross-browser compatibility
        
        CONCLUSION
        
        This solution addresses a critical need in the professional reading space.
      `
      
      const processedDoc = await processor.processPastedText(structuredText, 'Project Specification')
      const structure = processor.extractStructure(processedDoc)
      
      // Verify headings were detected
      const headingSections = structure.sections.filter(s => s.type === 'heading')
      expect(headingSections.length).toBeGreaterThan(2)
      
      // Verify bullet sections were detected
      const bulletSections = structure.sections.filter(s => s.type === 'bullet')
      expect(bulletSections.length).toBeGreaterThan(0)
      
      // Verify content structure
      expect(structure.sections.length).toBeGreaterThan(3)
      
      // Verify section boundaries
      structure.sections.forEach(section => {
        expect(section.startWordIndex).toBeGreaterThanOrEqual(0)
        expect(section.endWordIndex).toBeGreaterThanOrEqual(section.startWordIndex)
        expect(section.endWordIndex).toBeLessThan(structure.totalWords)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed content gracefully', async () => {
      const malformedText = `
        \t\t\t   
        
        
        Some content with weird spacing    
        
        
        \r\n\r\n\r\n
        
        More content
      `
      
      const result = await processor.processPastedText(malformedText, 'Malformed Document')
      
      expect(result.content).toContain('Some content with weird spacing')
      expect(result.content).toContain('More content')
      expect(result.content).not.toMatch(/\t/)
      expect(result.content).not.toMatch(/\r/)
      expect(result.content).not.toMatch(/\n{3,}/)
    })

    it('should generate unique document IDs', () => {
      const doc1 = { content: 'test', sections: [], metadata: { title: 'Test Doc', fileType: 'text' as const, originalSize: 4, processedAt: new Date() }}
      const doc2 = { content: 'test', sections: [], metadata: { title: 'Test Doc', fileType: 'text' as const, originalSize: 4, processedAt: new Date() }}
      
      const structure1 = processor.extractStructure(doc1)
      const structure2 = processor.extractStructure(doc2)
      
      expect(structure1.id).not.toBe(structure2.id)
      expect(structure1.id).toContain('test-doc')
      expect(structure2.id).toContain('test-doc')
    })
  })
})
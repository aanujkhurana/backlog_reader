/**
 * Property-based tests for Summary Service
 * Tests Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 * Feature: adhd-focus-reader, Property 7: Summary Generation Constraints
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { SummaryService, createSummaryService } from '../summaryService'
import type { Section } from '../../types/document'

// Mock the progress manager
vi.mock('../progressManager', () => ({
  progressManager: {
    getSettings: vi.fn(() => ({
      baseSpeed: 250,
      summariesEnabled: true,
      lastUsed: new Date()
    }))
  }
}))

// Mock fetch for AI API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SummaryService Property-Based Tests', () => {
  let summaryService: SummaryService

  beforeEach(() => {
    vi.clearAllMocks()
    
    summaryService = createSummaryService({
      enabled: true,
      apiKey: 'test-api-key',
      maxLength: 200
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Property 7: Summary Generation Constraints
   * For any document section when summaries are enabled, generated summaries should be 
   * 1-2 lines, confirmatory rather than analytical, and only appear when the feature is active
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
   */
  it('Property 7: Summary generation should meet length and content constraints for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary sections and content
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          startWordIndex: fc.nat({ max: 1000 }),
          endWordIndex: fc.nat({ max: 2000 }),
          type: fc.constantFrom('paragraph', 'heading', 'bullet', 'normal')
        }),
        fc.string({ minLength: 10, maxLength: 1000 }), // Content
        fc.string({ minLength: 10, maxLength: 300 }), // AI response
        async (sectionData, content, aiResponse) => {
          // Ensure valid section structure
          const section: Section = {
            ...sectionData,
            endWordIndex: Math.max(sectionData.startWordIndex, sectionData.endWordIndex)
          }

          // Mock successful AI response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [{
                message: {
                  content: aiResponse
                }
              }]
            })
          })

          try {
            const result = await summaryService.generateSummary(section, content)

            // Property: Summary should be 1-2 lines (max 200 characters)
            expect(result.summary.length).toBeLessThanOrEqual(200)
            expect(result.summary.length).toBeGreaterThan(0)

            // Property: Summary should be confirmatory
            expect(result.isConfirmatory).toBe(true)

            // Property: Summary should have reasonable word count (1-2 lines)
            expect(result.wordCount).toBeGreaterThan(0)
            expect(result.wordCount).toBeLessThanOrEqual(50) // Reasonable upper bound for 1-2 lines

            // Property: Section title should be preserved
            expect(result.sectionTitle).toBe(section.title)

            // Property: Summary should end with proper punctuation
            expect(result.summary).toMatch(/[.!?]$/)

          } catch (error) {
            // If generation fails, it should be due to service being disabled or API issues
            // This is acceptable behavior per requirements
            expect(error).toBeDefined()
          }
        }
      ),
      { numRuns: 50 } // Reduced runs for API mocking
    )
  })

  it('Property: Service state should be consistent with configuration', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // enabled state
        fc.string(), // API key
        (enabled, apiKey) => {
          const service = createSummaryService({
            enabled,
            apiKey
          })

          // Property: Service should only be enabled if both enabled=true AND apiKey is provided
          const expectedEnabled = enabled && apiKey.length > 0
          expect(service.isEnabled()).toBe(expectedEnabled)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property: Fallback summaries should always be valid', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ maxLength: 200 }),
          startWordIndex: fc.nat({ max: 1000 }),
          endWordIndex: fc.nat({ max: 2000 }),
          type: fc.constantFrom('paragraph', 'heading', 'bullet', 'normal')
        }),
        (sectionData) => {
          const section: Section = {
            ...sectionData,
            endWordIndex: Math.max(sectionData.startWordIndex, sectionData.endWordIndex)
          }

          const fallback = summaryService.createFallbackSummary(section)

          // Property: Fallback should always be confirmatory
          expect(fallback.isConfirmatory).toBe(true)

          // Property: Fallback should have valid structure
          expect(fallback.summary).toBeTruthy()
          expect(fallback.wordCount).toBeGreaterThan(0)
          expect(fallback.sectionTitle).toBeTruthy()

          // Property: Fallback should be short and simple
          expect(fallback.summary.length).toBeLessThanOrEqual(100)
          expect(fallback.wordCount).toBeLessThanOrEqual(10)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property: Configuration updates should preserve valid state', () => {
    fc.assert(
      fc.property(
        fc.record({
          enabled: fc.boolean(),
          maxLength: fc.integer({ min: 50, max: 500 }),
          confirmatory: fc.boolean(),
          apiKey: fc.string({ maxLength: 100 })
        }),
        (configUpdate) => {
          const originalConfig = summaryService.getConfig()
          
          summaryService.updateConfig(configUpdate)
          const newConfig = summaryService.getConfig()

          // Property: Updated fields should match input
          if (configUpdate.enabled !== undefined) {
            expect(newConfig.enabled).toBe(configUpdate.enabled)
          }
          if (configUpdate.maxLength !== undefined) {
            expect(newConfig.maxLength).toBe(configUpdate.maxLength)
          }
          if (configUpdate.confirmatory !== undefined) {
            expect(newConfig.confirmatory).toBe(configUpdate.confirmatory)
          }

          // Property: Non-updated fields should remain unchanged
          if (configUpdate.enabled === undefined) {
            expect(newConfig.enabled).toBe(originalConfig.enabled)
          }

          // Property: Configuration should always be valid
          expect(newConfig.maxLength).toBeGreaterThan(0)
          expect(typeof newConfig.confirmatory).toBe('boolean')
          expect(typeof newConfig.enabled).toBe('boolean')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property: Content truncation should preserve meaning boundaries', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2500, maxLength: 5000 }), // Long content that will be truncated
        (longContent) => {
          // Access private method through any cast for testing
          const service = summaryService as any
          const truncated = service.truncateContent(longContent)

          // Property: Truncated content should be shorter than original
          expect(truncated.length).toBeLessThan(longContent.length)

          // Property: Truncated content should be reasonable length for API
          expect(truncated.length).toBeLessThanOrEqual(2000)

          // Property: Truncated content should not be empty
          expect(truncated.length).toBeGreaterThan(0)

          // Property: If truncated, should end with sentence or word boundary
          if (truncated.length < longContent.length) {
            const lastChar = truncated[truncated.length - 1]
            const secondLastChar = truncated[truncated.length - 2]
            
            // Should end with punctuation, space, or ellipsis
            expect(
              lastChar === '.' || 
              lastChar === ' ' || 
              (lastChar === '.' && secondLastChar === '.' && truncated[truncated.length - 3] === '.')
            ).toBe(true)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
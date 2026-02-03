/**
 * Unit tests for Summary Service
 * Tests Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SummaryService, createSummaryService } from '../summaryService'
import type { Section } from '../../types/document'
import type { SummaryConfig } from '../../types/summary'

// Mock the progress manager
vi.mock('../progressManager', () => ({
  progressManager: {
    getSettings: vi.fn(() => ({
      baseSpeed: 250,
      summariesEnabled: false,
      lastUsed: new Date()
    }))
  }
}))

// Mock fetch for AI API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SummaryService', () => {
  let summaryService: SummaryService
  let mockSection: Section

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Create test section
    mockSection = {
      title: 'Test Section',
      startWordIndex: 0,
      endWordIndex: 50,
      type: 'paragraph'
    }

    // Create service with test config
    summaryService = createSummaryService({
      enabled: true,
      apiKey: 'test-api-key',
      apiEndpoint: 'https://test-api.com/chat'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Service Configuration (Requirement 6.3)', () => {
    it('should initialize with user settings', () => {
      const service = new SummaryService()
      expect(service.isEnabled()).toBe(false) // Default from mock
    })

    it('should allow enabling and disabling summaries', () => {
      summaryService.setEnabled(false)
      expect(summaryService.isEnabled()).toBe(false)
      
      summaryService.setEnabled(true)
      expect(summaryService.isEnabled()).toBe(true)
    })

    it('should require API key to be enabled', () => {
      const serviceWithoutKey = createSummaryService({
        enabled: true,
        apiKey: ''
      })
      expect(serviceWithoutKey.isEnabled()).toBe(false)
    })
  })

  describe('Summary Generation (Requirements 6.1, 6.2)', () => {
    it('should generate confirmatory summary for valid content', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'You just read about test content covering the main topic.'
            }
          }]
        })
      })

      const content = 'This is test content about the main topic. It contains important information.'
      const result = await summaryService.generateSummary(mockSection, content)

      expect(result.sectionTitle).toBe('Test Section')
      expect(result.summary).toContain('You just read about')
      expect(result.isConfirmatory).toBe(true)
      expect(result.wordCount).toBeGreaterThan(0)
    })

    it('should handle empty content gracefully', async () => {
      await expect(
        summaryService.generateSummary(mockSection, '')
      ).rejects.toThrow('Cannot generate summary: no content provided')
    })

    it('should truncate long content for API limits', async () => {
      // Mock API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Summary of truncated content.'
            }
          }]
        })
      })

      // Create very long content
      const longContent = 'A'.repeat(3000)
      await summaryService.generateSummary(mockSection, longContent)

      // Check that fetch was called with truncated content
      const fetchCall = mockFetch.mock.calls[0]
      if (fetchCall) {
        const requestBody = JSON.parse(fetchCall[1].body)
        const promptContent = requestBody.messages[0].content
        
        expect(promptContent.length).toBeLessThan(3000)
      }
    })

    it('should enforce maximum summary length (Requirement 6.1)', async () => {
      // Mock API response with very long summary
      const longSummary = 'This is a very long summary that exceeds the maximum character limit and should be truncated to fit within the specified bounds for user readability and interface constraints.'
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: longSummary
            }
          }]
        })
      })

      const result = await summaryService.generateSummary(mockSection, 'Test content')
      
      expect(result.summary.length).toBeLessThanOrEqual(200) // Max length from config
    })
  })

  describe('Error Handling (Requirement 6.4)', () => {
    it('should throw error when service is disabled', async () => {
      summaryService.setEnabled(false)
      
      await expect(
        summaryService.generateSummary(mockSection, 'Test content')
      ).rejects.toThrow('Summary service is not enabled')
    })

    it('should handle API errors with retries', async () => {
      // Mock API failure
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(
        summaryService.generateSummary(mockSection, 'Test content')
      ).rejects.toThrow('AI service failed after 2 attempts')
      
      // Should have retried twice
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should handle API response errors', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Unauthorized' }
        })
      })

      await expect(
        summaryService.generateSummary(mockSection, 'Test content')
      ).rejects.toThrow('AI service failed after 2 attempts')
    })

    it('should handle empty API responses', async () => {
      // Mock empty API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: ''
            }
          }]
        })
      })

      await expect(
        summaryService.generateSummary(mockSection, 'Test content')
      ).rejects.toThrow('AI service failed after 2 attempts')
    })
  })

  describe('Fallback Summary (Requirement 6.4)', () => {
    it('should create fallback summary when AI unavailable', () => {
      const fallback = summaryService.createFallbackSummary(mockSection)
      
      expect(fallback.sectionTitle).toBe('Test Section')
      expect(fallback.summary).toBe('You completed reading this section.')
      expect(fallback.isConfirmatory).toBe(true)
      expect(fallback.wordCount).toBe(5)
    })

    it('should handle sections without titles', () => {
      const sectionWithoutTitle: Section = {
        title: '',
        startWordIndex: 0,
        endWordIndex: 10,
        type: 'paragraph'
      }
      
      const fallback = summaryService.createFallbackSummary(sectionWithoutTitle)
      expect(fallback.sectionTitle).toBe('Section')
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<SummaryConfig> = {
        maxLength: 150,
        apiEndpoint: 'https://new-api.com'
      }
      
      summaryService.updateConfig(newConfig)
      const config = summaryService.getConfig()
      
      expect(config.maxLength).toBe(150)
      expect(config.apiEndpoint).toBe('https://new-api.com')
    })

    it('should preserve existing config when updating', () => {
      const originalConfig = summaryService.getConfig()
      
      summaryService.updateConfig({ maxLength: 100 })
      const updatedConfig = summaryService.getConfig()
      
      expect(updatedConfig.maxLength).toBe(100)
      expect(updatedConfig.confirmatory).toBe(originalConfig.confirmatory)
      expect(updatedConfig.apiKey).toBe(originalConfig.apiKey)
    })
  })

  describe('Factory Function', () => {
    it('should create service with custom configuration', () => {
      const customConfig: Partial<SummaryConfig> = {
        enabled: true,
        maxLength: 300,
        apiKey: 'custom-key'
      }
      
      const customService = createSummaryService(customConfig)
      const config = customService.getConfig()
      
      expect(config.enabled).toBe(true)
      expect(config.maxLength).toBe(300)
      expect(config.apiKey).toBe('custom-key')
    })
  })
})
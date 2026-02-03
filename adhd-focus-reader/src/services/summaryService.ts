/**
 * AI Summary Service for ADHD Focus Reader
 * Generates 1-2 line section summaries to confirm comprehension
 * Validates Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { SummaryGenerator, SectionSummary, SummaryConfig } from '../types/summary'
import type { Section } from '../types/document'
import { errorHandler } from './errorHandler'
import { progressManager } from './progressManager'
import { ErrorType, ErrorSeverity, createAppError } from '../types/errors'

export class SummaryService implements SummaryGenerator {
  private config: SummaryConfig
  private isServiceEnabled: boolean = false

  constructor(config?: Partial<SummaryConfig>) {
    // Get user settings for default enabled state
    const userSettings = progressManager.getSettings()
    
    this.config = {
      enabled: userSettings.summariesEnabled, // Use user preference
      maxLength: 200, // Maximum characters for summary
      confirmatory: true, // Should confirm rather than analyze
      apiEndpoint: import.meta.env.VITE_AI_SUMMARY_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
      apiKey: import.meta.env.VITE_AI_API_KEY || '',
      ...config
    }
    
    this.isServiceEnabled = this.config.enabled && !!this.config.apiKey
  }

  /**
   * Generate a confirmatory summary for a document section
   * Requirement 6.1: Generate 1-2 line summaries after sections
   * Requirement 6.2: Confirm what was read without adding new information
   */
  async generateSummary(section: Section, content: string): Promise<SectionSummary> {
    if (!this.isServiceEnabled) {
      throw createAppError(
        ErrorType.AI_SERVICE_UNAVAILABLE,
        'Summary service is not enabled or configured',
        ErrorSeverity.MEDIUM,
        {
          userMessage: 'Summaries are not available. Continuing without summaries.',
          recoverable: true
        }
      )
    }

    try {
      // Validate inputs
      if (!content || content.trim().length === 0) {
        throw createAppError(
          ErrorType.VALIDATION_ERROR,
          'Cannot generate summary: no content provided',
          ErrorSeverity.LOW,
          {
            userMessage: 'Unable to generate summary for empty section.',
            recoverable: true
          }
        )
      }

      // Truncate content if too long (API limits)
      const truncatedContent = this.truncateContent(content)
      
      // Create confirmatory prompt
      const prompt = this.createConfirmatoryPrompt(section, truncatedContent)
      
      // Call AI service
      const summaryText = await this.callAIService(prompt)
      
      // Validate and format response
      const formattedSummary = this.formatSummary(summaryText)
      
      return {
        sectionTitle: section.title || 'Section',
        summary: formattedSummary,
        wordCount: formattedSummary.split(' ').length,
        isConfirmatory: true // Always confirmatory per requirements
      }
      
    } catch (error) {
      // Handle AI service errors gracefully
      if (error && typeof error === 'object' && 'type' in error) {
        throw error // Re-throw AppErrors
      }
      
      throw errorHandler.handleError(error, {
        action: 'generateSummary',
        sectionTitle: section.title,
        contentLength: content.length
      })
    }
  }

  /**
   * Check if summary service is enabled
   * Requirement 6.3: Toggle functionality to enable/disable summaries
   */
  isEnabled(): boolean {
    return this.isServiceEnabled
  }

  /**
   * Enable or disable summary service
   * Requirement 6.3: Toggle functionality to enable/disable summaries
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    this.isServiceEnabled = enabled && !!this.config.apiKey
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<SummaryConfig>): void {
    this.config = { ...this.config, ...config }
    this.isServiceEnabled = this.config.enabled && !!this.config.apiKey
  }

  /**
   * Get current configuration
   */
  getConfig(): SummaryConfig {
    return { ...this.config }
  }

  // Private methods

  /**
   * Truncate content to fit API limits while preserving meaning
   */
  private truncateContent(content: string): string {
    const maxLength = 2000 // Conservative limit for API calls
    
    if (content.length <= maxLength) {
      return content
    }
    
    // Try to truncate at sentence boundaries
    const truncated = content.substring(0, maxLength)
    const lastSentence = truncated.lastIndexOf('.')
    
    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1)
    }
    
    // Fallback to word boundaries
    const lastSpace = truncated.lastIndexOf(' ')
    return truncated.substring(0, lastSpace) + '...'
  }

  /**
   * Create a prompt that encourages confirmatory rather than analytical summaries
   * Requirement 6.2: Confirm what was read without adding new information
   */
  private createConfirmatoryPrompt(section: Section, content: string): string {
    return `You are helping someone with ADHD confirm their reading comprehension. 

Your task is to create a brief, confirmatory summary that helps the reader feel confident about what they just read. 

IMPORTANT RULES:
- Write exactly 1-2 sentences (maximum 200 characters)
- ONLY confirm what was explicitly stated in the text
- Do NOT add analysis, interpretation, or new information
- Use simple, clear language
- Start with "You just read about..." or "This section covered..."
- Focus on the main topic or key facts mentioned

Section: ${section.title || 'Untitled Section'}

Content to summarize:
${content}

Confirmatory summary:`
  }

  /**
   * Call the AI service with error handling and retries
   */
  private async callAIService(prompt: string): Promise<string> {
    const maxRetries = 2
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.config.apiEndpoint!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 100, // Keep summaries short
            temperature: 0.3, // Low temperature for consistent, factual responses
            top_p: 0.9
          })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`AI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
        }

        const data = await response.json()
        const summary = data.choices?.[0]?.message?.content?.trim()

        if (!summary) {
          throw new Error('AI service returned empty response')
        }

        return summary

      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          throw createAppError(
            ErrorType.AI_SERVICE_ERROR,
            `AI service failed after ${maxRetries} attempts: ${lastError.message}`,
            ErrorSeverity.MEDIUM,
            {
              userMessage: 'Unable to generate summary. Continuing without summaries.',
              context: { attempt, error: lastError.message },
              recoverable: true
            }
          )
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      }
    }

    throw lastError!
  }

  /**
   * Format and validate the AI-generated summary
   * Requirement 6.1: Ensure summaries are 1-2 lines
   */
  private formatSummary(summaryText: string): string {
    // Clean up the response
    let formatted = summaryText
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace

    // Ensure it's not too long
    if (formatted.length > this.config.maxLength) {
      // Try to truncate at sentence boundary
      const sentences = formatted.split(/[.!?]+/)
      if (sentences.length > 1 && sentences[0] && sentences[0].length <= this.config.maxLength) {
        formatted = sentences[0] + '.'
      } else {
        // Truncate at word boundary
        const words = formatted.split(' ')
        let truncated = ''
        for (const word of words) {
          if ((truncated + ' ' + word).length > this.config.maxLength - 3) {
            break
          }
          truncated += (truncated ? ' ' : '') + word
        }
        formatted = truncated + '...'
      }
    }

    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(formatted)) {
      formatted += '.'
    }

    return formatted
  }

  /**
   * Create a fallback summary when AI service is unavailable
   * Requirement 6.4: Continue reading without summaries when disabled
   */
  createFallbackSummary(section: Section): SectionSummary {
    return {
      sectionTitle: section.title || 'Section',
      summary: `You completed reading this section.`,
      wordCount: 5,
      isConfirmatory: true
    }
  }
}

// Export singleton instance
export const summaryService = new SummaryService()

/**
 * Factory function to create summary service with custom configuration
 */
export function createSummaryService(config?: Partial<SummaryConfig>): SummaryService {
  return new SummaryService(config)
}
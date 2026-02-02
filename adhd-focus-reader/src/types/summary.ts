/**
 * AI Summary interfaces for ADHD Focus Reader
 * Validates Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { Section } from './document'

export interface SummaryGenerator {
  generateSummary(section: Section, content: string): Promise<SectionSummary>
  isEnabled(): boolean
  setEnabled(enabled: boolean): void
}

export interface SectionSummary {
  sectionTitle: string
  summary: string
  wordCount: number
  isConfirmatory: boolean // true if confirms what was read, false if adds new info
}

export interface SummaryConfig {
  enabled: boolean
  maxLength: number // characters
  confirmatory: boolean // should confirm rather than analyze
  apiEndpoint?: string
  apiKey?: string
}
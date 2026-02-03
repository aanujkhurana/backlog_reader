/**
 * Integration tests for Summary View
 * Tests Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import SummaryView from '../SummaryView.vue'

// Mock services
const mockSummaryService = {
  isEnabled: vi.fn(() => true),
  generateSummary: vi.fn(),
  createFallbackSummary: vi.fn(() => ({
    sectionTitle: 'Test Section',
    summary: 'You completed reading this section.',
    wordCount: 5,
    isConfirmatory: true
  }))
}

const mockProgressManager = {
  getDocumentStructure: vi.fn(() => ({
    id: 'test-doc',
    title: 'Test Document',
    totalWords: 100,
    sections: [
      {
        title: 'Test Section',
        startWordIndex: 0,
        endWordIndex: 50,
        type: 'paragraph'
      }
    ],
    words: Array.from({ length: 100 }, (_, i) => ({
      text: `word${i}`,
      orp: 0,
      baseDelay: 250,
      punctuationPause: 0,
      isLongWord: false
    })),
    createdAt: new Date(),
    lastPosition: 0
  })),
  savePosition: vi.fn()
}

vi.mock('../../services/summaryService', () => ({
  summaryService: mockSummaryService
}))

vi.mock('../../services/progressManager', () => ({
  progressManager: mockProgressManager
}))

describe('SummaryView', () => {
  let router: any
  let wrapper: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create test router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: '/summary/:documentId',
          name: 'summary',
          component: SummaryView
        },
        {
          path: '/reading/:documentId',
          name: 'reading',
          component: { template: '<div>Reading View</div>' }
        },
        {
          path: '/',
          name: 'home',
          component: { template: '<div>Home View</div>' }
        }
      ]
    })

    // Navigate to summary route with test parameters
    await router.push({
      name: 'summary',
      params: { documentId: 'test-doc' },
      query: {
        sectionIndex: '0',
        position: '50',
        totalWords: '100'
      }
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.restoreAllMocks()
  })

  describe('Summary Generation (Requirements 6.1, 6.2)', () => {
    it('should display loading state initially', async () => {
      // Mock slow summary generation
      mockSummaryService.generateSummary.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.summary-loading').exists()).toBe(true)
      expect(wrapper.find('.loading-text').text()).toContain('Generating quick recap')
    })

    it('should display generated summary when successful', async () => {
      const mockSummary = {
        sectionTitle: 'Introduction',
        summary: 'You just read about the main concepts and key principles.',
        wordCount: 10,
        isConfirmatory: true
      }

      mockSummaryService.generateSummary.mockResolvedValue(mockSummary)

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      // Wait for summary generation
      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.summary-content').exists()).toBe(true)
      expect(wrapper.find('.summary-title').text()).toBe('Quick Recap')
      expect(wrapper.find('.summary-subtitle').text()).toBe('Introduction')
      expect(wrapper.find('.summary-text').text()).toBe(mockSummary.summary)
    })

    it('should display fallback summary when AI service fails', async () => {
      mockSummaryService.generateSummary.mockRejectedValue(new Error('AI service unavailable'))

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      // Wait for error handling and fallback
      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.summary-content').exists()).toBe(true)
      expect(wrapper.find('.summary-text').text()).toBe('You completed reading this section.')
    })
  })

  describe('User Interactions (Requirements 6.4, 6.5)', () => {
    beforeEach(async () => {
      const mockSummary = {
        sectionTitle: 'Test Section',
        summary: 'You just read about test content.',
        wordCount: 7,
        isConfirmatory: true
      }

      mockSummaryService.generateSummary.mockResolvedValue(mockSummary)

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      // Wait for summary to load
      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()
    })

    it('should navigate back to reading when continue button is clicked', async () => {
      const continueButton = wrapper.find('.continue-button')
      expect(continueButton.exists()).toBe(true)

      await continueButton.trigger('click')

      expect(router.currentRoute.value.name).toBe('reading')
      expect(router.currentRoute.value.params.documentId).toBe('test-doc')
      expect(router.currentRoute.value.query.position).toBe('50')
      expect(router.currentRoute.value.query.resumeFromSummary).toBe('true')
    })

    it('should save position and navigate to home when pause button is clicked', async () => {
      const pauseButton = wrapper.find('.pause-button')
      expect(pauseButton.exists()).toBe(true)

      await pauseButton.trigger('click')

      expect(mockProgressManager.savePosition).toHaveBeenCalledWith('test-doc', 50)
      expect(router.currentRoute.value.name).toBe('home')
    })

    it('should focus continue button for accessibility', async () => {
      const continueButton = wrapper.find('.continue-button')
      
      // Check that the button can receive focus
      expect(continueButton.element.tabIndex).not.toBe(-1)
    })
  })

  describe('Progress Display', () => {
    it('should display correct progress percentage', async () => {
      mockSummaryService.generateSummary.mockResolvedValue({
        sectionTitle: 'Test',
        summary: 'Test summary',
        wordCount: 2,
        isConfirmatory: true
      })

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      const progressText = wrapper.find('.progress-text')
      expect(progressText.text()).toBe('50% complete') // 50/100 = 50%

      const progressBar = wrapper.find('.progress-bar')
      expect(progressBar.attributes('style')).toContain('width: 50%')
    })
  })

  describe('Error Handling (Requirement 6.4)', () => {
    it('should display error state when document not found', async () => {
      mockProgressManager.getDocumentStructure.mockReturnValue(null)

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.summary-error').exists()).toBe(true)
      expect(wrapper.find('.error-title').text()).toBe('Summary Unavailable')
    })

    it('should display error state when section not found', async () => {
      // Mock document with no sections
      mockProgressManager.getDocumentStructure.mockReturnValue({
        sections: [],
        words: []
      })

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.summary-error').exists()).toBe(true)
    })

    it('should allow continuing even when summary fails', async () => {
      mockSummaryService.generateSummary.mockRejectedValue(new Error('Service error'))
      mockSummaryService.createFallbackSummary.mockImplementation(() => {
        throw new Error('Fallback also failed')
      })

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      const continueButton = wrapper.find('.continue-button')
      expect(continueButton.exists()).toBe(true)
      expect(continueButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Responsive Design', () => {
    it('should render properly on mobile viewports', async () => {
      mockSummaryService.generateSummary.mockResolvedValue({
        sectionTitle: 'Mobile Test',
        summary: 'Mobile summary test.',
        wordCount: 3,
        isConfirmatory: true
      })

      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480
      })

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      // Check that mobile-specific classes and structure are applied
      expect(wrapper.find('.summary-container').exists()).toBe(true)
      expect(wrapper.find('.summary-actions').exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and structure', async () => {
      mockSummaryService.generateSummary.mockResolvedValue({
        sectionTitle: 'Accessibility Test',
        summary: 'Accessibility summary.',
        wordCount: 2,
        isConfirmatory: true
      })

      wrapper = mount(SummaryView, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      await wrapper.vm.$nextTick()

      // Check for proper heading structure
      expect(wrapper.find('h1').exists()).toBe(true)
      
      // Check for keyboard navigation support
      const continueButton = wrapper.find('.continue-button')
      expect(continueButton.element.tagName).toBe('BUTTON')
    })
  })
})
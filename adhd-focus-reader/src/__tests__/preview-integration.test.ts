import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import DocumentPreviewView from '../views/DocumentPreviewView.vue'
import type { DocumentStructure } from '../types'

// Mock the services
vi.mock('../services', () => ({
  progressManager: {
    getDocumentStructure: vi.fn(),
    savePosition: vi.fn()
  }
}))

const mockDocumentStructure: DocumentStructure = {
  id: 'test-doc-1',
  title: 'Test Document for Preview',
  totalWords: 50,
  sections: [
    {
      title: 'Introduction',
      startWordIndex: 0,
      endWordIndex: 19,
      type: 'heading'
    },
    {
      title: 'Main Content',
      startWordIndex: 20,
      endWordIndex: 39,
      type: 'paragraph'
    },
    {
      title: 'Conclusion',
      startWordIndex: 40,
      endWordIndex: 49,
      type: 'normal'
    }
  ],
  words: Array.from({ length: 50 }, (_, i) => ({
    text: `word${i}`,
    orp: 0,
    baseDelay: 250,
    punctuationPause: 0,
    isLongWord: false
  })),
  createdAt: new Date(),
  lastPosition: 0
}

describe('Document Preview Integration', () => {
  let router: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/preview/:documentId', name: 'preview', component: DocumentPreviewView },
        { path: '/setup/:documentId', name: 'setup', component: { template: '<div>Setup</div>' } }
      ]
    })
  })

  it('should integrate preview functionality with document selection', async () => {
    const { progressManager } = await import('../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    const mockPush = vi.fn()
    router.push = mockPush

    await router.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [router]
      }
    })

    // Wait for component to load
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    // Verify document information is displayed
    expect(wrapper.find('.preview-title').text()).toBe('Test Document for Preview')
    expect(wrapper.find('.preview-subtitle').text()).toContain('50 words')

    // Verify sections are rendered
    const sections = wrapper.findAll('.section')
    expect(sections).toHaveLength(3)

    // Test section selection workflow
    await sections[1]?.trigger('click')

    // Verify confirmation modal appears
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('.modal-header h2').text()).toBe('Start Reading From Here?')

    // Confirm selection
    const confirmButton = wrapper.find('.confirm-button')
    await confirmButton.trigger('click')

    // Verify position was saved and navigation occurred
    expect(progressManager.savePosition).toHaveBeenCalledWith('test-doc-1', 20)
    expect(mockPush).toHaveBeenCalledWith({
      name: 'setup',
      params: { documentId: 'test-doc-1' },
      query: {
        customStart: 'true',
        startPosition: '20'
      }
    })
  })

  it('should handle start from beginning workflow', async () => {
    const { progressManager } = await import('../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    const mockPush = vi.fn()
    router.push = mockPush

    await router.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    // Click start from beginning
    const startButton = wrapper.find('.start-button')
    await startButton.trigger('click')

    // Verify navigation to setup without custom position
    expect(mockPush).toHaveBeenCalledWith({
      name: 'setup',
      params: { documentId: 'test-doc-1' }
    })
  })

  it('should display section information correctly', async () => {
    const { progressManager } = await import('../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    await router.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const sections = wrapper.findAll('.section')
    
    // Check first section (heading)
    expect(sections[0]?.find('.section-type-icon').text()).toBe('📋')
    expect(sections[0]?.find('.section-meta').text()).toContain('Words 1-20')
    
    // Check second section (paragraph)
    expect(sections[1]?.find('.section-type-icon').text()).toBe('📄')
    expect(sections[1]?.find('.section-meta').text()).toContain('Words 21-40')
    
    // Check third section (normal)
    expect(sections[2]?.find('.section-type-icon').text()).toBe('📄')
    expect(sections[2]?.find('.section-meta').text()).toContain('Words 41-50')
  })
})
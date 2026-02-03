import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import DocumentPreviewView from '../DocumentPreviewView.vue'
import type { DocumentStructure } from '../../types'

// Mock the services
vi.mock('../../services', () => ({
  progressManager: {
    getDocumentStructure: vi.fn(),
    savePosition: vi.fn()
  }
}))

// Mock router
const mockRouter = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/preview/:documentId', name: 'preview', component: DocumentPreviewView },
    { path: '/setup/:documentId', name: 'setup', component: { template: '<div>Setup</div>' } }
  ]
})

const mockDocumentStructure: DocumentStructure = {
  id: 'test-doc-1',
  title: 'Test Document',
  totalWords: 100,
  sections: [
    {
      title: 'Introduction',
      startWordIndex: 0,
      endWordIndex: 29,
      type: 'heading'
    },
    {
      title: 'Main Content',
      startWordIndex: 30,
      endWordIndex: 69,
      type: 'paragraph'
    },
    {
      title: 'Bullet Points',
      startWordIndex: 70,
      endWordIndex: 99,
      type: 'bullet'
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
}

describe('DocumentPreviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders document preview with sections', async () => {
    const { progressManager } = await import('../../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    // Set up router with the document ID
    await mockRouter.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [mockRouter]
      }
    })

    // Wait for component to load
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.find('.preview-title').text()).toBe('Test Document')
    expect(wrapper.find('.preview-subtitle').text()).toContain('100 words')
    expect(wrapper.findAll('.section')).toHaveLength(3)
  })

  it('displays correct section types and icons', async () => {
    const { progressManager } = await import('../../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    await mockRouter.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [mockRouter]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const sections = wrapper.findAll('.section')
    
    // Check section types
    expect(sections[0]?.classes()).toContain('section-heading')
    expect(sections[1]?.classes()).toContain('section-paragraph')
    expect(sections[2]?.classes()).toContain('section-bullet')

    // Check section icons
    const icons = wrapper.findAll('.section-type-icon')
    expect(icons[0]?.text()).toBe('📋')
    expect(icons[1]?.text()).toBe('📄')
    expect(icons[2]?.text()).toBe('•')
  })

  it('handles section selection and confirmation', async () => {
    const { progressManager } = await import('../../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    await mockRouter.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [mockRouter]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    // Click on the second section
    const sections = wrapper.findAll('.section')
    await sections[1]?.trigger('click')

    // Check that confirmation modal appears
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('.modal-header h2').text()).toBe('Start Reading From Here?')

    // Check that section is highlighted
    expect(sections[1]?.classes()).toContain('section-selected')
  })

  it('saves position and navigates on confirmation', async () => {
    const { progressManager } = await import('../../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    const mockPush = vi.fn()
    mockRouter.push = mockPush

    await mockRouter.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [mockRouter]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    // Select a section
    const sections = wrapper.findAll('.section')
    await sections[1]?.trigger('click')

    // Confirm selection
    const confirmButton = wrapper.find('.confirm-button')
    await confirmButton.trigger('click')

    // Check that position was saved
    expect(progressManager.savePosition).toHaveBeenCalledWith('test-doc-1', 30)

    // Check navigation
    expect(mockPush).toHaveBeenCalledWith({
      name: 'setup',
      params: { documentId: 'test-doc-1' },
      query: {
        customStart: 'true',
        startPosition: '30'
      }
    })
  })

  it('handles document not found error', async () => {
    const { progressManager } = await import('../../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(null)

    await mockRouter.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [mockRouter]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.find('.error-state').exists()).toBe(true)
    expect(wrapper.find('.error-state h3').text()).toBe('Unable to load document')
  })

  it('navigates to setup when start from beginning is clicked', async () => {
    const { progressManager } = await import('../../services')
    vi.mocked(progressManager.getDocumentStructure).mockReturnValue(mockDocumentStructure)

    const mockPush = vi.fn()
    mockRouter.push = mockPush

    await mockRouter.push('/preview/test-doc-1')

    const wrapper = mount(DocumentPreviewView, {
      global: {
        plugins: [mockRouter]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const startButton = wrapper.find('.start-button')
    await startButton.trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'setup',
      params: { documentId: 'test-doc-1' }
    })
  })
})
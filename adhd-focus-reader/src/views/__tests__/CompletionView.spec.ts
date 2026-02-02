import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import CompletionView from '../CompletionView.vue'
import { progressManager } from '../../services'

// Mock the progress manager
vi.mock('../../services', () => ({
  progressManager: {
    getDocumentById: vi.fn(),
    savePosition: vi.fn()
  }
}))

const mockProgressManager = vi.mocked(progressManager)

describe('CompletionView', () => {
  let router: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a mock router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        { path: '/setup/:documentId', name: 'setup', component: { template: '<div>Setup</div>' } },
        { path: '/completion/:documentId', name: 'completion', component: CompletionView }
      ]
    })
  })

  it('should render completion screen with success message', async () => {
    mockProgressManager.getDocumentById.mockReturnValue({
      id: 'test-doc',
      title: 'Test Document',
      totalWords: 1000,
      lastPosition: 1000,
      uploadedAt: new Date(),
      isCompleted: true
    })

    // Navigate to completion route
    await router.push('/completion/test-doc')

    const wrapper = mount(CompletionView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Check for completion elements
    expect(wrapper.find('.completion-container').exists()).toBe(true)
    expect(wrapper.find('.success-icon').exists()).toBe(true)
    expect(wrapper.find('.completion-title').text()).toBe('Document Complete')
    expect(wrapper.find('.completion-message').text()).toContain('Test Document')
    expect(wrapper.find('.primary-action').text()).toBe('Read Another Document')
  })

  it('should have read again button when document can be read again', async () => {
    mockProgressManager.getDocumentById.mockReturnValue({
      id: 'test-doc',
      title: 'Test Document',
      totalWords: 1000,
      lastPosition: 1000,
      uploadedAt: new Date(),
      isCompleted: true
    })

    await router.push('/completion/test-doc')

    const wrapper = mount(CompletionView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.secondary-action').exists()).toBe(true)
    expect(wrapper.find('.secondary-action').text()).toBe('Read This Again')
  })

  it('should have navigation methods available', async () => {
    mockProgressManager.getDocumentById.mockReturnValue({
      id: 'test-doc',
      title: 'Test Document',
      totalWords: 1000,
      lastPosition: 1000,
      uploadedAt: new Date(),
      isCompleted: true
    })

    await router.push('/completion/test-doc')

    const wrapper = mount(CompletionView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Check that navigation methods exist
    expect(typeof wrapper.vm.returnHome).toBe('function')
    expect(typeof wrapper.vm.readAgain).toBe('function')
    
    // Check that buttons exist and can be clicked
    const primaryButton = wrapper.find('.primary-action')
    const secondaryButton = wrapper.find('.secondary-action')
    
    expect(primaryButton.exists()).toBe(true)
    expect(secondaryButton.exists()).toBe(true)
    
    // Test that clicking doesn't throw errors
    await primaryButton.trigger('click')
    await secondaryButton.trigger('click')
  })

  it('should handle missing document gracefully', async () => {
    mockProgressManager.getDocumentById.mockReturnValue(null)

    await router.push('/completion/missing-doc')

    const wrapper = mount(CompletionView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Should still render with default title
    expect(wrapper.find('.completion-message').text()).toContain('your document')
  })
})
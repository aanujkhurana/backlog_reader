/**
 * Unit tests for SetupView component
 * Tests setup screen functionality and user interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import SetupView from '../SetupView.vue'
import { progressManager } from '../../services'
import type { DocumentSummary } from '../../types'

// Mock the progress manager
vi.mock('../../services', () => ({
  progressManager: {
    getDocumentById: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn()
  }
}))

const mockProgressManager = progressManager as any

describe('SetupView', () => {
  let router: any
  let wrapper: any

  const mockDocument: DocumentSummary = {
    id: 'test-doc-1',
    title: 'Test Document',
    totalWords: 1500,
    lastPosition: 0,
    uploadedAt: new Date(),
    isCompleted: false
  }

  beforeEach(() => {
    // Create router for testing
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/setup/:documentId', name: 'setup', component: SetupView }
      ]
    })

    // Reset mocks
    vi.clearAllMocks()
    
    // Setup default mock returns
    mockProgressManager.getDocumentById.mockReturnValue(mockDocument)
    mockProgressManager.getSettings.mockReturnValue({
      baseSpeed: 250,
      summariesEnabled: false,
      lastUsed: new Date()
    })
  })

  it('renders setup screen with document information', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.setup-title').text()).toBe('Test Document')
    expect(wrapper.find('.setup-subtitle').text()).toContain('1500 words')
    expect(wrapper.find('.setup-subtitle').text()).toContain('reading time')
  })

  it('displays speed options correctly', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    const speedButtons = wrapper.findAll('.speed-button')
    expect(speedButtons).toHaveLength(3)
    
    expect(speedButtons[0].text()).toContain('Slow')
    expect(speedButtons[0].text()).toContain('180 words per minute')
    
    expect(speedButtons[1].text()).toContain('Normal')
    expect(speedButtons[1].text()).toContain('250 words per minute')
    
    expect(speedButtons[2].text()).toContain('Fast')
    expect(speedButtons[2].text()).toContain('350 words per minute')
  })

  it('calculates estimated reading time correctly', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Default speed is 250 WPM, 1500 words = 6 minutes
    expect(wrapper.find('.setup-subtitle').text()).toContain('6 min')
    
    // Click fast speed (350 WPM)
    await wrapper.findAll('.speed-button')[2].trigger('click')
    await wrapper.vm.$nextTick()
    
    // 1500 words at 350 WPM = ~4.3 minutes, rounded up to 5
    expect(wrapper.find('.setup-subtitle').text()).toContain('5 min')
  })

  it('allows speed selection', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    // Initially Normal (250 WPM) should be selected
    expect(wrapper.findAll('.speed-button')[1].classes()).toContain('active')
    
    // Click Slow speed
    await wrapper.findAll('.speed-button')[0].trigger('click')
    await wrapper.vm.$nextTick()
    
    expect(wrapper.findAll('.speed-button')[0].classes()).toContain('active')
    expect(wrapper.findAll('.speed-button')[1].classes()).not.toContain('active')
  })

  it('allows toggling auto pacing', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    const autoPacingToggle = wrapper.find('input[type="checkbox"]')
    
    // Should be enabled by default
    expect(autoPacingToggle.element.checked).toBe(true)
    
    // Toggle off
    await autoPacingToggle.trigger('click')
    expect(autoPacingToggle.element.checked).toBe(false)
  })

  it('allows toggling section summaries', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    const summaryToggles = wrapper.findAll('input[type="checkbox"]')
    const summariesToggle = summaryToggles[1] // Second toggle is summaries
    
    // Should be disabled by default
    expect(summariesToggle.element.checked).toBe(false)
    
    // Toggle on
    await summariesToggle.trigger('click')
    expect(summariesToggle.element.checked).toBe(true)
  })

  it('saves settings when starting reading', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    // Wait for component to mount
    await wrapper.vm.$nextTick()

    // Change speed to fast
    await wrapper.findAll('.speed-button')[2].trigger('click')
    await wrapper.vm.$nextTick()
    
    // Click start reading
    await wrapper.find('.start-button').trigger('click')
    
    expect(mockProgressManager.updateSettings).toHaveBeenCalledWith({
      baseSpeed: 350,
      summariesEnabled: false // Default value
    })
  })

  it('saves default settings when skipping setup', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    // Click skip setup
    await wrapper.find('.skip-button').trigger('click')
    
    expect(mockProgressManager.updateSettings).toHaveBeenCalledWith({
      baseSpeed: 250,
      summariesEnabled: false
    })
  })

  it('loads user preferences on mount', async () => {
    // Mock user with custom preferences
    mockProgressManager.getSettings.mockReturnValue({
      baseSpeed: 180,
      summariesEnabled: true,
      lastUsed: new Date()
    })

    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    // Should load slow speed and enabled summaries
    expect(wrapper.findAll('.speed-button')[0].classes()).toContain('active')
    expect(wrapper.findAll('input[type="checkbox"]')[1].element.checked).toBe(true)
  })

  it('handles missing document gracefully', async () => {
    mockProgressManager.getDocumentById.mockReturnValue(null)

    await router.push('/setup/missing-doc')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.setup-title').text()).toBe('Document')
    expect(wrapper.find('.setup-subtitle').text()).toContain('0 words')
  })

  it('displays setup timer indicator', async () => {
    await router.push('/setup/test-doc-1')
    
    wrapper = mount(SetupView, {
      global: {
        plugins: [router]
      }
    })

    expect(wrapper.find('.timer-text').text()).toContain('Setup completes in under 5 seconds')
  })
})
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../LandingView.vue'

// Mock the services
vi.mock('../../services', () => ({
  documentProcessor: {
    parseDocument: vi.fn(),
    processPastedText: vi.fn(),
    extractStructure: vi.fn()
  },
  progressManager: {
    getRecentDocuments: vi.fn(() => []),
    getMostRecentUnfinished: vi.fn(() => null),
    storeDocument: vi.fn()
  }
}))

describe('LandingView', () => {
  let router: any

  beforeEach(() => {
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: LandingView }
      ]
    })
  })

  it('renders the main headline correctly', () => {
    const wrapper = mount(LandingView, {
      global: {
        plugins: [router]
      }
    })

    expect(wrapper.find('.hero-title').text()).toBe('Finish documents without losing focus')
    expect(wrapper.find('.hero-subtitle').text()).toContain('Upload a document or paste text')
  })

  it('shows drag and drop area', () => {
    const wrapper = mount(LandingView, {
      global: {
        plugins: [router]
      }
    })

    const dropZone = wrapper.find('.drop-zone')
    expect(dropZone.exists()).toBe(true)
    expect(dropZone.text()).toContain('Drop PDF or DOCX files here')
  })

  it('shows paste text button', () => {
    const wrapper = mount(LandingView, {
      global: {
        plugins: [router]
      }
    })

    const pasteButton = wrapper.find('.paste-button')
    expect(pasteButton.exists()).toBe(true)
    expect(pasteButton.text()).toBe('Paste Text Instead')
  })

  it('opens paste modal when paste button is clicked', async () => {
    const wrapper = mount(LandingView, {
      global: {
        plugins: [router]
      }
    })

    const pasteButton = wrapper.find('.paste-button')
    await pasteButton.trigger('click')

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('.modal-header h2').text()).toBe('Paste Your Text')
  })

  it('does not show continue reading section when no unfinished documents', () => {
    const wrapper = mount(LandingView, {
      global: {
        plugins: [router]
      }
    })

    expect(wrapper.find('.continue-section').exists()).toBe(false)
  })

  it('does not show recent documents section when no documents exist', () => {
    const wrapper = mount(LandingView, {
      global: {
        plugins: [router]
      }
    })

    expect(wrapper.find('.recent-section').exists()).toBe(false)
  })
})
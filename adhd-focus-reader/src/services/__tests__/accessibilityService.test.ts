/**
 * Unit tests for Accessibility Service
 * Tests WCAG 2.1 AA compliance and screen reader support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AccessibilityService } from '../accessibilityService'

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    setAttribute: vi.fn(),
    style: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    textContent: '',
    parentNode: {
      removeChild: vi.fn()
    }
  }))
})

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn()
})

Object.defineProperty(document, 'addEventListener', {
  value: vi.fn()
})

Object.defineProperty(document, 'removeEventListener', {
  value: vi.fn()
})

// Mock window.matchMedia
const mockMatchMedia = vi.fn((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}))

Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia,
  writable: true
})

describe('AccessibilityService', () => {
  let accessibilityService: AccessibilityService

  beforeEach(() => {
    vi.clearAllMocks()
    accessibilityService = new AccessibilityService()
  })

  afterEach(() => {
    accessibilityService.destroy()
  })

  describe('Contrast Ratio Calculation', () => {
    it('should calculate correct contrast ratio for black and white', () => {
      const result = accessibilityService.calculateContrastRatio('#ffffff', '#000000')
      
      expect(result.ratio).toBe(21) // Perfect contrast
      expect(result.isCompliant).toBe(true)
      expect(result.level).toBe('AAA')
    })

    it('should calculate correct contrast ratio for gray colors', () => {
      const result = accessibilityService.calculateContrastRatio('#666666', '#ffffff')
      
      expect(result.ratio).toBeGreaterThan(4.5) // Should meet AA standard
      expect(result.isCompliant).toBe(true)
      expect(result.level).toBe('AA')
    })

    it('should identify non-compliant color combinations', () => {
      const result = accessibilityService.calculateContrastRatio('#cccccc', '#ffffff')
      
      expect(result.ratio).toBeLessThan(4.5)
      expect(result.isCompliant).toBe(false)
      expect(result.level).toBe('FAIL')
    })
  })

  describe('Color Scheme Validation', () => {
    it('should validate default color scheme', () => {
      const colors = {
        background: '#000000',
        text: '#ffffff',
        orp: '#ff0000',
        progress: '#ffffff'
      }

      const validation = accessibilityService.validateColorScheme(colors)
      
      expect(validation.text.isCompliant).toBe(true)
      expect(validation.orp.isCompliant).toBe(true)
      expect(validation.progress.isCompliant).toBe(true)
    })

    it('should provide accessible color scheme', () => {
      const scheme = accessibilityService.getAccessibleColorScheme()
      
      expect(scheme.background).toBe('#000000')
      expect(scheme.text).toBe('#ffffff')
      expect(scheme.orp).toBe('#ff0000')
      expect(scheme.progress).toBe('rgba(255, 255, 255, 0.25)')
    })

    it('should provide high contrast color scheme when enabled', () => {
      const highContrastService = new AccessibilityService({ highContrast: true })
      const scheme = highContrastService.getAccessibleColorScheme()
      
      expect(scheme.orp).toBe('#ffff00') // Yellow for better contrast
      
      highContrastService.destroy()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should setup keyboard navigation with callbacks', () => {
      const callbacks = {
        onPauseResume: vi.fn(),
        onJumpBack: vi.fn(),
        onJumpForward: vi.fn(),
        onSpeedUp: vi.fn(),
        onSpeedDown: vi.fn(),
        onExit: vi.fn()
      }

      accessibilityService.setupKeyboardNavigation(callbacks)
      
      // Verify event listener was added
      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      )
    })

    it('should remove keyboard navigation', () => {
      const callbacks = {
        onPauseResume: vi.fn(),
        onJumpBack: vi.fn(),
        onJumpForward: vi.fn(),
        onSpeedUp: vi.fn(),
        onSpeedDown: vi.fn(),
        onExit: vi.fn()
      }

      accessibilityService.setupKeyboardNavigation(callbacks)
      accessibilityService.removeKeyboardNavigation()
      
      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { capture: true }
      )
    })
  })

  describe('Screen Reader Announcements', () => {
    it('should announce state changes', () => {
      const mockAnnouncer = {
        textContent: '',
        setAttribute: vi.fn(),
        style: {}
      }
      
      // Mock the announcer element
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnnouncer as any)
      
      const service = new AccessibilityService({ announceStateChanges: true })
      
      service.announceStateChange('started', { totalWords: 1000 })
      
      // Should create announcer element
      expect(document.createElement).toHaveBeenCalledWith('div')
      
      service.destroy()
    })

    it('should announce progress milestones', () => {
      const service = new AccessibilityService({ announceProgress: true })
      
      // Mock announcer
      const mockAnnouncer = { textContent: '' }
      ;(service as any).announcer = mockAnnouncer
      
      service.announceProgress(250, 1000) // 25%
      
      // Should announce milestone
      setTimeout(() => {
        expect(mockAnnouncer.textContent).toBe('25% complete')
      }, 150)
      
      service.destroy()
    })

    it('should not announce progress for non-milestones', () => {
      const service = new AccessibilityService({ announceProgress: true })
      
      // Mock announcer
      const mockAnnouncer = { textContent: '' }
      ;(service as any).announcer = mockAnnouncer
      
      service.announceProgress(230, 1000) // 23%
      
      // Should not announce
      setTimeout(() => {
        expect(mockAnnouncer.textContent).toBe('')
      }, 150)
      
      service.destroy()
    })
  })

  describe('Accessible Button Creation', () => {
    it('should create accessible button with proper attributes', () => {
      const mockButton = {
        textContent: '',
        addEventListener: vi.fn(),
        setAttribute: vi.fn(),
        style: {},
        className: ''
      }
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockButton as any)
      
      const onClick = vi.fn()
      const button = accessibilityService.createAccessibleButton('Test Button', onClick, {
        ariaLabel: 'Test button for testing',
        className: 'test-btn'
      })
      
      expect(mockButton.textContent).toBe('Test Button')
      expect(mockButton.setAttribute).toHaveBeenCalledWith('aria-label', 'Test button for testing')
      expect(mockButton.className).toBe('test-btn')
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', onClick)
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        announceWords: true,
        highContrast: true
      }
      
      accessibilityService.updateConfig(newConfig)
      const config = accessibilityService.getConfig()
      
      expect(config.announceWords).toBe(true)
      expect(config.highContrast).toBe(true)
    })

    it('should return current configuration', () => {
      const config = accessibilityService.getConfig()
      
      expect(config).toHaveProperty('announceWords')
      expect(config).toHaveProperty('announceProgress')
      expect(config).toHaveProperty('announceStateChanges')
      expect(config).toHaveProperty('highContrast')
      expect(config).toHaveProperty('reducedMotion')
      expect(config).toHaveProperty('keyboardNavigation')
    })
  })

  describe('Focus Management', () => {
    it('should manage focus with options', () => {
      const mockElement = {
        focus: vi.fn(),
        getAttribute: vi.fn().mockReturnValue('Test Element'),
        textContent: 'Test Content'
      }
      
      accessibilityService.manageFocus(mockElement as any, {
        preventScroll: true,
        announceChange: true
      })
      
      expect(mockElement.focus).toHaveBeenCalledWith({ preventScroll: true })
    })
  })

  describe('User Preference Detection', () => {
    it('should detect high contrast preference', () => {
      const mockMatchMedia = vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn()
      }))
      
      Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia })
      
      const service = new AccessibilityService()
      const config = service.getConfig()
      
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-contrast: high)')
      
      service.destroy()
    })

    it('should detect reduced motion preference', () => {
      const mockMatchMedia = vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn()
      }))
      
      Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia })
      
      const service = new AccessibilityService()
      
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
      
      service.destroy()
    })
  })
})
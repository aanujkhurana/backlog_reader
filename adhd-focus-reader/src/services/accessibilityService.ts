/**
 * Accessibility Service for ADHD Focus Reader
 * Ensures WCAG 2.1 AA compliance and screen reader support
 * Requirements: 2.4, 2.5, 4.1, 4.2, 4.3, 4.4
 */

export interface AccessibilityConfig {
  announceWords: boolean
  announceProgress: boolean
  announceStateChanges: boolean
  highContrast: boolean
  reducedMotion: boolean
  keyboardNavigation: boolean
}

export interface ContrastRatio {
  foreground: string
  background: string
  ratio: number
  isCompliant: boolean
  level: 'AA' | 'AAA' | 'FAIL'
}

export class AccessibilityService {
  private config: AccessibilityConfig
  private announcer: HTMLElement | null = null
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null

  constructor(config?: Partial<AccessibilityConfig>) {
    this.config = {
      announceWords: false, // Don't announce every word by default (too verbose)
      announceProgress: true,
      announceStateChanges: true,
      highContrast: false,
      reducedMotion: false,
      keyboardNavigation: true,
      ...config
    }

    this.initializeAccessibility()
  }

  /**
   * Initialize accessibility features
   */
  private initializeAccessibility(): void {
    this.createScreenReaderAnnouncer()
    this.detectUserPreferences()
  }

  /**
   * Create hidden element for screen reader announcements
   */
  private createScreenReaderAnnouncer(): void {
    this.announcer = document.createElement('div')
    this.announcer.setAttribute('aria-live', 'polite')
    this.announcer.setAttribute('aria-atomic', 'true')
    this.announcer.setAttribute('role', 'status')
    this.announcer.style.position = 'absolute'
    this.announcer.style.left = '-10000px'
    this.announcer.style.width = '1px'
    this.announcer.style.height = '1px'
    this.announcer.style.overflow = 'hidden'
    document.body.appendChild(this.announcer)
  }

  /**
   * Detect user accessibility preferences
   */
  private detectUserPreferences(): void {
    // Check if matchMedia is available (not available in some test environments)
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }

    try {
      // Detect high contrast preference
      if (window.matchMedia('(prefers-contrast: high)').matches) {
        this.config.highContrast = true
      }

      // Detect reduced motion preference
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.config.reducedMotion = true
      }

      // Listen for changes
      window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
        this.config.highContrast = e.matches
      })
    } catch (error) {
      // Gracefully handle matchMedia errors in test environments
      console.warn('matchMedia not available:', error)
    }

    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.config.reducedMotion = e.matches
    })
  }

  /**
   * Announce reading state changes to screen readers
   * Requirement: Add screen reader announcements for reading state changes
   */
  announceStateChange(state: 'started' | 'paused' | 'resumed' | 'completed' | 'speed_changed', details?: any): void {
    if (!this.config.announceStateChanges || !this.announcer) {
      return
    }

    let message = ''
    
    switch (state) {
      case 'started':
        message = `Reading started. Document has ${details?.totalWords || 0} words. Press spacebar to pause.`
        break
      case 'paused':
        message = `Reading paused at word ${details?.currentPosition || 0} of ${details?.totalWords || 0}. Press spacebar to resume.`
        break
      case 'resumed':
        message = `Reading resumed from word ${details?.currentPosition || 0}.`
        break
      case 'completed':
        message = `Reading completed. You have finished the entire document.`
        break
      case 'speed_changed':
        message = `Reading speed changed to ${details?.speed || 0} words per minute.`
        break
    }

    this.announce(message)
  }

  /**
   * Announce progress updates
   */
  announceProgress(currentPosition: number, totalWords: number): void {
    if (!this.config.announceProgress || !this.announcer) {
      return
    }

    const percentage = Math.round((currentPosition / totalWords) * 100)
    
    // Only announce progress at 25%, 50%, 75% milestones to avoid spam
    if (percentage === 25 || percentage === 50 || percentage === 75) {
      this.announce(`${percentage}% complete`)
    }
  }

  /**
   * Announce keyboard shortcuts when requested
   */
  announceKeyboardShortcuts(): void {
    const shortcuts = [
      'Spacebar: Pause or resume reading',
      'Left arrow: Jump back several words',
      'Right arrow: Skip forward',
      'Up arrow: Increase reading speed',
      'Down arrow: Decrease reading speed',
      'Escape: Exit reading mode'
    ]

    this.announce(`Keyboard shortcuts: ${shortcuts.join('. ')}`)
  }

  /**
   * Set up keyboard navigation for reading interface
   * Requirements: 4.1, 4.2, 4.3, 4.4 - Keyboard controls
   */
  setupKeyboardNavigation(callbacks: {
    onPauseResume: () => void
    onJumpBack: () => void
    onJumpForward: () => void
    onSpeedUp: () => void
    onSpeedDown: () => void
    onExit: () => void
    onHelp?: () => void
  }): void {
    if (!this.config.keyboardNavigation) {
      return
    }

    this.keyboardHandler = (event: KeyboardEvent) => {
      // Prevent default behavior for our handled keys
      const handledKeys = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'F1']
      
      if (handledKeys.includes(event.code)) {
        event.preventDefault()
        event.stopPropagation()
      }

      switch (event.code) {
        case 'Space':
          callbacks.onPauseResume()
          break
        case 'ArrowLeft':
          callbacks.onJumpBack()
          break
        case 'ArrowRight':
          callbacks.onJumpForward()
          break
        case 'ArrowUp':
          callbacks.onSpeedUp()
          break
        case 'ArrowDown':
          callbacks.onSpeedDown()
          break
        case 'Escape':
          callbacks.onExit()
          break
        case 'F1':
          event.preventDefault()
          callbacks.onHelp?.()
          this.announceKeyboardShortcuts()
          break
      }
    }

    document.addEventListener('keydown', this.keyboardHandler, { capture: true })
  }

  /**
   * Remove keyboard navigation
   */
  removeKeyboardNavigation(): void {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, { capture: true })
      this.keyboardHandler = null
    }
  }

  /**
   * Calculate contrast ratio between two colors
   * Requirement 2.5: Ensure WCAG 2.1 AA contrast ratios
   */
  calculateContrastRatio(foreground: string, background: string): ContrastRatio {
    const fgLuminance = this.getLuminance(foreground)
    const bgLuminance = this.getLuminance(background)
    
    const lighter = Math.max(fgLuminance, bgLuminance)
    const darker = Math.min(fgLuminance, bgLuminance)
    
    const ratio = (lighter + 0.05) / (darker + 0.05)
    
    let level: 'AA' | 'AAA' | 'FAIL' = 'FAIL'
    let isCompliant = false
    
    if (ratio >= 7) {
      level = 'AAA'
      isCompliant = true
    } else if (ratio >= 4.5) {
      level = 'AA'
      isCompliant = true
    }

    return {
      foreground,
      background,
      ratio: Math.round(ratio * 100) / 100,
      isCompliant,
      level
    }
  }

  /**
   * Validate color scheme for accessibility compliance
   */
  validateColorScheme(colors: {
    background: string
    text: string
    orp: string
    progress: string
  }): { [key: string]: ContrastRatio } {
    return {
      text: this.calculateContrastRatio(colors.text, colors.background),
      orp: this.calculateContrastRatio(colors.orp, colors.background),
      progress: this.calculateContrastRatio(colors.progress, colors.background)
    }
  }

  /**
   * Get accessible color scheme based on user preferences
   */
  getAccessibleColorScheme(): {
    background: string
    text: string
    orp: string
    progress: string
  } {
    if (this.config.highContrast) {
      return {
        background: '#000000',
        text: '#ffffff',
        orp: '#ffff00', // Yellow for better contrast than red
        progress: '#ffffff'
      }
    }

    return {
      background: '#000000',
      text: '#ffffff',
      orp: '#ff0000',
      progress: 'rgba(255, 255, 255, 0.25)'
    }
  }

  /**
   * Focus management for reading interface
   */
  manageFocus(element: HTMLElement, options?: {
    preventScroll?: boolean
    announceChange?: boolean
  }): void {
    element.focus({ preventScroll: options?.preventScroll ?? true })
    
    if (options?.announceChange) {
      const label = element.getAttribute('aria-label') || 
                   element.getAttribute('title') || 
                   element.textContent?.trim() || 
                   'Element'
      this.announce(`Focused on ${label}`)
    }
  }

  /**
   * Create accessible button with proper ARIA attributes
   */
  createAccessibleButton(text: string, onClick: () => void, options?: {
    ariaLabel?: string
    ariaDescribedBy?: string
    className?: string
  }): HTMLButtonElement {
    const button = document.createElement('button')
    button.textContent = text
    button.addEventListener('click', onClick)
    
    if (options?.ariaLabel) {
      button.setAttribute('aria-label', options.ariaLabel)
    }
    
    if (options?.ariaDescribedBy) {
      button.setAttribute('aria-describedby', options.ariaDescribedBy)
    }
    
    if (options?.className) {
      button.className = options.className
    }

    // Ensure proper focus styles
    button.style.outline = 'none'
    button.addEventListener('focus', () => {
      button.style.outline = '2px solid #ffffff'
      button.style.outlineOffset = '2px'
    })
    
    button.addEventListener('blur', () => {
      button.style.outline = 'none'
    })

    return button
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  getConfig(): AccessibilityConfig {
    return { ...this.config }
  }

  /**
   * Clean up accessibility service
   */
  destroy(): void {
    this.removeKeyboardNavigation()
    
    if (this.announcer && this.announcer.parentNode) {
      this.announcer.parentNode.removeChild(this.announcer)
      this.announcer = null
    }
  }

  // Private helper methods

  private announce(message: string): void {
    if (!this.announcer) return

    // Clear previous message
    this.announcer.textContent = ''
    
    // Add new message after a brief delay to ensure screen readers pick it up
    setTimeout(() => {
      if (this.announcer) {
        this.announcer.textContent = message
      }
    }, 100)
  }

  private getLuminance(color: string): number {
    // Convert color to RGB values
    const rgb = this.hexToRgb(color)
    if (!rgb) return 0

    // Convert to relative luminance
    const rsRGB = rgb.r / 255
    const gsRGB = rgb.g / 255
    const bsRGB = rgb.b / 255

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4)
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4)
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4)

    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1]!, 16),
      g: parseInt(result[2]!, 16),
      b: parseInt(result[3]!, 16)
    } : null
  }
}

// Export singleton instance (lazy initialization)
let _accessibilityService: AccessibilityService | null = null

export const accessibilityService = {
  getInstance(): AccessibilityService {
    if (!_accessibilityService) {
      _accessibilityService = new AccessibilityService()
    }
    return _accessibilityService
  },
  
  // Delegate methods for convenience
  announceStateChange: (state: any, details?: any) => accessibilityService.getInstance().announceStateChange(state, details),
  announceProgress: (current: number, total: number) => accessibilityService.getInstance().announceProgress(current, total),
  setupKeyboardNavigation: (callbacks: any) => accessibilityService.getInstance().setupKeyboardNavigation(callbacks),
  removeKeyboardNavigation: () => accessibilityService.getInstance().removeKeyboardNavigation(),
  calculateContrastRatio: (fg: string, bg: string) => accessibilityService.getInstance().calculateContrastRatio(fg, bg),
  validateColorScheme: (colors: any) => accessibilityService.getInstance().validateColorScheme(colors),
  getAccessibleColorScheme: () => accessibilityService.getInstance().getAccessibleColorScheme(),
  manageFocus: (element: HTMLElement, options?: any) => accessibilityService.getInstance().manageFocus(element, options),
  createAccessibleButton: (text: string, onClick: () => void, options?: any) => accessibilityService.getInstance().createAccessibleButton(text, onClick, options),
  updateConfig: (config: any) => accessibilityService.getInstance().updateConfig(config),
  getConfig: () => accessibilityService.getInstance().getConfig(),
  destroy: () => {
    if (_accessibilityService) {
      _accessibilityService.destroy()
      _accessibilityService = null
    }
  }
}
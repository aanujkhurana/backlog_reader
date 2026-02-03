/**
 * Keyboard control interfaces for ADHD Focus Reader
 * Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

export interface KeyboardController {
  bindControls(): void
  unbindControls(): void
  isControlsBound(): boolean
}

export interface KeyboardEvent {
  key: string
  preventDefault(): void
  stopPropagation(): void
}

export interface ControlAction {
  type: 'pause' | 'resume' | 'speed-up' | 'speed-down' | 'jump-back' | 'jump-forward' | 'exit' | 'help'
  payload?: number
}

export interface ControlConfig {
  pauseResumeKey: string // spacebar
  jumpBackKey: string // left arrow
  jumpForwardKey: string // right arrow
  speedUpKey: string // up arrow
  speedDownKey: string // down arrow
  jumpDistance: number // words to jump
  speedIncrement: number // WPM change per keypress
}
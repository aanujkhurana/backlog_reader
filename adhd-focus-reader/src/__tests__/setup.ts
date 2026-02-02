/**
 * Test setup file for ADHD Focus Reader
 * Configures global mocks and test environment
 */

import { vi, beforeEach } from 'vitest'

// Mock browser APIs that are not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn()

// Mock performance.now
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
  },
})

// Mock localStorage with proper implementation
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

// Create a simple in-memory storage for testing
const mockStorage: Record<string, string> = {}

localStorageMock.getItem.mockImplementation((key: string) => {
  return mockStorage[key] || null
})

localStorageMock.setItem.mockImplementation((key: string, value: string) => {
  mockStorage[key] = value
})

localStorageMock.removeItem.mockImplementation((key: string) => {
  delete mockStorage[key]
})

localStorageMock.clear.mockImplementation(() => {
  Object.keys(mockStorage).forEach(key => delete mockStorage[key])
})

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
})

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'mock-url'),
})

// Mock URL.revokeObjectURL
Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
})

// Mock FileReader
global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null
  error: any = null
  readyState: number = 0
  
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  
  readAsText(file: Blob) {
    setTimeout(() => {
      this.result = 'mock file content'
      this.readyState = 2
      if (this.onload) {
        this.onload({} as ProgressEvent<FileReader>)
      }
    }, 0)
  }
  
  readAsArrayBuffer(file: Blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(8)
      this.readyState = 2
      if (this.onload) {
        this.onload({} as ProgressEvent<FileReader>)
      }
    }, 0)
  }
  
  abort() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true }
} as any

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  
  // Clear mock storage
  Object.keys(mockStorage).forEach(key => delete mockStorage[key])
  
  // Reset localStorage mock implementations
  localStorageMock.getItem.mockImplementation((key: string) => {
    return mockStorage[key] || null
  })
  
  localStorageMock.setItem.mockImplementation((key: string, value: string) => {
    mockStorage[key] = value
  })
  
  localStorageMock.removeItem.mockImplementation((key: string) => {
    delete mockStorage[key]
  })
  
  localStorageMock.clear.mockImplementation(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key])
  })
})
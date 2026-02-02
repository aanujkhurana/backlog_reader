/**
 * Unit tests for Performance Monitor Service
 * Tests performance monitoring and optimization features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PerformanceMonitor } from '../performanceMonitor'

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor

  beforeEach(() => {
    vi.clearAllMocks()
    performanceMonitor = new PerformanceMonitor({
      enableMonitoring: false // Disable auto-start for testing
    })
  })

  afterEach(() => {
    if (performanceMonitor) {
      performanceMonitor.destroy()
    }
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const monitor = new PerformanceMonitor()
      const metrics = monitor.getMetrics()
      
      expect(metrics.frameRate).toBe(0)
      expect(metrics.memoryUsage).toBe(0)
      expect(metrics.renderTime).toBe(0)
      expect(metrics.wordDisplayLatency).toBe(0)
      expect(metrics.keyboardResponseTime).toBe(0)
      
      monitor.destroy()
    })

    it('should initialize with custom configuration', () => {
      const config = {
        targetFrameRate: 30,
        maxMemoryUsage: 50,
        enableMonitoring: false,
        logMetrics: true
      }
      
      const monitor = new PerformanceMonitor(config)
      
      // Configuration should be applied
      expect(monitor).toBeDefined()
      
      monitor.destroy()
    })
  })

  describe('Metrics Measurement', () => {
    it('should measure word display latency', () => {
      // Mock performance.now to return predictable values
      const mockNow = vi.fn()
        .mockReturnValueOnce(100) // startTime
        .mockReturnValueOnce(105) // current time
      
      Object.defineProperty(global, 'performance', {
        value: { now: mockNow },
        writable: true
      })
      
      const startTime = performance.now()
      performanceMonitor.measureWordDisplayLatency(startTime)
      const metrics = performanceMonitor.getMetrics()
      
      expect(metrics.wordDisplayLatency).toBe(5)
    })

    it('should measure keyboard response time', () => {
      // Mock performance.now to return predictable values
      const mockNow = vi.fn()
        .mockReturnValueOnce(200) // startTime
        .mockReturnValueOnce(210) // current time
      
      Object.defineProperty(global, 'performance', {
        value: { now: mockNow },
        writable: true
      })
      
      const startTime = performance.now()
      performanceMonitor.measureKeyboardResponse(startTime)
      const metrics = performanceMonitor.getMetrics()
      
      expect(metrics.keyboardResponseTime).toBe(10)
    })

    it('should measure render time', () => {
      const operation = vi.fn(() => 'result')
      
      const result = performanceMonitor.measureRenderTime(operation)
      
      expect(result).toBe('result')
      expect(operation).toHaveBeenCalled()
    })
  })

  describe('Performance Assessment', () => {
    it('should identify acceptable performance', () => {
      // Set good metrics
      const monitor = new PerformanceMonitor({
        targetFrameRate: 60,
        maxMemoryUsage: 100,
        enableMonitoring: false
      })
      
      // Simulate good performance
      ;(monitor as any).metrics = {
        frameRate: 60,
        memoryUsage: 50,
        renderTime: 10,
        wordDisplayLatency: 2,
        keyboardResponseTime: 5
      }
      
      expect(monitor.isPerformanceAcceptable()).toBe(true)
      
      monitor.destroy()
    })

    it('should identify poor performance', () => {
      const monitor = new PerformanceMonitor({
        targetFrameRate: 60,
        maxMemoryUsage: 100,
        enableMonitoring: false
      })
      
      // Simulate poor performance
      ;(monitor as any).metrics = {
        frameRate: 20, // Low frame rate
        memoryUsage: 150, // High memory usage
        renderTime: 30, // High render time
        wordDisplayLatency: 10,
        keyboardResponseTime: 20
      }
      
      expect(monitor.isPerformanceAcceptable()).toBe(false)
      
      monitor.destroy()
    })
  })

  describe('Performance Recommendations', () => {
    it('should provide recommendations for poor performance', () => {
      const monitor = new PerformanceMonitor({
        targetFrameRate: 60,
        maxMemoryUsage: 100,
        enableMonitoring: false
      })
      
      // Set poor metrics
      ;(monitor as any).metrics = {
        frameRate: 20,
        memoryUsage: 150,
        renderTime: 30,
        wordDisplayLatency: 10,
        keyboardResponseTime: 20
      }
      
      const recommendations = monitor.getPerformanceRecommendations()
      
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.includes('Frame rate'))).toBe(true)
      expect(recommendations.some(r => r.includes('Memory usage'))).toBe(true)
      expect(recommendations.some(r => r.includes('Render time'))).toBe(true)
      
      monitor.destroy()
    })

    it('should provide no recommendations for good performance', () => {
      const monitor = new PerformanceMonitor({
        targetFrameRate: 60,
        maxMemoryUsage: 100,
        enableMonitoring: false
      })
      
      // Set good metrics
      ;(monitor as any).metrics = {
        frameRate: 60,
        memoryUsage: 50,
        renderTime: 10,
        wordDisplayLatency: 2,
        keyboardResponseTime: 5
      }
      
      const recommendations = monitor.getPerformanceRecommendations()
      
      expect(recommendations.length).toBe(0)
      
      monitor.destroy()
    })
  })

  describe('Performance Summary', () => {
    it('should provide excellent status for good performance', () => {
      const monitor = new PerformanceMonitor({
        enableMonitoring: false
      })
      
      // Set excellent metrics
      ;(monitor as any).metrics = {
        frameRate: 60,
        memoryUsage: 30,
        renderTime: 8,
        wordDisplayLatency: 1,
        keyboardResponseTime: 3
      }
      
      const summary = monitor.getPerformanceSummary()
      
      expect(summary.status).toBe('excellent')
      expect(summary.recommendations.length).toBe(0)
      
      monitor.destroy()
    })

    it('should provide poor status for bad performance', () => {
      const monitor = new PerformanceMonitor({
        enableMonitoring: false
      })
      
      // Set poor metrics
      ;(monitor as any).metrics = {
        frameRate: 15,
        memoryUsage: 200,
        renderTime: 50,
        wordDisplayLatency: 20,
        keyboardResponseTime: 30
      }
      
      const summary = monitor.getPerformanceSummary()
      
      expect(summary.status).toBe('poor')
      expect(summary.recommendations.length).toBeGreaterThan(0)
      
      monitor.destroy()
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        targetFrameRate: 30,
        logMetrics: true
      }
      
      performanceMonitor.updateConfig(newConfig)
      
      expect((performanceMonitor as any).config.targetFrameRate).toBe(30)
      expect((performanceMonitor as any).config.logMetrics).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      performanceMonitor.destroy()
      
      expect((performanceMonitor as any).frameRateHistory).toEqual([])
      expect((performanceMonitor as any).renderTimeHistory).toEqual([])
    })
  })
})
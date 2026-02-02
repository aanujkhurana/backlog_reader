/**
 * Performance Monitoring Service for ADHD Focus Reader
 * Monitors and optimizes performance for smooth RSVP experience
 */

export interface PerformanceMetrics {
  frameRate: number
  memoryUsage: number
  renderTime: number
  wordDisplayLatency: number
  keyboardResponseTime: number
}

export interface PerformanceConfig {
  targetFrameRate: number
  maxMemoryUsage: number // MB
  enableMonitoring: boolean
  logMetrics: boolean
}

export class PerformanceMonitor {
  private config: PerformanceConfig
  private metrics: PerformanceMetrics
  private frameCount: number = 0
  private lastFrameTime: number = 0
  private frameRateHistory: number[] = []
  private renderTimeHistory: number[] = []
  private monitoringInterval: number | null = null

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      targetFrameRate: 60,
      maxMemoryUsage: 100, // 100MB
      enableMonitoring: true,
      logMetrics: false,
      ...config
    }

    this.metrics = {
      frameRate: 0,
      memoryUsage: 0,
      renderTime: 0,
      wordDisplayLatency: 0,
      keyboardResponseTime: 0
    }

    if (this.config.enableMonitoring) {
      this.startMonitoring()
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return
    }

    this.monitoringInterval = window.setInterval(() => {
      this.updateMetrics()
      
      if (this.config.logMetrics) {
        this.logCurrentMetrics()
      }
    }, 1000) // Update every second

    // Monitor frame rate
    this.monitorFrameRate()
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  /**
   * Monitor frame rate using requestAnimationFrame
   */
  private monitorFrameRate(): void {
    const measureFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const frameDuration = timestamp - this.lastFrameTime
        const currentFPS = 1000 / frameDuration
        
        this.frameRateHistory.push(currentFPS)
        if (this.frameRateHistory.length > 60) {
          this.frameRateHistory.shift()
        }
      }
      
      this.lastFrameTime = timestamp
      this.frameCount++

      if (this.config.enableMonitoring) {
        requestAnimationFrame(measureFrame)
      }
    }

    requestAnimationFrame(measureFrame)
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    // Calculate average frame rate
    if (this.frameRateHistory.length > 0) {
      this.metrics.frameRate = this.frameRateHistory.reduce((a, b) => a + b, 0) / this.frameRateHistory.length
    }

    // Get memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024) // Convert to MB
    }

    // Calculate average render time
    if (this.renderTimeHistory.length > 0) {
      this.metrics.renderTime = this.renderTimeHistory.reduce((a, b) => a + b, 0) / this.renderTimeHistory.length
    }
  }

  /**
   * Measure word display latency
   */
  measureWordDisplayLatency(startTime: number): void {
    const latency = performance.now() - startTime
    this.metrics.wordDisplayLatency = latency
  }

  /**
   * Measure keyboard response time
   */
  measureKeyboardResponse(startTime: number): void {
    const responseTime = performance.now() - startTime
    this.metrics.keyboardResponseTime = responseTime
  }

  /**
   * Measure render time for a specific operation
   */
  measureRenderTime<T>(operation: () => T): T {
    const startTime = performance.now()
    const result = operation()
    const renderTime = performance.now() - startTime
    
    this.renderTimeHistory.push(renderTime)
    if (this.renderTimeHistory.length > 30) {
      this.renderTimeHistory.shift()
    }

    return result
  }

  /**
   * Check if performance is within acceptable limits
   */
  isPerformanceAcceptable(): boolean {
    const frameRateOk = this.metrics.frameRate >= this.config.targetFrameRate * 0.8 // Allow 20% tolerance
    const memoryOk = this.metrics.memoryUsage <= this.config.maxMemoryUsage
    const renderTimeOk = this.metrics.renderTime <= 16.67 // 60fps = 16.67ms per frame

    return frameRateOk && memoryOk && renderTimeOk
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.frameRate < this.config.targetFrameRate * 0.8) {
      recommendations.push('Frame rate is below target. Consider reducing visual effects or closing other applications.')
    }

    if (this.metrics.memoryUsage > this.config.maxMemoryUsage * 0.8) {
      recommendations.push('Memory usage is high. Consider refreshing the page or closing other browser tabs.')
    }

    if (this.metrics.renderTime > 16.67) {
      recommendations.push('Render time is high. The browser may be struggling to keep up with the display rate.')
    }

    if (this.metrics.wordDisplayLatency > 5) {
      recommendations.push('Word display latency is high. This may affect reading smoothness.')
    }

    if (this.metrics.keyboardResponseTime > 10) {
      recommendations.push('Keyboard response time is slow. This may affect control responsiveness.')
    }

    return recommendations
  }

  /**
   * Optimize performance based on current metrics
   */
  optimizePerformance(): void {
    if (!this.isPerformanceAcceptable()) {
      // Reduce frame rate target if performance is poor
      if (this.metrics.frameRate < 30) {
        this.config.targetFrameRate = 30
      }

      // Clear history to free memory
      if (this.metrics.memoryUsage > this.config.maxMemoryUsage * 0.9) {
        this.frameRateHistory = this.frameRateHistory.slice(-10)
        this.renderTimeHistory = this.renderTimeHistory.slice(-10)
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    status: 'excellent' | 'good' | 'fair' | 'poor'
    metrics: PerformanceMetrics
    recommendations: string[]
  } {
    const isAcceptable = this.isPerformanceAcceptable()
    const recommendations = this.getPerformanceRecommendations()

    let status: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'

    if (recommendations.length === 0) {
      status = 'excellent'
    } else if (recommendations.length <= 2 && isAcceptable) {
      status = 'good'
    } else if (isAcceptable) {
      status = 'fair'
    } else {
      status = 'poor'
    }

    return {
      status,
      metrics: this.getMetrics(),
      recommendations
    }
  }

  /**
   * Log current metrics to console
   */
  private logCurrentMetrics(): void {
    console.log('Performance Metrics:', {
      frameRate: Math.round(this.metrics.frameRate),
      memoryUsage: Math.round(this.metrics.memoryUsage),
      renderTime: Math.round(this.metrics.renderTime * 100) / 100,
      wordDisplayLatency: Math.round(this.metrics.wordDisplayLatency * 100) / 100,
      keyboardResponseTime: Math.round(this.metrics.keyboardResponseTime * 100) / 100
    })
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopMonitoring()
    this.frameRateHistory = []
    this.renderTimeHistory = []
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()
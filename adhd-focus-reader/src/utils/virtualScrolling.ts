/**
 * Virtual Scrolling Utilities for Large Documents
 * Implements efficient rendering for documents with many words
 * Requirement: Implement virtual scrolling for large documents
 */

export interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  overscan: number // Number of items to render outside visible area
}

export interface VirtualScrollState {
  startIndex: number
  endIndex: number
  totalHeight: number
  offsetY: number
}

export class VirtualScrollManager {
  private config: VirtualScrollConfig
  private totalItems: number = 0
  private scrollTop: number = 0

  constructor(config: VirtualScrollConfig) {
    this.config = config
  }

  /**
   * Update the total number of items
   */
  setTotalItems(count: number): void {
    this.totalItems = count
  }

  /**
   * Update scroll position and calculate visible range
   */
  updateScrollPosition(scrollTop: number): VirtualScrollState {
    this.scrollTop = scrollTop

    const visibleItemCount = Math.ceil(this.config.containerHeight / this.config.itemHeight)
    const startIndex = Math.max(0, Math.floor(scrollTop / this.config.itemHeight) - this.config.overscan)
    const endIndex = Math.min(
      this.totalItems - 1,
      startIndex + visibleItemCount + this.config.overscan * 2
    )

    return {
      startIndex,
      endIndex,
      totalHeight: this.totalItems * this.config.itemHeight,
      offsetY: startIndex * this.config.itemHeight
    }
  }

  /**
   * Get the scroll position for a specific item index
   */
  getScrollPositionForIndex(index: number): number {
    return Math.max(0, index * this.config.itemHeight - this.config.containerHeight / 2)
  }

  /**
   * Check if an index is currently visible
   */
  isIndexVisible(index: number): boolean {
    const state = this.updateScrollPosition(this.scrollTop)
    return index >= state.startIndex && index <= state.endIndex
  }
}

/**
 * Chunked processing for large document structures
 * Processes documents in chunks to prevent UI blocking
 */
export class ChunkedProcessor<T> {
  private chunkSize: number
  private processingDelay: number

  constructor(chunkSize: number = 1000, processingDelay: number = 5) {
    this.chunkSize = chunkSize
    this.processingDelay = processingDelay
  }

  /**
   * Process a large array in chunks with yielding to prevent UI blocking
   */
  async processInChunks<R>(
    items: T[],
    processor: (item: T, index: number) => R,
    onProgress?: (processed: number, total: number) => void
  ): Promise<R[]> {
    const results: R[] = []
    const total = items.length

    for (let i = 0; i < total; i += this.chunkSize) {
      const chunk = items.slice(i, i + this.chunkSize)
      
      // Process chunk
      for (let j = 0; j < chunk.length; j++) {
        const globalIndex = i + j
        results.push(processor(chunk[j]!, globalIndex))
      }

      // Report progress
      onProgress?.(Math.min(i + this.chunkSize, total), total)

      // Yield to browser to prevent blocking
      if (i + this.chunkSize < total) {
        await this.delay(this.processingDelay)
      }
    }

    return results
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Memory-efficient word storage for large documents
 * Uses lazy loading and caching strategies
 */
export class WordCache {
  private cache = new Map<number, any>()
  private maxCacheSize: number
  private accessOrder: number[] = []

  constructor(maxCacheSize: number = 10000) {
    this.maxCacheSize = maxCacheSize
  }

  /**
   * Get a word by index, loading if necessary
   */
  get(index: number, loader: (index: number) => any): any {
    if (this.cache.has(index)) {
      // Move to end of access order (most recently used)
      this.updateAccessOrder(index)
      return this.cache.get(index)
    }

    // Load the word
    const word = loader(index)
    this.set(index, word)
    return word
  }

  /**
   * Set a word in the cache
   */
  set(index: number, word: any): void {
    // Remove if already exists
    if (this.cache.has(index)) {
      this.cache.delete(index)
      this.removeFromAccessOrder(index)
    }

    // Add to cache
    this.cache.set(index, word)
    this.accessOrder.push(index)

    // Evict oldest if over limit
    while (this.cache.size > this.maxCacheSize) {
      const oldest = this.accessOrder.shift()
      if (oldest !== undefined) {
        this.cache.delete(oldest)
      }
    }
  }

  /**
   * Preload a range of words
   */
  preload(startIndex: number, endIndex: number, loader: (index: number) => any): void {
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.cache.has(i)) {
        this.set(i, loader(i))
      }
    }
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  private updateAccessOrder(index: number): void {
    this.removeFromAccessOrder(index)
    this.accessOrder.push(index)
  }

  private removeFromAccessOrder(index: number): void {
    const pos = this.accessOrder.indexOf(index)
    if (pos !== -1) {
      this.accessOrder.splice(pos, 1)
    }
  }
}
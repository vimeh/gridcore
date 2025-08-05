export interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
}

export interface PerformanceMetrics {
  cpuUsage: NodeJS.CpuUsage
  memory: MemoryMetrics
  timestamp: number
}

export class MetricsCollector {
  private startCpu: NodeJS.CpuUsage | null = null
  private startMemory: MemoryMetrics | null = null
  private samples: PerformanceMetrics[] = []

  start() {
    this.startCpu = process.cpuUsage()
    this.startMemory = this.getMemoryMetrics()
    this.samples = []
  }

  sample() {
    if (!this.startCpu) {
      throw new Error("MetricsCollector not started")
    }

    const metrics: PerformanceMetrics = {
      cpuUsage: process.cpuUsage(this.startCpu),
      memory: this.getMemoryMetrics(),
      timestamp: performance.now(),
    }

    this.samples.push(metrics)
    return metrics
  }

  stop() {
    const endCpu = process.cpuUsage(this.startCpu!)
    const endMemory = this.getMemoryMetrics()

    return {
      cpu: {
        user: endCpu.user / 1000, // Convert to ms
        system: endCpu.system / 1000,
        total: (endCpu.user + endCpu.system) / 1000,
      },
      memory: {
        heapUsedDelta: endMemory.heapUsed - this.startMemory!.heapUsed,
        heapTotalDelta: endMemory.heapTotal - this.startMemory!.heapTotal,
        externalDelta: endMemory.external - this.startMemory!.external,
        rssDelta: endMemory.rss - this.startMemory!.rss,
        final: endMemory,
      },
      samples: this.samples,
    }
  }

  private getMemoryMetrics(): MemoryMetrics {
    const mem = process.memoryUsage()
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    }
  }

  static formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"]
    let size = Math.abs(bytes)
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    const sign = bytes < 0 ? "-" : ""
    return `${sign}${size.toFixed(2)} ${units[unitIndex]}`
  }

  static async measureMemoryImpact<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; memoryDelta: number }> {
    // Force GC if available
    if (global.gc) {
      global.gc()
    }

    const before = process.memoryUsage().heapUsed
    const result = await fn()

    // Force GC again
    if (global.gc) {
      global.gc()
    }

    const after = process.memoryUsage().heapUsed
    return {
      result,
      memoryDelta: after - before,
    }
  }
}
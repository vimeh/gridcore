/**
 * Performance monitoring system for structural operations
 * Tracks timing, memory usage, and operation metrics to ensure performance targets
 */

export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  cellsAffected: number;
  operationSize: number; // number of rows/columns
  timestamp: number;
}

export interface PerformanceThresholds {
  maxDurationMs: number;
  maxMemoryMB: number;
  maxCellsAffected: number;
  warningDurationMs: number;
  warningMemoryMB: number;
}

export interface PerformanceReport {
  totalOperations: number;
  averageDuration: number;
  peakDuration: number;
  peakMemoryUsage: number;
  operationsExceedingThreshold: number;
  recentOperations: PerformanceMetrics[];
  performanceGrade: "A" | "B" | "C" | "D" | "F";
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxHistorySize: number = 1000;

  // Performance targets based on requirements
  private readonly thresholds: PerformanceThresholds = {
    maxDurationMs: 2000, // 2s for 10k rows
    maxMemoryMB: 100, // 100MB memory limit
    maxCellsAffected: 10000, // 10k cells
    warningDurationMs: 200, // 200ms for 1k rows
    warningMemoryMB: 50, // 50MB warning threshold
  };

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Start timing an operation
   */
  startOperation(
    operationName: string,
    operationSize: number,
  ): PerformanceTimer {
    return new PerformanceTimer(this, operationName, operationSize);
  }

  /**
   * Record a completed operation
   */
  recordOperation(
    operationName: string,
    startTime: number,
    endTime: number,
    memoryBefore: number,
    memoryAfter: number,
    cellsAffected: number,
    operationSize: number,
  ): void {
    const metrics: PerformanceMetrics = {
      operationName,
      startTime,
      endTime,
      duration: endTime - startTime,
      memoryBefore,
      memoryAfter,
      cellsAffected,
      operationSize,
      timestamp: Date.now(),
    };

    this.metrics.push(metrics);

    // Maintain history size limit
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.maxHistorySize);
    }

    // Check for performance violations
    this.checkPerformanceThresholds(metrics);
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        peakDuration: 0,
        peakMemoryUsage: 0,
        operationsExceedingThreshold: 0,
        recentOperations: [],
        performanceGrade: "A",
      };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalDuration / this.metrics.length;
    const peakDuration = Math.max(...this.metrics.map((m) => m.duration));
    const peakMemoryUsage = Math.max(...this.metrics.map((m) => m.memoryAfter));

    const operationsExceedingThreshold = this.metrics.filter(
      (m) => m.duration > this.getExpectedDuration(m.operationSize),
    ).length;

    // Calculate performance grade directly here to avoid circular dependency
    const violationRate = operationsExceedingThreshold / this.metrics.length;
    const avgDurationScore =
      averageDuration / this.thresholds.warningDurationMs;
    const memoryScore =
      peakMemoryUsage / (this.thresholds.warningMemoryMB * 1024 * 1024);
    const score =
      violationRate * 0.4 + avgDurationScore * 0.4 + memoryScore * 0.2;

    let performanceGrade: "A" | "B" | "C" | "D" | "F";
    if (score <= 0.2) performanceGrade = "A";
    else if (score <= 0.4) performanceGrade = "B";
    else if (score <= 0.6) performanceGrade = "C";
    else if (score <= 0.8) performanceGrade = "D";
    else performanceGrade = "F";

    return {
      totalOperations: this.metrics.length,
      averageDuration,
      peakDuration,
      peakMemoryUsage,
      operationsExceedingThreshold,
      recentOperations: this.metrics.slice(-10), // Last 10 operations
      performanceGrade,
    };
  }

  /**
   * Get metrics for a specific operation type
   */
  getOperationMetrics(operationName: string): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.operationName === operationName);
  }

  /**
   * Check if current performance meets targets
   */
  meetsPerformanceTargets(): boolean {
    const report = this.getPerformanceReport();
    return report.performanceGrade === "A" || report.performanceGrade === "B";
  }

  /**
   * Get expected duration for operation size (used for benchmarking)
   */
  getExpectedDuration(operationSize: number): number {
    if (operationSize <= 1000) {
      return this.thresholds.warningDurationMs; // 200ms for 1k rows
    } else if (operationSize <= 10000) {
      return this.thresholds.maxDurationMs; // 2s for 10k rows
    } else {
      // Scale linearly beyond 10k
      return this.thresholds.maxDurationMs * (operationSize / 10000);
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        thresholds: this.thresholds,
        metrics: this.metrics,
        report: this.getPerformanceReport(),
      },
      null,
      2,
    );
  }

  /**
   * Get performance warnings
   */
  getPerformanceWarnings(): string[] {
    const warnings: string[] = [];
    const report = this.getPerformanceReport();

    if (report.performanceGrade === "D" || report.performanceGrade === "F") {
      warnings.push(`Poor performance grade: ${report.performanceGrade}`);
    }

    if (report.operationsExceedingThreshold > 0) {
      warnings.push(
        `${report.operationsExceedingThreshold} operations exceeded performance thresholds`,
      );
    }

    if (
      report.peakMemoryUsage >
      this.thresholds.warningMemoryMB * 1024 * 1024
    ) {
      warnings.push(
        `Peak memory usage ${Math.round(report.peakMemoryUsage / 1024 / 1024)}MB exceeds warning threshold`,
      );
    }

    return warnings;
  }

  // Private methods

  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const expectedDuration = this.getExpectedDuration(metrics.operationSize);

    if (metrics.duration > expectedDuration) {
      console.warn(
        `Performance warning: ${metrics.operationName} took ${metrics.duration}ms, expected ${expectedDuration}ms for ${metrics.operationSize} rows/cols`,
      );
    }

    const memoryUsageMB = metrics.memoryAfter / 1024 / 1024;
    if (memoryUsageMB > this.thresholds.warningMemoryMB) {
      console.warn(
        `Memory warning: ${metrics.operationName} used ${memoryUsageMB.toFixed(2)}MB`,
      );
    }
  }
}

/**
 * Timer for tracking individual operations
 */
export class PerformanceTimer {
  private monitor: PerformanceMonitor;
  private operationName: string;
  private operationSize: number;
  private startTime: number;
  private memoryBefore: number;

  constructor(
    monitor: PerformanceMonitor,
    operationName: string,
    operationSize: number,
  ) {
    this.monitor = monitor;
    this.operationName = operationName;
    this.operationSize = operationSize;
    this.startTime = performance.now();
    this.memoryBefore = this.getMemoryUsage();
  }

  /**
   * End the operation and record metrics
   */
  end(cellsAffected: number = 0): void {
    const endTime = performance.now();
    const memoryAfter = this.getMemoryUsage();

    this.monitor.recordOperation(
      this.operationName,
      this.startTime,
      endTime,
      this.memoryBefore,
      memoryAfter,
      cellsAffected,
      this.operationSize,
    );
  }

  private getMemoryUsage(): number {
    // Simplified memory usage estimation
    // In a real implementation, this would use more sophisticated memory tracking
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    // Browser fallback - rough estimation
    // Type assertion for browser-specific performance API
    const perfWithMemory = performance as unknown as {
      memory?: { usedJSHeapSize: number };
    };
    return perfWithMemory.memory ? perfWithMemory.memory.usedJSHeapSize : 0;
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor();

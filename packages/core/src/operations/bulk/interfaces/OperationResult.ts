import type { CellChange } from "./OperationPreview";

/**
 * Result of executing a bulk operation
 */
export interface OperationResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Number of cells that were successfully modified */
  cellsModified: number;

  /** Number of cells that were processed (including skipped) */
  cellsProcessed: number;

  /** Time taken to execute the operation (in milliseconds) */
  executionTime: number;

  /** List of errors that occurred during execution */
  errors: string[];

  /** List of warnings generated during execution */
  warnings: string[];

  /** Changes that were actually made (for undo) */
  actualChanges: Map<string, CellChange>;

  /** Additional metadata about the operation */
  metadata: OperationMetadata;
}

/**
 * Metadata about an executed operation
 */
export interface OperationMetadata {
  /** Type of operation that was executed */
  operationType: string;

  /** Timestamp when the operation started */
  startTime: number;

  /** Timestamp when the operation completed */
  endTime: number;

  /** Memory usage during the operation */
  memoryUsage?: number;

  /** Number of formula recalculations triggered */
  formulaRecalculations?: number;

  /** Performance metrics */
  performance: PerformanceMetrics;

  /** User who executed the operation */
  userId?: string;

  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Performance metrics for an operation
 */
export interface PerformanceMetrics {
  /** Cells processed per second */
  cellsPerSecond: number;

  /** Peak memory usage during operation */
  peakMemoryUsage: number;

  /** Number of batches the operation was split into */
  batchCount: number;

  /** Average time per batch */
  averageBatchTime: number;

  /** Time spent on validation */
  validationTime: number;

  /** Time spent on actual cell updates */
  updateTime: number;

  /** Time spent on formula recalculation */
  recalculationTime: number;
}

/**
 * Result of a batch operation containing multiple bulk operations
 */
export interface BatchOperationResult {
  /** Whether all operations in the batch succeeded */
  success: boolean;

  /** Results of individual operations */
  operationResults: OperationResult[];

  /** Total number of operations in the batch */
  operationCount: number;

  /** Total number of cells modified across all operations */
  totalCellsModified: number;

  /** Total execution time for the entire batch */
  totalExecutionTime: number;

  /** Whether the batch was rolled back due to errors */
  wasRolledBack: boolean;

  /** Errors that occurred at the batch level */
  batchErrors: string[];

  /** Consolidated changes from all operations */
  consolidatedChanges: Map<string, CellChange>;
}

/**
 * Builder for creating operation results
 */
export class OperationResultBuilder {
  private result: Partial<OperationResult> = {
    success: false,
    cellsModified: 0,
    cellsProcessed: 0,
    executionTime: 0,
    errors: [],
    warnings: [],
    actualChanges: new Map(),
    metadata: {
      operationType: "",
      startTime: Date.now(),
      endTime: Date.now(),
      performance: {
        cellsPerSecond: 0,
        peakMemoryUsage: 0,
        batchCount: 0,
        averageBatchTime: 0,
        validationTime: 0,
        updateTime: 0,
        recalculationTime: 0,
      },
    },
  };

  setSuccess(success: boolean): this {
    this.result.success = success;
    return this;
  }

  setCellsModified(count: number): this {
    this.result.cellsModified = count;
    return this;
  }

  setCellsProcessed(count: number): this {
    this.result.cellsProcessed = count;
    return this;
  }

  setExecutionTime(time: number): this {
    this.result.executionTime = time;
    if (this.result.metadata) {
      this.result.metadata.endTime =
        (this.result.metadata.startTime || 0) + time;
    }

    // Calculate cells per second
    const cellsProcessed = this.result.cellsProcessed ?? 0;
    if (time > 0 && cellsProcessed > 0 && this.result.metadata?.performance) {
      this.result.metadata.performance.cellsPerSecond =
        cellsProcessed / (time / 1000);
    }

    return this;
  }

  addError(error: string): this {
    this.result.errors?.push(error);
    this.result.success = false;
    return this;
  }

  addWarning(warning: string): this {
    this.result.warnings?.push(warning);
    return this;
  }

  addChange(change: CellChange): this {
    const key = `${change.address.row},${change.address.col}`;
    this.result.actualChanges?.set(key, change);
    return this;
  }

  setOperationType(type: string): this {
    if (this.result.metadata) {
      this.result.metadata.operationType = type;
    }
    return this;
  }

  setPerformanceMetrics(metrics: Partial<PerformanceMetrics>): this {
    if (this.result.metadata) {
      this.result.metadata.performance = {
        ...this.result.metadata.performance,
        ...metrics,
      };
    }
    return this;
  }

  setContext(context: Record<string, unknown>): this {
    if (this.result.metadata) {
      this.result.metadata.context = context;
    }
    return this;
  }

  build(): OperationResult {
    // Auto-calculate success if no errors occurred
    // Success means the operation completed without errors, even if no cells were modified
    if (this.result.errors?.length === 0) {
      this.result.success = true;
    }

    return this.result as OperationResult;
  }
}

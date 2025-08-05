import type { ICellRepository } from "../domain/interfaces/ICellRepository";
import type { CellValue } from "../domain/models";
import { Cell, CellAddress } from "../domain/models";
import type { BulkOperation } from "./bulk/interfaces/BulkOperation";
import type {
  CellChange,
  OperationPreview,
} from "./bulk/interfaces/OperationPreview";
import type {
  BatchOperationResult,
  OperationResult,
} from "./bulk/interfaces/OperationResult";

/**
 * Context for a batch transaction
 */
export interface BatchContext {
  /** Unique identifier for the batch */
  batchId: string;

  /** Operations in this batch */
  operations: BulkOperation[];

  /** All cells affected by this batch */
  affectedCells: Set<string>;

  /** Original values for rollback */
  originalValues: Map<string, CellValue>;

  /** Timestamp when batch started */
  startTime: number;

  /** Whether the batch is currently active */
  isActive: boolean;

  /** Metadata about the batch */
  metadata: Record<string, unknown>;
}

/**
 * Configuration for batch processing
 */
export interface BatchProcessorConfig {
  /** Maximum number of operations per batch */
  maxOperationsPerBatch?: number;

  /** Maximum number of cells affected per batch */
  maxCellsPerBatch?: number;

  /** Whether to automatically rollback on any error */
  autoRollbackOnError?: boolean;

  /** Whether to validate operations before execution */
  validateBeforeExecution?: boolean;

  /** Timeout for batch operations (milliseconds) */
  batchTimeout?: number;

  /** Whether to enable parallel processing */
  enableParallelProcessing?: boolean;

  /** Number of worker threads for parallel processing */
  workerThreads?: number;
}

/**
 * Batch processor for handling multiple bulk operations atomically
 * Provides transaction support with rollback capabilities
 */
export class BatchProcessor {
  private contexts: Map<string, BatchContext> = new Map();

  constructor(
    private cellRepository: ICellRepository,
    private config: BatchProcessorConfig = {},
  ) {
    // Set default configuration
    this.config = {
      maxOperationsPerBatch: 100,
      maxCellsPerBatch: 1000000,
      autoRollbackOnError: true,
      validateBeforeExecution: true,
      batchTimeout: 300000, // 5 minutes
      enableParallelProcessing: false,
      workerThreads: 4,
      ...config,
    };
  }

  /**
   * Begin a new batch transaction
   */
  beginBatch(metadata: Record<string, unknown> = {}): BatchContext {
    const batchId = `batch_${this.nextBatchId++}`;

    const context: BatchContext = {
      batchId,
      operations: [],
      affectedCells: new Set(),
      originalValues: new Map(),
      startTime: Date.now(),
      isActive: true,
      metadata,
    };

    this.contexts.set(batchId, context);
    return context;
  }

  /**
   * Add an operation to a batch
   */
  addOperation(context: BatchContext, operation: BulkOperation): void {
    if (!context.isActive) {
      throw new Error("Cannot add operations to inactive batch");
    }

    // Check batch size limits
    const maxOps = this.config.maxOperationsPerBatch ?? 100;
    if (context.operations.length >= maxOps) {
      throw new Error(`Batch size limit exceeded (max: ${maxOps})`);
    }

    // Check for conflicts with existing operations
    this.checkForConflicts(context, operation);

    // Add operation to batch
    context.operations.push(operation);

    // Track affected cells for conflict detection
    for (const cell of operation.selection.getCells()) {
      const key = `${cell.row},${cell.col}`;
      context.affectedCells.add(key);
    }
  }

  /**
   * Check for conflicts between operations
   */
  private checkForConflicts(
    context: BatchContext,
    newOperation: BulkOperation,
  ): void {
    for (const cell of newOperation.selection.getCells()) {
      const key = `${cell.row},${cell.col}`;
      if (context.affectedCells.has(key)) {
        throw new Error(
          `Cell conflict detected at ${key}. Cell is already affected by another operation in this batch.`,
        );
      }
    }

    // Check total cell limit
    const totalCells =
      context.affectedCells.size + newOperation.selection.count();
    if (totalCells > this.config.maxCellsPerBatch!) {
      throw new Error(
        `Batch cell limit exceeded (max: ${this.config.maxCellsPerBatch})`,
      );
    }
  }

  /**
   * Preview all operations in a batch
   */
  async previewBatch(context: BatchContext): Promise<OperationPreview[]> {
    if (!context.isActive) {
      throw new Error("Cannot preview inactive batch");
    }

    const previews: OperationPreview[] = [];

    for (const operation of context.operations) {
      try {
        const preview = await operation.preview();
        previews.push(preview);
      } catch (error) {
        // Create error preview
        previews.push({
          affectedCells: operation.selection.count(),
          changes: new Map(),
          warnings: [],
          errors: [`Failed to generate preview: ${error}`],
          estimatedTime: 0,
          isTruncated: false,
          previewCount: 0,
          summary: {
            totalCells: operation.selection.count(),
            modifiedCells: 0,
            skippedCells: 0,
            formulaCells: 0,
            valueCells: 0,
            changesByType: {},
            memoryEstimate: 0,
          },
        });
      }
    }

    return previews;
  }

  /**
   * Validate all operations in a batch
   */
  validateBatch(context: BatchContext): string[] {
    const errors: string[] = [];

    if (!context.isActive) {
      errors.push("Batch is not active");
      return errors;
    }

    if (context.operations.length === 0) {
      errors.push("Batch contains no operations");
      return errors;
    }

    // Check timeout
    const elapsed = Date.now() - context.startTime;
    if (elapsed > this.config.batchTimeout!) {
      errors.push(
        `Batch timeout exceeded (${elapsed}ms > ${this.config.batchTimeout}ms)`,
      );
    }

    // Validate each operation
    for (let i = 0; i < context.operations.length; i++) {
      const operation = context.operations[i];
      const validationError = operation.validate();
      if (validationError) {
        errors.push(`Operation ${i}: ${validationError}`);
      }
    }

    return errors;
  }

  /**
   * Capture original values for rollback
   */
  private async captureOriginalValues(context: BatchContext): Promise<void> {
    for (const cellKey of context.affectedCells) {
      if (context.originalValues.has(cellKey)) {
        continue; // Already captured
      }

      const [row, col] = cellKey.split(",").map(Number);
      const addressResult = CellAddress.create(row, col);
      if (!addressResult.ok) {
        continue;
      }

      const cell = await this.cellRepository.get(addressResult.value);
      const originalValue = cell ? cell.value || null : null;

      context.originalValues.set(cellKey, originalValue);
    }
  }

  /**
   * Execute all operations in a batch
   */
  async commitBatch(context: BatchContext): Promise<BatchOperationResult> {
    const startTime = Date.now();

    try {
      // Validate before execution if configured
      if (this.config.validateBeforeExecution) {
        const errors = this.validateBatch(context);
        if (errors.length > 0) {
          return {
            success: false,
            operationResults: [],
            operationCount: context.operations.length,
            totalCellsModified: 0,
            totalExecutionTime: Date.now() - startTime,
            wasRolledBack: false,
            batchErrors: errors,
            consolidatedChanges: new Map(),
          };
        }
      }

      // Capture original values for rollback
      await this.captureOriginalValues(context);

      // Execute operations
      const operationResults: OperationResult[] = [];
      let totalCellsModified = 0;
      const consolidatedChanges = new Map<string, CellChange>();
      const batchErrors: string[] = [];

      for (let i = 0; i < context.operations.length; i++) {
        const operation = context.operations[i];

        try {
          const result = await operation.execute();
          operationResults.push(result);

          if (result.success) {
            totalCellsModified += result.cellsModified;

            // Consolidate changes
            for (const [key, change] of result.actualChanges) {
              consolidatedChanges.set(key, change);
            }
          } else {
            // Operation failed
            batchErrors.push(
              `Operation ${i} failed: ${result.errors.join(", ")}`,
            );

            if (this.config.autoRollbackOnError) {
              // Rollback and return
              await this.rollbackBatch(context);
              return {
                success: false,
                operationResults,
                operationCount: context.operations.length,
                totalCellsModified: 0,
                totalExecutionTime: Date.now() - startTime,
                wasRolledBack: true,
                batchErrors,
                consolidatedChanges: new Map(),
              };
            }
          }
        } catch (error) {
          batchErrors.push(`Operation ${i} threw error: ${error}`);

          if (this.config.autoRollbackOnError) {
            await this.rollbackBatch(context);
            return {
              success: false,
              operationResults,
              operationCount: context.operations.length,
              totalCellsModified: 0,
              totalExecutionTime: Date.now() - startTime,
              wasRolledBack: true,
              batchErrors,
              consolidatedChanges: new Map(),
            };
          }
        }
      }

      // Mark batch as complete
      context.isActive = false;

      return {
        success: batchErrors.length === 0,
        operationResults,
        operationCount: context.operations.length,
        totalCellsModified,
        totalExecutionTime: Date.now() - startTime,
        wasRolledBack: false,
        batchErrors,
        consolidatedChanges,
      };
    } catch (error) {
      // Critical error during batch execution
      await this.rollbackBatch(context);
      return {
        success: false,
        operationResults: [],
        operationCount: context.operations.length,
        totalCellsModified: 0,
        totalExecutionTime: Date.now() - startTime,
        wasRolledBack: true,
        batchErrors: [`Critical batch error: ${error}`],
        consolidatedChanges: new Map(),
      };
    }
  }

  /**
   * Rollback a batch transaction
   */
  async rollbackBatch(context: BatchContext): Promise<void> {
    try {
      // Restore original values
      for (const [cellKey, originalValue] of context.originalValues) {
        const [row, col] = cellKey.split(",").map(Number);
        const addressResult = CellAddress.create(row, col);
        if (!addressResult.ok) {
          continue;
        }

        // Restore the original value
        // Create a cell with the original value
        const cellResult = Cell.create(originalValue, addressResult.value);
        if (cellResult.ok) {
          await this.cellRepository.set(addressResult.value, cellResult.value);
        }
      }

      // Mark batch as inactive
      context.isActive = false;
    } catch (error) {
      throw new Error(`Rollback failed: ${error}`);
    }
  }

  /**
   * Cancel a batch without execution
   */
  cancelBatch(context: BatchContext): void {
    context.isActive = false;
    this.contexts.delete(context.batchId);
  }

  /**
   * Get the status of a batch
   */
  getBatchStatus(batchId: string): BatchContext | null {
    return this.contexts.get(batchId) || null;
  }

  /**
   * Get all active batches
   */
  getActiveBatches(): BatchContext[] {
    return Array.from(this.contexts.values()).filter((ctx) => ctx.isActive);
  }

  /**
   * Clean up completed batches
   */
  cleanup(): void {
    for (const [batchId, context] of this.contexts) {
      if (!context.isActive) {
        this.contexts.delete(batchId);
      }
    }
  }

  /**
   * Execute a single bulk operation (convenience method)
   */
  async executeSingle(operation: BulkOperation): Promise<OperationResult> {
    const batch = this.beginBatch({ singleOperation: true });
    this.addOperation(batch, operation);

    const result = await this.commitBatch(batch);

    if (result.operationResults.length > 0) {
      return result.operationResults[0];
    }

    // Fallback result
    return {
      success: false,
      cellsModified: 0,
      cellsProcessed: 0,
      executionTime: result.totalExecutionTime,
      errors: result.batchErrors,
      warnings: [],
      actualChanges: new Map(),
      metadata: {
        operationType: operation.type,
        startTime: batch.startTime,
        endTime: Date.now(),
        performance: {
          cellsPerSecond: 0,
          peakMemoryUsage: 0,
          batchCount: 1,
          averageBatchTime: result.totalExecutionTime,
          validationTime: 0,
          updateTime: result.totalExecutionTime,
          recalculationTime: 0,
        },
      },
    };
  }
}

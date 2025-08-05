import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import type { CellAddress, CellValue } from "../../domain/models";
import { CellSelection } from "./base/CellSelection";
import { BulkSetOperation } from "./implementations/BulkSetOperation";
import type { BulkOperation } from "./interfaces/BulkOperation";
import type { CellChange } from "./interfaces/OperationPreview";
import type {
  BatchOperationResult,
  OperationResult,
} from "./interfaces/OperationResult";

/**
 * Represents an undoable action in the undo/redo stack
 */
export interface UndoAction {
  /** Unique identifier for this action */
  actionId: string;

  /** Type of the original operation */
  operationType: string;

  /** Description for UI display */
  description: string;

  /** Timestamp when action was created */
  timestamp: number;

  /** Operation to undo this action */
  undoOperation: BulkOperation;

  /** Operation to redo this action (if available) */
  redoOperation?: BulkOperation;

  /** Changes that were made */
  changes: Map<string, CellChange>;

  /** Metadata about the action */
  metadata: Record<string, any>;
}

/**
 * Configuration for the undo/redo manager
 */
export interface UndoRedoConfig {
  /** Maximum number of actions to keep in history */
  maxHistorySize: number;

  /** Whether to automatically clean up old actions */
  autoCleanup: boolean;

  /** Maximum age of actions to keep (milliseconds) */
  maxActionAge: number;

  /** Whether to compress similar consecutive actions */
  compressActions: boolean;

  /** Whether to validate undo operations before execution */
  validateUndo: boolean;
}

/**
 * Manager for undo/redo functionality for bulk operations
 */
export class UndoRedoManager {
  private undoStack: UndoAction[] = [];
  private redoStack: UndoAction[] = [];

  constructor(
    private cellRepository: ICellRepository,
    private config: UndoRedoConfig = {
      maxHistorySize: 100,
      autoCleanup: true,
      maxActionAge: 24 * 60 * 60 * 1000, // 24 hours
      compressActions: false,
      validateUndo: true,
    },
  ) {}

  /**
   * Record a bulk operation for undo/redo
   */
  async recordAction(
    operation: BulkOperation,
    result: OperationResult,
  ): Promise<void> {
    if (!result.success || result.cellsModified === 0) {
      return; // Don't record failed or no-op operations
    }

    try {
      // Create undo operation from the changes
      const undoOperation = await this.createUndoOperation(result);

      const action: UndoAction = {
        actionId: `action_${this.nextActionId++}`,
        operationType: operation.type,
        description: operation.getDescription(),
        timestamp: Date.now(),
        undoOperation,
        redoOperation: operation, // The original operation becomes the redo
        changes: new Map(result.actualChanges),
        metadata: {
          cellsModified: result.cellsModified,
          executionTime: result.executionTime,
          originalOperationType: operation.type,
        },
      };

      // Add to undo stack
      this.undoStack.push(action);

      // Clear redo stack (new action invalidates redo history)
      this.redoStack.length = 0;

      // Manage stack size
      this.maintainStackSize();

      // Auto cleanup if enabled
      if (this.config.autoCleanup) {
        this.cleanupOldActions();
      }
    } catch (error) {
      console.warn(`Failed to record undo action: ${error}`);
    }
  }

  /**
   * Record a batch operation for undo/redo
   */
  async recordBatchAction(
    operations: BulkOperation[],
    result: BatchOperationResult,
  ): Promise<void> {
    if (!result.success || result.totalCellsModified === 0) {
      return;
    }

    try {
      // Create a single undo operation for all changes
      const undoOperation = await this.createUndoOperationFromChanges(
        result.consolidatedChanges,
      );

      const action: UndoAction = {
        actionId: `batch_${this.nextActionId++}`,
        operationType: "batch",
        description: `Batch operation (${operations.length} operations, ${result.totalCellsModified} cells)`,
        timestamp: Date.now(),
        undoOperation,
        changes: new Map(result.consolidatedChanges),
        metadata: {
          operationCount: operations.length,
          cellsModified: result.totalCellsModified,
          executionTime: result.totalExecutionTime,
          isBatch: true,
        },
      };

      this.undoStack.push(action);
      this.redoStack.length = 0;
      this.maintainStackSize();

      if (this.config.autoCleanup) {
        this.cleanupOldActions();
      }
    } catch (error) {
      console.warn(`Failed to record batch undo action: ${error}`);
    }
  }

  /**
   * Undo the last action
   */
  async undo(): Promise<OperationResult | null> {
    if (this.undoStack.length === 0) {
      return null;
    }

    const action = this.undoStack.pop()!;

    try {
      // Validate undo operation if configured
      if (this.config.validateUndo) {
        const validationError = action.undoOperation.validate();
        if (validationError) {
          // Put action back and return error
          this.undoStack.push(action);
          return {
            success: false,
            cellsModified: 0,
            cellsProcessed: 0,
            executionTime: 0,
            errors: [`Undo validation failed: ${validationError}`],
            warnings: [],
            actualChanges: new Map(),
            metadata: {
              operationType: "undo",
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
        }
      }

      // Execute the undo operation
      const undoResult = await action.undoOperation.execute();

      if (undoResult.success) {
        // Move action to redo stack
        this.redoStack.push(action);
        this.maintainRedoStackSize();
      } else {
        // Put action back on undo stack if undo failed
        this.undoStack.push(action);
      }

      return undoResult;
    } catch (error) {
      // Put action back on undo stack
      this.undoStack.push(action);
      throw error;
    }
  }

  /**
   * Redo the last undone action
   */
  async redo(): Promise<OperationResult | null> {
    if (this.redoStack.length === 0) {
      return null;
    }

    const action = this.redoStack.pop()!;

    try {
      // Execute the redo operation if available
      const redoOperation = action.redoOperation;
      if (!redoOperation) {
        // If no redo operation, create one from the changes
        const redoOp = await this.createRedoOperationFromChanges(
          action.changes,
        );
        const redoResult = await redoOp.execute();

        if (redoResult.success) {
          this.undoStack.push(action);
        } else {
          this.redoStack.push(action);
        }

        return redoResult;
      }

      const redoResult = await redoOperation.execute();

      if (redoResult.success) {
        // Move action back to undo stack
        this.undoStack.push(action);
      } else {
        // Put action back on redo stack if redo failed
        this.redoStack.push(action);
      }

      return redoResult;
    } catch (error) {
      // Put action back on redo stack
      this.redoStack.push(action);
      throw error;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next undo action
   */
  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) {
      return null;
    }
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get the description of the next redo action
   */
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) {
      return null;
    }
    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Clear all undo/redo history
   */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /**
   * Get undo history for UI display
   */
  getUndoHistory(): Array<{
    id: string;
    description: string;
    timestamp: number;
  }> {
    return this.undoStack.map((action) => ({
      id: action.actionId,
      description: action.description,
      timestamp: action.timestamp,
    }));
  }

  /**
   * Get redo history for UI display
   */
  getRedoHistory(): Array<{
    id: string;
    description: string;
    timestamp: number;
  }> {
    return this.redoStack.map((action) => ({
      id: action.actionId,
      description: action.description,
      timestamp: action.timestamp,
    }));
  }

  /**
   * Create an undo operation from the execution result
   */
  private async createUndoOperation(
    result: OperationResult,
  ): Promise<BulkOperation> {
    return this.createUndoOperationFromChanges(result.actualChanges);
  }

  /**
   * Create an undo operation from a set of changes
   */
  private async createUndoOperationFromChanges(
    changes: Map<string, CellChange>,
  ): Promise<BulkOperation> {
    // Group changes by their original value to optimize undo operations
    const valueGroups = new Map<string, CellAddress[]>();

    for (const [_key, change] of changes) {
      const valueKey = String(change.before);
      if (!valueGroups.has(valueKey)) {
        valueGroups.set(valueKey, []);
      }
      valueGroups.get(valueKey)?.push(change.address);
    }

    // If all cells are being restored to the same value, use a single bulk set operation
    if (valueGroups.size === 1) {
      const firstEntry = valueGroups.entries().next();
      if (!firstEntry.value) {
        throw new Error("Unexpected empty value group");
      }
      const [value, addresses] = firstEntry.value;
      const selection = CellSelection.fromCells(addresses);

      return new BulkSetOperation(
        selection,
        { value: value === "null" ? null : value, overwriteExisting: true },
        this.cellRepository,
      );
    }

    // Otherwise, create a composite undo operation
    return new CompositeUndoOperation(changes, this.cellRepository);
  }

  /**
   * Create a redo operation from changes
   */
  private async createRedoOperationFromChanges(
    changes: Map<string, CellChange>,
  ): Promise<BulkOperation> {
    // Similar to undo, but using the 'after' values
    const valueGroups = new Map<string, CellAddress[]>();

    for (const [_key, change] of changes) {
      const valueKey = String(change.after);
      if (!valueGroups.has(valueKey)) {
        valueGroups.set(valueKey, []);
      }
      valueGroups.get(valueKey)?.push(change.address);
    }

    if (valueGroups.size === 1) {
      const firstEntry = valueGroups.entries().next();
      if (!firstEntry.value) {
        throw new Error("Unexpected empty value group");
      }
      const [value, addresses] = firstEntry.value;
      const selection = CellSelection.fromCells(addresses);

      return new BulkSetOperation(
        selection,
        { value: value === "null" ? null : value, overwriteExisting: true },
        this.cellRepository,
      );
    }

    return new CompositeRedoOperation(changes, this.cellRepository);
  }

  /**
   * Maintain undo stack size
   */
  private maintainStackSize(): void {
    while (this.undoStack.length > this.config.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  /**
   * Maintain redo stack size
   */
  private maintainRedoStackSize(): void {
    // Redo stack can be smaller than undo stack
    const maxRedoSize = Math.floor(this.config.maxHistorySize / 2);
    while (this.redoStack.length > maxRedoSize) {
      this.redoStack.shift();
    }
  }

  /**
   * Clean up old actions beyond max age
   */
  private cleanupOldActions(): void {
    const cutoffTime = Date.now() - this.config.maxActionAge;

    // Clean undo stack
    while (
      this.undoStack.length > 0 &&
      this.undoStack[0].timestamp < cutoffTime
    ) {
      this.undoStack.shift();
    }

    // Clean redo stack
    while (
      this.redoStack.length > 0 &&
      this.redoStack[0].timestamp < cutoffTime
    ) {
      this.redoStack.shift();
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    undoActions: number;
    redoActions: number;
    estimatedMemory: number;
  } {
    const undoMemory = this.undoStack.reduce(
      (sum, action) => sum + action.changes.size * 200,
      0,
    );
    const redoMemory = this.redoStack.reduce(
      (sum, action) => sum + action.changes.size * 200,
      0,
    );

    return {
      undoActions: this.undoStack.length,
      redoActions: this.redoStack.length,
      estimatedMemory: undoMemory + redoMemory,
    };
  }
}

/**
 * Composite operation for complex undo/redo scenarios
 */
class CompositeUndoOperation extends BulkSetOperation {
  constructor(
    private changes: Map<string, CellChange>,
    cellRepository: ICellRepository,
  ) {
    // Create a selection from all affected cells
    const addresses = Array.from(changes.values()).map(
      (change) => change.address,
    );
    const selection = CellSelection.fromCells(addresses);

    super(selection, { value: null, overwriteExisting: true }, cellRepository);
  }

  protected async transformCell(
    address: CellAddress,
    _currentValue: CellValue,
  ): Promise<CellValue | null> {
    const key = `${address.row},${address.col}`;
    const change = this.changes.get(key);
    return change ? change.before : null;
  }

  getDescription(): string {
    return `Undo ${this.changes.size} cell changes`;
  }
}

/**
 * Composite operation for redo scenarios
 */
class CompositeRedoOperation extends BulkSetOperation {
  constructor(
    private changes: Map<string, CellChange>,
    cellRepository: ICellRepository,
  ) {
    const addresses = Array.from(changes.values()).map(
      (change) => change.address,
    );
    const selection = CellSelection.fromCells(addresses);

    super(selection, { value: null, overwriteExisting: true }, cellRepository);
  }

  protected async transformCell(
    address: CellAddress,
    _currentValue: CellValue,
  ): Promise<CellValue | null> {
    const key = `${address.row},${address.col}`;
    const change = this.changes.get(key);
    return change ? change.after : null;
  }

  getDescription(): string {
    return `Redo ${this.changes.size} cell changes`;
  }
}

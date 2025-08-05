import { Cell } from "../domain/models/Cell";
import { CellAddress } from "../domain/models/CellAddress";
import { err, ok, type Result } from "../shared/types/Result";
import type { StructuralChange } from "./ReferenceUpdater";
import { ReferenceUpdater } from "./ReferenceUpdater";
import type { SparseGrid } from "./SparseGrid";

/**
 * Complete snapshot of structural state for undo/redo operations
 */
export interface StructuralSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: number;
  /** Complete grid state - all cells with their positions and values */
  gridState: Map<string, Cell>;
  /** Grid bounds */
  gridBounds: { maxRow: number; maxCol: number };
  /** Cursor/selection state for restoration */
  cursorState?: {
    cursor: CellAddress;
    selection?: { start: CellAddress; end: CellAddress };
  };
  /** Viewport state for restoration */
  viewportState?: {
    startRow: number;
    startCol: number;
    rows: number;
    cols: number;
  };
}

/**
 * Represents a structural operation that can be undone/redone
 */
export interface StructuralOperation {
  /** Unique identifier for this operation */
  id: string;
  /** Type of structural change */
  type: StructuralChange["type"];
  /** Human-readable description */
  description: string;
  /** Timestamp when operation was performed */
  timestamp: number;
  /** State before the operation (for undo) */
  beforeSnapshot: StructuralSnapshot;
  /** State after the operation (for redo) */
  afterSnapshot?: StructuralSnapshot;
  /** The original structural change for analysis */
  change: StructuralChange;
  /** Whether this operation is part of a transaction group */
  transactionId?: string;
}

/**
 * Transaction group for related operations
 */
export interface StructuralTransaction {
  id: string;
  description: string;
  operations: StructuralOperation[];
  timestamp: number;
}

/**
 * Undo/Redo manager for structural operations with formula reference restoration
 */
export class StructuralUndoManager {
  private undoStack: (StructuralOperation | StructuralTransaction)[] = [];
  private redoStack: (StructuralOperation | StructuralTransaction)[] = [];
  private maxStackSize: number;
  private referenceUpdater: ReferenceUpdater;
  private currentTransactionId?: string;
  private currentTransaction?: StructuralTransaction;

  constructor(maxStackSize = 100) {
    this.maxStackSize = maxStackSize;
    this.referenceUpdater = new ReferenceUpdater();
  }

  /**
   * Create a snapshot of the current structural state
   */
  createSnapshot(
    grid: SparseGrid,
    cursorState?: StructuralSnapshot["cursorState"],
    viewportState?: StructuralSnapshot["viewportState"],
  ): StructuralSnapshot {
    const allCells = grid.getAllCells();
    const gridState = new Map<string, Cell>();

    // Deep copy all cells with their current positions
    for (const [address, cell] of allCells.entries()) {
      const key = `${address.row},${address.col}`;
      // Deep copy the cell to preserve its state
      const cellCopy = Cell.create(cell.rawValue, address);
      if (cellCopy.ok) {
        gridState.set(key, cellCopy.value);
      }
    }

    return {
      timestamp: Date.now(),
      gridState,
      gridBounds: grid.getBounds(),
      cursorState: cursorState ? { ...cursorState } : undefined,
      viewportState: viewportState ? { ...viewportState } : undefined,
    };
  }

  /**
   * Start a new transaction group for related operations
   */
  startTransaction(description: string): string {
    const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.currentTransactionId = transactionId;
    this.currentTransaction = {
      id: transactionId,
      description,
      operations: [],
      timestamp: Date.now(),
    };
    return transactionId;
  }

  /**
   * End the current transaction
   */
  endTransaction(): void {
    if (
      this.currentTransaction &&
      this.currentTransaction.operations.length > 0
    ) {
      // Add the transaction to the undo stack
      this.addToUndoStack(this.currentTransaction);
    }
    this.currentTransactionId = undefined;
    this.currentTransaction = undefined;
  }

  /**
   * Cancel the current transaction without saving it
   */
  cancelTransaction(): void {
    this.currentTransactionId = undefined;
    this.currentTransaction = undefined;
  }

  /**
   * Record a structural operation for undo/redo
   */
  recordOperation(
    id: string,
    change: StructuralChange,
    description: string,
    beforeSnapshot: StructuralSnapshot,
    afterSnapshot?: StructuralSnapshot,
  ): void {
    const operation: StructuralOperation = {
      id,
      type: change.type,
      description,
      timestamp: Date.now(),
      beforeSnapshot,
      afterSnapshot,
      change,
      transactionId: this.currentTransactionId,
    };

    if (this.currentTransaction) {
      // Add to current transaction
      this.currentTransaction.operations.push(operation);
    } else {
      // Add as individual operation
      this.addToUndoStack(operation);
    }
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Undo the last operation or transaction
   */
  async undo(grid: SparseGrid): Promise<Result<StructuralSnapshot, string>> {
    if (!this.canUndo()) {
      return err("Nothing to undo");
    }

    const item = this.undoStack.pop();
    if (!item) {
      return err("Undo stack is empty");
    }

    try {
      let resultSnapshot: StructuralSnapshot;

      if ("operations" in item) {
        // Undo transaction (operations in reverse order)
        const transaction = item as StructuralTransaction;
        const operations = [...transaction.operations].reverse();

        for (const operation of operations) {
          const result = await this.undoSingleOperation(operation, grid);
          if (!result.ok) {
            return err(`Failed to undo transaction: ${result.error}`);
          }
        }

        // Use the first operation's before snapshot as the result
        resultSnapshot = transaction.operations[0].beforeSnapshot;
      } else {
        // Undo single operation
        const operation = item as StructuralOperation;
        const result = await this.undoSingleOperation(operation, grid);
        if (!result.ok) {
          return err(result.error);
        }
        resultSnapshot = result.value;
      }

      // Move to redo stack
      this.redoStack.push(item);
      this.trimStack(this.redoStack);

      return ok(resultSnapshot);
    } catch (error) {
      return err(`Undo failed: ${error}`);
    }
  }

  /**
   * Redo the last undone operation or transaction
   */
  async redo(grid: SparseGrid): Promise<Result<StructuralSnapshot, string>> {
    if (!this.canRedo()) {
      return err("Nothing to redo");
    }

    const item = this.redoStack.pop();
    if (!item) {
      return err("Redo stack is empty");
    }

    try {
      let resultSnapshot: StructuralSnapshot;

      if ("operations" in item) {
        // Redo transaction (operations in forward order)
        const transaction = item as StructuralTransaction;

        for (const operation of transaction.operations) {
          const result = await this.redoSingleOperation(operation, grid);
          if (!result.ok) {
            return err(`Failed to redo transaction: ${result.error}`);
          }
        }

        // Use the last operation's after snapshot as the result
        const lastOp =
          transaction.operations[transaction.operations.length - 1];
        if (!lastOp.afterSnapshot) {
          return err("Last operation has no after snapshot");
        }
        resultSnapshot = lastOp.afterSnapshot;
      } else {
        // Redo single operation
        const operation = item as StructuralOperation;
        const result = await this.redoSingleOperation(operation, grid);
        if (!result.ok) {
          return err(result.error);
        }
        resultSnapshot = result.value;
      }

      // Move back to undo stack
      this.undoStack.push(item);
      this.trimStack(this.undoStack);

      return ok(resultSnapshot);
    } catch (error) {
      return err(`Redo failed: ${error}`);
    }
  }

  /**
   * Restore grid state from a snapshot
   */
  restoreGridFromSnapshot(
    grid: SparseGrid,
    snapshot: StructuralSnapshot,
  ): Result<void, string> {
    try {
      // Clear current grid
      grid.clear();

      // Restore all cells from snapshot
      for (const [positionKey, cell] of snapshot.gridState.entries()) {
        const [row, col] = positionKey.split(",").map(Number);
        const addressResult = CellAddress.create(row, col);
        if (!addressResult.ok) continue;
        const address = addressResult.value;

        // Deep copy the cell to avoid reference issues
        const cellCopy = Cell.create(cell.rawValue, address);
        if (cellCopy.ok) {
          grid.setCell(address, cellCopy.value);
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(`Failed to restore grid from snapshot: ${error}`);
    }
  }

  /**
   * Get undo history for debugging/display
   */
  getUndoHistory(): Array<{
    description: string;
    timestamp: number;
    type: string;
  }> {
    return this.undoStack.map((item) => ({
      description: "operations" in item ? item.description : item.description,
      timestamp: item.timestamp,
      type: "operations" in item ? "transaction" : "operation",
    }));
  }

  /**
   * Get redo history for debugging/display
   */
  getRedoHistory(): Array<{
    description: string;
    timestamp: number;
    type: string;
  }> {
    return this.redoStack.map((item) => ({
      description: "operations" in item ? item.description : item.description,
      timestamp: item.timestamp,
      type: "operations" in item ? "transaction" : "operation",
    }));
  }

  /**
   * Clear all undo/redo history
   */
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.cancelTransaction();
  }

  /**
   * Get statistics about the undo system
   */
  getStats(): {
    undoStackSize: number;
    redoStackSize: number;
    maxStackSize: number;
    currentTransactionId?: string;
  } {
    return {
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      maxStackSize: this.maxStackSize,
      currentTransactionId: this.currentTransactionId,
    };
  }

  /**
   * Undo a single operation
   */
  private async undoSingleOperation(
    operation: StructuralOperation,
    grid: SparseGrid,
  ): Promise<Result<StructuralSnapshot, string>> {
    // Restore the grid state from before the operation
    const restoreResult = this.restoreGridFromSnapshot(
      grid,
      operation.beforeSnapshot,
    );
    if (!restoreResult.ok) {
      return err(restoreResult.error);
    }

    return ok(operation.beforeSnapshot);
  }

  /**
   * Redo a single operation
   */
  private async redoSingleOperation(
    operation: StructuralOperation,
    grid: SparseGrid,
  ): Promise<Result<StructuralSnapshot, string>> {
    if (!operation.afterSnapshot) {
      return err("No after snapshot available for redo");
    }

    // Restore the grid state from after the operation
    const restoreResult = this.restoreGridFromSnapshot(
      grid,
      operation.afterSnapshot,
    );
    if (!restoreResult.ok) {
      return err(restoreResult.error);
    }

    return ok(operation.afterSnapshot);
  }

  /**
   * Add item to undo stack and clear redo stack
   */
  private addToUndoStack(
    item: StructuralOperation | StructuralTransaction,
  ): void {
    this.undoStack.push(item);
    this.trimStack(this.undoStack);

    // Clear redo stack when new operation is added
    this.redoStack = [];
  }

  /**
   * Trim stack to max size
   */
  private trimStack(
    stack: (StructuralOperation | StructuralTransaction)[],
  ): void {
    while (stack.length > this.maxStackSize) {
      stack.shift();
    }
  }
}

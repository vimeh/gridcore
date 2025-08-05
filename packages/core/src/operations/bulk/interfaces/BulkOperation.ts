import type { CellAddress, CellValue } from "../../../domain/models";
import type { OperationPreview } from "./OperationPreview";
import type { OperationResult } from "./OperationResult";

/**
 * Selection interface for bulk operations
 * Represents the cells that will be affected by a bulk operation
 */
export interface Selection {
  /** Get all cell addresses in the selection */
  getCells(): Iterable<CellAddress>;
  
  /** Check if a specific cell is in the selection */
  contains(address: CellAddress): boolean;
  
  /** Get the count of cells in the selection */
  count(): number;
  
  /** Check if the selection is empty */
  isEmpty(): boolean;
}

/**
 * Core interface for all bulk operations
 * Defines the contract that all bulk operations must implement
 */
export interface BulkOperation {
  /** Unique identifier for the operation type */
  readonly type: string;
  
  /** The selection of cells this operation will affect */
  readonly selection: Selection;
  
  /** Operation-specific options */
  readonly options: Record<string, any>;
  
  /**
   * Generate a preview of what this operation will do
   * Should be fast and limit results for large operations
   */
  preview(limit?: number): Promise<OperationPreview>;
  
  /**
   * Execute the bulk operation
   * Should be atomic - either all changes succeed or all fail
   */
  execute(): Promise<OperationResult>;
  
  /**
   * Estimate the time this operation will take to complete
   * Used for progress indicators
   */
  estimateTime(): number;
  
  /**
   * Validate that this operation can be executed
   * Returns null if valid, error message if invalid
   */
  validate(): string | null;
  
  /**
   * Get a human-readable description of this operation
   */
  getDescription(): string;
}

/**
 * Extended interface for operations that support undo/redo
 */
export interface UndoableBulkOperation extends BulkOperation {
  /**
   * Create an undo operation that reverses this operation
   */
  createUndoOperation(): Promise<BulkOperation>;
  
  /**
   * Check if this operation can be undone
   */
  canUndo(): boolean;
}

/**
 * Interface for operations that can be previewed
 */
export interface PreviewableBulkOperation extends BulkOperation {
  /**
   * Whether this operation requires preview before execution
   */
  readonly requiresPreview: boolean;
  
  /**
   * Generate a detailed preview for user confirmation
   */
  generateDetailedPreview(): Promise<OperationPreview>;
}

/**
 * Options for configuring bulk operation behavior
 */
export interface BulkOperationOptions {
  /** Whether to stop on first error or continue processing */
  stopOnError?: boolean;
  
  /** Maximum number of cells to process in a single batch */
  batchSize?: number;
  
  /** Whether to validate each cell before processing */
  validateCells?: boolean;
  
  /** Progress callback for long-running operations */
  onProgress?: (processed: number, total: number) => void;
  
  /** Whether to skip empty cells */
  skipEmpty?: boolean;
  
  /** Whether to process formulas or their calculated values */
  processFormulas?: boolean;
}

/**
 * Factory interface for creating bulk operations
 */
export interface BulkOperationFactory {
  /**
   * Create a bulk operation from a command and selection
   */
  createOperation(
    type: string,
    selection: Selection,
    options: Record<string, any>
  ): BulkOperation | null;
  
  /**
   * Get all supported operation types
   */
  getSupportedTypes(): string[];
  
  /**
   * Check if an operation type is supported
   */
  isSupported(type: string): boolean;
}
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import { Cell, type CellAddress, type CellValue } from "../../../domain/models";
import { BaseBulkOperation } from "../base/BaseBulkOperation";
import type { CellChange } from "../interfaces/OperationPreview";
import type { OperationResult } from "../interfaces/OperationResult";
import type {
  BulkOperationOptions,
  Selection,
} from "../interfaces/BulkOperation";

/**
 * Options for bulk set operation
 */
export interface BulkSetOptions extends BulkOperationOptions {
  /** The value to set in all selected cells */
  value: CellValue;

  /** Whether to overwrite existing values */
  overwriteExisting?: boolean;

  /** Whether to preserve formulas */
  preserveFormulas?: boolean;
}

/**
 * Bulk operation that sets all selected cells to a specific value
 */
export class BulkSetOperation extends BaseBulkOperation {
  private setValue: CellValue;

  constructor(
    selection: Selection,
    options: BulkSetOptions,
    cellRepository: ICellRepository,
  ) {
    super("bulkSet", selection, options, cellRepository);
    this.setValue = options.value;
  }

  /**
   * Transform each cell to the target value
   */
  protected async transformCell(
    address: CellAddress,
    currentValue: CellValue,
  ): Promise<CellValue | null> {
    const options = this.options as BulkSetOptions;

    // Check if we should skip this cell
    if (
      !options.overwriteExisting &&
      currentValue !== null &&
      currentValue !== ""
    ) {
      return null; // Skip non-empty cells if not overwriting
    }

    // Check if this is a formula cell and we should preserve formulas
    if (options.preserveFormulas) {
      const cell = this.cellRepository.get(address);
      if (cell?.formula) {
        return null; // Skip formula cells if preserving formulas
      }
    }

    return this.setValue;
  }

  /**
   * Validate the operation
   */
  validate(): string | null {
    const baseValidation = super.validate();
    if (baseValidation) {
      return baseValidation;
    }

    const options = this.options as BulkSetOptions;
    if (options.value === undefined) {
      return "Set value cannot be undefined";
    }
    
    if (options.value === null) {
      return "Set value cannot be null";
    }

    return null;
  }

  /**
   * Get description of the operation
   */
  getDescription(): string {
    const options = this.options as BulkSetOptions;
    return `Set ${this.selection.count()} cells to "${options.value}"`;
  }

  /**
   * Estimate time more accurately for set operations
   */
  estimateTime(): number {
    // Set operations are very fast - estimate 50,000 cells per second
    const cellCount = this.selection.count();
    const cellsPerSecond = 50000;
    return Math.max(100, (cellCount / cellsPerSecond) * 1000); // Minimum 100ms
  }

  /**
   * Execute the operation with proper error handling
   */
  async execute(): Promise<OperationResult> {
    const startTime = Date.now();
    const cells = Array.from(this.selection.getCells());
    const errors: string[] = [];
    const warnings: string[] = [];
    const actualChanges = new Map<string, CellChange>();
    let cellsProcessed = 0;
    let cellsModified = 0;

    for (const address of cells) {
      try {
        cellsProcessed++;

        // Get current cell value
        const currentCell = this.cellRepository.get(address);
        const currentValue = currentCell
          ? currentCell.computedValue || currentCell.rawValue
          : null;

        // Transform the cell value
        const newValue = await this.transformCell(address, currentValue);

        if (newValue === null || newValue === currentValue) {
          continue;
        }

        // Update the cell
        const cellResult = Cell.create(newValue, address);
        if (!cellResult.ok) {
          errors.push(
            `Failed to create cell ${address.row},${address.col}: ${cellResult.error}`,
          );
          continue;
        }

        // Check if setCell exists and returns a result (for test mocks)
        const repo = this.cellRepository as any;
        if (typeof repo.setCell === 'function') {
          const setResult = await repo.setCell(address, cellResult.value);
          if (setResult && !setResult.ok) {
            errors.push(
              `Failed to set cell ${address.row},${address.col}: ${setResult.error || 'Repository error'}`,
            );
            continue;
          }
        } else {
          // Use standard set method
          this.cellRepository.set(address, cellResult.value);
        }

        // Record the change
        const change: CellChange = {
          address,
          before: currentValue,
          after: newValue,
          isFormula: false,
          changeType: "value",
        };

        actualChanges.set(`${address.row},${address.col}`, change);
        cellsModified++;
      } catch (error) {
        errors.push(
          `Error processing cell ${address.row},${address.col}: ${error}`,
        );
        if (this.options.stopOnError) {
          break;
        }
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      success: errors.length === 0,
      cellsModified,
      cellsProcessed,
      executionTime,
      errors,
      warnings,
      actualChanges,
      metadata: {
        operationType: this.type,
        startTime: Date.now() - executionTime,
        endTime: Date.now(),
        memoryUsage: this.estimateMemoryUsage(cellsModified),
        performance: {
          cellsPerSecond: cellsProcessed / Math.max(executionTime / 1000, 0.001),
          peakMemoryUsage: this.estimateMemoryUsage(cellsModified),
          batchCount: 1,
          averageBatchTime: executionTime,
          validationTime: 0,
          updateTime: executionTime,
          recalculationTime: 0,
        },
      },
    };
  }
}

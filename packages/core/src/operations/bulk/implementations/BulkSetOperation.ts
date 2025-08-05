import { CellAddress } from "../../../domain/models";
import type { CellValue } from "../../../domain/models";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Selection, BulkOperationOptions } from "../interfaces/BulkOperation";
import { BaseBulkOperation } from "../base/BaseBulkOperation";

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
    cellRepository: ICellRepository
  ) {
    super("bulkSet", selection, options, cellRepository);
    this.setValue = options.value;
  }

  /**
   * Transform each cell to the target value
   */
  protected async transformCell(address: CellAddress, currentValue: CellValue): Promise<CellValue | null> {
    const options = this.options as BulkSetOptions;
    
    // Check if we should skip this cell
    if (!options.overwriteExisting && currentValue !== null && currentValue !== "") {
      return null; // Skip non-empty cells if not overwriting
    }
    
    // Check if this is a formula cell and we should preserve formulas
    if (options.preserveFormulas) {
      const cell = await this.cellRepository.get(address);
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
    if (options.value === undefined || options.value === null) {
      return "Set value cannot be null or undefined";
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
}
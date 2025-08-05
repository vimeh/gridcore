import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import type { Selection, BulkOperationFactory as IBulkOperationFactory, BulkOperation } from "./interfaces/BulkOperation";
import { FindReplaceOperation, FindReplaceOptions } from "./implementations/FindReplaceOperation";
import { BulkSetOperation, BulkSetOptions } from "./implementations/BulkSetOperation";

/**
 * Factory for creating bulk operations from command parser results
 * Bridges the gap between UI commands and operation implementations
 */
export class BulkOperationFactory implements IBulkOperationFactory {
  constructor(private cellRepository: ICellRepository) {}

  /**
   * Create a bulk operation from a command type and options
   */
  createOperation(
    type: string,
    selection: Selection,
    options: Record<string, any>
  ): BulkOperation | null {
    switch (type) {
      case "findReplace":
        return this.createFindReplaceOperation(selection, options);
      
      case "bulkSet":
        return this.createBulkSetOperation(selection, options);
      
      case "mathOperation":
        return this.createMathOperation(selection, options);
      
      case "fill":
        return this.createFillOperation(selection, options);
      
      case "transform":
        return this.createTransformOperation(selection, options);
      
      case "format":
        return this.createFormatOperation(selection, options);
      
      default:
        return null;
    }
  }

  /**
   * Get all supported operation types
   */
  getSupportedTypes(): string[] {
    return [
      "findReplace",
      "bulkSet", 
      "mathOperation",
      "fill",
      "transform",
      "format"
    ];
  }

  /**
   * Check if an operation type is supported
   */
  isSupported(type: string): boolean {
    return this.getSupportedTypes().includes(type);
  }

  /**
   * Create a find/replace operation from command options
   */
  private createFindReplaceOperation(selection: Selection, options: any): FindReplaceOperation {
    const findReplaceOptions: FindReplaceOptions = {
      findPattern: options.findPattern,
      replaceWith: options.replaceWith,
      useRegex: options.options?.useRegex ?? true,
      caseSensitive: options.options?.caseSensitive ?? true,
      global: options.options?.global ?? true,
      scope: options.options?.scope ?? "selection",
      searchInFormulas: options.options?.searchInFormulas ?? false,
      searchInValues: options.options?.searchInValues ?? true,
      wholeCellMatch: options.options?.wholeCellMatch ?? false
    };

    return new FindReplaceOperation(selection, findReplaceOptions, this.cellRepository);
  }

  /**
   * Create a bulk set operation from command options
   */
  private createBulkSetOperation(selection: Selection, options: any): BulkSetOperation {
    const bulkSetOptions: BulkSetOptions = {
      value: options.value,
      overwriteExisting: options.overwriteExisting ?? true,
      preserveFormulas: options.preserveFormulas ?? false,
      skipEmpty: options.skipEmpty ?? false
    };

    return new BulkSetOperation(selection, bulkSetOptions, this.cellRepository);
  }

  /**
   * Create a math operation (placeholder for future implementation)
   */
  private createMathOperation(selection: Selection, options: any): BulkOperation | null {
    // TODO: Implement MathOperation class
    // This would handle add, subtract, multiply, divide operations
    console.warn("Math operations not yet implemented");
    return null;
  }

  /**
   * Create a fill operation (placeholder for future implementation)
   */
  private createFillOperation(selection: Selection, options: any): BulkOperation | null {
    // TODO: Implement FillOperation class
    // This would handle fill down, up, left, right, series operations
    console.warn("Fill operations not yet implemented");
    return null;
  }

  /**
   * Create a transform operation (placeholder for future implementation)
   */
  private createTransformOperation(selection: Selection, options: any): BulkOperation | null {
    // TODO: Implement TransformOperation class
    // This would handle upper, lower, trim, clean operations
    console.warn("Transform operations not yet implemented");
    return null;
  }

  /**
   * Create a format operation (placeholder for future implementation)
   */
  private createFormatOperation(selection: Selection, options: any): BulkOperation | null {
    // TODO: Implement FormatOperation class
    // This would handle currency, percent, date, number formatting
    console.warn("Format operations not yet implemented");
    return null;
  }
}

/**
 * Convenience function to create a factory instance
 */
export function createBulkOperationFactory(cellRepository: ICellRepository): BulkOperationFactory {
  return new BulkOperationFactory(cellRepository);
}
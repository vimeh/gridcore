import { CellAddress } from "../../../domain/models";
import type { CellValue } from "../../../domain/models";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Selection, BulkOperationOptions } from "../interfaces/BulkOperation";
import type { OperationPreview, CellChange } from "../interfaces/OperationPreview";
import { BaseBulkOperation } from "../base/BaseBulkOperation";
import { OperationPreviewBuilder } from "../interfaces/OperationPreview";

/**
 * Supported math operations
 */
export type MathOperationType = 
  | "add" 
  | "subtract" 
  | "multiply" 
  | "divide" 
  | "modulo"
  | "percent"
  | "percentDecrease"
  | "round"
  | "floor"
  | "ceil";

/**
 * Options for bulk math operation
 */
export interface BulkMathOptions extends BulkOperationOptions {
  /** The type of math operation to perform */
  operation: MathOperationType;
  
  /** The operand value for the operation */
  value: number;
  
  /** Number of decimal places for rounding operations */
  decimalPlaces?: number;
  
  /** Whether to skip non-numeric cells */
  skipNonNumeric?: boolean;
  
  /** Whether to attempt conversion of string numbers */
  convertStrings?: boolean;
  
  /** Whether to preserve the original data type when possible */
  preserveType?: boolean;
}

/**
 * Utility functions for numeric operations
 */
export class NumericUtils {
  /**
   * Convert a cell value to a number if possible
   */
  static toNumber(value: CellValue): number | null {
    if (typeof value === "number") {
      return value;
    }
    
    if (typeof value === "string") {
      // Remove common formatting characters
      const cleaned = value.replace(/[\s,$%]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    
    return null;
  }
  
  /**
   * Check if a value can be converted to a number
   */
  static isNumeric(value: CellValue): boolean {
    return NumericUtils.toNumber(value) !== null;
  }
  
  /**
   * Format a number back to the appropriate type
   */
  static formatResult(result: number, originalValue: CellValue, preserveType: boolean = true): CellValue {
    // Handle special cases
    if (!isFinite(result)) {
      return result; // NaN, Infinity, -Infinity
    }
    
    // If preserving type and original was a string that looked numeric, return as string
    if (preserveType && typeof originalValue === "string" && NumericUtils.isNumeric(originalValue)) {
      // Try to preserve the original string format style
      if (originalValue.includes("%")) {
        return `${result}%`;
      }
      if (originalValue.includes("$")) {
        return `$${result}`;
      }
      // For clean integers, return as integer string
      if (Number.isInteger(result) && !originalValue.includes(".")) {
        return result.toString();
      }
    }
    
    return result;
  }
  
  /**
   * Perform a math operation safely
   */
  static performOperation(
    operation: MathOperationType, 
    value: number, 
    operand: number, 
    decimalPlaces?: number
  ): number {
    let result: number;
    
    switch (operation) {
      case "add":
        result = value + operand;
        break;
        
      case "subtract":
        result = value - operand;
        break;
        
      case "multiply":
        result = value * operand;
        break;
        
      case "divide":
        if (operand === 0) {
          return NaN; // Division by zero
        }
        result = value / operand;
        break;
        
      case "modulo":
        if (operand === 0) {
          return NaN; // Modulo by zero
        }
        result = value % operand;
        break;
        
      case "percent":
        // Increase by percentage: value * (1 + operand/100)
        result = value * (1 + operand / 100);
        break;
        
      case "percentDecrease":
        // Decrease by percentage: value * (1 - operand/100)
        result = value * (1 - operand / 100);
        break;
        
      case "round":
        const factor = Math.pow(10, decimalPlaces || 0);
        result = Math.round(value * factor) / factor;
        break;
        
      case "floor":
        result = Math.floor(value);
        break;
        
      case "ceil":
        result = Math.ceil(value);
        break;
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    return result;
  }
}

/**
 * Bulk operation that performs mathematical operations on numeric cells
 */
export class BulkMathOperation extends BaseBulkOperation {
  private mathOptions: BulkMathOptions;
  
  constructor(
    selection: Selection,
    options: BulkMathOptions,
    cellRepository: ICellRepository
  ) {
    super("mathOperation", selection, options, cellRepository);
    this.mathOptions = {
      skipNonNumeric: true,
      convertStrings: true,
      preserveType: true,
      ...options
    };
  }

  /**
   * Transform each cell using the specified math operation
   */
  protected async transformCell(address: CellAddress, currentValue: CellValue): Promise<CellValue | null> {
    const { operation, value: operand, decimalPlaces, skipNonNumeric, convertStrings, preserveType } = this.mathOptions;
    
    // Skip null/undefined values
    if (currentValue === null || currentValue === undefined) {
      return null;
    }
    
    // Skip empty strings
    if (currentValue === "") {
      return null;
    }
    
    // Convert to number
    let numericValue: number | null = null;
    
    if (convertStrings) {
      numericValue = NumericUtils.toNumber(currentValue);
    } else if (typeof currentValue === "number") {
      numericValue = currentValue;
    }
    
    // Skip if not numeric and configured to skip
    if (numericValue === null) {
      if (skipNonNumeric) {
        return null;
      } else {
        throw new Error(`Cannot perform ${operation} on non-numeric value: ${currentValue}`);
      }
    }
    
    // Perform the operation
    const result = NumericUtils.performOperation(operation, numericValue, operand, decimalPlaces);
    
    // Handle invalid results
    if (!isFinite(result)) {
      if (skipNonNumeric) {
        return null; // Skip invalid results
      } else {
        return result; // Return NaN/Infinity if not skipping
      }
    }
    
    // Format the result appropriately
    return NumericUtils.formatResult(result, currentValue, preserveType);
  }

  /**
   * Validate the math operation
   */
  validate(): string | null {
    const baseValidation = super.validate();
    if (baseValidation) {
      return baseValidation;
    }
    
    const { operation, value: operand, decimalPlaces } = this.mathOptions;
    
    // Validate operand
    if (typeof operand !== "number" || !isFinite(operand)) {
      return "Math operation requires a valid finite number";
    }
    
    // Check for division/modulo by zero
    if ((operation === "divide" || operation === "modulo") && operand === 0) {
      return `Cannot ${operation} by zero`;
    }
    
    // Validate decimal places for rounding
    if (operation === "round" && decimalPlaces !== undefined) {
      if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 10) {
        return "Decimal places must be an integer between 0 and 10";
      }
    }
    
    // Validate percentage ranges
    if (operation === "percentDecrease" && operand >= 100) {
      return "Percentage decrease cannot be 100% or greater";
    }
    
    return null;
  }

  /**
   * Get description of the operation
   */
  getDescription(): string {
    const { operation, value: operand, decimalPlaces } = this.mathOptions;
    const cellCount = this.selection.count();
    
    switch (operation) {
      case "add":
        return `Add ${operand} to ${cellCount} numeric cells`;
      case "subtract":
        return `Subtract ${operand} from ${cellCount} numeric cells`;
      case "multiply":
        return `Multiply ${cellCount} numeric cells by ${operand}`;
      case "divide":
        return `Divide ${cellCount} numeric cells by ${operand}`;
      case "modulo":
        return `Apply modulo ${operand} to ${cellCount} numeric cells`;
      case "percent":
        return `Increase ${cellCount} numeric cells by ${operand}%`;
      case "percentDecrease":
        return `Decrease ${cellCount} numeric cells by ${operand}%`;
      case "round":
        const places = decimalPlaces || 0;
        return `Round ${cellCount} numeric cells to ${places} decimal places`;
      case "floor":
        return `Apply floor to ${cellCount} numeric cells`;
      case "ceil":
        return `Apply ceiling to ${cellCount} numeric cells`;
      default:
        return `Apply ${operation} to ${cellCount} cells`;
    }
  }

  /**
   * Estimate time for math operations
   */
  estimateTime(): number {
    // Math operations are fast - estimate 100,000 cells per second
    const cellCount = this.selection.count();
    const cellsPerSecond = 100000;
    return Math.max(50, (cellCount / cellsPerSecond) * 1000); // Minimum 50ms
  }
  
  /**
   * Generate enhanced preview with calculation examples
   */
  async preview(limit: number = 100): Promise<OperationPreview> {
    const builder = new OperationPreviewBuilder();
    const totalCells = this.selection.count();
    
    builder.setAffectedCells(totalCells);
    
    let previewCount = 0;
    let modifiedCount = 0;
    let skippedCount = 0;
    let numericCount = 0;
    let nonNumericCount = 0;
    
    const examples: Array<{ before: CellValue; after: CellValue; calculation: string }> = [];
    const changesByType: Record<string, number> = {};

    try {
      for (const address of this.selection.getCells()) {
        if (previewCount >= limit) {
          builder.setTruncated(true);
          break;
        }

        // Get current cell value
        const currentResult = await this.cellRepository.getCell(address);
        if (!currentResult.ok) {
          builder.addWarning(`Could not read cell ${address.row},${address.col}`);
          skippedCount++;
          continue;
        }

        const currentValue = currentResult.value?.value || null;
        
        // Skip empty cells
        if (currentValue === null || currentValue === "") {
          skippedCount++;
          continue;
        }

        // Check if numeric
        const numericValue = NumericUtils.toNumber(currentValue);
        if (numericValue === null) {
          nonNumericCount++;
          if (this.mathOptions.skipNonNumeric) {
            skippedCount++;
            continue;
          }
        } else {
          numericCount++;
        }

        // Transform the cell value
        const newValue = await this.transformCell(address, currentValue);
        
        if (newValue === null || newValue === currentValue) {
          skippedCount++;
          continue;
        }

        // Create calculation explanation
        const calculation = this.getCalculationExplanation(currentValue, newValue);

        // Store example if we have fewer than 5
        if (examples.length < 5) {
          examples.push({
            before: currentValue,
            after: newValue,
            calculation
          });
        }

        // Create change record
        const change: CellChange = {
          address,
          before: currentValue,
          after: newValue,
          isFormula: false,
          changeType: "mathOperation"
        };

        builder.addChange(change);
        modifiedCount++;
        previewCount++;
        
        changesByType["mathOperation"] = (changesByType["mathOperation"] || 0) + 1;
      }

      // Prepare operation-specific information
      const operationSummary = this.getOperationSummary(numericCount, nonNumericCount, skippedCount);
      
      // Prepare examples information  
      const exampleInfo = examples.length > 0 ? 
        examples.map(ex => `${ex.before} → ${ex.after} (${ex.calculation})`).join(", ") : 
        "No examples available";

      // Set summary information
      builder.setSummary({
        totalCells,
        modifiedCells: modifiedCount,
        skippedCells: skippedCount,
        formulaCells: 0, // Math operations don't handle formulas
        valueCells: numericCount + nonNumericCount,
        changesByType,
        memoryEstimate: this.estimateMemoryUsage(modifiedCount),
        operationSpecific: {
          numericCells: numericCount,
          nonNumericCells: nonNumericCount,
          operation: this.mathOptions.operation,
          operand: this.mathOptions.value
        },
        operationSummary,
        examples: exampleInfo
      });

      // Estimate execution time
      const estimatedTime = this.estimateTime();
      builder.setEstimatedTime(estimatedTime);

    } catch (error) {
      builder.addError(`Preview generation failed: ${error}`);
    }

    return builder.build();
  }

  /**
   * Get a human-readable explanation of the calculation
   */
  private getCalculationExplanation(before: CellValue, after: CellValue): string {
    const { operation, value: operand, decimalPlaces } = this.mathOptions;
    const beforeNum = NumericUtils.toNumber(before);
    
    if (beforeNum === null) {
      return `non-numeric value skipped`;
    }
    
    switch (operation) {
      case "add":
        return `${beforeNum} + ${operand}`;
      case "subtract":
        return `${beforeNum} - ${operand}`;
      case "multiply":
        return `${beforeNum} × ${operand}`;
      case "divide":
        return `${beforeNum} ÷ ${operand}`;
      case "modulo":
        return `${beforeNum} mod ${operand}`;
      case "percent":
        return `${beforeNum} + ${operand}%`;
      case "percentDecrease":
        return `${beforeNum} - ${operand}%`;
      case "round":
        const places = decimalPlaces || 0;
        return `round(${beforeNum}, ${places})`;
      case "floor":
        return `floor(${beforeNum})`;
      case "ceil":
        return `ceil(${beforeNum})`;
      default:
        return `${operation}(${beforeNum})`;
    }
  }

  /**
   * Get operation-specific summary text
   */
  private getOperationSummary(numericCount: number, nonNumericCount: number, skippedCount: number): string {
    const { operation, value: operand } = this.mathOptions;
    const total = numericCount + nonNumericCount;
    
    let summary = `Math Operation: ${operation.toUpperCase()}`;
    
    if (operation === "add" || operation === "subtract" || operation === "multiply" || operation === "divide" || operation === "modulo") {
      summary += ` by ${operand}`;
    } else if (operation === "percent" || operation === "percentDecrease") {
      summary += ` ${operand}%`;
    } else if (operation === "round" && this.mathOptions.decimalPlaces !== undefined) {
      summary += ` to ${this.mathOptions.decimalPlaces} decimal places`;
    }
    
    summary += `\n${numericCount} numeric cells will be modified`;
    
    if (nonNumericCount > 0) {
      summary += `, ${nonNumericCount} non-numeric cells will be ${this.mathOptions.skipNonNumeric ? 'skipped' : 'cause errors'}`;
    }
    
    if (skippedCount > 0) {
      summary += `, ${skippedCount} cells skipped (empty or unchanged)`;
    }
    
    return summary;
  }

  /**
   * Get operation details for external use
   */
  getOperationDetails(): { operation: MathOperationType; operand: number; decimalPlaces?: number } {
    return {
      operation: this.mathOptions.operation,
      operand: this.mathOptions.value,
      decimalPlaces: this.mathOptions.decimalPlaces
    };
  }
}
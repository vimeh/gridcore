import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import type { Selection, IBulkOperationFactory, BulkOperation } from "./interfaces/BulkOperation";
import { FindReplaceOperation, FindReplaceOptions } from "./implementations/FindReplaceOperation";
import { BulkSetOperation, BulkSetOptions } from "./implementations/BulkSetOperation";
import { BulkMathOperation, BulkMathOptions, MathOperationType } from "./implementations/BulkMathOperation";
import { BulkTransformOperation, BulkTransformOptions, TransformationType } from "./implementations/BulkTransformOperation";
import { BulkFormatOperation, BulkFormatOptions, FormatType } from "./implementations/BulkFormatOperation";

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
   * Create a math operation from command options
   */
  private createMathOperation(selection: Selection, options: any): BulkMathOperation | null {
    // Map command operation names to MathOperationType
    const operationMap: Record<string, MathOperationType> = {
      "add": "add",
      "sub": "subtract", 
      "subtract": "subtract",
      "mul": "multiply",
      "multiply": "multiply",
      "div": "divide",
      "divide": "divide",
      "mod": "modulo",
      "modulo": "modulo",
      "percent": "percent",
      "percentd": "percentDecrease",
      "percentDecrease": "percentDecrease",
      "round": "round",
      "floor": "floor",
      "ceil": "ceil"
    };

    const operation = operationMap[options.operation];
    if (!operation) {
      console.warn(`Unsupported math operation: ${options.operation}`);
      return null;
    }

    const mathOptions: BulkMathOptions = {
      operation,
      value: options.value,
      decimalPlaces: options.decimalPlaces,
      skipNonNumeric: options.skipNonNumeric ?? true,
      convertStrings: options.convertStrings ?? true,
      preserveType: options.preserveType ?? true,
      skipEmpty: options.skipEmpty ?? true,
      batchSize: options.batchSize,
      onProgress: options.onProgress,
      stopOnError: options.stopOnError ?? false
    };

    return new BulkMathOperation(selection, mathOptions, this.cellRepository);
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
   * Create a transform operation from command options
   */
  private createTransformOperation(selection: Selection, options: any): BulkTransformOperation | null {
    // Map command transformation names to TransformationType
    const transformationMap: Record<string, TransformationType> = {
      "upper": "upper",
      "uppercase": "upper",
      "lower": "lower",
      "lowercase": "lower",
      "trim": "trim",
      "clean": "clean"
    };

    const transformation = transformationMap[options.transformation];
    if (!transformation) {
      console.warn(`Unsupported transformation: ${options.transformation}`);
      return null;
    }

    const transformOptions: BulkTransformOptions = {
      transformation,
      skipNonText: options.skipNonText ?? true,
      convertNumbers: options.convertNumbers ?? false,
      preserveType: options.preserveType ?? true,
      cleanOptions: options.cleanOptions ?? {
        normalizeSpaces: true,
        removeLineBreaks: true,
        removeTabs: true,
        removeOtherWhitespace: false
      },
      skipEmpty: options.skipEmpty ?? true,
      batchSize: options.batchSize,
      onProgress: options.onProgress,
      stopOnError: options.stopOnError ?? false
    };

    return new BulkTransformOperation(selection, transformOptions, this.cellRepository);
  }

  /**
   * Create a format operation from command options
   */
  private createFormatOperation(selection: Selection, options: any): BulkFormatOperation | null {
    // Map command format names to FormatType
    const formatMap: Record<string, FormatType> = {
      "currency": "currency",
      "money": "currency",
      "percent": "percent",
      "percentage": "percent",
      "date": "date",
      "datetime": "date",
      "number": "number",
      "numeric": "number",
      "text": "text",
      "string": "text"
    };

    const formatType = formatMap[options.formatType];
    if (!formatType) {
      console.warn(`Unsupported format type: ${options.formatType}`);
      return null;
    }

    const formatOptions: BulkFormatOptions = {
      formatType,
      locale: options.locale ?? "en-US",
      skipNonNumeric: options.skipNonNumeric ?? true,
      convertStrings: options.convertStrings ?? true,
      preserveOnError: options.preserveOnError ?? true,
      currencyOptions: {
        currency: options.currency ?? "USD",
        symbol: options.currencySymbol,
        decimals: options.currencyDecimals ?? 2,
        showSymbol: options.showCurrencySymbol ?? true,
        useThousandsSeparator: options.useThousandsSeparator ?? true,
        ...options.currencyOptions
      },
      percentOptions: {
        decimals: options.percentDecimals ?? 2,
        multiplyBy100: options.multiplyBy100 ?? true,
        ...options.percentOptions
      },
      dateOptions: {
        format: options.dateFormat ?? "MM/DD/YYYY",
        includeTime: options.includeTime ?? false,
        timeFormat: options.timeFormat ?? "12h",
        ...options.dateOptions
      },
      numberOptions: {
        decimals: options.numberDecimals ?? 2,
        useThousandsSeparator: options.useThousandsSeparator ?? true,
        showPositiveSign: options.showPositiveSign ?? false,
        ...options.numberOptions
      },
      skipEmpty: options.skipEmpty ?? true,
      batchSize: options.batchSize,
      onProgress: options.onProgress,
      stopOnError: options.stopOnError ?? false
    };

    return new BulkFormatOperation(selection, formatOptions, this.cellRepository);
  }
}

/**
 * Convenience function to create a factory instance
 */
export function createBulkOperationFactory(cellRepository: ICellRepository): BulkOperationFactory {
  return new BulkOperationFactory(cellRepository);
}
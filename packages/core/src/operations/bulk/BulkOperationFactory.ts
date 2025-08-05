import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import type { CellValue } from "../../domain/models";
import {
  BulkFormatOperation,
  type BulkFormatOptions,
  type FormatType,
} from "./implementations/BulkFormatOperation";
import {
  BulkMathOperation,
  type BulkMathOptions,
  type MathOperationType,
} from "./implementations/BulkMathOperation";
import {
  BulkSetOperation,
  type BulkSetOptions,
} from "./implementations/BulkSetOperation";
import {
  BulkTransformOperation,
  type BulkTransformOptions,
  type TransformationType,
} from "./implementations/BulkTransformOperation";
import {
  FindReplaceOperation,
  type FindReplaceOptions,
} from "./implementations/FindReplaceOperation";
import type {
  BulkOperation,
  BulkOperationOptions,
  IBulkOperationFactory,
  Selection,
} from "./interfaces/BulkOperation";

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
    options: BulkOperationOptions,
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
      "format",
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
  private createFindReplaceOperation(
    selection: Selection,
    options: BulkOperationOptions,
  ): FindReplaceOperation {
    const findReplaceOptions: FindReplaceOptions = {
      findPattern:
        typeof options.findPattern === "string" ? options.findPattern : "",
      replaceWith:
        typeof options.replaceWith === "string" ? options.replaceWith : "",
      useRegex: (options.options as Record<string, unknown>)?.useRegex === true,
      caseSensitive:
        (options.options as Record<string, unknown>)?.caseSensitive !== false,
      global: (options.options as Record<string, unknown>)?.global !== false,
      scope:
        (options.options as Record<string, unknown>)?.scope === "sheet"
          ? "sheet"
          : (options.options as Record<string, unknown>)?.scope === "allSheets"
            ? "allSheets"
            : "selection",
      searchInFormulas:
        (options.options as Record<string, unknown>)?.searchInFormulas === true,
      searchInValues:
        (options.options as Record<string, unknown>)?.searchInValues !== false,
      wholeCellMatch:
        (options.options as Record<string, unknown>)?.wholeCellMatch === true,
    };

    return new FindReplaceOperation(
      selection,
      findReplaceOptions,
      this.cellRepository,
    );
  }

  /**
   * Create a bulk set operation from command options
   */
  private createBulkSetOperation(
    selection: Selection,
    options: BulkOperationOptions,
  ): BulkSetOperation {
    const bulkSetOptions: BulkSetOptions = {
      value: options.value as CellValue,
      overwriteExisting:
        typeof options.overwriteExisting === "boolean"
          ? options.overwriteExisting
          : true,
      preserveFormulas:
        typeof options.preserveFormulas === "boolean"
          ? options.preserveFormulas
          : false,
      skipEmpty:
        typeof options.skipEmpty === "boolean" ? options.skipEmpty : false,
    };

    return new BulkSetOperation(selection, bulkSetOptions, this.cellRepository);
  }

  /**
   * Create a math operation from command options
   */
  private createMathOperation(
    selection: Selection,
    options: BulkOperationOptions,
  ): BulkMathOperation | null {
    // Map command operation names to MathOperationType
    const operationMap: Record<string, MathOperationType> = {
      add: "add",
      sub: "subtract",
      subtract: "subtract",
      mul: "multiply",
      multiply: "multiply",
      div: "divide",
      divide: "divide",
      mod: "modulo",
      modulo: "modulo",
      percent: "percent",
      percentd: "percentDecrease",
      percentDecrease: "percentDecrease",
      round: "round",
      floor: "floor",
      ceil: "ceil",
    };

    const operationKey =
      typeof options.operation === "string" ? options.operation : "";
    const operation = operationMap[operationKey];
    if (!operation) {
      console.warn(`Unsupported math operation: ${operationKey}`);
      return null;
    }

    const mathOptions: BulkMathOptions = {
      operation,
      value: typeof options.value === "number" ? options.value : 0,
      decimalPlaces:
        typeof options.decimalPlaces === "number"
          ? options.decimalPlaces
          : undefined,
      skipNonNumeric:
        typeof options.skipNonNumeric === "boolean"
          ? options.skipNonNumeric
          : true,
      convertStrings:
        typeof options.convertStrings === "boolean"
          ? options.convertStrings
          : true,
      preserveType:
        typeof options.preserveType === "boolean" ? options.preserveType : true,
      skipEmpty:
        typeof options.skipEmpty === "boolean" ? options.skipEmpty : true,
      batchSize:
        typeof options.batchSize === "number" ? options.batchSize : undefined,
      onProgress:
        typeof options.onProgress === "function"
          ? options.onProgress
          : undefined,
      stopOnError:
        typeof options.stopOnError === "boolean" ? options.stopOnError : false,
    };

    return new BulkMathOperation(selection, mathOptions, this.cellRepository);
  }

  /**
   * Create a fill operation (placeholder for future implementation)
   */
  private createFillOperation(
    _selection: Selection,
    _options: unknown,
  ): BulkOperation | null {
    // TODO: Implement FillOperation class
    // This would handle fill down, up, left, right, series operations
    console.warn("Fill operations not yet implemented");
    return null;
  }

  /**
   * Create a transform operation from command options
   */
  private createTransformOperation(
    selection: Selection,
    options: BulkOperationOptions,
  ): BulkTransformOperation | null {
    // Map command transformation names to TransformationType
    const transformationMap: Record<string, TransformationType> = {
      upper: "upper",
      uppercase: "upper",
      lower: "lower",
      lowercase: "lower",
      trim: "trim",
      clean: "clean",
    };

    const transformKey =
      typeof options.transformation === "string" ? options.transformation : "";
    const transformation = transformationMap[transformKey];
    if (!transformation) {
      console.warn(`Unsupported transformation: ${transformKey}`);
      return null;
    }

    const transformOptions: BulkTransformOptions = {
      transformation,
      skipNonText:
        typeof options.skipNonText === "boolean" ? options.skipNonText : true,
      convertNumbers:
        typeof options.convertNumbers === "boolean"
          ? options.convertNumbers
          : false,
      preserveType:
        typeof options.preserveType === "boolean" ? options.preserveType : true,
      cleanOptions:
        typeof options.cleanOptions === "object" &&
        options.cleanOptions !== null
          ? (options.cleanOptions as BulkTransformOptions["cleanOptions"])
          : {
              normalizeSpaces: true,
              removeLineBreaks: true,
              removeTabs: true,
              removeOtherWhitespace: false,
            },
      skipEmpty:
        typeof options.skipEmpty === "boolean" ? options.skipEmpty : true,
      batchSize:
        typeof options.batchSize === "number" ? options.batchSize : undefined,
      onProgress:
        typeof options.onProgress === "function"
          ? options.onProgress
          : undefined,
      stopOnError:
        typeof options.stopOnError === "boolean" ? options.stopOnError : false,
    };

    return new BulkTransformOperation(
      selection,
      transformOptions,
      this.cellRepository,
    );
  }

  /**
   * Create a format operation from command options
   */
  private createFormatOperation(
    selection: Selection,
    options: BulkOperationOptions,
  ): BulkFormatOperation | null {
    // Map command format names to FormatType
    const formatMap: Record<string, FormatType> = {
      currency: "currency",
      money: "currency",
      percent: "percent",
      percentage: "percent",
      date: "date",
      datetime: "date",
      number: "number",
      numeric: "number",
      text: "text",
      string: "text",
    };

    const formatKey =
      typeof options.formatType === "string" ? options.formatType : "";
    const formatType = formatMap[formatKey];
    if (!formatType) {
      console.warn(`Unsupported format type: ${formatKey}`);
      return null;
    }

    const formatOptions: BulkFormatOptions = {
      formatType,
      locale: typeof options.locale === "string" ? options.locale : "en-US",
      skipNonNumeric:
        typeof options.skipNonNumeric === "boolean"
          ? options.skipNonNumeric
          : true,
      convertStrings:
        typeof options.convertStrings === "boolean"
          ? options.convertStrings
          : true,
      preserveOnError:
        typeof options.preserveOnError === "boolean"
          ? options.preserveOnError
          : true,
      currencyOptions: {
        currency:
          typeof options.currency === "string" ? options.currency : "USD",
        symbol:
          typeof options.currencySymbol === "string"
            ? options.currencySymbol
            : undefined,
        decimals:
          typeof options.currencyDecimals === "number"
            ? options.currencyDecimals
            : 2,
        showSymbol:
          typeof options.showCurrencySymbol === "boolean"
            ? options.showCurrencySymbol
            : true,
        useThousandsSeparator:
          typeof options.useThousandsSeparator === "boolean"
            ? options.useThousandsSeparator
            : true,
        ...(typeof options.currencyOptions === "object" &&
        options.currencyOptions !== null
          ? options.currencyOptions
          : {}),
      },
      percentOptions: {
        decimals:
          typeof options.percentDecimals === "number"
            ? options.percentDecimals
            : 2,
        multiplyBy100:
          typeof options.multiplyBy100 === "boolean"
            ? options.multiplyBy100
            : true,
        ...(typeof options.percentOptions === "object" &&
        options.percentOptions !== null
          ? options.percentOptions
          : {}),
      },
      dateOptions: {
        format:
          typeof options.dateFormat === "string"
            ? options.dateFormat
            : "MM/DD/YYYY",
        includeTime:
          typeof options.includeTime === "boolean"
            ? options.includeTime
            : false,
        timeFormat: options.timeFormat === "24h" ? "24h" : "12h",
        ...(typeof options.dateOptions === "object" &&
        options.dateOptions !== null
          ? options.dateOptions
          : {}),
      },
      numberOptions: {
        decimals:
          typeof options.numberDecimals === "number"
            ? options.numberDecimals
            : 2,
        useThousandsSeparator:
          typeof options.useThousandsSeparator === "boolean"
            ? options.useThousandsSeparator
            : true,
        showPositiveSign:
          typeof options.showPositiveSign === "boolean"
            ? options.showPositiveSign
            : false,
        ...(typeof options.numberOptions === "object" &&
        options.numberOptions !== null
          ? options.numberOptions
          : {}),
      },
      skipEmpty:
        typeof options.skipEmpty === "boolean" ? options.skipEmpty : true,
      batchSize:
        typeof options.batchSize === "number" ? options.batchSize : undefined,
      onProgress:
        typeof options.onProgress === "function"
          ? options.onProgress
          : undefined,
      stopOnError:
        typeof options.stopOnError === "boolean" ? options.stopOnError : false,
    };

    return new BulkFormatOperation(
      selection,
      formatOptions,
      this.cellRepository,
    );
  }
}

/**
 * Convenience function to create a factory instance
 */
export function createBulkOperationFactory(
  cellRepository: ICellRepository,
): BulkOperationFactory {
  return new BulkOperationFactory(cellRepository);
}

import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { CellAddress, CellValue } from "../../../domain/models";
import { BaseBulkOperation } from "../base/BaseBulkOperation";
import type {
  BulkOperationOptions,
  Selection,
} from "../interfaces/BulkOperation";
import type {
  CellChange,
  OperationPreview,
} from "../interfaces/OperationPreview";
import { OperationPreviewBuilder } from "../interfaces/OperationPreview";
import { applyTransform, cellValueToString } from "./TextUtils";

/**
 * Supported text transformation operations
 */
export type TransformationType =
  | "upper" // Convert to uppercase
  | "lower" // Convert to lowercase
  | "trim" // Remove leading/trailing whitespace
  | "clean"; // Remove extra spaces and line breaks

/**
 * Options for bulk transform operation
 */
export interface BulkTransformOptions extends BulkOperationOptions {
  /** The type of transformation to perform */
  transformation: TransformationType;

  /** Whether to skip non-text cells */
  skipNonText?: boolean;

  /** Whether to convert numbers to strings before transforming */
  convertNumbers?: boolean;

  /** Whether to preserve the original data type when possible */
  preserveType?: boolean;

  /** Custom cleaning options for "clean" transformation */
  cleanOptions?: {
    /** Replace multiple spaces with single space */
    normalizeSpaces?: boolean;
    /** Remove line breaks */
    removeLineBreaks?: boolean;
    /** Remove tab characters */
    removeTabs?: boolean;
    /** Remove other whitespace characters */
    removeOtherWhitespace?: boolean;
  };
}

/**
 * Bulk operation for text transformations
 * Supports uppercase, lowercase, trim, and clean operations on selected cells
 */
export class BulkTransformOperation extends BaseBulkOperation {
  private readonly transformOptions: BulkTransformOptions;

  constructor(
    selection: Selection,
    options: BulkTransformOptions,
    cellRepository: ICellRepository,
  ) {
    super("transform", selection, options, cellRepository);
    this.transformOptions = {
      skipNonText: true,
      convertNumbers: false,
      preserveType: true,
      cleanOptions: {
        normalizeSpaces: true,
        removeLineBreaks: true,
        removeTabs: true,
        removeOtherWhitespace: false,
      },
      ...options,
    };
  }

  /**
   * Transform a single cell value according to the transformation type
   */
  protected async transformCell(
    _address: CellAddress,
    currentValue: CellValue,
  ): Promise<CellValue | null> {
    // Skip null/undefined values
    if (currentValue === null || currentValue === undefined) {
      return null;
    }

    // Convert to string if possible
    const textValue = cellValueToString(currentValue);
    if (textValue === null) {
      return null;
    }

    // Skip non-text values if configured and not convertible
    if (typeof currentValue !== "string") {
      if (this.transformOptions.skipNonText) {
        // Skip non-text unless we can convert numbers
        if (
          !this.transformOptions.convertNumbers ||
          typeof currentValue !== "number"
        ) {
          return null;
        }
      } else if (!this.transformOptions.convertNumbers) {
        // If not skipping non-text but not converting, still skip numbers
        if (typeof currentValue === "number") {
          return null;
        }
      }
    }

    let transformedValue: string;

    // Apply the transformation
    switch (this.transformOptions.transformation) {
      case "upper":
        transformedValue = applyTransform(textValue, "upper");
        break;

      case "lower":
        transformedValue = applyTransform(textValue, "lower");
        break;

      case "trim":
        transformedValue = applyTransform(textValue, "trim");
        break;

      case "clean":
        transformedValue = applyTransform(
          textValue,
          "clean",
          this.transformOptions.cleanOptions,
        );
        break;

      default:
        return null;
    }

    // Return null if no change
    if (transformedValue === textValue) {
      return null;
    }

    // Preserve original type if requested and possible
    if (this.transformOptions.preserveType) {
      // If original was a number and the result can be parsed back to a number
      if (typeof currentValue === "number") {
        const numericResult = parseFloat(transformedValue);
        if (!Number.isNaN(numericResult) && Number.isFinite(numericResult)) {
          return numericResult;
        }
      }

      // If original was a boolean
      if (typeof currentValue === "boolean") {
        if (transformedValue.toLowerCase() === "true") return true;
        if (transformedValue.toLowerCase() === "false") return false;
      }
    }

    return transformedValue;
  }

  /**
   * Enhanced preview for transform operations
   */
  async preview(limit: number = 100): Promise<OperationPreview> {
    const builder = new OperationPreviewBuilder();
    const totalCells = this.selection.count();

    builder.setAffectedCells(totalCells);

    let previewCount = 0;
    let modifiedCount = 0;
    let skippedCount = 0;
    let nonTextCount = 0;
    let noChangeCount = 0;

    const sampleTransformations: string[] = [];

    try {
      for (const address of this.selection.getCells()) {
        if (previewCount >= limit) {
          builder.setTruncated(true);
          break;
        }

        // Get current cell value
        const currentCell = this.cellRepository.get(address);
        const currentValue = currentCell
          ? currentCell.computedValue || currentCell.rawValue
          : null;

        // Skip empty cells if configured
        if (
          this.options.skipEmpty &&
          (currentValue === null || currentValue === "")
        ) {
          skippedCount++;
          continue;
        }

        // Transform the cell value
        const newValue = await this.transformCell(address, currentValue);

        if (newValue === null) {
          if (
            currentValue !== null &&
            (currentValue === null || currentValue === undefined)
          ) {
            nonTextCount++;
          } else {
            noChangeCount++;
          }
          skippedCount++;
          continue;
        }

        // Create change record
        const change: CellChange = {
          address,
          before: currentValue,
          after: newValue,
          isFormula: false,
          changeType: "value",
        };

        builder.addChange(change);

        // Add sample transformation for preview
        if (sampleTransformations.length < 5) {
          const beforeStr = String(currentValue);
          const afterStr = String(newValue);
          if (beforeStr !== afterStr) {
            sampleTransformations.push(`"${beforeStr}" → "${afterStr}"`);
          }
        }

        modifiedCount++;
        previewCount++;
      }

      // Enhanced summary with transformation-specific information
      builder.setSummary({
        totalCells,
        modifiedCells: modifiedCount,
        skippedCells: skippedCount,
        formulaCells: 0, // Transform operations don't modify formulas
        valueCells: modifiedCount + skippedCount,
        changesByType: { transform: modifiedCount },
        memoryEstimate: this.estimateMemoryUsage(modifiedCount),
        customData: {
          transformation: this.transformOptions.transformation,
          nonTextCells: nonTextCount,
          noChangeCells: noChangeCount,
          sampleTransformations,
        },
      });

      // Estimate execution time (transforms are typically fast)
      const estimatedTime = this.estimateTime();
      builder.setEstimatedTime(estimatedTime);
    } catch (error) {
      builder.addError(`Preview generation failed: ${error}`);
    }

    return builder.build();
  }

  /**
   * Get human-readable description of this operation
   */
  getDescription(): string {
    const transformationNames = {
      upper: "uppercase",
      lower: "lowercase",
      trim: "trim whitespace",
      clean: "clean text",
    };

    const transformName =
      transformationNames[this.transformOptions.transformation];
    const cellCount = this.selection.count();

    return `Convert ${cellCount} cell${cellCount === 1 ? "" : "s"} to ${transformName}`;
  }

  /**
   * Estimate execution time (transforms are typically very fast)
   */
  estimateTime(): number {
    const cellCount = this.selection.count();
    // Transform operations are very fast - estimate 50,000 cells per second
    const cellsPerSecond = 50000;
    return Math.max(10, (cellCount / cellsPerSecond) * 1000); // Minimum 10ms
  }

  /**
   * Validate the transform operation
   */
  validate(): string | null {
    const baseValidation = super.validate();
    if (baseValidation) {
      return baseValidation;
    }

    const validTransformations: TransformationType[] = [
      "upper",
      "lower",
      "trim",
      "clean",
    ];
    if (!validTransformations.includes(this.transformOptions.transformation)) {
      return `Invalid transformation type: ${this.transformOptions.transformation}`;
    }

    return null;
  }
}

// Re-export TextUtils functions as a namespace for tests
import * as TextUtils from "./TextUtils";
export { TextUtils };

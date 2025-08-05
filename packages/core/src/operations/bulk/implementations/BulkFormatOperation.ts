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
import {
  DEFAULT_LOCALE,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  isNumeric,
  toDate,
  toNumber,
} from "./FormatUtils";

/**
 * Supported formatting operations
 */
export type FormatType =
  | "currency" // Format as currency ($1,234.56)
  | "percent" // Format as percentage (12.34%)
  | "date" // Format as date (MM/DD/YYYY or locale-specific)
  | "number" // Format as number with thousands separator (1,234.56)
  | "text"; // Format as plain text (remove all formatting)

/**
 * Currency formatting options
 */
export interface CurrencyFormatOptions {
  /** Currency code (USD, EUR, GBP, etc.) */
  currency?: string;
  /** Currency symbol ($, €, £, etc.) - overrides currency code */
  symbol?: string;
  /** Number of decimal places */
  decimals?: number;
  /** Whether to show currency symbol */
  showSymbol?: boolean;
  /** Whether to use thousands separator */
  useThousandsSeparator?: boolean;
}

/**
 * Percentage formatting options
 */
export interface PercentFormatOptions {
  /** Number of decimal places */
  decimals?: number;
  /** Whether to multiply by 100 (true: 0.5 → 50%, false: 0.5 → 0.5%) */
  multiplyBy100?: boolean;
}

/**
 * Date formatting options
 */
export interface DateFormatOptions {
  /** Date format pattern (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.) */
  format?: string;
  /** Whether to include time */
  includeTime?: boolean;
  /** Time format (12h, 24h) */
  timeFormat?: "12h" | "24h";
}

/**
 * Number formatting options
 */
export interface NumberFormatOptions {
  /** Number of decimal places */
  decimals?: number;
  /** Whether to use thousands separator */
  useThousandsSeparator?: boolean;
  /** Whether to show positive sign */
  showPositiveSign?: boolean;
}

/**
 * Options for bulk format operation
 */
export interface BulkFormatOptions extends BulkOperationOptions {
  /** The type of formatting to apply */
  formatType: FormatType;

  /** Locale for formatting (en-US, en-GB, de-DE, etc.) */
  locale?: string;

  /** Currency-specific options */
  currencyOptions?: CurrencyFormatOptions;

  /** Percentage-specific options */
  percentOptions?: PercentFormatOptions;

  /** Date-specific options */
  dateOptions?: DateFormatOptions;

  /** Number-specific options */
  numberOptions?: NumberFormatOptions;

  /** Whether to skip non-numeric cells for numeric formats */
  skipNonNumeric?: boolean;

  /** Whether to attempt conversion of string numbers */
  convertStrings?: boolean;

  /** Whether to preserve original value if formatting fails */
  preserveOnError?: boolean;
}

/**
 * Bulk operation for cell formatting
 * Supports currency, percentage, date, and number formatting on selected cells
 */
export class BulkFormatOperation extends BaseBulkOperation {
  private readonly formatOptions: BulkFormatOptions;

  constructor(
    selection: Selection,
    options: BulkFormatOptions,
    cellRepository: ICellRepository,
  ) {
    super("format", selection, options, cellRepository);
    this.formatOptions = {
      locale: DEFAULT_LOCALE,
      skipNonNumeric: true,
      convertStrings: true,
      preserveOnError: true,
      currencyOptions: {
        currency: "USD",
        decimals: 2,
        showSymbol: true,
        useThousandsSeparator: true,
      },
      percentOptions: {
        decimals: 2,
        multiplyBy100: true,
      },
      dateOptions: {
        format: "MM/DD/YYYY",
        includeTime: false,
        timeFormat: "12h",
      },
      numberOptions: {
        decimals: 2,
        useThousandsSeparator: true,
        showPositiveSign: false,
      },
      ...options,
    };
  }

  /**
   * Format a single cell value according to the format type
   */
  protected async transformCell(
    _address: CellAddress,
    currentValue: CellValue,
  ): Promise<CellValue | null> {
    // Skip null/undefined values
    if (currentValue === null || currentValue === undefined) {
      return null;
    }

    try {
      switch (this.formatOptions.formatType) {
        case "currency":
          return this.formatAsCurrency(currentValue);

        case "percent":
          return this.formatAsPercent(currentValue);

        case "date":
          return this.formatAsDate(currentValue);

        case "number":
          return this.formatAsNumber(currentValue);

        case "text":
          return this.formatAsText(currentValue);

        default:
          return null;
      }
    } catch (_error) {
      // Return original value if preserveOnError is true
      return this.formatOptions.preserveOnError ? currentValue : null;
    }
  }

  /**
   * Format value as currency
   */
  private formatAsCurrency(value: CellValue): string | null {
    const numValue = toNumber(value);
    if (numValue === null) {
      if (this.formatOptions.skipNonNumeric) {
        return null;
      }
      // Try to convert string
      if (this.formatOptions.convertStrings && typeof value === "string") {
        const converted = toNumber(value);
        if (converted !== null) {
          return formatCurrency(
            converted,
            this.formatOptions.currencyOptions,
            this.formatOptions.locale,
          );
        }
      }
      return null;
    }

    return formatCurrency(
      numValue,
      this.formatOptions.currencyOptions,
      this.formatOptions.locale,
    );
  }

  /**
   * Format value as percentage
   */
  private formatAsPercent(value: CellValue): string | null {
    const numValue = toNumber(value);
    if (numValue === null) {
      if (this.formatOptions.skipNonNumeric) {
        return null;
      }
      // Try to convert string
      if (this.formatOptions.convertStrings && typeof value === "string") {
        const converted = toNumber(value);
        if (converted !== null) {
          return formatPercent(
            converted,
            this.formatOptions.percentOptions,
            this.formatOptions.locale,
          );
        }
      }
      return null;
    }

    return formatPercent(
      numValue,
      this.formatOptions.percentOptions,
      this.formatOptions.locale,
    );
  }

  /**
   * Format value as date
   */
  private formatAsDate(value: CellValue): string | null {
    const dateValue = toDate(value);
    if (dateValue === null) {
      return null;
    }

    return formatDate(
      value,
      this.formatOptions.dateOptions?.format || "MM/DD/YYYY",
      this.formatOptions.locale,
    );
  }

  /**
   * Format value as number
   */
  private formatAsNumber(value: CellValue): string | null {
    const numValue = toNumber(value);
    if (numValue === null) {
      if (this.formatOptions.skipNonNumeric) {
        return null;
      }
      // Try to convert string
      if (this.formatOptions.convertStrings && typeof value === "string") {
        const converted = toNumber(value);
        if (converted !== null) {
          return formatNumber(
            converted,
            this.formatOptions.numberOptions,
            this.formatOptions.locale,
          );
        }
      }
      return null;
    }

    return formatNumber(
      numValue,
      this.formatOptions.numberOptions,
      this.formatOptions.locale,
    );
  }

  /**
   * Format value as plain text
   */
  private formatAsText(value: CellValue): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return String(value);
  }

  /**
   * Enhanced preview for format operations
   */
  async preview(limit: number = 100): Promise<OperationPreview> {
    const builder = new OperationPreviewBuilder();
    const totalCells = this.selection.count();

    builder.setAffectedCells(totalCells);

    let previewCount = 0;
    let modifiedCount = 0;
    let skippedCount = 0;
    let nonNumericCount = 0;
    let errorCount = 0;

    const sampleFormats: string[] = [];

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

        // Format the cell value
        const newValue = await this.transformCell(address, currentValue);

        if (newValue === null) {
          if (currentValue !== null) {
            if (
              this.formatOptions.formatType !== "text" &&
              !isNumeric(currentValue)
            ) {
              nonNumericCount++;
            } else {
              errorCount++;
            }
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
          changeType: "format",
        };

        builder.addChange(change);

        // Add sample format for preview
        if (sampleFormats.length < 5) {
          const beforeStr = String(currentValue);
          const afterStr = String(newValue);
          if (beforeStr !== afterStr) {
            sampleFormats.push(`${beforeStr} → ${afterStr}`);
          }
        }

        modifiedCount++;
        previewCount++;
      }

      // Enhanced summary with formatting-specific information
      builder.setSummary({
        totalCells,
        modifiedCells: modifiedCount,
        skippedCells: skippedCount,
        formulaCells: 0, // Format operations don't modify formulas
        valueCells: modifiedCount + skippedCount,
        changesByType: { format: modifiedCount },
        memoryEstimate: this.estimateMemoryUsage(modifiedCount),
        customData: {
          formatType: this.formatOptions.formatType,
          locale: this.formatOptions.locale,
          nonNumericCells: nonNumericCount,
          errorCells: errorCount,
          sampleFormats,
        },
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
   * Get human-readable description of this operation
   */
  getDescription(): string {
    const formatNames = {
      currency: "currency",
      percent: "percentage",
      date: "date",
      number: "number",
      text: "text",
    };

    const formatName = formatNames[this.formatOptions.formatType];
    const cellCount = this.selection.count();

    return `Format ${cellCount} cell${cellCount === 1 ? "" : "s"} as ${formatName}`;
  }

  /**
   * Estimate execution time (formatting can vary in complexity)
   */
  estimateTime(): number {
    const cellCount = this.selection.count();

    // Different formats have different performance characteristics
    let cellsPerSecond: number;
    switch (this.formatOptions.formatType) {
      case "text":
        cellsPerSecond = 100000; // Very fast
        break;
      case "number":
        cellsPerSecond = 40000; // Fast
        break;
      case "currency":
      case "percent":
        cellsPerSecond = 25000; // Moderate (uses Intl.NumberFormat)
        break;
      case "date":
        cellsPerSecond = 15000; // Slower (date parsing/formatting)
        break;
      default:
        cellsPerSecond = 20000;
    }

    return Math.max(10, (cellCount / cellsPerSecond) * 1000); // Minimum 10ms
  }

  /**
   * Validate the format operation
   */
  validate(): string | null {
    const baseValidation = super.validate();
    if (baseValidation) {
      return baseValidation;
    }

    const validFormats: FormatType[] = [
      "currency",
      "percent",
      "date",
      "number",
      "text",
    ];
    if (!validFormats.includes(this.formatOptions.formatType)) {
      return `Invalid format type: ${this.formatOptions.formatType}`;
    }

    // Validate locale if provided
    if (this.formatOptions.locale) {
      try {
        new Intl.NumberFormat(this.formatOptions.locale);
      } catch (_error) {
        return `Invalid locale: ${this.formatOptions.locale}`;
      }
    }

    // Validate currency options
    if (
      this.formatOptions.formatType === "currency" &&
      this.formatOptions.currencyOptions?.currency
    ) {
      try {
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: this.formatOptions.currencyOptions.currency,
        });
      } catch (_error) {
        return `Invalid currency code: ${this.formatOptions.currencyOptions.currency}`;
      }
    }

    return null;
  }
}

// Re-export FormatUtils functions as a namespace for tests
import * as FormatUtils from "./FormatUtils";
export { FormatUtils };

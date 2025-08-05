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
 * Utility functions for formatting operations
 */
export class FormatUtils {
  /**
   * Default locale
   */
  static DEFAULT_LOCALE = "en-US";

  /**
   * Convert a cell value to number if possible
   */
  static toNumber(value: CellValue): number | null {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      // Remove common formatting characters
      const cleaned = value.replace(/[\s,$%€£¥]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    return null;
  }

  /**
   * Convert a cell value to date if possible
   */
  static toDate(value: CellValue): Date | null {
    if (typeof value === "number") {
      // Assume Excel-style date serial number
      const date = new Date((value - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * Check if a value can be converted to a number
   */
  static isNumeric(value: CellValue): boolean {
    return FormatUtils.toNumber(value) !== null;
  }

  /**
   * Check if a value can be converted to a date
   */
  static isDate(value: CellValue): boolean {
    return FormatUtils.toDate(value) !== null;
  }

  /**
   * Format a number as currency
   */
  static formatCurrency(
    value: number,
    options: CurrencyFormatOptions = {},
    locale: string = FormatUtils.DEFAULT_LOCALE,
  ): string {
    const opts = {
      currency: "USD",
      decimals: 2,
      showSymbol: true,
      useThousandsSeparator: true,
      ...options,
    };

    try {
      if (opts.symbol) {
        // Use custom symbol
        const formatted = new Intl.NumberFormat(locale, {
          minimumFractionDigits: opts.decimals,
          maximumFractionDigits: opts.decimals,
          useGrouping: opts.useThousandsSeparator,
        }).format(value);

        return opts.showSymbol ? `${opts.symbol}${formatted}` : formatted;
      } else {
        // Use standard currency formatting
        return new Intl.NumberFormat(locale, {
          style: opts.showSymbol ? "currency" : "decimal",
          currency: opts.currency,
          minimumFractionDigits: opts.decimals,
          maximumFractionDigits: opts.decimals,
          useGrouping: opts.useThousandsSeparator,
        }).format(value);
      }
    } catch (error) {
      // Fallback formatting
      const rounded =
        Math.round(value * 10 ** opts.decimals!) / 10 ** opts.decimals!;
      const formatted = opts.useThousandsSeparator
        ? rounded.toLocaleString(locale, {
            minimumFractionDigits: opts.decimals,
            maximumFractionDigits: opts.decimals,
          })
        : rounded.toFixed(opts.decimals);

      return opts.showSymbol ? `$${formatted}` : formatted;
    }
  }

  /**
   * Format a number as percentage
   */
  static formatPercent(
    value: number,
    options: PercentFormatOptions = {},
    locale: string = FormatUtils.DEFAULT_LOCALE,
  ): string {
    const opts = {
      decimals: 2,
      multiplyBy100: true,
      ...options,
    };

    const numValue = opts.multiplyBy100 ? value * 100 : value;

    try {
      return new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: opts.decimals,
        maximumFractionDigits: opts.decimals,
      }).format(opts.multiplyBy100 ? value : value / 100);
    } catch (error) {
      // Fallback formatting
      const rounded =
        Math.round(numValue * 10 ** opts.decimals!) / 10 ** opts.decimals!;
      return `${rounded.toFixed(opts.decimals)}%`;
    }
  }

  /**
   * Format a date
   */
  static formatDate(
    value: Date,
    options: DateFormatOptions = {},
    locale: string = FormatUtils.DEFAULT_LOCALE,
  ): string {
    const opts = {
      format: "MM/DD/YYYY",
      includeTime: false,
      timeFormat: "12h" as const,
      ...options,
    };

    try {
      if (opts.format === "locale") {
        // Use locale-specific formatting
        const dateOptions: Intl.DateTimeFormatOptions = {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        };

        if (opts.includeTime) {
          dateOptions.hour = "2-digit";
          dateOptions.minute = "2-digit";
          dateOptions.hour12 = opts.timeFormat === "12h";
        }

        return new Intl.DateTimeFormat(locale, dateOptions).format(value);
      } else {
        // Use custom format pattern
        const year = value.getFullYear();
        const month = (value.getMonth() + 1).toString().padStart(2, "0");
        const day = value.getDate().toString().padStart(2, "0");

        let formatted = opts
          .format!.replace("YYYY", year.toString())
          .replace("MM", month)
          .replace("DD", day);

        if (opts.includeTime) {
          const hours =
            opts.timeFormat === "12h"
              ? (value.getHours() % 12 || 12).toString().padStart(2, "0")
              : value.getHours().toString().padStart(2, "0");
          const minutes = value.getMinutes().toString().padStart(2, "0");
          const ampm =
            opts.timeFormat === "12h"
              ? value.getHours() >= 12
                ? " PM"
                : " AM"
              : "";

          formatted += ` ${hours}:${minutes}${ampm}`;
        }

        return formatted;
      }
    } catch (error) {
      // Fallback formatting
      return value.toLocaleDateString(locale);
    }
  }

  /**
   * Format a number
   */
  static formatNumber(
    value: number,
    options: NumberFormatOptions = {},
    locale: string = FormatUtils.DEFAULT_LOCALE,
  ): string {
    const opts = {
      decimals: 2,
      useThousandsSeparator: true,
      showPositiveSign: false,
      ...options,
    };

    try {
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: opts.decimals,
        maximumFractionDigits: opts.decimals,
        useGrouping: opts.useThousandsSeparator,
        signDisplay: opts.showPositiveSign ? "always" : "auto",
      }).format(value);

      return formatted;
    } catch (error) {
      // Fallback formatting
      const rounded =
        Math.round(value * 10 ** opts.decimals!) / 10 ** opts.decimals!;
      const formatted = opts.useThousandsSeparator
        ? rounded.toLocaleString(locale, {
            minimumFractionDigits: opts.decimals,
            maximumFractionDigits: opts.decimals,
          })
        : rounded.toFixed(opts.decimals);

      return opts.showPositiveSign && value > 0 ? `+${formatted}` : formatted;
    }
  }
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
      locale: FormatUtils.DEFAULT_LOCALE,
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
    address: CellAddress,
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
    } catch (error) {
      // Return original value if preserveOnError is true
      return this.formatOptions.preserveOnError ? currentValue : null;
    }
  }

  /**
   * Format value as currency
   */
  private formatAsCurrency(value: CellValue): string | null {
    const numValue = FormatUtils.toNumber(value);
    if (numValue === null) {
      if (this.formatOptions.skipNonNumeric) {
        return null;
      }
      // Try to convert string
      if (this.formatOptions.convertStrings && typeof value === "string") {
        const converted = FormatUtils.toNumber(value);
        if (converted !== null) {
          return FormatUtils.formatCurrency(
            converted,
            this.formatOptions.currencyOptions,
            this.formatOptions.locale,
          );
        }
      }
      return null;
    }

    return FormatUtils.formatCurrency(
      numValue,
      this.formatOptions.currencyOptions,
      this.formatOptions.locale,
    );
  }

  /**
   * Format value as percentage
   */
  private formatAsPercent(value: CellValue): string | null {
    const numValue = FormatUtils.toNumber(value);
    if (numValue === null) {
      if (this.formatOptions.skipNonNumeric) {
        return null;
      }
      // Try to convert string
      if (this.formatOptions.convertStrings && typeof value === "string") {
        const converted = FormatUtils.toNumber(value);
        if (converted !== null) {
          return FormatUtils.formatPercent(
            converted,
            this.formatOptions.percentOptions,
            this.formatOptions.locale,
          );
        }
      }
      return null;
    }

    return FormatUtils.formatPercent(
      numValue,
      this.formatOptions.percentOptions,
      this.formatOptions.locale,
    );
  }

  /**
   * Format value as date
   */
  private formatAsDate(value: CellValue): string | null {
    const dateValue = FormatUtils.toDate(value);
    if (dateValue === null) {
      return null;
    }

    return FormatUtils.formatDate(
      dateValue,
      this.formatOptions.dateOptions,
      this.formatOptions.locale,
    );
  }

  /**
   * Format value as number
   */
  private formatAsNumber(value: CellValue): string | null {
    const numValue = FormatUtils.toNumber(value);
    if (numValue === null) {
      if (this.formatOptions.skipNonNumeric) {
        return null;
      }
      // Try to convert string
      if (this.formatOptions.convertStrings && typeof value === "string") {
        const converted = FormatUtils.toNumber(value);
        if (converted !== null) {
          return FormatUtils.formatNumber(
            converted,
            this.formatOptions.numberOptions,
            this.formatOptions.locale,
          );
        }
      }
      return null;
    }

    return FormatUtils.formatNumber(
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
        const currentCell = await this.cellRepository.get(address);
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
              !FormatUtils.isNumeric(currentValue)
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
      } catch (error) {
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
      } catch (error) {
        return `Invalid currency code: ${this.formatOptions.currencyOptions.currency}`;
      }
    }

    return null;
  }
}

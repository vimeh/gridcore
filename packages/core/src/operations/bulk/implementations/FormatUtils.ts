import type { CellValue } from "../../../domain/models";
import type {
  CurrencyFormatOptions,
  NumberFormatOptions,
  PercentFormatOptions,
} from "./BulkFormatOperation";

/**
 * Default locale
 */
export const DEFAULT_LOCALE = "en-US";

/**
 * Convert a cell value to number if possible
 */
export function toNumber(value: CellValue): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    // Remove common formatting characters
    const cleaned = value.replace(/[\s,$%€£¥]/g, "");
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

/**
 * Convert a cell value to date if possible
 */
export function toDate(value: CellValue): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    // Assume Excel-style date serial number
    const date = new Date((value - 25569) * 86400 * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Check if a value can be converted to a number
 */
export function isNumeric(value: CellValue): boolean {
  return toNumber(value) !== null;
}

/**
 * Check if a value can be converted to a date
 */
export function isDate(value: CellValue): boolean {
  return toDate(value) !== null;
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  value: number,
  options: CurrencyFormatOptions = {},
  locale: string = DEFAULT_LOCALE,
): string {
  const opts = {
    currency: "USD",
    decimals: 2,
    showSymbol: true,
    useThousandsSeparator: true,
    ...options,
  };

  try {
    // Use Intl.NumberFormat for proper currency formatting
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: opts.currency,
      minimumFractionDigits: opts.decimals,
      maximumFractionDigits: opts.decimals,
      useGrouping: opts.useThousandsSeparator,
    });

    const formatted = formatter.format(value);

    // Handle custom symbol or no symbol
    if (!opts.showSymbol) {
      // Remove currency symbol but keep number formatting
      return formatted.replace(/[^\d.,\s-]/g, "").trim();
    }

    if (opts.symbol && opts.symbol !== opts.currency) {
      // Replace the currency code with custom symbol
      const currencySymbol = formatter
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value;
      if (currencySymbol) {
        return formatted.replace(currencySymbol, opts.symbol);
      }
    }

    return formatted;
  } catch (_error) {
    // Fallback formatting
    const rounded =
      Math.round(value * 10 ** (opts.decimals ?? 2)) /
      10 ** (opts.decimals ?? 2);
    const formatted = opts.useThousandsSeparator
      ? rounded.toLocaleString(locale, {
          minimumFractionDigits: opts.decimals,
          maximumFractionDigits: opts.decimals,
        })
      : rounded.toFixed(opts.decimals);

    return opts.showSymbol ? `${opts.symbol || "$"}${formatted}` : formatted;
  }
}

/**
 * Format a value as percentage
 */
export function formatPercent(
  value: CellValue,
  options: PercentFormatOptions = {},
  locale: string = DEFAULT_LOCALE,
): string | null {
  const numValue = toNumber(value);
  if (numValue === null) {
    return null;
  }

  const opts = {
    decimals: 2,
    multiplyBy100: true,
    ...options,
  };

  const percentValue = opts.multiplyBy100 ? numValue * 100 : numValue;

  try {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: opts.decimals,
      maximumFractionDigits: opts.decimals,
    }).format(opts.multiplyBy100 ? numValue : numValue / 100);
  } catch (_error) {
    // Fallback formatting
    const rounded =
      Math.round(percentValue * 10 ** (opts.decimals ?? 2)) /
      10 ** (opts.decimals ?? 2);
    return `${rounded.toFixed(opts.decimals)}%`;
  }
}

/**
 * Format a value as date
 */
export function formatDate(
  value: CellValue,
  format: string = "MM/DD/YYYY",
  locale: string = DEFAULT_LOCALE,
): string | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  try {
    // Simple format string parsing
    const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
      "MM/DD/YYYY": { month: "2-digit", day: "2-digit", year: "numeric" },
      "DD/MM/YYYY": { day: "2-digit", month: "2-digit", year: "numeric" },
      "YYYY-MM-DD": { year: "numeric", month: "2-digit", day: "2-digit" },
      "MMM DD, YYYY": { month: "short", day: "numeric", year: "numeric" },
      "MMMM DD, YYYY": { month: "long", day: "numeric", year: "numeric" },
    };

    const options = formatMap[format] || formatMap["MM/DD/YYYY"];
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch (_error) {
    // Fallback formatting
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();

    switch (format) {
      case "DD/MM/YYYY":
        return `${day}/${month}/${year}`;
      case "YYYY-MM-DD":
        return `${year}-${month}-${day}`;
      default:
        return `${month}/${day}/${year}`;
    }
  }
}

/**
 * Format a number with specific options
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {},
  locale: string = DEFAULT_LOCALE,
): string {
  const opts = {
    decimals: 2,
    useThousandsSeparator: true,
    showPositiveSign: false,
    ...options,
  };

  try {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: opts.decimals,
      maximumFractionDigits: opts.decimals,
      useGrouping: opts.useThousandsSeparator,
    });

    const formatted = formatter.format(value);
    return opts.showPositiveSign && value > 0 ? `+${formatted}` : formatted;
  } catch (_error) {
    // Fallback formatting
    const rounded =
      Math.round(value * 10 ** (opts.decimals ?? 2)) /
      10 ** (opts.decimals ?? 2);
    const formatted = opts.useThousandsSeparator
      ? rounded.toLocaleString(locale, {
          minimumFractionDigits: opts.decimals,
          maximumFractionDigits: opts.decimals,
        })
      : rounded.toFixed(opts.decimals);

    return opts.showPositiveSign && value > 0 ? `+${formatted}` : formatted;
  }
}

import type { CellAddress, CellValue } from "../../../domain/models";

/**
 * Represents a change that will be made to a cell
 */
export interface CellChange {
  /** The cell address being changed */
  address: CellAddress;

  /** The current value of the cell */
  before: CellValue;

  /** The new value the cell will have */
  after: CellValue;

  /** The formula that will be set (if applicable) */
  formula?: string;

  /** Whether this change affects a formula */
  isFormula: boolean;

  /** The type of change being made */
  changeType: "value" | "formula" | "format" | "clear";

  /** Optional metadata specific to the operation type */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a preview of what a bulk operation will do
 */
export interface OperationPreview {
  /** Total number of cells that will be affected */
  affectedCells: number;

  /** Map of specific cell changes (limited for performance) */
  changes: Map<string, CellChange>;

  /** List of warnings about the operation */
  warnings: string[];

  /** List of errors that would prevent the operation */
  errors: string[];

  /** Estimated time to complete the operation */
  estimatedTime: number;

  /** Whether this preview is truncated (for large operations) */
  isTruncated: boolean;

  /** Number of changes shown in preview vs total */
  previewCount: number;

  /** Summary statistics about the operation */
  summary: OperationSummary;
}

/**
 * Summary statistics for an operation preview
 */
export interface OperationSummary {
  /** Total cells in the selection */
  totalCells: number;

  /** Cells that will be modified */
  modifiedCells: number;

  /** Cells that will be skipped (e.g., empty cells) */
  skippedCells: number;

  /** Cells that contain formulas */
  formulaCells: number;

  /** Cells that contain only values */
  valueCells: number;

  /** Breakdown by change type */
  changesByType: Record<string, number>;

  /** Memory usage estimate */
  memoryEstimate: number;

  /** Optional operation-specific metadata */
  [key: string]: unknown;
}

/**
 * Configuration for preview generation
 */
export interface PreviewOptions {
  /** Maximum number of changes to include in preview */
  maxChanges?: number;

  /** Whether to include detailed change information */
  includeDetails?: boolean;

  /** Whether to calculate memory estimates */
  calculateMemory?: boolean;

  /** Types of changes to include in preview */
  includeChangeTypes?: string[];

  /** Whether to validate each change */
  validateChanges?: boolean;
}

/**
 * Builder for creating operation previews
 */
export class OperationPreviewBuilder {
  private preview: Partial<OperationPreview> = {
    changes: new Map(),
    warnings: [],
    errors: [],
    affectedCells: 0,
    estimatedTime: 0,
    isTruncated: false,
    previewCount: 0,
    summary: {
      totalCells: 0,
      modifiedCells: 0,
      skippedCells: 0,
      formulaCells: 0,
      valueCells: 0,
      changesByType: {},
      memoryEstimate: 0,
    },
  };

  setAffectedCells(count: number): this {
    this.preview.affectedCells = count;
    return this;
  }

  addChange(change: CellChange): this {
    const key = `${change.address.row},${change.address.col}`;
    this.preview.changes?.set(key, change);
    this.preview.previewCount = this.preview.changes?.size;

    // Update summary
    if (this.preview.summary) {
      this.preview.summary.modifiedCells++;
      this.preview.summary.changesByType[change.changeType] =
        (this.preview.summary.changesByType[change.changeType] || 0) + 1;
    }

    return this;
  }

  addWarning(warning: string): this {
    this.preview.warnings?.push(warning);
    return this;
  }

  addError(error: string): this {
    this.preview.errors?.push(error);
    return this;
  }

  setEstimatedTime(time: number): this {
    this.preview.estimatedTime = time;
    return this;
  }

  setTruncated(truncated: boolean): this {
    this.preview.isTruncated = truncated;
    return this;
  }

  setSummary(summary: Partial<OperationSummary>): this {
    this.preview.summary = { ...(this.preview.summary || {}), ...summary };
    return this;
  }

  build(): OperationPreview {
    // Validate required fields
    if (this.preview.affectedCells === undefined) {
      throw new Error("Affected cells count is required");
    }

    return this.preview as OperationPreview;
  }
}

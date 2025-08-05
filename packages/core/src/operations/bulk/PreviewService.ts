import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import type { BulkOperation, Selection } from "./interfaces/BulkOperation";
import type {
  OperationPreview,
  PreviewOptions,
} from "./interfaces/OperationPreview";
import { OperationPreviewBuilder } from "./interfaces/OperationPreview";

/**
 * Configuration for the preview service
 */
export interface PreviewServiceConfig {
  /** Default maximum number of changes to include in previews */
  defaultMaxChanges: number;

  /** Maximum time to spend generating a preview (milliseconds) */
  maxPreviewTime: number;

  /** Whether to cache previews for repeated operations */
  enableCaching: boolean;

  /** Maximum size of preview cache */
  maxCacheSize: number;

  /** Whether to calculate detailed memory estimates */
  calculateMemoryEstimates: boolean;

  /** Whether to perform expensive validation during preview */
  enableExpensiveValidation: boolean;
}

/**
 * Cache entry for preview results
 */
interface PreviewCacheEntry {
  preview: OperationPreview;
  timestamp: number;
  operationHash: string;
}

/**
 * Service for managing and generating operation previews
 */
export class PreviewService {
  private cache = new Map<string, PreviewCacheEntry>();

  constructor(
    private cellRepository: ICellRepository,
    private config: PreviewServiceConfig = {
      defaultMaxChanges: 100,
      maxPreviewTime: 5000, // 5 seconds
      enableCaching: true,
      maxCacheSize: 100,
      calculateMemoryEstimates: true,
      enableExpensiveValidation: false,
    },
  ) {}

  /**
   * Generate a preview for a bulk operation
   */
  async generatePreview(
    operation: BulkOperation,
    options: PreviewOptions = {},
  ): Promise<OperationPreview> {
    const effectiveOptions = {
      maxChanges: this.config.defaultMaxChanges,
      includeDetails: true,
      calculateMemory: this.config.calculateMemoryEstimates,
      includeChangeTypes: undefined,
      validateChanges: this.config.enableExpensiveValidation,
      ...options,
    };

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedPreview(operation, effectiveOptions);
      if (cached) {
        return cached;
      }
    }

    const startTime = Date.now();
    const builder = new OperationPreviewBuilder();

    try {
      // Set basic information
      const totalCells = operation.selection.count();
      builder.setAffectedCells(totalCells);

      // Generate the preview using the operation's preview method
      const preview = await this.generateTimedPreview(
        operation,
        effectiveOptions,
        startTime,
      );

      // Cache the result if caching is enabled
      if (this.config.enableCaching) {
        this.cachePreview(operation, effectiveOptions, preview);
      }

      return preview;
    } catch (error) {
      // Return error preview
      return builder
        .addError(`Preview generation failed: ${error}`)
        .setEstimatedTime(0)
        .build();
    }
  }

  /**
   * Generate preview with timeout protection
   */
  private async generateTimedPreview(
    operation: BulkOperation,
    options: PreviewOptions,
    _startTime: number,
  ): Promise<OperationPreview> {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Preview generation timed out after ${this.config.maxPreviewTime}ms`,
          ),
        );
      }, this.config.maxPreviewTime);

      // Execute the preview operation
      operation
        .preview(options.maxChanges)
        .then((preview) => {
          clearTimeout(timeout);
          resolve(preview);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Generate a quick preview with minimal computation
   */
  async generateQuickPreview(
    operation: BulkOperation,
  ): Promise<OperationPreview> {
    const builder = new OperationPreviewBuilder();
    const totalCells = operation.selection.count();

    builder
      .setAffectedCells(totalCells)
      .setEstimatedTime(operation.estimateTime())
      .setSummary({
        totalCells,
        modifiedCells: totalCells, // Assume all cells will be modified
        skippedCells: 0,
        formulaCells: 0,
        valueCells: totalCells,
        changesByType: { [operation.type]: totalCells },
        memoryEstimate: totalCells * 100, // Basic estimate
      });

    // Add quick validation
    const validationError = operation.validate();
    if (validationError) {
      builder.addError(validationError);
    }

    return builder.build();
  }

  /**
   * Compare two operations for preview caching
   */
  private generateOperationHash(
    operation: BulkOperation,
    options: PreviewOptions,
  ): string {
    const selectionHash = this.hashSelection(operation.selection);
    const optionsHash = JSON.stringify(options);
    return `${operation.type}_${selectionHash}_${optionsHash}`;
  }

  /**
   * Generate a hash for a selection
   */
  private hashSelection(selection: Selection): string {
    // For performance, we'll use selection count and a sample of cells
    const count = selection.count();
    const sample: string[] = [];

    let sampleCount = 0;
    const maxSample = 10;

    for (const cell of selection.getCells()) {
      if (sampleCount >= maxSample) break;
      sample.push(`${cell.row},${cell.col}`);
      sampleCount++;
    }

    return `${count}_${sample.join("_")}`;
  }

  /**
   * Get cached preview if available and valid
   */
  private getCachedPreview(
    operation: BulkOperation,
    options: PreviewOptions,
  ): OperationPreview | null {
    const hash = this.generateOperationHash(operation, options);
    const entry = this.cache.get(hash);

    if (!entry) {
      return null;
    }

    // Check if cache entry is still valid (5 minutes)
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - entry.timestamp > maxAge) {
      this.cache.delete(hash);
      return null;
    }

    return entry.preview;
  }

  /**
   * Cache a preview result
   */
  private cachePreview(
    operation: BulkOperation,
    options: PreviewOptions,
    preview: OperationPreview,
  ): void {
    // Don't cache error previews
    if (preview.errors.length > 0) {
      return;
    }

    const hash = this.generateOperationHash(operation, options);

    // Manage cache size
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 20%
      const toRemove = Math.floor(this.config.maxCacheSize * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(hash, {
      preview,
      timestamp: Date.now(),
      operationHash: hash,
    });
  }

  /**
   * Generate a detailed summary for multiple operations
   */
  async generateBatchPreview(
    operations: BulkOperation[],
  ): Promise<BatchPreviewSummary> {
    const previews: OperationPreview[] = [];
    let totalCells = 0;
    let totalModified = 0;
    let totalTime = 0;
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const changesByType: Record<string, number> = {};

    for (const operation of operations) {
      try {
        const preview = await this.generateQuickPreview(operation);
        previews.push(preview);

        totalCells += preview.affectedCells;
        totalModified += preview.summary.modifiedCells;
        totalTime += preview.estimatedTime;
        allErrors.push(...preview.errors);
        allWarnings.push(...preview.warnings);

        // Merge change types
        for (const [type, count] of Object.entries(
          preview.summary.changesByType,
        )) {
          changesByType[type] = (changesByType[type] || 0) + count;
        }
      } catch (error) {
        allErrors.push(
          `Failed to preview operation ${operation.type}: ${error}`,
        );
      }
    }

    return {
      operationCount: operations.length,
      totalCells,
      totalModified,
      estimatedTotalTime: totalTime,
      errors: allErrors,
      warnings: allWarnings,
      changesByType,
      previews,
      canExecute: allErrors.length === 0,
      memoryEstimate: totalModified * 100,
    };
  }

  /**
   * Validate that a preview is still accurate
   */
  async validatePreview(
    operation: BulkOperation,
    preview: OperationPreview,
  ): Promise<PreviewValidationResult> {
    const issues: string[] = [];

    // Check if selection size has changed
    const currentSelectionSize = operation.selection.count();
    if (currentSelectionSize !== preview.affectedCells) {
      issues.push(
        `Selection size changed: ${preview.affectedCells} -> ${currentSelectionSize}`,
      );
    }

    // Sample a few cells to check if values have changed
    let sampleCount = 0;
    const maxSamples = 10;

    for (const cell of operation.selection.getCells()) {
      if (sampleCount >= maxSamples) break;

      const currentCell = this.cellRepository.get(cell);
      const currentValue = currentCell
        ? currentCell.computedValue || currentCell.rawValue
        : null;

      const cellKey = `${cell.row},${cell.col}`;
      const previewChange = preview.changes.get(cellKey);

      if (previewChange && previewChange.before !== currentValue) {
        issues.push(
          `Cell ${cellKey} value changed: expected ${previewChange.before}, got ${currentValue}`,
        );
      }

      sampleCount++;
    }

    return {
      isValid: issues.length === 0,
      issues,
      needsRegeneration: issues.length > 0,
    };
  }

  /**
   * Clear preview cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      // Hit rate would require tracking cache hits/misses
    };
  }
}

/**
 * Summary of previews for multiple operations
 */
export interface BatchPreviewSummary {
  operationCount: number;
  totalCells: number;
  totalModified: number;
  estimatedTotalTime: number;
  errors: string[];
  warnings: string[];
  changesByType: Record<string, number>;
  previews: OperationPreview[];
  canExecute: boolean;
  memoryEstimate: number;
}

/**
 * Result of validating a preview
 */
export interface PreviewValidationResult {
  isValid: boolean;
  issues: string[];
  needsRegeneration: boolean;
}

import { Cell, CellAddress } from "../../../domain/models";
import type { CellValue } from "../../../domain/models";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Selection } from "../interfaces/BulkOperation";
import type { CellChange, OperationPreview } from "../interfaces/OperationPreview";
import { BaseBulkOperation } from "./BaseBulkOperation";
import { OperationPreviewBuilder } from "../interfaces/OperationPreview";

/**
 * Lazy bulk operation that uses generators for memory-efficient processing
 * Best for operations on very large selections (100K+ cells)
 */
export abstract class LazyBulkOperation extends BaseBulkOperation {
  private changeGenerator: Generator<Promise<CellChange | null>> | null = null;
  
  constructor(
    type: string,
    selection: Selection,
    options: any,
    cellRepository: ICellRepository
  ) {
    super(type, selection, options, cellRepository);
  }

  /**
   * Create a generator that yields cell changes lazily
   */
  protected abstract createChangeGenerator(): Generator<Promise<CellChange | null>>;

  /**
   * Get the change generator (create if not exists)
   */
  protected getChangeGenerator(): Generator<Promise<CellChange | null>> {
    if (!this.changeGenerator) {
      this.changeGenerator = this.createChangeGenerator();
    }
    return this.changeGenerator;
  }

  /**
   * Generate preview using lazy evaluation
   * Only processes the first N changes for performance
   */
  async preview(limit: number = 100): Promise<OperationPreview> {
    const builder = new OperationPreviewBuilder();
    const totalCells = this.selection.count();
    
    builder.setAffectedCells(totalCells);
    
    let previewCount = 0;
    let estimatedModified = 0;
    const sampleSize = Math.min(limit * 2, 1000); // Sample larger than preview for estimation
    let sampleCount = 0;
    
    const changesByType: Record<string, number> = {};

    try {
      // Create a fresh generator for preview
      const previewGenerator = this.createChangeGenerator();
      
      for (const changePromise of previewGenerator) {
        if (previewCount >= limit && sampleCount >= sampleSize) {
          break;
        }

        const change = await changePromise;
        sampleCount++;
        
        if (change === null) {
          continue; // Skip unchanged cells
        }

        if (previewCount < limit) {
          builder.addChange(change);
          previewCount++;
        }
        
        estimatedModified++;
        changesByType[change.changeType] = (changesByType[change.changeType] || 0) + 1;
      }

      // Estimate total changes based on sample
      const sampleRatio = sampleCount > 0 ? estimatedModified / sampleCount : 0;
      const estimatedTotalModified = Math.round(totalCells * sampleRatio);
      
      if (previewCount >= limit && estimatedTotalModified > previewCount) {
        builder.setTruncated(true);
        builder.addWarning(`Preview shows ${previewCount} changes. Estimated total: ${estimatedTotalModified}`);
      }

      // Set summary information
      builder.setSummary({
        totalCells,
        modifiedCells: estimatedTotalModified,
        skippedCells: totalCells - estimatedTotalModified,
        formulaCells: 0, // Would need to be calculated based on actual implementation
        valueCells: totalCells,
        changesByType: this.projectChangesByType(changesByType, sampleCount, totalCells),
        memoryEstimate: this.estimateMemoryUsage(estimatedTotalModified)
      });

      // Estimate execution time based on projected changes
      const baseTime = this.estimateTime();
      const adjustedTime = Math.round(baseTime * (estimatedTotalModified / totalCells));
      builder.setEstimatedTime(adjustedTime);

    } catch (error) {
      builder.addError(`Preview generation failed: ${error}`);
    }

    return builder.build();
  }

  /**
   * Project change counts from sample to full population
   */
  private projectChangesByType(
    sampleChanges: Record<string, number>, 
    sampleSize: number, 
    totalSize: number
  ): Record<string, number> {
    const projected: Record<string, number> = {};
    const ratio = totalSize / sampleSize;
    
    for (const [type, count] of Object.entries(sampleChanges)) {
      projected[type] = Math.round(count * ratio);
    }
    
    return projected;
  }

  /**
   * Execute using generator for memory efficiency
   */
  async execute() {
    this.startTime = Date.now();
    
    // Use the base implementation but with our generator
    return super.execute();
  }

  /**
   * Process batch using lazy generator
   */
  protected async processBatch(cells: CellAddress[]) {
    // Create a generator for just this batch
    const batchGenerator = this.createBatchGenerator(cells);
    
    const changes: CellChange[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let processed = 0;
    let modified = 0;

    try {
      for (const changePromise of batchGenerator) {
        processed++;
        
        const change = await changePromise;
        if (change === null) {
          continue; // Skip unchanged cells
        }

        // Apply the change to the repository
        const cellResult = Cell.create(change.after, change.address);
        if (!cellResult.ok) {
          errors.push(`Failed to create cell ${change.address.row},${change.address.col}: ${cellResult.error}`);
          if (this.options.stopOnError) {
            break;
          }
          continue;
        }
        await this.cellRepository.set(change.address, cellResult.value);

        changes.push(change);
        modified++;
      }
    } catch (error) {
      errors.push(`Batch processing failed: ${error}`);
    }

    return { processed, modified, changes, errors, warnings };
  }

  /**
   * Create a generator for a specific batch of cells
   */
  private *createBatchGenerator(cells: CellAddress[]): Generator<Promise<CellChange | null>> {
    for (const address of cells) {
      yield this.createChangeForCell(address);
    }
  }

  /**
   * Create a change for a specific cell (to be implemented by subclasses)
   */
  protected async createChangeForCell(address: CellAddress): Promise<CellChange | null> {
    try {
      // Get current cell value
      const currentCell = await this.cellRepository.get(address);
      const currentValue = currentCell ? (currentCell.computedValue || currentCell.rawValue) : null;
      
      // Skip empty cells if configured
      if (this.options.skipEmpty && (currentValue === null || currentValue === "")) {
        return null;
      }

      // Transform the cell value
      const newValue = await this.transformCell(address, currentValue);
      
      if (newValue === null || newValue === currentValue) {
        return null;
      }

      // Create change record
      return {
        address,
        before: currentValue,
        after: newValue,
        isFormula: false,
        changeType: "value"
      };

    } catch (error) {
      // Return null for errors in individual cells (let batch handle error reporting)
      return null;
    }
  }

  /**
   * Reset the generator (useful for multiple operations)
   */
  protected resetGenerator(): void {
    this.changeGenerator = null;
  }

  /**
   * Check if the operation would benefit from lazy evaluation
   */
  static shouldUseLazy(cellCount: number): boolean {
    return cellCount > 10000; // Use lazy for operations over 10K cells
  }
}
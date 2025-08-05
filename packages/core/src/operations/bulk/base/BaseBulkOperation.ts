import { Cell, CellAddress } from "../../../domain/models";
import type { CellValue } from "../../../domain/models";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { 
  BulkOperation, 
  Selection, 
  BulkOperationOptions 
} from "../interfaces/BulkOperation";
import type { 
  OperationPreview, 
  CellChange, 
  PreviewOptions 
} from "../interfaces/OperationPreview";
import type { OperationResult } from "../interfaces/OperationResult";
import { OperationPreviewBuilder } from "../interfaces/OperationPreview";
import { OperationResultBuilder } from "../interfaces/OperationResult";

/**
 * Abstract base class for bulk operations
 * Provides common functionality and patterns for all bulk operations
 */
export abstract class BaseBulkOperation implements BulkOperation {
  protected startTime: number = 0;
  protected cellRepository: ICellRepository;
  
  constructor(
    public readonly type: string,
    public readonly selection: Selection,
    public readonly options: BulkOperationOptions = {},
    cellRepository: ICellRepository
  ) {
    this.cellRepository = cellRepository;
  }

  /**
   * Abstract method that subclasses must implement
   * Defines how a cell value should be transformed
   */
  protected abstract transformCell(
    address: CellAddress, 
    currentValue: CellValue
  ): Promise<CellValue | null>;

  /**
   * Generate a preview of what this operation will do
   */
  async preview(limit: number = 100): Promise<OperationPreview> {
    const builder = new OperationPreviewBuilder();
    const totalCells = this.selection.count();
    
    builder.setAffectedCells(totalCells);
    
    let previewCount = 0;
    let modifiedCount = 0;
    let skippedCount = 0;
    let formulaCount = 0;
    let valueCount = 0;
    
    const changesByType: Record<string, number> = {};

    try {
      for (const address of this.selection.getCells()) {
        if (previewCount >= limit) {
          builder.setTruncated(true);
          break;
        }

        // Get current cell value
        const currentCell = await this.cellRepository.get(address);
        const currentValue = currentCell ? (currentCell.computedValue || currentCell.rawValue) : null;
        
        // Check if this is a formula cell
        const isFormula = currentCell?.formula !== undefined;
        if (isFormula) {
          formulaCount++;
        } else {
          valueCount++;
        }

        // Skip empty cells if configured
        if (this.options.skipEmpty && (currentValue === null || currentValue === "")) {
          skippedCount++;
          continue;
        }

        // Transform the cell value
        const newValue = await this.transformCell(address, currentValue);
        
        if (newValue === null || newValue === currentValue) {
          skippedCount++;
          continue;
        }

        // Create change record
        const change: CellChange = {
          address,
          before: currentValue,
          after: newValue,
          isFormula: false, // Base implementation handles values, not formulas
          changeType: "value"
        };

        builder.addChange(change);
        modifiedCount++;
        previewCount++;
        
        changesByType[change.changeType] = (changesByType[change.changeType] || 0) + 1;
      }

      // Set summary information
      builder.setSummary({
        totalCells,
        modifiedCells: modifiedCount,
        skippedCells: skippedCount,
        formulaCells: formulaCount,
        valueCells: valueCount,
        changesByType,
        memoryEstimate: this.estimateMemoryUsage(modifiedCount)
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
   * Execute the bulk operation
   */
  async execute(): Promise<OperationResult> {
    this.startTime = Date.now();
    const builder = new OperationResultBuilder();
    
    builder.setOperationType(this.type);
    
    let cellsProcessed = 0;
    let cellsModified = 0;
    const batchSize = this.options.batchSize || 1000;
    let batchCount = 0;
    const batchTimes: number[] = [];

    try {
      // Process cells in batches for better performance
      const cellBatches = this.chunkCells(this.selection.getCells(), batchSize);
      
      for (const batch of cellBatches) {
        const batchStart = Date.now();
        batchCount++;
        
        const batchResult = await this.processBatch(batch);
        cellsProcessed += batchResult.processed;
        cellsModified += batchResult.modified;
        
        // Add changes to result
        for (const change of batchResult.changes) {
          builder.addChange(change);
        }
        
        // Add any errors or warnings
        for (const error of batchResult.errors) {
          builder.addError(error);
        }
        for (const warning of batchResult.warnings) {
          builder.addWarning(warning);
        }

        const batchTime = Date.now() - batchStart;
        batchTimes.push(batchTime);
        
        // Report progress if callback provided
        if (this.options.onProgress) {
          this.options.onProgress(cellsProcessed, this.selection.count());
        }

        // Stop on error if configured
        if (this.options.stopOnError && batchResult.errors.length > 0) {
          break;
        }
      }

      const executionTime = Date.now() - this.startTime;
      
      builder
        .setCellsProcessed(cellsProcessed)
        .setCellsModified(cellsModified)
        .setExecutionTime(executionTime)
        .setPerformanceMetrics({
          cellsPerSecond: cellsProcessed / (executionTime / 1000),
          peakMemoryUsage: this.estimateMemoryUsage(cellsModified),
          batchCount,
          averageBatchTime: batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length,
          validationTime: 0, // Would be calculated during validation
          updateTime: executionTime,
          recalculationTime: 0 // Would be provided by formula service
        });

    } catch (error) {
      builder.addError(`Operation failed: ${error}`);
    }

    return builder.build();
  }

  /**
   * Estimate the time this operation will take to complete
   */
  estimateTime(): number {
    const cellCount = this.selection.count();
    // Estimate 10,000 cells per second (can be overridden by subclasses)
    const cellsPerSecond = 10000;
    return (cellCount / cellsPerSecond) * 1000; // Return milliseconds
  }

  /**
   * Validate that this operation can be executed
   */
  validate(): string | null {
    if (this.selection.isEmpty()) {
      return "Selection is empty";
    }
    
    if (this.selection.count() > 1000000) {
      return "Selection is too large (max 1,000,000 cells)";
    }
    
    return null;
  }

  /**
   * Get a human-readable description of this operation
   */
  abstract getDescription(): string;

  /**
   * Process a batch of cells
   */
  protected async processBatch(cells: CellAddress[]): Promise<BatchResult> {
    const changes: CellChange[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let processed = 0;
    let modified = 0;

    for (const address of cells) {
      try {
        processed++;
        
        // Get current cell value
        const currentCell = await this.cellRepository.get(address);
        const currentValue = currentCell ? (currentCell.computedValue || currentCell.rawValue) : null;
        
        // Skip empty cells if configured
        if (this.options.skipEmpty && (currentValue === null || currentValue === "")) {
          continue;
        }

        // Transform the cell value
        const newValue = await this.transformCell(address, currentValue);
        
        if (newValue === null || newValue === currentValue) {
          continue;
        }

        // Update the cell
        const cellResult = Cell.create(newValue, address);
        if (!cellResult.ok) {
          errors.push(`Failed to create cell ${address.row},${address.col}: ${cellResult.error}`);
          continue;
        }
        await this.cellRepository.set(address, cellResult.value);

        // Record the change
        const change: CellChange = {
          address,
          before: currentValue,
          after: newValue,
          isFormula: false,
          changeType: "value"
        };
        
        changes.push(change);
        modified++;

      } catch (error) {
        errors.push(`Error processing cell ${address.row},${address.col}: ${error}`);
        if (this.options.stopOnError) {
          break;
        }
      }
    }

    return { processed, modified, changes, errors, warnings };
  }

  /**
   * Split cells into batches for processing
   */
  protected *chunkCells(cells: Iterable<CellAddress>, size: number): Generator<CellAddress[]> {
    let batch: CellAddress[] = [];
    
    for (const cell of cells) {
      batch.push(cell);
      if (batch.length >= size) {
        yield batch;
        batch = [];
      }
    }
    
    if (batch.length > 0) {
      yield batch;
    }
  }

  /**
   * Estimate memory usage for the operation
   */
  protected estimateMemoryUsage(cellCount: number): number {
    // Rough estimate: 100 bytes per cell change
    return cellCount * 100;
  }
}

/**
 * Result of processing a batch of cells
 */
interface BatchResult {
  processed: number;
  modified: number;
  changes: CellChange[];
  errors: string[];
  warnings: string[];
}
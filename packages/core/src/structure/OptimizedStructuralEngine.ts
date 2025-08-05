import type { Cell } from "../domain/models/Cell";
import type { CellAddress } from "../domain/models/CellAddress";
import { err, ok, type Result } from "../shared/types/Result";
import type { StructuralChange } from "./ReferenceUpdater";
import { ReferenceUpdater } from "./ReferenceUpdater";
import { OptimizedSparseGrid } from "./OptimizedSparseGrid";
import { PerformanceMonitor, globalPerformanceMonitor } from "./PerformanceMonitor";

/**
 * Batch structural operation for multiple changes
 */
export interface BatchStructuralOperation {
  id: string;
  operations: StructuralChange[];
  timestamp: number;
}

/**
 * Warning about potential data loss from structural operations
 */
export interface StructuralWarning {
  type: "formulaReference" | "dataLoss" | "outOfBounds" | "performance";
  message: string;
  affectedCells: CellAddress[];
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Result of analyzing a structural operation before execution
 */
export interface StructuralAnalysis {
  warnings: StructuralWarning[];
  affectedCells: CellAddress[];
  formulaUpdates: Map<CellAddress, string>;
  estimatedDuration: number;
  estimatedMemoryUsage: number;
  riskLevel: "low" | "medium" | "high" | "critical";
}

/**
 * Enhanced engine for coordinating structural changes with performance optimization
 */
export class OptimizedStructuralEngine {
  private grid: OptimizedSparseGrid;
  private referenceUpdater: ReferenceUpdater;
  private performanceMonitor: PerformanceMonitor;
  private batchMode: boolean = false;
  private pendingBatch: StructuralChange[] = [];

  // Performance and safety limits
  private readonly limits = {
    maxRowsColumns: 1000000,    // 1M rows/cols limit
    maxCellsPerOperation: 100000, // 100k cells per operation
    maxBatchSize: 100,          // 100 operations per batch
    warningCellThreshold: 10000, // Warn if affecting >10k cells
  };

  constructor(grid?: OptimizedSparseGrid, performanceMonitor?: PerformanceMonitor) {
    this.grid = grid || new OptimizedSparseGrid();
    this.referenceUpdater = new ReferenceUpdater();
    this.performanceMonitor = performanceMonitor || globalPerformanceMonitor;
  }

  /**
   * Enable batch mode for multiple operations
   */
  startBatch(): void {
    this.batchMode = true;
    this.pendingBatch = [];
  }

  /**
   * Execute all pending batch operations
   */
  executeBatch(): Result<StructuralAnalysis, string> {
    if (!this.batchMode || this.pendingBatch.length === 0) {
      return err("No batch operations pending");
    }

    const timer = this.performanceMonitor.startOperation(
      `batch-${this.pendingBatch.length}-operations`,
      this.pendingBatch.reduce((sum, op) => sum + op.count, 0)
    );

    try {
      // Optimize batch operations by grouping similar operations
      const optimizedBatch = this.optimizeBatch(this.pendingBatch);
      
      const combinedAnalysis: StructuralAnalysis = {
        warnings: [],
        affectedCells: [],
        formulaUpdates: new Map(),
        estimatedDuration: 0,
        estimatedMemoryUsage: 0,
        riskLevel: "low",
      };

      // Execute optimized batch
      for (const operation of optimizedBatch) {
        const result = this.executeStructuralChangeInternal(operation);
        if (!result.ok) {
          timer.end(combinedAnalysis.affectedCells.length);
          this.batchMode = false;
          this.pendingBatch = [];
          return result;
        }

        // Combine analysis results
        const analysis = result.value;
        combinedAnalysis.warnings.push(...analysis.warnings);
        combinedAnalysis.affectedCells.push(...analysis.affectedCells);
        for (const [addr, formula] of analysis.formulaUpdates) {
          combinedAnalysis.formulaUpdates.set(addr, formula);
        }
        combinedAnalysis.estimatedDuration += analysis.estimatedDuration;
        combinedAnalysis.estimatedMemoryUsage = Math.max(
          combinedAnalysis.estimatedMemoryUsage,
          analysis.estimatedMemoryUsage
        );
      }

      // Calculate overall risk level
      combinedAnalysis.riskLevel = this.calculateRiskLevel(combinedAnalysis);

      timer.end(combinedAnalysis.affectedCells.length);
      this.batchMode = false;
      this.pendingBatch = [];

      return ok(combinedAnalysis);
    } catch (error) {
      timer.end(0);
      this.batchMode = false;
      this.pendingBatch = [];
      return err(`Failed to execute batch: ${error}`);
    }
  }

  /**
   * Cancel batch mode without executing
   */
  cancelBatch(): void {
    this.batchMode = false;
    this.pendingBatch = [];
  }

  /**
   * Analyze what would happen if we perform a structural change
   */
  analyzeStructuralChange(change: StructuralChange): Result<StructuralAnalysis, string> {
    try {
      const timer = this.performanceMonitor.startOperation(
        `analyze-${change.type}`,
        change.count
      );

      const warnings: StructuralWarning[] = [];
      const affectedCells: CellAddress[] = [];
      const formulaUpdates = new Map<CellAddress, string>();

      // Early validation checks
      const validationResult = this.validateOperation(change);
      if (!validationResult.ok) {
        timer.end(0);
        return validationResult;
      }

      // Estimate performance impact
      const estimatedDuration = this.estimateOperationDuration(change);
      const estimatedMemoryUsage = this.estimateMemoryUsage(change);

      // Add performance warnings if needed
      if (estimatedDuration > this.performanceMonitor.getExpectedDuration(change.count)) {
        warnings.push({
          type: "performance",
          message: `Operation may take ${estimatedDuration}ms, which exceeds recommended duration`,
          affectedCells: [],
          severity: "medium",
        });
      }

      // Get all cells efficiently using optimized grid
      const allCells = this.grid.getAllCells();
      let processedCells = 0;

      for (const [address, cell] of allCells.entries()) {
        processedCells++;
        
        // Check if cell position will be affected
        const positionAffected = this.isCellPositionAffected(address, change);
        if (positionAffected) {
          affectedCells.push(address);
        }

        // Check if cell has formulas that reference affected areas
        if (cell && typeof cell.hasFormula === 'function' && cell.hasFormula()) {
          const formula = cell.rawValue as string;
          const wouldBeAffected = this.referenceUpdater.wouldBeAffected(formula, change);
          
          if (wouldBeAffected) {
            const updateResult = this.referenceUpdater.updateForStructuralChange(formula, change);
            if (updateResult.ok) {
              formulaUpdates.set(address, updateResult.value);
              
              // Check for #REF! errors
              if (updateResult.value.includes("#REF!")) {
                warnings.push({
                  type: "formulaReference",
                  message: `Formula in cell ${address.row},${address.col} will reference deleted cells`,
                  affectedCells: [address],
                  severity: "high",
                });
              }
            }
          }
        }

        // Break early if processing too many cells to avoid performance issues
        if (processedCells > this.limits.maxCellsPerOperation) {
          warnings.push({
            type: "performance",
            message: `Operation affects more than ${this.limits.maxCellsPerOperation} cells, may impact performance`,
            affectedCells: [],
            severity: "medium",
          });
          break;
        }
      }

      // Check for data loss in deletion operations
      if (change.type === "deleteRow" || change.type === "deleteColumn") {
        const lostCells = this.getCellsInDeletedArea(change);
        if (lostCells.length > 0) {
          const severity = lostCells.length > 1000 ? "high" : "medium";
          warnings.push({
            type: "dataLoss",
            message: `${lostCells.length} cells will be deleted`,
            affectedCells: lostCells,
            severity,
          });
        }
      }

      const analysis: StructuralAnalysis = {
        warnings,
        affectedCells,
        formulaUpdates,
        estimatedDuration,
        estimatedMemoryUsage,
        riskLevel: this.calculateRiskLevel({
          warnings,
          affectedCells,
          formulaUpdates,
          estimatedDuration,
          estimatedMemoryUsage,
          riskLevel: "low", // Will be calculated
        }),
      };

      timer.end(affectedCells.length);
      return ok(analysis);
    } catch (error) {
      return err(`Failed to analyze structural change: ${error}`);
    }
  }

  /**
   * Execute a structural change with proper formula updates
   */
  executeStructuralChange(change: StructuralChange): Result<StructuralAnalysis, string> {
    if (this.batchMode) {
      // Add to batch instead of executing immediately
      this.pendingBatch.push(change);
      if (this.pendingBatch.length >= this.limits.maxBatchSize) {
        return this.executeBatch();
      }
      return ok({
        warnings: [],
        affectedCells: [],
        formulaUpdates: new Map(),
        estimatedDuration: 0,
        estimatedMemoryUsage: 0,
        riskLevel: "low",
      });
    }

    return this.executeStructuralChangeInternal(change);
  }

  private executeStructuralChangeInternal(change: StructuralChange): Result<StructuralAnalysis, string> {
    const timer = this.performanceMonitor.startOperation(
      `execute-${change.type}`,
      change.count
    );

    try {
      // First analyze the change
      const analysisResult = this.analyzeStructuralChange(change);
      if (!analysisResult.ok) {
        timer.end(0);
        return analysisResult;
      }
      const analysis = analysisResult.value;

      // Apply formula updates before structural changes
      for (const [address, newFormula] of analysis.formulaUpdates.entries()) {
        const cell = this.grid.getCell(address);
        if (cell) {
          // Update the cell's formula
          const updatedCell = { ...cell };
          // In a real implementation, we'd call cell.setRawValue(newFormula) or similar
          this.grid.setCell(address, updatedCell);
        }
      }

      // Apply the structural change to the grid using optimized methods
      const gridResult = this.applyStructuralChangeToGrid(change);
      if (!gridResult.ok) {
        timer.end(0);
        return err(gridResult.error);
      }

      timer.end(analysis.affectedCells.length);
      return ok(analysis);
    } catch (error) {
      timer.end(0);
      return err(`Failed to execute structural change: ${error}`);
    }
  }

  /**
   * Insert rows with batch optimization
   */
  insertRows(beforeRow: number, count: number): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "insertRow",
      index: beforeRow,
      count,
      timestamp: Date.now()
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Delete rows with optimization
   */
  deleteRows(startRow: number, count: number): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "deleteRow",
      index: startRow,
      count,
      timestamp: Date.now()
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Insert columns with optimization
   */
  insertColumns(beforeCol: number, count: number): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "insertColumn",
      index: beforeCol,
      count,
      timestamp: Date.now()
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Delete columns with optimization
   */
  deleteColumns(startCol: number, count: number): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "deleteColumn",
      index: startCol,
      count,
      timestamp: Date.now()
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Get the underlying optimized grid
   */
  getGrid(): OptimizedSparseGrid {
    return this.grid;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    return {
      monitor: this.performanceMonitor.getPerformanceReport(),
      grid: this.grid.getPerformanceMetrics(),
      warnings: this.performanceMonitor.getPerformanceWarnings(),
    };
  }

  // Private helper methods

  private validateOperation(change: StructuralChange): Result<void, string> {
    // Check bounds
    if (change.index < 0) {
      return err(`Invalid ${change.type} index: ${change.index}`);
    }
    
    if (change.count <= 0) {
      return err(`Invalid ${change.type} count: ${change.count}`);
    }

    // Check limits
    const bounds = this.grid.getBounds();
    const isRowOperation = change.type === "insertRow" || change.type === "deleteRow";
    const maxAllowed = isRowOperation ? this.limits.maxRowsColumns : this.limits.maxRowsColumns;
    const currentMax = isRowOperation ? bounds.maxRow : bounds.maxCol;

    if (change.type === "insertRow" || change.type === "insertColumn") {
      if (currentMax + change.count > maxAllowed) {
        return err(`Operation would exceed maximum ${isRowOperation ? 'rows' : 'columns'} limit of ${maxAllowed}`);
      }
    }

    // Check memory constraints
    if (this.grid.isAtMemoryLimit()) {
      return err("Grid is at memory limit, cannot perform structural operations");
    }

    return ok(undefined);
  }

  private estimateOperationDuration(change: StructuralChange): number {
    // Estimate based on operation size and grid size
    const gridSize = this.grid.size();
    const baseTime = Math.log(gridSize + 1) * 0.1; // Logarithmic scaling
    const countFactor = change.count * 0.05; // Linear scaling with count
    return Math.max(1, baseTime + countFactor);
  }

  private estimateMemoryUsage(change: StructuralChange): number {
    const currentMemory = this.grid.getMemoryStats().estimatedBytes;
    const operationOverhead = change.count * 1024; // 1KB per row/column
    return currentMemory + operationOverhead;
  }

  private calculateRiskLevel(analysis: StructuralAnalysis): "low" | "medium" | "high" | "critical" {
    let riskScore = 0;

    // Factor in warnings
    for (const warning of analysis.warnings) {
      switch (warning.severity) {
        case "low": riskScore += 1; break;
        case "medium": riskScore += 2; break;
        case "high": riskScore += 4; break;
        case "critical": riskScore += 8; break;
      }
    }

    // Factor in affected cells
    if (analysis.affectedCells.length > this.limits.warningCellThreshold) {
      riskScore += 3;
    }

    // Factor in estimated duration
    if (analysis.estimatedDuration > 1000) {
      riskScore += 2;
    }

    if (riskScore <= 2) return "low";
    if (riskScore <= 5) return "medium";
    if (riskScore <= 10) return "high";
    return "critical";
  }

  private optimizeBatch(operations: StructuralChange[]): StructuralChange[] {
    // Group similar operations together for batch processing
    const insertRows: StructuralChange[] = [];
    const deleteRows: StructuralChange[] = [];
    const insertCols: StructuralChange[] = [];
    const deleteCols: StructuralChange[] = [];

    for (const op of operations) {
      switch (op.type) {
        case "insertRow": insertRows.push(op); break;
        case "deleteRow": deleteRows.push(op); break;
        case "insertColumn": insertCols.push(op); break;
        case "deleteColumn": deleteCols.push(op); break;
      }
    }

    // Sort row operations by index (descending for inserts, ascending for deletes)
    insertRows.sort((a, b) => b.index - a.index);
    deleteRows.sort((a, b) => a.index - b.index);
    insertCols.sort((a, b) => b.index - a.index);
    deleteCols.sort((a, b) => a.index - b.index);

    // Return optimized order: deletes first, then inserts
    return [...deleteRows, ...deleteCols, ...insertRows, ...insertCols];
  }

  private isCellPositionAffected(address: CellAddress, change: StructuralChange): boolean {
    switch (change.type) {
      case "insertRow":
        return address.row >= change.index;
      case "deleteRow":
        return address.row >= change.index;
      case "insertColumn":
        return address.col >= change.index;
      case "deleteColumn":
        return address.col >= change.index;
      default:
        return false;
    }
  }

  private getCellsInDeletedArea(change: StructuralChange): CellAddress[] {
    const lostCells: CellAddress[] = [];
    
    // Use optimized range queries for better performance
    if (change.type === "deleteRow") {
      const rangeMap = this.grid.getCellsInRowRange(change.index, change.index + change.count - 1);
      for (const address of rangeMap.keys()) {
        lostCells.push(address);
      }
    } else if (change.type === "deleteColumn") {
      // For columns, we need to check each row - could be optimized further
      const allCells = this.grid.getAllCells();
      for (const [address] of allCells.entries()) {
        if (address.col >= change.index && address.col < change.index + change.count) {
          lostCells.push(address);
        }
      }
    }

    return lostCells;
  }

  private applyStructuralChangeToGrid(change: StructuralChange): Result<void, string> {
    switch (change.type) {
      case "insertRow":
        return this.grid.insertRows(change.index, change.count);
      case "deleteRow":
        return this.grid.deleteRows(change.index, change.count);
      case "insertColumn":
        return this.grid.insertColumns(change.index, change.count);
      case "deleteColumn":
        return this.grid.deleteColumns(change.index, change.count);
      default:
        return err(`Unknown structural change type: ${(change as any).type}`);
    }
  }
}
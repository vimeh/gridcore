import { Cell } from "../domain/models/Cell";
import type { CellAddress } from "../domain/models/CellAddress";
import { err, ok, type Result } from "../shared/types/Result";
import type { StructuralChange } from "./ReferenceUpdater";
import { ReferenceUpdater } from "./ReferenceUpdater";
import { SparseGrid } from "./SparseGrid";

/**
 * Warning about potential data loss from structural operations
 */
export interface StructuralWarning {
  type: "formulaReference" | "dataLoss" | "outOfBounds";
  message: string;
  affectedCells: CellAddress[];
}

/**
 * Result of analyzing a structural operation before execution
 */
export interface StructuralAnalysis {
  warnings: StructuralWarning[];
  affectedCells: CellAddress[];
  formulaUpdates: Map<CellAddress, string>;
}

/**
 * Engine for coordinating structural changes with proper formula updates
 */
export class StructuralEngine {
  private grid: SparseGrid;
  private referenceUpdater: ReferenceUpdater;

  constructor(grid?: SparseGrid) {
    this.grid = grid || new SparseGrid();
    this.referenceUpdater = new ReferenceUpdater();
  }

  /**
   * Analyze what would happen if we perform a structural change
   */
  analyzeStructuralChange(
    change: StructuralChange,
  ): Result<StructuralAnalysis, string> {
    try {
      const warnings: StructuralWarning[] = [];
      const affectedCells: CellAddress[] = [];
      const formulaUpdates = new Map<CellAddress, string>();

      // Get all cells that might be affected
      const allCells = this.grid.getAllCells();

      for (const [address, cell] of allCells.entries()) {
        // Check if cell position will be affected
        const positionAffected = this.isCellPositionAffected(address, change);
        if (positionAffected) {
          affectedCells.push(address);
        }

        // Check if cell has formulas that reference affected areas
        if (cell.hasFormula()) {
          const formula = cell.rawValue as string;
          const wouldBeAffected = this.referenceUpdater.wouldBeAffected(
            formula,
            change,
          );

          if (wouldBeAffected) {
            const updateResult =
              this.referenceUpdater.updateForStructuralChange(formula, change);
            if (updateResult.ok) {
              formulaUpdates.set(address, updateResult.value);

              // Check for #REF! errors
              if (updateResult.value.includes("#REF!")) {
                warnings.push({
                  type: "formulaReference",
                  message: `Formula in cell ${address.row},${address.col} will reference deleted cells`,
                  affectedCells: [address],
                });
              }
            }
          }
        }
      }

      // Check for data loss in deletion operations
      if (change.type === "deleteRow" || change.type === "deleteColumn") {
        const lostCells = this.getCellsInDeletedArea(change);
        if (lostCells.length > 0) {
          warnings.push({
            type: "dataLoss",
            message: `${lostCells.length} cells will be deleted`,
            affectedCells: lostCells,
          });
        }
      }

      return ok({
        warnings,
        affectedCells,
        formulaUpdates,
      });
    } catch (error) {
      return err(`Failed to analyze structural change: ${error}`);
    }
  }

  /**
   * Execute a structural change with proper formula updates
   */
  executeStructuralChange(
    change: StructuralChange,
  ): Result<StructuralAnalysis, string> {
    try {
      // First analyze the change
      const analysisResult = this.analyzeStructuralChange(change);
      if (!analysisResult.ok) {
        return analysisResult;
      }
      const analysis = analysisResult.value;

      // Apply formula updates before structural changes
      for (const [address, newFormula] of analysis.formulaUpdates.entries()) {
        const cell = this.grid.getCell(address);
        if (cell) {
          // Update the cell's formula
          // Note: This is a simplified approach - in a real implementation
          // we'd need to properly update the cell's raw value and trigger recalculation
          const cellResult = Cell.create(newFormula, address);
          if (cellResult.ok) {
            this.grid.setCell(address, cellResult.value);
          }
        }
      }

      // Apply the structural change to the grid
      const gridResult = this.applyStructuralChangeToGrid(change);
      if (!gridResult.ok) {
        return err(gridResult.error);
      }

      return ok(analysis);
    } catch (error) {
      return err(`Failed to execute structural change: ${error}`);
    }
  }

  /**
   * Insert rows in the grid
   */
  insertRows(
    beforeRow: number,
    count: number,
  ): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "insertRow",
      index: beforeRow,
      count,
      timestamp: Date.now(),
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Delete rows from the grid
   */
  deleteRows(
    startRow: number,
    count: number,
  ): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "deleteRow",
      index: startRow,
      count,
      timestamp: Date.now(),
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Insert columns in the grid
   */
  insertColumns(
    beforeCol: number,
    count: number,
  ): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "insertColumn",
      index: beforeCol,
      count,
      timestamp: Date.now(),
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Delete columns from the grid
   */
  deleteColumns(
    startCol: number,
    count: number,
  ): Result<StructuralAnalysis, string> {
    const change: StructuralChange = {
      type: "deleteColumn",
      index: startCol,
      count,
      timestamp: Date.now(),
    };

    return this.executeStructuralChange(change);
  }

  /**
   * Get the underlying grid
   */
  getGrid(): SparseGrid {
    return this.grid;
  }

  /**
   * Check if a cell's position would be affected by a structural change
   */
  private isCellPositionAffected(
    address: CellAddress,
    change: StructuralChange,
  ): boolean {
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

  /**
   * Get cells that would be lost in a deletion operation
   */
  private getCellsInDeletedArea(change: StructuralChange): CellAddress[] {
    const lostCells: CellAddress[] = [];
    const allCells = this.grid.getAllCells();

    for (const [address] of allCells.entries()) {
      switch (change.type) {
        case "deleteRow":
          if (
            address.row >= change.index &&
            address.row < change.index + change.count
          ) {
            lostCells.push(address);
          }
          break;
        case "deleteColumn":
          if (
            address.col >= change.index &&
            address.col < change.index + change.count
          ) {
            lostCells.push(address);
          }
          break;
      }
    }

    return lostCells;
  }

  /**
   * Apply the structural change to the underlying grid
   */
  private applyStructuralChangeToGrid(
    change: StructuralChange,
  ): Result<void, string> {
    switch (change.type) {
      case "insertRow":
        return this.grid.insertRows(change.index, change.count);
      case "deleteRow":
        return this.grid.deleteRows(change.index, change.count);
      case "insertColumn":
        return this.grid.insertColumns(change.index, change.count);
      case "deleteColumn":
        return this.grid.deleteColumns(change.index, change.count);
      default: {
        const exhaustiveCheck: never = change;
        return err(
          `Unknown structural change type: ${(exhaustiveCheck as unknown as { type: string }).type}`,
        );
      }
    }
  }
}

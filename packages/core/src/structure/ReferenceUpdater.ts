import type { CellAddress } from "../domain/models/CellAddress";
import { ReferenceAdjuster, ReferenceDetector, ReferenceParser } from "../references";
import type { CellReference, Reference } from "../references/types";
import { err, ok, type Result } from "../shared/types/Result";

/**
 * Structural change types for tracking insert/delete operations
 */
export interface StructuralChange {
  type: "insertRow" | "insertColumn" | "deleteRow" | "deleteColumn";
  index: number;
  count: number;
  timestamp: number;
}

/**
 * High-level wrapper around Agent-1's reference system for formula updates
 * during structural changes (insert/delete operations).
 */
export class ReferenceUpdater {
  private parser: ReferenceParser;
  private adjuster: ReferenceAdjuster;
  private detector: ReferenceDetector;

  constructor() {
    this.parser = new ReferenceParser();
    this.adjuster = new ReferenceAdjuster();
    this.detector = new ReferenceDetector();
  }

  /**
   * Update formula references when rows are inserted
   */
  updateForInsertRows(formula: string, insertRow: number, count: number): Result<string, string> {
    try {
      const analysis = this.detector.analyzeFormula(formula);
      let updatedFormula = formula;
      let offset = 0;

      // Process references from right to left to maintain positions
      const sortedRefs = [...analysis.references].sort((a, b) => b.position - a.position);

      for (const refInfo of sortedRefs) {
        const ref = refInfo.reference;
        
        // Only update if the row needs adjustment
        if (ref.row >= insertRow && !ref.rowAbsolute) {
          const adjustedRef: CellReference = {
            ...ref,
            row: ref.row + count
          };

          const originalText = refInfo.text;
          const newText = this.parser.stringifyCellReference(adjustedRef);
          
          updatedFormula = 
            updatedFormula.substring(0, refInfo.position) +
            newText +
            updatedFormula.substring(refInfo.position + refInfo.length);
        }
      }

      return ok(updatedFormula);
    } catch (error) {
      return err(`Failed to update formula for row insertion: ${error}`);
    }
  }

  /**
   * Update formula references when rows are deleted
   */
  updateForDeleteRows(formula: string, deleteRow: number, count: number): Result<string, string> {
    try {
      const analysis = this.detector.analyzeFormula(formula);
      let updatedFormula = formula;

      // Process references from right to left to maintain positions
      const sortedRefs = [...analysis.references].sort((a, b) => b.position - a.position);

      for (const refInfo of sortedRefs) {
        const ref = refInfo.reference;
        
        if (ref.rowAbsolute) {
          // Absolute references don't change
          continue;
        }

        const originalText = refInfo.text;
        let newText: string;

        if (ref.row >= deleteRow && ref.row < deleteRow + count) {
          // Reference points to deleted row - becomes #REF!
          newText = "#REF!";
        } else if (ref.row >= deleteRow + count) {
          // Reference is after deleted rows - shift up
          const adjustedRef: CellReference = {
            ...ref,
            row: ref.row - count
          };
          newText = this.parser.stringifyCellReference(adjustedRef);
        } else {
          // Reference is before deleted rows - no change needed
          continue;
        }

        updatedFormula = 
          updatedFormula.substring(0, refInfo.position) +
          newText +
          updatedFormula.substring(refInfo.position + refInfo.length);
      }

      return ok(updatedFormula);
    } catch (error) {
      return err(`Failed to update formula for row deletion: ${error}`);
    }
  }

  /**
   * Update formula references when columns are inserted
   */
  updateForInsertColumns(formula: string, insertCol: number, count: number): Result<string, string> {
    try {
      const analysis = this.detector.analyzeFormula(formula);
      let updatedFormula = formula;

      // Process references from right to left to maintain positions
      const sortedRefs = [...analysis.references].sort((a, b) => b.position - a.position);

      for (const refInfo of sortedRefs) {
        const ref = refInfo.reference;
        
        // Only update if the column needs adjustment
        if (ref.column >= insertCol && !ref.columnAbsolute) {
          const adjustedRef: CellReference = {
            ...ref,
            column: ref.column + count
          };

          const originalText = refInfo.text;
          const newText = this.parser.stringifyCellReference(adjustedRef);
          
          updatedFormula = 
            updatedFormula.substring(0, refInfo.position) +
            newText +
            updatedFormula.substring(refInfo.position + refInfo.length);
        }
      }

      return ok(updatedFormula);
    } catch (error) {
      return err(`Failed to update formula for column insertion: ${error}`);
    }
  }

  /**
   * Update formula references when columns are deleted
   */
  updateForDeleteColumns(formula: string, deleteCol: number, count: number): Result<string, string> {
    try {
      const analysis = this.detector.analyzeFormula(formula);
      let updatedFormula = formula;

      // Process references from right to left to maintain positions
      const sortedRefs = [...analysis.references].sort((a, b) => b.position - a.position);

      for (const refInfo of sortedRefs) {
        const ref = refInfo.reference;
        
        if (ref.columnAbsolute) {
          // Absolute references don't change
          continue;
        }

        const originalText = refInfo.text;
        let newText: string;

        if (ref.column >= deleteCol && ref.column < deleteCol + count) {
          // Reference points to deleted column - becomes #REF!
          newText = "#REF!";
        } else if (ref.column >= deleteCol + count) {
          // Reference is after deleted columns - shift left
          const adjustedRef: CellReference = {
            ...ref,
            column: ref.column - count
          };
          newText = this.parser.stringifyCellReference(adjustedRef);
        } else {
          // Reference is before deleted columns - no change needed
          continue;
        }

        updatedFormula = 
          updatedFormula.substring(0, refInfo.position) +
          newText +
          updatedFormula.substring(refInfo.position + refInfo.length);
      }

      return ok(updatedFormula);
    } catch (error) {
      return err(`Failed to update formula for column deletion: ${error}`);
    }
  }

  /**
   * Generic update method that dispatches to appropriate handler
   */
  updateForStructuralChange(formula: string, change: StructuralChange): Result<string, string> {
    switch (change.type) {
      case "insertRow":
        return this.updateForInsertRows(formula, change.index, change.count);
      case "deleteRow":
        return this.updateForDeleteRows(formula, change.index, change.count);
      case "insertColumn":
        return this.updateForInsertColumns(formula, change.index, change.count);
      case "deleteColumn":
        return this.updateForDeleteColumns(formula, change.index, change.count);
      default:
        return err(`Unknown structural change type: ${(change as any).type}`);
    }
  }

  /**
   * Check if a formula contains any references that would be affected by a structural change
   */
  wouldBeAffected(formula: string, change: StructuralChange): boolean {
    try {
      const analysis = this.detector.analyzeFormula(formula);
      
      for (const refInfo of analysis.references) {
        const ref = refInfo.reference;
        
        switch (change.type) {
          case "insertRow":
          case "deleteRow":
            if (ref.row >= change.index && !ref.rowAbsolute) {
              return true;
            }
            break;
          case "insertColumn":
          case "deleteColumn":
            if (ref.column >= change.index && !ref.columnAbsolute) {
              return true;
            }
            break;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }
}
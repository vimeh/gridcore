import { DependencyGraph } from "./DependencyGraph";
import type { EvaluationContext } from "./formula/evaluator";
import type { Cell, CellAddress } from "./types";
import { cellAddressToString } from "./utils/cellAddress";
import type { Workbook } from "./Workbook";

export interface CrossSheetDependency {
  fromSheet: string;
  fromCell: CellAddress;
  toSheet: string;
  toCell: CellAddress;
}

export class WorkbookFormulaEngine {
  private workbook: Workbook;
  private crossSheetDependencies: Map<string, Set<string>>;

  constructor(workbook: Workbook) {
    this.workbook = workbook;
    this.crossSheetDependencies = new Map();
  }

  createEvaluationContext(
    sheetId: string,
    currentCell?: CellAddress,
  ): EvaluationContext {
    const sheet = this.workbook.getSheetById(sheetId);
    if (!sheet) {
      throw new Error(`Sheet ${sheetId} not found`);
    }

    const engine = sheet.getEngine();

    return {
      getCellValue: (addr: CellAddress) => engine.getCell(addr),
      getRangeValues: (start: CellAddress, end: CellAddress) => {
        const cells: Cell[] = [];
        for (let row = start.row; row <= end.row; row++) {
          for (let col = start.col; col <= end.col; col++) {
            const cell = engine.getCell({ row, col });
            if (cell) cells.push(cell);
          }
        }
        return cells;
      },
      currentCell,
      getSheetCellValue: (sheetName: string, address: CellAddress) => {
        const targetSheet = this.workbook.getSheetByName(sheetName);
        if (!targetSheet) {
          return undefined;
        }

        // Track cross-sheet dependency
        if (currentCell) {
          this.addCrossSheetDependency(
            sheetId,
            currentCell,
            targetSheet.getId(),
            address,
          );
        }

        return targetSheet.getEngine().getCell(address);
      },
      getSheetRangeValues: (
        sheetName: string,
        start: CellAddress,
        end: CellAddress,
      ) => {
        const targetSheet = this.workbook.getSheetByName(sheetName);
        if (!targetSheet) {
          return [];
        }

        const cells: Cell[] = [];
        const targetEngine = targetSheet.getEngine();

        for (let row = start.row; row <= end.row; row++) {
          for (let col = start.col; col <= end.col; col++) {
            const cellAddr = { row, col };

            // Track dependencies for each cell in the range
            if (currentCell) {
              this.addCrossSheetDependency(
                sheetId,
                currentCell,
                targetSheet.getId(),
                cellAddr,
              );
            }

            const cell = targetEngine.getCell(cellAddr);
            if (cell) cells.push(cell);
          }
        }

        return cells;
      },
    };
  }

  private addCrossSheetDependency(
    fromSheetId: string,
    fromCell: CellAddress,
    toSheetId: string,
    toCell: CellAddress,
  ): void {
    const fromKey = `${fromSheetId}!${cellAddressToString(fromCell)}`;
    const toKey = `${toSheetId}!${cellAddressToString(toCell)}`;

    if (!this.crossSheetDependencies.has(toKey)) {
      this.crossSheetDependencies.set(toKey, new Set());
    }

    this.crossSheetDependencies.get(toKey)!.add(fromKey);
  }

  removeCrossSheetDependencies(sheetId: string, cell: CellAddress): void {
    const cellKey = `${sheetId}!${cellAddressToString(cell)}`;

    // Remove as dependent
    this.crossSheetDependencies.delete(cellKey);

    // Remove as dependency
    for (const [key, deps] of this.crossSheetDependencies) {
      if (deps.has(cellKey)) {
        deps.delete(cellKey);
        if (deps.size === 0) {
          this.crossSheetDependencies.delete(key);
        }
      }
    }
  }

  getCrossSheetDependents(
    sheetId: string,
    cell: CellAddress,
  ): Array<{ sheetId: string; cell: CellAddress }> {
    const cellKey = `${sheetId}!${cellAddressToString(cell)}`;
    const dependents = this.crossSheetDependencies.get(cellKey);

    if (!dependents) {
      return [];
    }

    const result: Array<{ sheetId: string; cell: CellAddress }> = [];

    for (const dep of dependents) {
      const match = dep.match(/^(.+)!([A-Z]+)(\d+)$/);
      if (match) {
        const [, depSheetId, col, row] = match;
        result.push({
          sheetId: depSheetId,
          cell: {
            row: parseInt(row, 10) - 1,
            col: col.charCodeAt(0) - "A".charCodeAt(0),
          },
        });
      }
    }

    return result;
  }

  recalculateCrossSheetDependents(
    sheetId: string,
    changedCell: CellAddress,
  ): void {
    const dependents = this.getCrossSheetDependents(sheetId, changedCell);

    for (const { sheetId: depSheetId, cell: depCell } of dependents) {
      const depSheet = this.workbook.getSheetById(depSheetId);
      if (depSheet) {
        const depEngine = depSheet.getEngine();
        const depCellData = depEngine.getCell(depCell);

        if (depCellData?.formula) {
          // Re-evaluate the formula with cross-sheet context
          const context = this.createEvaluationContext(depSheetId, depCell);
          depEngine.evaluateFormulaWithContext(
            depCell,
            depCellData.formula,
            context,
          );
        }
      }
    }
  }

  clear(): void {
    this.crossSheetDependencies.clear();
  }

  toJSON() {
    const deps: CrossSheetDependency[] = [];

    for (const [toKey, fromKeys] of this.crossSheetDependencies) {
      const toMatch = toKey.match(/^(.+)!([A-Z]+)(\d+)$/);
      if (!toMatch) continue;

      const [, toSheetId, toCol, toRow] = toMatch;
      const toCell = {
        row: parseInt(toRow, 10) - 1,
        col: toCol.charCodeAt(0) - "A".charCodeAt(0),
      };

      for (const fromKey of fromKeys) {
        const fromMatch = fromKey.match(/^(.+)!([A-Z]+)(\d+)$/);
        if (!fromMatch) continue;

        const [, fromSheetId, fromCol, fromRow] = fromMatch;
        const fromCell = {
          row: parseInt(fromRow, 10) - 1,
          col: fromCol.charCodeAt(0) - "A".charCodeAt(0),
        };

        deps.push({
          fromSheet: fromSheetId,
          fromCell,
          toSheet: toSheetId,
          toCell,
        });
      }
    }

    return deps;
  }

  static fromJSON(
    deps: CrossSheetDependency[],
    workbook: Workbook,
  ): WorkbookFormulaEngine {
    const engine = new WorkbookFormulaEngine(workbook);

    for (const dep of deps) {
      engine.addCrossSheetDependency(
        dep.fromSheet,
        dep.fromCell,
        dep.toSheet,
        dep.toCell,
      );
    }

    return engine;
  }
}

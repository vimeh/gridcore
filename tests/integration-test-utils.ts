import { type CellAddress, SpreadsheetFacade } from "@gridcore/core";

/**
 * Creates a test spreadsheet with optional initial data
 */
export function createTestSpreadsheet(
  _rows = 100,
  _cols = 26,
): SpreadsheetFacade {
  // Create a new spreadsheet facade directly
  const facade = new SpreadsheetFacade();

  return facade;
}

/**
 * Populates spreadsheet with test formulas containing references
 */
export function populateWithFormulas(
  spreadsheet: SpreadsheetFacade,
  formulaCount = 10,
): void {
  const formulas = [
    "=A1+B1",
    "=$A$1+B2",
    "=SUM(A1:A10)",
    "=SUM($A$1:$A$10)",
    "=A1*$B$1",
    "=IF(A1>10,$C$1,D1)",
    "=VLOOKUP(A1,$B$1:$D$10,2,FALSE)",
    "=INDEX($A$1:$D$10,2,3)",
    "=A1+A2+A3",
    "=$A$1+$B$1+$C$1",
  ];

  for (let i = 0; i < Math.min(formulaCount, formulas.length); i++) {
    spreadsheet.setCellValue(i, 2, formulas[i]); // Column C
  }
}

/**
 * Measures operation execution time
 */
export async function measureOperationTime<T>(
  operation: () => T | Promise<T>,
): Promise<{ result: T; timeMs: number }> {
  const start = performance.now();
  const result = await operation();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

/**
 * Validates that all formula references are still valid after an operation
 */
export function validateReferences(
  spreadsheet: SpreadsheetFacade,
  expectedErrors: CellAddress[] = [],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const grid = spreadsheet.getGrid();

  // Check all cells for #REF! errors
  for (let row = 0; row < grid.getRowCount(); row++) {
    for (let col = 0; col < grid.getColumnCount(); col++) {
      const cell = grid.getCell(row, col);
      if (cell?.formula) {
        const value = cell.value;
        const isExpectedError = expectedErrors.some(
          (addr) => addr.row === row && addr.col === col,
        );

        if (
          typeof value === "string" &&
          value === "#REF!" &&
          !isExpectedError
        ) {
          errors.push(`Unexpected #REF! error at ${row},${col}`);
        } else if (isExpectedError && value !== "#REF!") {
          errors.push(`Expected #REF! error at ${row},${col} but got ${value}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Checks formula integrity by re-evaluating and comparing results
 */
export async function checkFormulaIntegrity(
  spreadsheet: SpreadsheetFacade,
  beforeValues: Map<string, unknown>,
): Promise<{ intact: boolean; changes: string[] }> {
  const changes: string[] = [];
  const grid = spreadsheet.getGrid();

  // Force re-evaluation
  await spreadsheet.evaluate();

  // Compare values
  for (let row = 0; row < grid.getRowCount(); row++) {
    for (let col = 0; col < grid.getColumnCount(); col++) {
      const cell = grid.getCell(row, col);
      if (cell?.formula) {
        const key = `${row},${col}`;
        const oldValue = beforeValues.get(key);
        const newValue = cell.value;

        if (
          oldValue !== newValue &&
          !(
            typeof oldValue === "number" &&
            typeof newValue === "number" &&
            Math.abs(oldValue - newValue) < 0.0001
          )
        ) {
          changes.push(`Cell ${key}: ${oldValue} → ${newValue}`);
        }
      }
    }
  }

  return { intact: changes.length === 0, changes };
}

/**
 * Captures current formula values for later comparison
 */
export function captureFormulaValues(
  spreadsheet: SpreadsheetFacade,
): Map<string, unknown> {
  const values = new Map<string, unknown>();
  const grid = spreadsheet.getGrid();

  for (let row = 0; row < grid.getRowCount(); row++) {
    for (let col = 0; col < grid.getColumnCount(); col++) {
      const cell = grid.getCell(row, col);
      if (cell?.formula) {
        values.set(`${row},${col}`, cell.value);
      }
    }
  }

  return values;
}

/**
 * Creates a large dataset for performance testing
 */
export function createLargeDataset(
  spreadsheet: SpreadsheetFacade,
  rows: number,
  cols: number,
  formulaRatio = 0.2,
): void {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() < formulaRatio) {
        // Create formula referencing nearby cells
        const refRow = Math.max(0, row - 1);
        const refCol = Math.max(0, col - 1);
        spreadsheet.setCellValue(row, col, `=A${refRow + 1}+B${refCol + 1}`);
      } else {
        // Set numeric value
        spreadsheet.setCellValue(row, col, Math.floor(Math.random() * 100));
      }
    }
  }
}

/**
 * Performance benchmarks
 */
export const PERFORMANCE_TARGETS = {
  columnSelection: { rows: 10000, targetMs: 50 },
  findReplace: { cells: 100000, targetMs: 1000 },
  insertDelete: { rows: 1000, targetMs: 200 },
  formulaFill: { cells: 10000, targetMs: 200 },
};

/**
 * Validates performance against targets
 */
export function validatePerformance(
  operation: keyof typeof PERFORMANCE_TARGETS,
  actualMs: number,
): { passed: boolean; message: string } {
  const target = PERFORMANCE_TARGETS[operation];
  const passed = actualMs <= target.targetMs;
  const ratio = (actualMs / target.targetMs).toFixed(2);

  return {
    passed,
    message: passed
      ? `✅ ${operation}: ${actualMs.toFixed(2)}ms (${ratio}x of target)`
      : `❌ ${operation}: ${actualMs.toFixed(2)}ms (${ratio}x of target)`,
  };
}

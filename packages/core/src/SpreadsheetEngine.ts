import { DependencyGraph } from "./DependencyGraph";
import type { ASTNode } from "./formula/ast";
import { type EvaluationContext, FormulaEvaluator } from "./formula/evaluator";
import { FormulaParser } from "./formula/parser";
import { Grid } from "./Grid";
import type { Cell, CellAddress, CellValueType, GridDimensions } from "./types";
import type {
  SpreadsheetState,
  SpreadsheetStateOptions,
} from "./types/SpreadsheetState";
import { cellAddressToString, parseCellAddress } from "./utils/cellAddress";
import { PivotTable } from "./pivot/PivotTable";
import type { PivotTableConfig, PivotTableOutput } from "./pivot/PivotTypes";

export interface SpreadsheetChangeEvent {
  type: "cell-change" | "batch-change";
  cells: Array<{ address: CellAddress; oldValue?: Cell; newValue?: Cell }>;
}

export type SpreadsheetChangeListener = (event: SpreadsheetChangeEvent) => void;

export class SpreadsheetEngine {
  private grid: Grid;
  private dependencyGraph: DependencyGraph;
  private evaluator: FormulaEvaluator;
  private parser: FormulaParser;
  private listeners: Set<SpreadsheetChangeListener>;
  private isCalculating: boolean = false;
  private calculationQueue: Set<string> = new Set();
  private pivotTables: Map<string, { table: PivotTable; outputCell: CellAddress }> = new Map();

  constructor(rows: number = 1000, cols: number = 26) {
    this.grid = new Grid(rows, cols);
    this.dependencyGraph = new DependencyGraph();
    this.evaluator = new FormulaEvaluator();
    this.parser = new FormulaParser();
    this.listeners = new Set();
  }

  // Event handling
  addEventListener(listener: SpreadsheetChangeListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: SpreadsheetChangeListener): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(event: SpreadsheetChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // Cell operations
  getCell(address: CellAddress): Cell | undefined {
    return this.grid.getCell(address);
  }

  getCellByReference(reference: string): Cell | undefined {
    return this.grid.getCellByReference(reference);
  }

  setCell(address: CellAddress, value: CellValueType, formula?: string): void {
    const oldCell = this.grid.getCell(address);

    // Remove old dependencies
    this.dependencyGraph.removeDependencies(address);

    // Set the raw value
    this.grid.setCell(address, value, formula);

    // If it's a formula, parse and evaluate it
    if (formula?.startsWith("=")) {
      this.evaluateFormula(address, formula);
    }

    // Trigger recalculation of dependent cells
    this.recalculateDependents(address);

    // Notify listeners
    const newCell = this.grid.getCell(address);
    this.notifyListeners({
      type: "cell-change",
      cells: [{ address, oldValue: oldCell, newValue: newCell }],
    });
  }

  setCellByReference(
    reference: string,
    value: CellValueType,
    formula?: string,
  ): void {
    const address = parseCellAddress(reference);
    if (!address) {
      throw new Error(`Invalid cell reference: ${reference}`);
    }
    this.setCell(address, value, formula);
  }

  private evaluateFormula(address: CellAddress, formula: string): void {
    try {
      // Parse the formula to extract dependencies
      const parseResult = this.parser.parse(formula);
      if (parseResult.error) {
        const cell = this.grid.getCell(address);
        if (cell) {
          cell.error = parseResult.error.message;
          cell.computedValue = parseResult.error.message;
        }
        return;
      }

      if (!parseResult.ast) {
        return;
      }

      // Extract cell references from AST
      const dependencies = this.extractDependencies(parseResult.ast);

      // Check for circular dependencies
      for (const dep of dependencies) {
        if (this.dependencyGraph.hasCycle(address, dep)) {
          const cell = this.grid.getCell(address);
          if (cell) {
            cell.error = "#CIRCULAR!";
            cell.computedValue = "#CIRCULAR!";
          }
          return;
        }
        this.dependencyGraph.addDependency(address, dep);
      }

      // Create evaluation context
      const context: EvaluationContext = {
        getCellValue: (addr: CellAddress) => this.grid.getCell(addr),
        getRangeValues: (start: CellAddress, end: CellAddress) => {
          const cells: Cell[] = [];
          for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
              const cell = this.grid.getCell({ row, col });
              if (cell) cells.push(cell);
            }
          }
          return cells;
        },
        currentCell: address,
      };

      // Evaluate the formula
      const result = this.evaluator.evaluate(formula, context);
      const cell = this.grid.getCell(address);

      if (cell) {
        if (result.error) {
          cell.error = result.error;
          cell.computedValue = result.error;
        } else {
          cell.error = undefined;
          cell.computedValue = result.value;
        }
      }
    } catch (error) {
      const cell = this.grid.getCell(address);
      if (cell) {
        cell.error = error instanceof Error ? error.message : "Unknown error";
        cell.computedValue = cell.error;
      }
    }
  }

  private extractDependencies(node: ASTNode): CellAddress[] {
    const dependencies: CellAddress[] = [];

    const traverse = (n: ASTNode) => {
      if (!n) return;

      if (n.type === "cell") {
        dependencies.push(n.address);
      } else if (n.type === "range") {
        // Add all cells in the range as dependencies
        const { start, end } = n.range;
        for (let row = start.row; row <= end.row; row++) {
          for (let col = start.col; col <= end.col; col++) {
            dependencies.push({ row, col });
          }
        }
      } else if (n.type === "binary") {
        traverse(n.left);
        traverse(n.right);
      } else if (n.type === "unary") {
        traverse(n.operand);
      } else if (n.type === "function") {
        for (const arg of n.args) {
          traverse(arg);
        }
      }
    };

    traverse(node);
    return dependencies;
  }

  private recalculateDependents(changedCell: CellAddress): void {
    if (this.isCalculating) {
      // Add to queue for later processing
      this.calculationQueue.add(cellAddressToString(changedCell));
      return;
    }

    this.isCalculating = true;
    const changes: Array<{
      address: CellAddress;
      oldValue?: Cell;
      newValue?: Cell;
    }> = [];

    try {
      // Get all cells that need recalculation
      const cellsToRecalculate = this.dependencyGraph.getCalculationOrder([
        changedCell,
      ]);

      // Skip the first cell (the one that changed)
      for (let i = 1; i < cellsToRecalculate.length; i++) {
        const address = cellsToRecalculate[i];
        const cell = this.grid.getCell(address);

        if (cell?.formula) {
          const oldValue = { ...cell };
          this.evaluateFormula(address, cell.formula);
          const newValue = this.grid.getCell(address);
          changes.push({ address, oldValue, newValue });
        }
      }

      // Notify listeners of batch changes
      if (changes.length > 0) {
        this.notifyListeners({
          type: "batch-change",
          cells: changes,
        });
      }
    } finally {
      this.isCalculating = false;

      // Process any queued calculations
      if (this.calculationQueue.size > 0) {
        const queue = Array.from(this.calculationQueue);
        this.calculationQueue.clear();

        for (const cellKey of queue) {
          const [col, row] = cellKey.split(/(\d+)/);
          const address = parseCellAddress(col + row);
          if (address) {
            this.recalculateDependents(address);
          }
        }
      }
    }
  }

  // Batch operations
  setCells(
    updates: Array<{
      address: CellAddress;
      value: CellValueType;
      formula?: string;
    }>,
  ): void {
    const changes: Array<{
      address: CellAddress;
      oldValue?: Cell;
      newValue?: Cell;
    }> = [];

    // First pass: set all values without triggering recalculation
    for (const update of updates) {
      const oldCell = this.grid.getCell(update.address);
      this.dependencyGraph.removeDependencies(update.address);
      this.grid.setCell(update.address, update.value, update.formula);

      if (update.formula?.startsWith("=")) {
        this.evaluateFormula(update.address, update.formula);
      }

      const newCell = this.grid.getCell(update.address);
      changes.push({
        address: update.address,
        oldValue: oldCell,
        newValue: newCell,
      });
    }

    // Second pass: recalculate all dependents
    const allDependents = new Set<string>();
    for (const update of updates) {
      const dependents = this.dependencyGraph.getDependents(update.address);
      for (const dep of dependents) {
        allDependents.add(cellAddressToString(dep));
      }
    }

    // Calculate in proper order
    if (allDependents.size > 0) {
      const addresses = Array.from(allDependents)
        .map((key) => {
          const match = key.match(/^([A-Z]+)(\d+)$/);
          if (!match) return null;
          return parseCellAddress(key);
        })
        .filter((addr) => addr !== null) as CellAddress[];

      const orderedCells = this.dependencyGraph.getCalculationOrder(addresses);

      for (const address of orderedCells) {
        const cell = this.grid.getCell(address);
        if (cell?.formula) {
          const oldValue = { ...cell };
          this.evaluateFormula(address, cell.formula);
          const newValue = this.grid.getCell(address);
          changes.push({ address, oldValue, newValue });
        }
      }
    }

    // Notify listeners
    this.notifyListeners({
      type: "batch-change",
      cells: changes,
    });
  }

  // Grid operations
  clearCell(address: CellAddress): void {
    const oldCell = this.grid.getCell(address);
    this.dependencyGraph.removeDependencies(address);
    this.grid.clearCell(address);
    this.recalculateDependents(address);

    this.notifyListeners({
      type: "cell-change",
      cells: [{ address, oldValue: oldCell, newValue: undefined }],
    });
  }

  clear(): void {
    const allCells = this.grid.getNonEmptyCells();
    this.grid.clear();
    this.dependencyGraph.clear();

    this.notifyListeners({
      type: "batch-change",
      cells: allCells.map(({ address, cell }) => ({
        address,
        oldValue: cell,
        newValue: undefined,
      })),
    });
  }

  // Getters
  getDimensions(): GridDimensions {
    return this.grid.getDimensions();
  }

  getNonEmptyCells(): Array<{ address: CellAddress; cell: Cell }> {
    return this.grid.getNonEmptyCells();
  }

  getUsedRange(): { start: CellAddress; end: CellAddress } | null {
    return this.grid.getUsedRange();
  }

  getAllCells(): Map<string, Cell> {
    return this.grid.getAllCells();
  }

  getCellCount(): number {
    return this.grid.getCellCount();
  }

  // Serialization
  toJSON(): {
    grid: ReturnType<Grid["toJSON"]>;
    dependencies: ReturnType<DependencyGraph["toJSON"]>;
  } {
    return {
      grid: this.grid.toJSON(),
      dependencies: this.dependencyGraph.toJSON(),
    };
  }

  // New serialization format with view state
  toState(options: SpreadsheetStateOptions = {}): SpreadsheetState {
    const state: SpreadsheetState = {
      version: "1.0",
      dimensions: this.grid.getDimensions(),
      cells: this.grid.toJSON().cells,
      dependencies: this.dependencyGraph.toJSON(),
    };

    if (options.includeMetadata) {
      state.metadata = {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };
    }

    // View properties will be added by the UI layer
    return state;
  }

  static fromJSON(data: {
    grid: ReturnType<Grid["toJSON"]>;
    dependencies: ReturnType<DependencyGraph["toJSON"]>;
  }): SpreadsheetEngine {
    const dimensions = data.grid.dimensions;
    const engine = new SpreadsheetEngine(dimensions.rows, dimensions.cols);

    // Restore grid data
    for (const { address, cell } of data.grid.cells) {
      engine.grid.setCell(address, cell.rawValue, cell.formula);
      const engineCell = engine.grid.getCell(address);
      if (engineCell) {
        engineCell.computedValue = cell.computedValue;
        engineCell.error = cell.error;
        engineCell.style = cell.style;
      }
    }

    // Restore dependencies
    engine.dependencyGraph = DependencyGraph.fromJSON(data.dependencies);

    // Recalculate all formulas
    const formulaCells = data.grid.cells.filter((item) => item.cell.formula);
    for (const { address, cell } of formulaCells) {
      if (cell.formula) {
        engine.evaluateFormula(address, cell.formula);
      }
    }

    return engine;
  }

  static fromState(state: SpreadsheetState): SpreadsheetEngine {
    const engine = new SpreadsheetEngine(
      state.dimensions.rows,
      state.dimensions.cols,
    );

    // Restore cells
    for (const { address, cell } of state.cells) {
      // For formula cells, use the formula value directly
      if (cell.formula) {
        engine.setCell(address, cell.formula, cell.formula);
      } else {
        engine.grid.setCell(address, cell.rawValue, cell.formula);
        const engineCell = engine.grid.getCell(address);
        if (engineCell) {
          engineCell.computedValue = cell.computedValue;
          engineCell.error = cell.error;
          engineCell.style = cell.style;
        }
      }
    }

    // Restore dependencies
    engine.dependencyGraph = DependencyGraph.fromJSON(state.dependencies);

    return engine;
  }

  // Utility methods
  parseCellKey(key: string): CellAddress {
    return this.grid.parseCellKey(key);
  }

  updateCellStyle(address: CellAddress, style: Partial<Cell["style"]>): void {
    this.grid.updateCellStyle(address, style);
  }

  // Pivot table methods
  addPivotTable(
    id: string,
    config: PivotTableConfig,
    outputCell: CellAddress
  ): PivotTable {
    const pivotTable = new PivotTable(config);
    this.pivotTables.set(id, { table: pivotTable, outputCell });
    this.refreshPivotTable(id);
    return pivotTable;
  }

  removePivotTable(id: string): boolean {
    const pivot = this.pivotTables.get(id);
    if (!pivot) return false;

    // Clear the output area
    const output = pivot.table.getLastOutput();
    if (output) {
      const { topLeft, dimensions } = output;
      for (let row = 0; row < dimensions.rows; row++) {
        for (let col = 0; col < dimensions.cols; col++) {
          this.clearCell({
            row: topLeft.row + row,
            col: topLeft.col + col
          });
        }
      }
    }

    this.pivotTables.delete(id);
    return true;
  }

  getPivotTable(id: string): PivotTable | undefined {
    return this.pivotTables.get(id)?.table;
  }

  refreshPivotTable(id: string): PivotTableOutput | null {
    const pivot = this.pivotTables.get(id);
    if (!pivot) return null;

    // Generate the pivot table
    const output = pivot.table.generate(this.grid, pivot.outputCell);

    // Clear the old output area if it exists
    const lastOutput = pivot.table.getLastOutput();
    if (lastOutput && lastOutput !== output) {
      const { topLeft, dimensions } = lastOutput;
      for (let row = 0; row < dimensions.rows; row++) {
        for (let col = 0; col < dimensions.cols; col++) {
          const address = {
            row: topLeft.row + row,
            col: topLeft.col + col
          };
          if (!output.cells.has(this.grid.getCellKey(address))) {
            this.clearCell(address);
          }
        }
      }
    }

    // Write the pivot table output to the grid
    const changes: Array<{
      address: CellAddress;
      value: CellValueType;
    }> = [];

    for (const [key, value] of output.cells) {
      const [row, col] = key.split(",").map(Number);
      const address = { row, col };
      changes.push({ address, value });
    }

    // Apply all changes in batch
    this.setCells(changes);

    return output;
  }

  refreshAllPivotTables(): void {
    for (const [id] of this.pivotTables) {
      this.refreshPivotTable(id);
    }
  }

  getAllPivotTables(): Map<string, { table: PivotTable; outputCell: CellAddress }> {
    return new Map(this.pivotTables);
  }
}

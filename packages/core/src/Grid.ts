import { Cell, CellAddress, CellValueType, GridDimensions } from "./types";
import { parseCellAddress } from "./utils/cellAddress";

export class Grid {
  private cells: Map<string, Cell>;
  private dimensions: GridDimensions;

  constructor(rows: number = 1000, cols: number = 26) {
    this.cells = new Map();
    this.dimensions = { rows, cols };
  }

  private getCellKey(address: CellAddress): string {
    return `${address.row},${address.col}`;
  }

  parseCellKey(key: string): CellAddress {
    const [row, col] = key.split(",").map(Number);
    return { row, col };
  }

  getCell(address: CellAddress): Cell | undefined {
    return this.cells.get(this.getCellKey(address));
  }

  getCellByReference(reference: string): Cell | undefined {
    const address = parseCellAddress(reference);
    if (!address) return undefined;
    return this.getCell(address);
  }

  setCell(address: CellAddress, value: CellValueType, formula?: string): void {
    if (!this.isValidAddress(address)) {
      throw new Error(
        `Invalid cell address: row ${address.row}, col ${address.col}`,
      );
    }

    const cell: Cell = {
      rawValue: value,
      computedValue: value,
      formula,
    };

    this.cells.set(this.getCellKey(address), cell);
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

  updateCellStyle(address: CellAddress, style: Partial<Cell["style"]>): void {
    const cell = this.getCell(address);
    if (cell) {
      cell.style = { ...cell.style, ...style };
    }
  }

  clearCell(address: CellAddress): void {
    this.cells.delete(this.getCellKey(address));
  }

  clearCellByReference(reference: string): void {
    const address = parseCellAddress(reference);
    if (address) {
      this.clearCell(address);
    }
  }

  isValidAddress(address: CellAddress): boolean {
    return (
      address.row >= 0 &&
      address.row < this.dimensions.rows &&
      address.col >= 0 &&
      address.col < this.dimensions.cols
    );
  }

  getDimensions(): GridDimensions {
    return { ...this.dimensions };
  }

  getNonEmptyCells(): Array<{ address: CellAddress; cell: Cell }> {
    const result: Array<{ address: CellAddress; cell: Cell }> = [];

    for (const [key, cell] of this.cells) {
      const address = this.parseCellKey(key);
      result.push({ address, cell });
    }

    return result.sort((a, b) => {
      if (a.address.row !== b.address.row) {
        return a.address.row - b.address.row;
      }
      return a.address.col - b.address.col;
    });
  }

  getUsedRange(): { start: CellAddress; end: CellAddress } | null {
    const nonEmptyCells = this.getNonEmptyCells();
    if (nonEmptyCells.length === 0) return null;

    let minRow = Infinity,
      maxRow = -Infinity;
    let minCol = Infinity,
      maxCol = -Infinity;

    for (const { address } of nonEmptyCells) {
      minRow = Math.min(minRow, address.row);
      maxRow = Math.max(maxRow, address.row);
      minCol = Math.min(minCol, address.col);
      maxCol = Math.max(maxCol, address.col);
    }

    return {
      start: { row: minRow, col: minCol },
      end: { row: maxRow, col: maxCol },
    };
  }

  getAllCells(): Map<string, Cell> {
    return this.cells;
  }

  clear(): void {
    this.cells.clear();
  }

  getCellCount(): number {
    return this.cells.size;
  }

  clone(): Grid {
    const newGrid = new Grid(this.dimensions.rows, this.dimensions.cols);

    for (const [key, cell] of this.cells) {
      newGrid.cells.set(key, {
        rawValue: cell.rawValue,
        computedValue: cell.computedValue,
        formula: cell.formula,
        style: cell.style ? { ...cell.style } : undefined,
        error: cell.error,
      });
    }

    return newGrid;
  }

  toJSON(): any {
    return {
      dimensions: this.dimensions,
      cells: Array.from(this.cells.entries()).map(([key, cell]) => ({
        address: this.parseCellKey(key),
        cell,
      })),
    };
  }

  static fromJSON(data: any): Grid {
    const grid = new Grid(data.dimensions.rows, data.dimensions.cols);

    for (const { address, cell } of data.cells) {
      grid.cells.set(grid.getCellKey(address), cell);
    }

    return grid;
  }
}

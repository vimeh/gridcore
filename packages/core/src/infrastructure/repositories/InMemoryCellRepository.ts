import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import type { Cell } from "../../domain/models/Cell";
import type { CellAddress } from "../../domain/models/CellAddress";
import type { CellRange } from "../../domain/models/CellRange";

export class InMemoryCellRepository implements ICellRepository {
  private cells = new Map<string, Cell>();

  get(address: CellAddress): Cell | undefined {
    return this.cells.get(address.toString());
  }

  set(address: CellAddress, cell: Cell): void {
    this.cells.set(address.toString(), cell);
  }

  delete(address: CellAddress): void {
    this.cells.delete(address.toString());
  }

  clear(): void {
    this.cells.clear();
  }

  getAllInRange(range: CellRange): Map<string, Cell> {
    const result = new Map<string, Cell>();

    for (const address of range.cells()) {
      const cell = this.get(address);
      if (cell) {
        result.set(address.toString(), cell);
      }
    }

    return result;
  }

  getAll(): Map<string, Cell> {
    return new Map(this.cells);
  }

  count(): number {
    return this.cells.size;
  }
}

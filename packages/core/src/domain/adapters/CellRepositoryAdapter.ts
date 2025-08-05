import type { ICellRepository } from "../interfaces/ICellRepository";
import type { Cell } from "../models/Cell";
import type { CellAddress } from "../models/CellAddress";
import type { CellRange } from "../models/CellRange";

/**
 * Adapter that provides both the new ICellRepository interface
 * and legacy getCell/setCell methods for compatibility
 */
export class CellRepositoryAdapter implements ICellRepository {
  constructor(private readonly repository: ICellRepository) {}

  // Standard ICellRepository methods
  get(address: CellAddress): Cell | undefined {
    return this.repository.get(address);
  }

  set(address: CellAddress, cell: Cell): void {
    this.repository.set(address, cell);
  }

  delete(address: CellAddress): void {
    this.repository.delete(address);
  }

  clear(): void {
    this.repository.clear();
  }

  getAllInRange(range: CellRange): Map<string, Cell> {
    return this.repository.getAllInRange(range);
  }

  getAll(): Map<string, Cell> {
    return this.repository.getAll();
  }

  count(): number {
    return this.repository.count();
  }

  // Legacy methods for compatibility with fill and bulk-ops features
  getCell(address: CellAddress): Cell | undefined {
    return this.get(address);
  }

  setCell(address: CellAddress, cell: Cell): void {
    this.set(address, cell);
  }
}

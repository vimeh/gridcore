import type { Cell } from "../models/Cell";
import type { CellAddress } from "../models/CellAddress";
import type { CellRange } from "../models/CellRange";

export interface ICellRepository {
  get(address: CellAddress): Cell | undefined;
  set(address: CellAddress, cell: Cell): void;
  delete(address: CellAddress): void;
  clear(): void;
  getAllInRange(range: CellRange): Map<string, Cell>;
  getAll(): Map<string, Cell>;
  count(): number;
}

import type { CellAddress } from "../models/CellAddress";

export interface IDependencyRepository {
  addDependency(from: CellAddress, to: CellAddress): void;
  removeDependency(from: CellAddress, to: CellAddress): void;
  getDependents(address: CellAddress): Set<CellAddress>;
  getDependencies(address: CellAddress): Set<CellAddress>;
  clearDependencies(address: CellAddress): void;
  clearAll(): void;
  hasCycle(from: CellAddress, to: CellAddress): boolean;
  getTopologicalOrder(startingCells: CellAddress[]): CellAddress[];
}

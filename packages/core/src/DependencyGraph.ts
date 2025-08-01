import type { CellAddress } from "./types";
import { cellAddressToString } from "./utils/cellAddress";

export class DependencyGraph {
  // Map from cell to cells that depend on it
  private dependents: Map<string, Set<string>>;
  // Map from cell to cells it depends on
  private dependencies: Map<string, Set<string>>;

  constructor() {
    this.dependents = new Map();
    this.dependencies = new Map();
  }

  private getCellKey(address: CellAddress): string {
    return cellAddressToString(address);
  }

  addDependency(from: CellAddress, to: CellAddress): void {
    const fromKey = this.getCellKey(from);
    const toKey = this.getCellKey(to);

    // Add to dependencies
    if (!this.dependencies.has(fromKey)) {
      this.dependencies.set(fromKey, new Set());
    }
    this.dependencies.get(fromKey)!.add(toKey);

    // Add to dependents
    if (!this.dependents.has(toKey)) {
      this.dependents.set(toKey, new Set());
    }
    this.dependents.get(toKey)!.add(fromKey);
  }

  removeDependencies(cell: CellAddress): void {
    const cellKey = this.getCellKey(cell);

    // Remove this cell from all its dependencies' dependents
    const deps = this.dependencies.get(cellKey);
    if (deps) {
      for (const dep of deps) {
        const dependents = this.dependents.get(dep);
        if (dependents) {
          dependents.delete(cellKey);
          if (dependents.size === 0) {
            this.dependents.delete(dep);
          }
        }
      }
    }

    // Remove this cell's dependencies
    this.dependencies.delete(cellKey);
  }

  getDependencies(cell: CellAddress): CellAddress[] {
    const cellKey = this.getCellKey(cell);
    const deps = this.dependencies.get(cellKey);
    if (!deps) return [];

    return Array.from(deps).map((key) => {
      const match = key.match(/^([A-Z]+)(\d+)$/);
      if (!match) throw new Error(`Invalid cell key: ${key}`);
      const col =
        match[1]
          .split("")
          .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
      return {
        col,
        row: parseInt(match[2]) - 1,
      };
    });
  }

  getDependents(cell: CellAddress): CellAddress[] {
    const cellKey = this.getCellKey(cell);
    const deps = this.dependents.get(cellKey);
    if (!deps) return [];

    return Array.from(deps).map((key) => {
      const match = key.match(/^([A-Z]+)(\d+)$/);
      if (!match) throw new Error(`Invalid cell key: ${key}`);
      const col =
        match[1]
          .split("")
          .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
      return {
        col,
        row: parseInt(match[2]) - 1,
      };
    });
  }

  getCalculationOrder(changedCells: CellAddress[]): CellAddress[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    // Get all cells that need recalculation
    const toProcess = new Set<string>();
    for (const cell of changedCells) {
      this.collectAffectedCells(cell, toProcess);
    }

    // Perform topological sort
    for (const cellKey of toProcess) {
      if (!visited.has(cellKey)) {
        this.topologicalSort(cellKey, visited, visiting, order);
      }
    }

    // Convert back to CellAddress
    return order.map((key) => {
      const match = key.match(/^([A-Z]+)(\d+)$/);
      if (!match) throw new Error(`Invalid cell key: ${key}`);
      const col =
        match[1]
          .split("")
          .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
      return {
        col,
        row: parseInt(match[2]) - 1,
      };
    });
  }

  private collectAffectedCells(cell: CellAddress, affected: Set<string>): void {
    const cellKey = this.getCellKey(cell);
    if (affected.has(cellKey)) return;

    affected.add(cellKey);

    const dependents = this.dependents.get(cellKey);
    if (dependents) {
      for (const dependent of dependents) {
        const match = dependent.match(/^([A-Z]+)(\d+)$/);
        if (!match) continue;
        const col =
          match[1]
            .split("")
            .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
        const depCell = {
          col,
          row: parseInt(match[2]) - 1,
        };
        this.collectAffectedCells(depCell, affected);
      }
    }
  }

  private topologicalSort(
    cellKey: string,
    visited: Set<string>,
    visiting: Set<string>,
    order: string[],
  ): void {
    if (visited.has(cellKey)) return;

    if (visiting.has(cellKey)) {
      throw new Error(`Circular dependency detected involving cell ${cellKey}`);
    }

    visiting.add(cellKey);

    const deps = this.dependencies.get(cellKey);
    if (deps) {
      for (const dep of deps) {
        this.topologicalSort(dep, visited, visiting, order);
      }
    }

    visiting.delete(cellKey);
    visited.add(cellKey);
    order.push(cellKey);
  }

  hasCycle(from: CellAddress, to: CellAddress): boolean {
    const fromKey = this.getCellKey(from);
    const toKey = this.getCellKey(to);

    // Check if adding this dependency would create a cycle
    const visited = new Set<string>();
    return this.wouldCreateCycle(toKey, fromKey, visited);
  }

  private wouldCreateCycle(
    current: string,
    target: string,
    visited: Set<string>,
  ): boolean {
    if (current === target) return true;
    if (visited.has(current)) return false;

    visited.add(current);

    const deps = this.dependencies.get(current);
    if (deps) {
      for (const dep of deps) {
        if (this.wouldCreateCycle(dep, target, visited)) {
          return true;
        }
      }
    }

    return false;
  }

  clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
  }

  toJSON(): any {
    return {
      dependencies: Array.from(this.dependencies.entries()).map(
        ([key, deps]) => ({
          cell: key,
          deps: Array.from(deps),
        }),
      ),
      dependents: Array.from(this.dependents.entries()).map(([key, deps]) => ({
        cell: key,
        deps: Array.from(deps),
      })),
    };
  }

  static fromJSON(data: any): DependencyGraph {
    const graph = new DependencyGraph();

    for (const { cell, deps } of data.dependencies) {
      graph.dependencies.set(cell, new Set(deps));
    }

    for (const { cell, deps } of data.dependents) {
      graph.dependents.set(cell, new Set(deps));
    }

    return graph;
  }
}

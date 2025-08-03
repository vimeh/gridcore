import type { IDependencyRepository } from "../../domain/interfaces/IDependencyRepository";
import { CellAddress } from "../../domain/models/CellAddress";

export class InMemoryDependencyRepository implements IDependencyRepository {
  private dependencies = new Map<string, Set<string>>();
  private dependents = new Map<string, Set<string>>();

  addDependency(from: CellAddress, to: CellAddress): void {
    const fromKey = from.toString();
    const toKey = to.toString();

    if (!this.dependencies.has(fromKey)) {
      this.dependencies.set(fromKey, new Set());
    }
    this.dependencies.get(fromKey)!.add(toKey);

    if (!this.dependents.has(toKey)) {
      this.dependents.set(toKey, new Set());
    }
    this.dependents.get(toKey)!.add(fromKey);
  }

  removeDependency(from: CellAddress, to: CellAddress): void {
    const fromKey = from.toString();
    const toKey = to.toString();

    this.dependencies.get(fromKey)?.delete(toKey);
    if (this.dependencies.get(fromKey)?.size === 0) {
      this.dependencies.delete(fromKey);
    }

    this.dependents.get(toKey)?.delete(fromKey);
    if (this.dependents.get(toKey)?.size === 0) {
      this.dependents.delete(toKey);
    }
  }

  getDependents(address: CellAddress): Set<CellAddress> {
    const key = address.toString();
    const dependentKeys = this.dependents.get(key) || new Set<string>();
    const result = new Set<CellAddress>();

    for (const depKey of dependentKeys) {
      const parsed = CellAddress.fromString(depKey);
      if (parsed.ok) {
        result.add(parsed.value);
      }
    }

    return result;
  }

  getDependencies(address: CellAddress): Set<CellAddress> {
    const key = address.toString();
    const dependencyKeys = this.dependencies.get(key) || new Set<string>();
    const result = new Set<CellAddress>();

    for (const depKey of dependencyKeys) {
      const parsed = CellAddress.fromString(depKey);
      if (parsed.ok) {
        result.add(parsed.value);
      }
    }

    return result;
  }

  clearDependencies(address: CellAddress): void {
    const key = address.toString();
    const deps = this.dependencies.get(key);

    if (deps) {
      for (const depKey of deps) {
        this.dependents.get(depKey)?.delete(key);
        if (this.dependents.get(depKey)?.size === 0) {
          this.dependents.delete(depKey);
        }
      }
      this.dependencies.delete(key);
    }
  }

  clearAll(): void {
    this.dependencies.clear();
    this.dependents.clear();
  }

  hasCycle(from: CellAddress, to: CellAddress): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const hasCycleDFS = (node: string): boolean => {
      if (stack.has(node)) {
        return true;
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      stack.add(node);

      const deps = this.dependencies.get(node) || new Set<string>();
      for (const dep of deps) {
        if (hasCycleDFS(dep)) {
          return true;
        }
      }

      stack.delete(node);
      return false;
    };

    const tempDeps =
      this.dependencies.get(from.toString()) || new Set<string>();
    const newDeps = new Set(tempDeps);
    newDeps.add(to.toString());
    this.dependencies.set(from.toString(), newDeps);

    const result = hasCycleDFS(from.toString());

    this.dependencies.set(from.toString(), tempDeps);

    return result;
  }

  getTopologicalOrder(startingCells: CellAddress[]): CellAddress[] {
    // This method returns cells in evaluation order. It includes:
    // 1. The starting cells
    // 2. All cells that the starting cells depend on (transitively)
    // 3. All cells that depend on the starting cells (transitively)
    // The order ensures that dependencies are evaluated before dependents.

    const visited = new Set<string>();
    const result: CellAddress[] = [];
    const allRelevantCells = new Set<string>();

    // First, collect all relevant cells (starting cells, their dependencies, and their dependents)
    const collectRelevantCells = (address: CellAddress) => {
      const key = address.toString();
      if (allRelevantCells.has(key)) {
        return;
      }
      allRelevantCells.add(key);

      // Collect all dependencies (cells this cell depends on)
      const deps = this.getDependencies(address);
      for (const dep of deps) {
        collectRelevantCells(dep);
      }

      // Collect all dependents (cells that depend on this cell)
      const dependents = this.getDependents(address);
      for (const dependent of dependents) {
        collectRelevantCells(dependent);
      }
    };

    // Collect all relevant cells
    for (const cell of startingCells) {
      collectRelevantCells(cell);
    }

    // Perform topological sort using DFS
    const visit = (address: CellAddress) => {
      const key = address.toString();
      if (visited.has(key)) {
        return;
      }

      visited.add(key);

      // First visit all dependencies (cells this cell depends on)
      const deps = this.getDependencies(address);
      for (const dep of deps) {
        visit(dep);
      }

      // Then add this cell to the result
      result.push(address);
    };

    // Visit all relevant cells
    for (const key of allRelevantCells) {
      const parsed = CellAddress.fromString(key);
      if (parsed.ok) {
        visit(parsed.value);
      }
    }

    return result;
  }
}

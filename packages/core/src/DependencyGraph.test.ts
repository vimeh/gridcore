import { describe, test, expect, beforeEach } from 'bun:test';
import { DependencyGraph } from './DependencyGraph';
import { CellAddress } from './types';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('basic operations', () => {
    test('adds dependencies', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      
      graph.addDependency(a1, b1);
      
      expect(graph.getDependencies(a1)).toContainEqual(b1);
      expect(graph.getDependents(b1)).toContainEqual(a1);
    });

    test('handles multiple dependencies', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      graph.addDependency(a1, b1);
      graph.addDependency(a1, c1);
      
      const deps = graph.getDependencies(a1);
      expect(deps).toHaveLength(2);
      expect(deps).toContainEqual(b1);
      expect(deps).toContainEqual(c1);
    });

    test('handles multiple dependents', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      graph.addDependency(a1, c1);
      graph.addDependency(b1, c1);
      
      const deps = graph.getDependents(c1);
      expect(deps).toHaveLength(2);
      expect(deps).toContainEqual(a1);
      expect(deps).toContainEqual(b1);
    });

    test('removes dependencies', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      graph.addDependency(a1, b1);
      graph.addDependency(a1, c1);
      
      graph.removeDependencies(a1);
      
      expect(graph.getDependencies(a1)).toHaveLength(0);
      expect(graph.getDependents(b1)).toHaveLength(0);
      expect(graph.getDependents(c1)).toHaveLength(0);
    });
  });

  describe('cycle detection', () => {
    test('detects direct cycle', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      
      graph.addDependency(a1, b1);
      
      expect(graph.hasCycle(b1, a1)).toBe(true);
    });

    test('detects indirect cycle', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      graph.addDependency(a1, b1);
      graph.addDependency(b1, c1);
      
      expect(graph.hasCycle(c1, a1)).toBe(true);
    });

    test('no cycle for valid dependencies', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      graph.addDependency(a1, b1);
      graph.addDependency(a1, c1);
      
      expect(graph.hasCycle(b1, c1)).toBe(false);
    });

    test('self-reference is a cycle', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      
      expect(graph.hasCycle(a1, a1)).toBe(true);
    });
  });

  describe('calculation order', () => {
    test('simple chain', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      // C1 depends on B1, B1 depends on A1
      graph.addDependency(b1, a1);
      graph.addDependency(c1, b1);
      
      const order = graph.getCalculationOrder([a1]);
      
      expect(order).toHaveLength(3);
      expect(order[0]).toEqual(a1);
      expect(order[1]).toEqual(b1);
      expect(order[2]).toEqual(c1);
    });

    test('diamond dependency', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      const d1: CellAddress = { row: 0, col: 3 };
      
      // D1 depends on B1 and C1, both depend on A1
      graph.addDependency(b1, a1);
      graph.addDependency(c1, a1);
      graph.addDependency(d1, b1);
      graph.addDependency(d1, c1);
      
      const order = graph.getCalculationOrder([a1]);
      
      expect(order).toHaveLength(4);
      expect(order[0]).toEqual(a1);
      // B1 and C1 can be in any order
      expect(order.slice(1, 3)).toContainEqual(b1);
      expect(order.slice(1, 3)).toContainEqual(c1);
      expect(order[3]).toEqual(d1);
    });

    test('multiple changed cells', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      const d1: CellAddress = { row: 0, col: 3 };
      
      graph.addDependency(c1, a1);
      graph.addDependency(d1, b1);
      
      const order = graph.getCalculationOrder([a1, b1]);
      
      expect(order).toHaveLength(4);
    });

    test('throws on circular dependency', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      graph.addDependency(a1, b1);
      graph.addDependency(b1, c1);
      graph.addDependency(c1, a1);
      
      expect(() => {
        graph.getCalculationOrder([a1]);
      }).toThrow('Circular dependency');
    });
  });

  describe('serialization', () => {
    test('serializes and deserializes', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      const c1: CellAddress = { row: 0, col: 2 };
      
      graph.addDependency(a1, b1);
      graph.addDependency(a1, c1);
      graph.addDependency(b1, c1);
      
      const json = graph.toJSON();
      const restored = DependencyGraph.fromJSON(json);
      
      expect(restored.getDependencies(a1)).toHaveLength(2);
      expect(restored.getDependencies(b1)).toHaveLength(1);
      expect(restored.getDependents(c1)).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    test('handles empty graph', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      
      expect(graph.getDependencies(a1)).toHaveLength(0);
      expect(graph.getDependents(a1)).toHaveLength(0);
      expect(graph.getCalculationOrder([a1])).toContainEqual(a1);
    });

    test('clears graph', () => {
      const a1: CellAddress = { row: 0, col: 0 };
      const b1: CellAddress = { row: 0, col: 1 };
      
      graph.addDependency(a1, b1);
      graph.clear();
      
      expect(graph.getDependencies(a1)).toHaveLength(0);
      expect(graph.getDependents(b1)).toHaveLength(0);
    });

    test('handles large column addresses', () => {
      const aa1: CellAddress = { row: 0, col: 26 }; // AA1
      const zz1: CellAddress = { row: 0, col: 701 }; // ZZ1
      
      graph.addDependency(aa1, zz1);
      
      expect(graph.getDependencies(aa1)).toContainEqual(zz1);
      expect(graph.getDependents(zz1)).toContainEqual(aa1);
    });
  });
});
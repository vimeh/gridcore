import { beforeEach, describe, expect, test } from "bun:test";
import { CellAddress } from "../../domain/models/CellAddress";
import { InMemoryDependencyRepository } from "./InMemoryDependencyRepository";

describe("InMemoryDependencyRepository", () => {
  let repository: InMemoryDependencyRepository;
  let a1: CellAddress;
  let a2: CellAddress;
  let b1: CellAddress;
  let b2: CellAddress;
  let c1: CellAddress;

  beforeEach(() => {
    repository = new InMemoryDependencyRepository();
    a1 = CellAddress.fromString("A1").value;
    a2 = CellAddress.fromString("A2").value;
    b1 = CellAddress.fromString("B1").value;
    b2 = CellAddress.fromString("B2").value;
    c1 = CellAddress.fromString("C1").value;
  });

  describe("addDependency", () => {
    test("adds single dependency", () => {
      repository.addDependency(a1, b1);

      const deps = repository.getDependencies(a1);
      expect(deps.size).toBe(1);
      expect(Array.from(deps)[0].equals(b1)).toBe(true);

      const dependents = repository.getDependents(b1);
      expect(dependents.size).toBe(1);
      expect(Array.from(dependents)[0].equals(a1)).toBe(true);
    });

    test("adds multiple dependencies", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(a1, b2);
      repository.addDependency(a1, c1);

      const deps = repository.getDependencies(a1);
      expect(deps.size).toBe(3);
    });

    test("maintains bidirectional relationships", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(a2, b1);

      const dependents = repository.getDependents(b1);
      expect(dependents.size).toBe(2);
    });
  });

  describe("removeDependency", () => {
    test("removes specific dependency", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(a1, b2);

      repository.removeDependency(a1, b1);

      const deps = repository.getDependencies(a1);
      expect(deps.size).toBe(1);
      expect(Array.from(deps)[0].equals(b2)).toBe(true);

      const dependents = repository.getDependents(b1);
      expect(dependents.size).toBe(0);
    });

    test("cleans up empty sets", () => {
      repository.addDependency(a1, b1);
      repository.removeDependency(a1, b1);

      const deps = repository.getDependencies(a1);
      expect(deps.size).toBe(0);
    });

    test("handles non-existent dependency", () => {
      expect(() => repository.removeDependency(a1, b1)).not.toThrow();
    });
  });

  describe("getDependencies", () => {
    test("returns empty set for cell with no dependencies", () => {
      const deps = repository.getDependencies(a1);
      expect(deps.size).toBe(0);
    });

    test("returns all dependencies", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(a1, b2);
      repository.addDependency(a1, c1);

      const deps = repository.getDependencies(a1);
      const addresses = Array.from(deps)
        .map((addr) => addr.toString())
        .sort();
      expect(addresses).toEqual(["B1", "B2", "C1"]);
    });
  });

  describe("getDependents", () => {
    test("returns empty set for cell with no dependents", () => {
      const dependents = repository.getDependents(a1);
      expect(dependents.size).toBe(0);
    });

    test("returns all dependents", () => {
      repository.addDependency(a1, c1);
      repository.addDependency(a2, c1);
      repository.addDependency(b1, c1);

      const dependents = repository.getDependents(c1);
      const addresses = Array.from(dependents)
        .map((addr) => addr.toString())
        .sort();
      expect(addresses).toEqual(["A1", "A2", "B1"]);
    });
  });

  describe("clearDependencies", () => {
    test("removes all dependencies for a cell", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(a1, b2);
      repository.addDependency(a2, b1);

      repository.clearDependencies(a1);

      expect(repository.getDependencies(a1).size).toBe(0);
      expect(repository.getDependents(b1).size).toBe(1);
      expect(repository.getDependents(b2).size).toBe(0);
    });

    test("handles cell with no dependencies", () => {
      expect(() => repository.clearDependencies(a1)).not.toThrow();
    });
  });

  describe("clearAll", () => {
    test("removes all dependencies and dependents", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(a2, b2);
      repository.addDependency(b1, c1);

      repository.clearAll();

      expect(repository.getDependencies(a1).size).toBe(0);
      expect(repository.getDependencies(a2).size).toBe(0);
      expect(repository.getDependents(b1).size).toBe(0);
      expect(repository.getDependents(c1).size).toBe(0);
    });
  });

  describe("hasCycle", () => {
    test("detects direct cycle", () => {
      repository.addDependency(a1, b1);
      expect(repository.hasCycle(b1, a1)).toBe(true);
    });

    test("detects indirect cycle", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(b1, c1);
      expect(repository.hasCycle(c1, a1)).toBe(true);
    });

    test("detects self-reference", () => {
      expect(repository.hasCycle(a1, a1)).toBe(true);
    });

    test("no cycle in valid dependency chain", () => {
      repository.addDependency(a1, b1);
      repository.addDependency(b1, c1);
      expect(repository.hasCycle(a2, c1)).toBe(false);
    });

    test("does not modify actual dependencies", () => {
      repository.addDependency(a1, b1);
      const hadCycle = repository.hasCycle(b1, c1);

      expect(hadCycle).toBe(false);
      expect(repository.getDependencies(b1).size).toBe(0);
    });
  });

  describe("getTopologicalOrder", () => {
    test("single cell with no dependencies", () => {
      const order = repository.getTopologicalOrder([a1]);
      expect(order.length).toBe(1);
      expect(order[0].equals(a1)).toBe(true);
    });

    test("linear dependency chain", () => {
      // A1 <- B1 <- C1 (C1 depends on B1, B1 depends on A1)
      repository.addDependency(b1, a1);
      repository.addDependency(c1, b1);

      const order = repository.getTopologicalOrder([a1]);
      const addresses = order.map((addr) => addr.toString());
      expect(addresses).toEqual(["A1", "B1", "C1"]);
    });

    test("diamond dependency", () => {
      // B1 and C1 depend on A1; B2 depends on both B1 and C1
      repository.addDependency(b1, a1);
      repository.addDependency(c1, a1);
      repository.addDependency(b2, b1);
      repository.addDependency(b2, c1);

      const order = repository.getTopologicalOrder([a1]);
      const addresses = order.map((addr) => addr.toString());

      expect(addresses.length).toBe(4);
      expect(addresses.indexOf("A1")).toBeLessThan(addresses.indexOf("B1"));
      expect(addresses.indexOf("A1")).toBeLessThan(addresses.indexOf("C1"));
      expect(addresses.indexOf("B1")).toBeLessThan(addresses.indexOf("B2"));
      expect(addresses.indexOf("C1")).toBeLessThan(addresses.indexOf("B2"));
    });

    test("multiple starting cells", () => {
      // A1 and B1 both depend on C1
      repository.addDependency(a1, c1);
      repository.addDependency(b1, c1);

      const order = repository.getTopologicalOrder([c1]);
      const addresses = order.map((addr) => addr.toString());

      expect(addresses.length).toBe(3);
      expect(addresses.indexOf("C1")).toBeLessThan(addresses.indexOf("A1"));
      expect(addresses.indexOf("C1")).toBeLessThan(addresses.indexOf("B1"));
    });

    test("handles duplicates in starting cells", () => {
      repository.addDependency(a1, b1);

      const order = repository.getTopologicalOrder([a1, a1]);
      expect(order.length).toBe(2);
    });
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import { Cell } from "../../domain/models/Cell";
import { CellAddress } from "../../domain/models/CellAddress";
import { CellRange } from "../../domain/models/CellRange";
import { InMemoryCellRepository } from "./InMemoryCellRepository";

describe("InMemoryCellRepository", () => {
  let repository: InMemoryCellRepository;

  beforeEach(() => {
    repository = new InMemoryCellRepository();
  });

  describe("get/set", () => {
    test("stores and retrieves cell", () => {
      const address = CellAddress.create(0, 0).value;
      const cell = Cell.create(42).value;

      repository.set(address, cell);
      const retrieved = repository.get(address);

      expect(retrieved).toBe(cell);
    });

    test("returns undefined for non-existent cell", () => {
      const address = CellAddress.create(0, 0).value;
      const retrieved = repository.get(address);

      expect(retrieved).toBeUndefined();
    });

    test("overwrites existing cell", () => {
      const address = CellAddress.create(0, 0).value;
      const cell1 = Cell.create(42).value;
      const cell2 = Cell.create(100).value;

      repository.set(address, cell1);
      repository.set(address, cell2);
      const retrieved = repository.get(address);

      expect(retrieved).toBe(cell2);
    });
  });

  describe("delete", () => {
    test("removes cell", () => {
      const address = CellAddress.create(0, 0).value;
      const cell = Cell.create(42).value;

      repository.set(address, cell);
      repository.delete(address);
      const retrieved = repository.get(address);

      expect(retrieved).toBeUndefined();
    });

    test("delete non-existent cell does not throw", () => {
      const address = CellAddress.create(0, 0).value;
      expect(() => repository.delete(address)).not.toThrow();
    });
  });

  describe("clear", () => {
    test("removes all cells", () => {
      const cells = [
        { address: CellAddress.create(0, 0).value, cell: Cell.create(1).value },
        { address: CellAddress.create(1, 1).value, cell: Cell.create(2).value },
        { address: CellAddress.create(2, 2).value, cell: Cell.create(3).value },
      ];

      for (const { address, cell } of cells) {
        repository.set(address, cell);
      }

      repository.clear();

      for (const { address } of cells) {
        expect(repository.get(address)).toBeUndefined();
      }
      expect(repository.count()).toBe(0);
    });
  });

  describe("getAllInRange", () => {
    test("returns cells within range", () => {
      const cells = [
        { address: CellAddress.create(0, 0).value, cell: Cell.create(1).value },
        { address: CellAddress.create(0, 1).value, cell: Cell.create(2).value },
        { address: CellAddress.create(1, 0).value, cell: Cell.create(3).value },
        { address: CellAddress.create(1, 1).value, cell: Cell.create(4).value },
        { address: CellAddress.create(2, 2).value, cell: Cell.create(5).value },
      ];

      for (const { address, cell } of cells) {
        repository.set(address, cell);
      }

      const range = CellRange.fromString("A1:B2").value;
      const result = repository.getAllInRange(range);

      expect(result.size).toBe(4);
      expect(result.get("A1")).toBe(cells[0].cell);
      expect(result.get("B1")).toBe(cells[1].cell);
      expect(result.get("A2")).toBe(cells[2].cell);
      expect(result.get("B2")).toBe(cells[3].cell);
      expect(result.get("C3")).toBeUndefined();
    });

    test("returns empty map for range with no cells", () => {
      const range = CellRange.fromString("A1:B2").value;
      const result = repository.getAllInRange(range);

      expect(result.size).toBe(0);
    });

    test("includes only existing cells in range", () => {
      repository.set(CellAddress.create(0, 0).value, Cell.create(1).value);
      repository.set(CellAddress.create(1, 1).value, Cell.create(2).value);

      const range = CellRange.fromString("A1:B2").value;
      const result = repository.getAllInRange(range);

      expect(result.size).toBe(2);
      expect(result.has("A1")).toBe(true);
      expect(result.has("B2")).toBe(true);
      expect(result.has("B1")).toBe(false);
      expect(result.has("A2")).toBe(false);
    });
  });

  describe("getAll", () => {
    test("returns all cells", () => {
      const cells = [
        { address: CellAddress.create(0, 0).value, cell: Cell.create(1).value },
        { address: CellAddress.create(5, 5).value, cell: Cell.create(2).value },
        {
          address: CellAddress.create(10, 10).value,
          cell: Cell.create(3).value,
        },
      ];

      for (const { address, cell } of cells) {
        repository.set(address, cell);
      }

      const result = repository.getAll();

      expect(result.size).toBe(3);
      expect(result.get("A1")).toBe(cells[0].cell);
      expect(result.get("F6")).toBe(cells[1].cell);
      expect(result.get("K11")).toBe(cells[2].cell);
    });

    test("returns copy of internal map", () => {
      repository.set(CellAddress.create(0, 0).value, Cell.create(1).value);

      const result1 = repository.getAll();
      result1.clear();

      const result2 = repository.getAll();
      expect(result2.size).toBe(1);
    });
  });

  describe("count", () => {
    test("returns number of cells", () => {
      expect(repository.count()).toBe(0);

      repository.set(CellAddress.create(0, 0).value, Cell.create(1).value);
      expect(repository.count()).toBe(1);

      repository.set(CellAddress.create(1, 1).value, Cell.create(2).value);
      expect(repository.count()).toBe(2);

      repository.delete(CellAddress.create(0, 0).value);
      expect(repository.count()).toBe(1);

      repository.clear();
      expect(repository.count()).toBe(0);
    });
  });
});

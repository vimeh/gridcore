import { beforeEach, describe, expect, it } from "bun:test";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Cell } from "../../../domain/models";
import { CellAddress } from "../../../domain/models/CellAddress";
import type { Result } from "../../../shared/types/Result";
import { CellSelection } from "../base/CellSelection";
import {
  BulkTransformOperation,
  type BulkTransformOptions,
  TextUtils,
  type TransformationType,
} from "./BulkTransformOperation";

// Mock cell repository for testing
class MockCellRepository implements ICellRepository {
  private cells: Map<string, Cell> = new Map();

  setCell(address: CellAddress, cell: Cell): Promise<Result<void>> {
    const key = `${address.row},${address.col}`;
    this.cells.set(key, cell);
    return Promise.resolve({ ok: true, value: undefined });
  }

  getCell(address: CellAddress): Promise<Result<Cell | null>> {
    const key = `${address.row},${address.col}`;
    const cell = this.cells.get(key) || null;
    return Promise.resolve({ ok: true, value: cell });
  }

  deleteCell(address: CellAddress): Promise<Result<void>> {
    const key = `${address.row},${address.col}`;
    this.cells.delete(key);
    return Promise.resolve({ ok: true, value: undefined });
  }

  getCells(): Promise<Result<Cell[]>> {
    return Promise.resolve({
      ok: true,
      value: Array.from(this.cells.values()),
    });
  }

  clear(): Promise<Result<void>> {
    this.cells.clear();
    return Promise.resolve({ ok: true, value: undefined });
  }
}

// Mock cell repository with test data
function createTestRepository() {
  const repo = new MockCellRepository();

  // Add test data with various text cases
  repo.set(new CellAddress(0, 0), { value: "hello world" });
  repo.set(new CellAddress(0, 1), { value: "GOODBYE WORLD" });
  repo.set(new CellAddress(0, 2), { value: "  spaced text  " });
  repo.set(new CellAddress(0, 3), { value: "line\nbreak\ttext" });
  repo.set(new CellAddress(0, 4), { value: "multiple   spaces   here" });
  repo.set(new CellAddress(1, 0), { value: 42 });
  repo.set(new CellAddress(1, 1), { value: true });
  repo.set(new CellAddress(1, 2), { value: null });
  repo.set(new CellAddress(1, 3), { value: "" });
  repo.set(new CellAddress(1, 4), { value: "Mixed Case String" });
  repo.set(new CellAddress(2, 0), { value: "trim  me\n" });
  repo.set(new CellAddress(2, 1), { value: "123.45" });
  repo.set(new CellAddress(2, 2), { value: "  \t\r\n  " });

  return repo;
}

// Helper to create a selection of specific cells
function createSelection(addresses: [number, number][]): CellSelection {
  const cellAddresses = addresses.map(
    ([row, col]) => new CellAddress(row, col),
  );
  return CellSelection.fromCells(cellAddresses);
}

describe("TextUtils", () => {
  describe("toString", () => {
    it("should convert string values", () => {
      expect(TextUtils.toString("hello")).toBe("hello");
      expect(TextUtils.toString("")).toBe("");
    });

    it("should convert number values", () => {
      expect(TextUtils.toString(42)).toBe("42");
      expect(TextUtils.toString(3.14)).toBe("3.14");
      expect(TextUtils.toString(0)).toBe("0");
    });

    it("should convert boolean values", () => {
      expect(TextUtils.toString(true)).toBe("true");
      expect(TextUtils.toString(false)).toBe("false");
    });

    it("should return null for null/undefined", () => {
      expect(TextUtils.toString(null)).toBe(null);
      expect(TextUtils.toString(undefined)).toBe(null);
    });
  });

  describe("isTransformable", () => {
    it("should return true for transformable values", () => {
      expect(TextUtils.isTransformable("hello")).toBe(true);
      expect(TextUtils.isTransformable(42)).toBe(true);
      expect(TextUtils.isTransformable(true)).toBe(true);
      expect(TextUtils.isTransformable("")).toBe(true);
      expect(TextUtils.isTransformable(0)).toBe(true);
    });

    it("should return false for null/undefined", () => {
      expect(TextUtils.isTransformable(null)).toBe(false);
      expect(TextUtils.isTransformable(undefined)).toBe(false);
    });
  });

  describe("transformations", () => {
    it("should apply uppercase transformation", () => {
      expect(TextUtils.applyUppercase("hello")).toBe("HELLO");
      expect(TextUtils.applyUppercase("Hello World")).toBe("HELLO WORLD");
      expect(TextUtils.applyUppercase("ALREADY UPPER")).toBe("ALREADY UPPER");
    });

    it("should apply lowercase transformation", () => {
      expect(TextUtils.applyLowercase("HELLO")).toBe("hello");
      expect(TextUtils.applyLowercase("Hello World")).toBe("hello world");
      expect(TextUtils.applyLowercase("already lower")).toBe("already lower");
    });

    it("should apply trim transformation", () => {
      expect(TextUtils.applyTrim("  hello  ")).toBe("hello");
      expect(TextUtils.applyTrim("\t\nworld\r\n")).toBe("world");
      expect(TextUtils.applyTrim("no spaces")).toBe("no spaces");
    });

    it("should apply clean transformation with default options", () => {
      expect(TextUtils.applyClean("  hello\nworld\t  ")).toBe("hello world");
      expect(TextUtils.applyClean("multiple   spaces")).toBe("multiple spaces");
      expect(TextUtils.applyClean("\r\n\t")).toBe("");
    });

    it("should apply clean transformation with custom options", () => {
      const options = {
        normalizeSpaces: false,
        removeLineBreaks: false,
        removeTabs: false,
        removeOtherWhitespace: false,
      };
      expect(TextUtils.applyClean("  hello\nworld\tthere  ", options)).toBe(
        "hello\nworld\tthere",
      );
    });
  });
});

describe("BulkTransformOperation", () => {
  let repository: MockCellRepository;
  let selection: CellSelection;

  beforeEach(() => {
    repository = createTestRepository();
    selection = createSelection([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ]);
  });

  describe("constructor", () => {
    it("should create transform operation with default options", () => {
      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      expect(operation.type).toBe("transform");
      expect(operation.selection).toBe(selection);
    });

    it("should merge provided options with defaults", () => {
      const options: BulkTransformOptions = {
        transformation: "clean",
        skipNonText: false,
        convertNumbers: true,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      expect(operation.type).toBe("transform");
    });
  });

  describe("transformCell", () => {
    let operation: BulkTransformOperation;

    beforeEach(() => {
      const options: BulkTransformOptions = { transformation: "upper" };
      operation = new BulkTransformOperation(selection, options, repository);
    });

    it("should transform string values to uppercase", async () => {
      const result = await operation.transformCell(
        new CellAddress(0, 0),
        "hello",
      );
      expect(result).toBe("HELLO");
    });

    it("should return null for values that don't change", async () => {
      const result = await operation.transformCell(
        new CellAddress(0, 0),
        "ALREADY UPPER",
      );
      expect(result).toBe(null);
    });

    it("should return null for null values", async () => {
      const result = await operation.transformCell(new CellAddress(0, 0), null);
      expect(result).toBe(null);
    });

    it("should skip non-text values by default", async () => {
      const result = await operation.transformCell(new CellAddress(0, 0), 42);
      expect(result).toBe(null);
    });

    it("should convert numbers when convertNumbers is true", async () => {
      const options: BulkTransformOptions = {
        transformation: "upper",
        convertNumbers: true,
        skipNonText: false,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const result = await operation.transformCell(new CellAddress(0, 0), 42);
      expect(result).toBe("42");
    });

    it("should preserve numeric type when possible", async () => {
      const options: BulkTransformOptions = {
        transformation: "trim",
        convertNumbers: true,
        skipNonText: false,
        preserveType: true,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const result = await operation.transformCell(new CellAddress(0, 0), 42);
      expect(result).toBe(42);
    });
  });

  describe("uppercase transformation", () => {
    let operation: BulkTransformOperation;

    beforeEach(() => {
      const options: BulkTransformOptions = { transformation: "upper" };
      operation = new BulkTransformOperation(selection, options, repository);
    });

    it("should execute uppercase transformation", async () => {
      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBeGreaterThan(0);

      // Check that "hello world" became "HELLO WORLD"
      const cell = await repository.get(new CellAddress(0, 0));
      expect(cell.value?.value).toBe("HELLO WORLD");
    });

    it("should preview uppercase transformation", async () => {
      const preview = await operation.preview(10);

      expect(preview.affectedCells).toBe(5);
      expect(preview.changes.length).toBeGreaterThan(0);

      // Find the change for "hello world"
      const change = preview.changes.find(
        (c) => c.address.row === 0 && c.address.col === 0,
      );
      expect(change?.before).toBe("hello world");
      expect(change?.after).toBe("HELLO WORLD");
    });
  });

  describe("lowercase transformation", () => {
    let operation: BulkTransformOperation;

    beforeEach(() => {
      const options: BulkTransformOptions = { transformation: "lower" };
      operation = new BulkTransformOperation(selection, options, repository);
    });

    it("should execute lowercase transformation", async () => {
      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBeGreaterThan(0);

      // Check that "GOODBYE WORLD" became "goodbye world"
      const cell = await repository.get(new CellAddress(0, 1));
      expect(cell.value?.value).toBe("goodbye world");
    });

    it("should preview lowercase transformation", async () => {
      const preview = await operation.preview(10);

      expect(preview.affectedCells).toBe(5);

      // Find the change for "GOODBYE WORLD"
      const change = preview.changes.find(
        (c) => c.address.row === 0 && c.address.col === 1,
      );
      expect(change?.before).toBe("GOODBYE WORLD");
      expect(change?.after).toBe("goodbye world");
    });
  });

  describe("trim transformation", () => {
    let operation: BulkTransformOperation;

    beforeEach(() => {
      const options: BulkTransformOptions = { transformation: "trim" };
      operation = new BulkTransformOperation(selection, options, repository);
    });

    it("should execute trim transformation", async () => {
      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBeGreaterThan(0);

      // Check that "  spaced text  " became "spaced text"
      const cell = await repository.get(new CellAddress(0, 2));
      expect(cell.value?.value).toBe("spaced text");
    });

    it("should preview trim transformation", async () => {
      const preview = await operation.preview(10);

      expect(preview.affectedCells).toBe(5);

      // Find the change for "  spaced text  "
      const change = preview.changes.find(
        (c) => c.address.row === 0 && c.address.col === 2,
      );
      expect(change?.before).toBe("  spaced text  ");
      expect(change?.after).toBe("spaced text");
    });
  });

  describe("clean transformation", () => {
    let operation: BulkTransformOperation;

    beforeEach(() => {
      const options: BulkTransformOptions = { transformation: "clean" };
      operation = new BulkTransformOperation(selection, options, repository);
    });

    it("should execute clean transformation", async () => {
      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBeGreaterThan(0);

      // Check that "line\nbreak\ttext" became "line break text"
      const cell = await repository.get(new CellAddress(0, 3));
      expect(cell.value?.value).toBe("line break text");
    });

    it("should preview clean transformation", async () => {
      const preview = await operation.preview(10);

      expect(preview.affectedCells).toBe(5);

      // Find the change for "line\nbreak\ttext"
      const change = preview.changes.find(
        (c) => c.address.row === 0 && c.address.col === 3,
      );
      expect(change?.before).toBe("line\nbreak\ttext");
      expect(change?.after).toBe("line break text");
    });

    it("should handle multiple spaces", async () => {
      const singleCellSelection = createSelection([[0, 4]]);
      const operation = new BulkTransformOperation(
        singleCellSelection,
        { transformation: "clean" },
        repository,
      );

      const result = await operation.execute();

      expect(result.success).toBe(true);

      // Check that "multiple   spaces   here" became "multiple spaces here"
      const cell = await repository.get(new CellAddress(0, 4));
      expect(cell.value?.value).toBe("multiple spaces here");
    });

    it("should support custom clean options", async () => {
      const options: BulkTransformOptions = {
        transformation: "clean",
        cleanOptions: {
          normalizeSpaces: false,
          removeLineBreaks: true,
          removeTabs: true,
          removeOtherWhitespace: false,
        },
      };

      const singleCellSelection = createSelection([[0, 3]]);
      const operation = new BulkTransformOperation(
        singleCellSelection,
        options,
        repository,
      );

      const result = await operation.execute();
      expect(result.success).toBe(true);

      // Should remove line breaks and tabs but not normalize spaces
      const cell = await repository.get(new CellAddress(0, 3));
      expect(cell.value?.value).toBe("line break text");
    });
  });

  describe("mixed data types", () => {
    let mixedSelection: CellSelection;
    let operation: BulkTransformOperation;

    beforeEach(() => {
      mixedSelection = createSelection([
        [1, 0],
        [1, 1],
        [1, 2],
        [1, 3],
        [1, 4],
      ]);
      const options: BulkTransformOptions = { transformation: "upper" };
      operation = new BulkTransformOperation(
        mixedSelection,
        options,
        repository,
      );
    });

    it("should skip non-text values by default", async () => {
      const result = await operation.execute();

      expect(result.success).toBe(true);
      // Should only transform the string value at [1, 4]
      expect(result.cellsModified).toBe(1);

      // Check that "Mixed Case String" became "MIXED CASE STRING"
      const cell = await repository.get(new CellAddress(1, 4));
      expect(cell.value?.value).toBe("MIXED CASE STRING");

      // Check that numeric and boolean values weren't changed
      const numCell = await repository.get(new CellAddress(1, 0));
      expect(numCell.value?.value).toBe(42);

      const boolCell = await repository.get(new CellAddress(1, 1));
      expect(boolCell.value?.value).toBe(true);
    });

    it("should convert numbers when convertNumbers is enabled", async () => {
      const options: BulkTransformOptions = {
        transformation: "upper",
        convertNumbers: true,
        skipNonText: false,
      };
      const operation = new BulkTransformOperation(
        mixedSelection,
        options,
        repository,
      );

      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBeGreaterThan(1);

      // Check that number was converted to string
      const numCell = await repository.get(new CellAddress(1, 0));
      expect(numCell.value?.value).toBe("42");
    });
  });

  describe("edge cases", () => {
    it("should handle empty selection", async () => {
      const emptySelection = CellSelection.fromCells([]);
      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        emptySelection,
        options,
        repository,
      );

      const validation = operation.validate();
      expect(validation).toBe("Selection is empty");
    });

    it("should handle very large selection", async () => {
      const addresses = [];
      for (let i = 0; i < 1000001; i++) {
        addresses.push(new CellAddress(i, 0));
      }
      const largeSelection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        largeSelection,
        options,
        repository,
      );

      const validation = operation.validate();
      expect(validation).toBe("Selection is too large (max 1,000,000 cells)");
    });

    it("should handle invalid transformation type", async () => {
      const options = { transformation: "invalid" as TransformationType };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const validation = operation.validate();
      expect(validation).toContain("Invalid transformation type");
    });

    it("should skip empty cells when skipEmpty is true", async () => {
      const emptySelection = createSelection([
        [1, 2],
        [1, 3],
      ]); // null and empty string
      const options: BulkTransformOptions = {
        transformation: "upper",
        skipEmpty: true,
      };
      const operation = new BulkTransformOperation(
        emptySelection,
        options,
        repository,
      );

      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(0);
    });
  });

  describe("performance", () => {
    it("should estimate reasonable execution time", () => {
      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const estimatedTime = operation.estimateTime();
      expect(estimatedTime).toBeGreaterThan(0);
      expect(estimatedTime).toBeLessThan(1000); // Should be very fast for small selection
    });

    it("should provide meaningful description", () => {
      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const description = operation.getDescription();
      expect(description).toContain("uppercase");
      expect(description).toContain("5 cells");
    });

    it("should handle batch processing for large selections", async () => {
      // Create a larger test dataset
      const largeRepo = new MockCellRepository();
      const addresses = [];

      for (let i = 0; i < 1000; i++) {
        const addr = new CellAddress(i, 0);
        addresses.push(addr);
        largeRepo.set(addr, { value: `text${i}` });
      }

      const largeSelection = CellSelection.fromCells(addresses);
      const options: BulkTransformOptions = {
        transformation: "upper",
        batchSize: 100,
      };
      const operation = new BulkTransformOperation(
        largeSelection,
        options,
        largeRepo,
      );

      const startTime = Date.now();
      const result = await operation.execute();
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });
  });

  describe("preview functionality", () => {
    it("should generate enhanced preview with samples", async () => {
      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const preview = await operation.preview(100);

      expect(preview.affectedCells).toBe(5);
      expect(preview.summary?.customData?.transformation).toBe("upper");
      expect(preview.summary?.customData?.sampleTransformations).toBeInstanceOf(
        Array,
      );
      expect(
        preview.summary?.customData?.sampleTransformations.length,
      ).toBeGreaterThan(0);
    });

    it("should respect preview limit", async () => {
      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const preview = await operation.preview(2);

      expect(preview.changes.length).toBeLessThanOrEqual(2);
      expect(preview.truncated).toBe(true);
    });

    it("should track non-text cells in preview", async () => {
      const mixedSelection = createSelection([
        [1, 0],
        [1, 1],
        [1, 4],
      ]); // number, boolean, string
      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        mixedSelection,
        options,
        repository,
      );

      const preview = await operation.preview(100);

      expect(preview.summary?.customData?.nonTextCells).toBeGreaterThan(0);
    });
  });
});

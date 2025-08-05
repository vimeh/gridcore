import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import { Cell, CellAddress } from "../../domain/models";
import { BulkOperationFactory } from "./BulkOperationFactory";
import { CellSelection } from "./base/CellSelection";
import { BulkFormatOperation } from "./implementations/BulkFormatOperation";
import { BulkSetOperation } from "./implementations/BulkSetOperation";
import { BulkTransformOperation } from "./implementations/BulkTransformOperation";
import { FindReplaceOperation } from "./implementations/FindReplaceOperation";

// Mock ICellRepository
const createMockCellRepository = (): ICellRepository => {
  const cells = new Map<string, Cell>();

  return {
    getCell: mock(async (address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      const cell = cells.get(key);
      if (cell) {
        return { ok: true, value: cell };
      }
      return { ok: true, value: null };
    }),

    setCell: mock(async (address: CellAddress, cell: Partial<Cell>) => {
      const key = `${address.row},${address.col}`;
      const cellResult = Cell.create(null);
      if (!cellResult.ok) {
        return { ok: false, error: "Failed to create cell" };
      }
      const existingCell = cells.get(key) || cellResult.value;
      const updatedCell = { ...existingCell, ...cell };
      cells.set(key, updatedCell);
      return { ok: true, value: updatedCell };
    }),

    hasCell: mock(async (address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      return { ok: true, value: cells.has(key) };
    }),

    deleteCell: mock(async (address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      const existed = cells.has(key);
      cells.delete(key);
      return { ok: true, value: existed };
    }),
  } as ICellRepository;
};

describe("BulkOperationFactory", () => {
  let cellRepository: ICellRepository;
  let factory: BulkOperationFactory;
  let selection: CellSelection;

  beforeEach(() => {
    cellRepository = createMockCellRepository();
    factory = new BulkOperationFactory(cellRepository);
    selection = new CellSelection();

    // Add some cells to selection
    const cell1 = CellAddress.create(0, 0);
    const cell2 = CellAddress.create(1, 1);
    if (cell1.ok && cell2.ok) {
      selection.addCell(cell1.value);
      selection.addCell(cell2.value);
    }
  });

  describe("getSupportedTypes", () => {
    it("should return all supported operation types", () => {
      const types = factory.getSupportedTypes();

      expect(types).toContain("findReplace");
      expect(types).toContain("bulkSet");
      expect(types).toContain("mathOperation");
      expect(types).toContain("fill");
      expect(types).toContain("transform");
      expect(types).toContain("format");
    });
  });

  describe("isSupported", () => {
    it("should return true for supported operation types", () => {
      expect(factory.isSupported("findReplace")).toBe(true);
      expect(factory.isSupported("bulkSet")).toBe(true);
    });

    it("should return false for unsupported operation types", () => {
      expect(factory.isSupported("unknownOperation")).toBe(false);
      expect(factory.isSupported("")).toBe(false);
    });
  });

  describe("createOperation", () => {
    describe("findReplace operations", () => {
      it("should create FindReplaceOperation with correct options", () => {
        const options = {
          findPattern: "test",
          replaceWith: "TEST",
          options: {
            useRegex: false,
            caseSensitive: true,
            global: true,
            scope: "selection",
          },
        };

        const operation = factory.createOperation(
          "findReplace",
          selection,
          options,
        );

        expect(operation).toBeInstanceOf(FindReplaceOperation);
        expect(operation?.type).toBe("findReplace");
        expect(operation?.selection).toBe(selection);
      });

      it("should use default options for findReplace when not specified", () => {
        const options = {
          findPattern: "test",
          replaceWith: "TEST",
        };

        const operation = factory.createOperation(
          "findReplace",
          selection,
          options,
        );

        expect(operation).toBeInstanceOf(FindReplaceOperation);
        expect(operation?.type).toBe("findReplace");
      });

      it("should handle vim-style command options", () => {
        const options = {
          findPattern: "\\d+",
          replaceWith: "NUMBER",
          options: {
            useRegex: true,
            caseSensitive: false,
            global: true,
            scope: "sheet",
          },
        };

        const operation = factory.createOperation(
          "findReplace",
          selection,
          options,
        );

        expect(operation).toBeInstanceOf(FindReplaceOperation);
      });
    });

    describe("bulkSet operations", () => {
      it("should create BulkSetOperation with correct options", () => {
        const options = {
          value: "test value",
          overwriteExisting: true,
          preserveFormulas: false,
        };

        const operation = factory.createOperation(
          "bulkSet",
          selection,
          options,
        );

        expect(operation).toBeInstanceOf(BulkSetOperation);
        expect(operation?.type).toBe("bulkSet");
        expect(operation?.selection).toBe(selection);
      });

      it("should use default options for bulkSet when not specified", () => {
        const options = {
          value: "test value",
        };

        const operation = factory.createOperation(
          "bulkSet",
          selection,
          options,
        );

        expect(operation).toBeInstanceOf(BulkSetOperation);
      });
    });

    describe("math operations", () => {
      it("should create BulkMathOperation for supported math operations", () => {
        const options = {
          operation: "add",
          value: 10,
        };

        const operation = factory.createOperation(
          "mathOperation",
          selection,
          options,
        );

        expect(operation).not.toBeNull();
        expect(operation?.type).toBe("mathOperation");
      });
    });

    describe("unsupported operations", () => {
      it("should return null for fill operations (not yet implemented)", () => {
        const options = {
          direction: "down",
        };

        const operation = factory.createOperation("fill", selection, options);

        expect(operation).toBeNull();
      });

      it("should create BulkTransformOperation for transform operations", () => {
        const options = {
          transformation: "upper",
        };

        const operation = factory.createOperation(
          "transform",
          selection,
          options,
        );

        expect(operation).not.toBeNull();
        expect(operation?.type).toBe("transform");
      });

      it("should create BulkFormatOperation for format operations", () => {
        const options = {
          formatType: "currency",
        };

        const operation = factory.createOperation("format", selection, options);

        expect(operation).not.toBeNull();
        expect(operation?.type).toBe("format");
      });

      it("should return null for unknown operation types", () => {
        const options = {};

        const operation = factory.createOperation(
          "unknownType",
          selection,
          options,
        );

        expect(operation).toBeNull();
      });
    });
  });

  describe("integration with command parser results", () => {
    it("should handle VimBulkCommandParser findReplace command", () => {
      // Simulate output from VimBulkCommandParser
      const commandResult = {
        type: "findReplace",
        findPattern: "test",
        replaceWith: "TEST",
        options: {
          global: true,
          caseSensitive: false,
          useRegex: false,
          scope: "selection",
        },
      };

      const operation = factory.createOperation(
        commandResult.type,
        selection,
        commandResult,
      );

      expect(operation).toBeInstanceOf(FindReplaceOperation);
      expect(operation?.type).toBe("findReplace");
    });

    it("should handle VimBulkCommandParser bulkSet command", () => {
      // Simulate output from VimBulkCommandParser
      const commandResult = {
        type: "bulkSet",
        value: "new value",
      };

      const operation = factory.createOperation(
        commandResult.type,
        selection,
        commandResult,
      );

      expect(operation).toBeInstanceOf(BulkSetOperation);
      expect(operation?.type).toBe("bulkSet");
    });
  });

  describe("validation", () => {
    it("should create operations that can be validated", () => {
      const options = {
        findPattern: "test",
        replaceWith: "TEST",
      };

      const operation = factory.createOperation(
        "findReplace",
        selection,
        options,
      );

      expect(operation).not.toBeNull();
      expect(operation?.validate()).toBeNull(); // Should be valid
    });

    it("should create operations that can handle invalid input", () => {
      const options = {
        findPattern: "", // Invalid empty pattern
        replaceWith: "TEST",
      };

      const operation = factory.createOperation(
        "findReplace",
        selection,
        options,
      );

      expect(operation).not.toBeNull();
      expect(operation?.validate()).not.toBeNull(); // Should be invalid
    });
  });

  describe("error handling", () => {
    it("should handle missing required options gracefully", () => {
      const options = {
        // Missing findPattern for findReplace
        replaceWith: "TEST",
      };

      const operation = factory.createOperation(
        "findReplace",
        selection,
        options,
      );

      expect(operation).toBeInstanceOf(FindReplaceOperation);
      // Validation should catch the missing pattern
      expect(operation?.validate()).not.toBeNull();
    });

    it("should handle empty options object", () => {
      const options = {};

      const operation = factory.createOperation("bulkSet", selection, options);

      expect(operation).toBeInstanceOf(BulkSetOperation);
      // Validation should catch missing value
      expect(operation?.validate()).not.toBeNull();
    });
  });
});

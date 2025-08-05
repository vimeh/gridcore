import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import { Cell, CellAddress, type CellValue } from "../../../domain/models";
import type { Result } from "../../../shared/types/Result";
import { CellSelection } from "../base/CellSelection";
import {
  FindReplaceOperation,
  type FindReplaceOptions,
} from "./FindReplaceOperation";

// Mock ICellRepository
const createMockCellRepository = (): ICellRepository => {
  const cells = new Map<string, Cell>();

  return {
    get: mock((address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      return cells.get(key);
    }),

    set: mock((address: CellAddress, cell: Cell) => {
      const key = `${address.row},${address.col}`;
      cells.set(key, cell);
    }),

    delete: mock((address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      cells.delete(key);
    }),

    clear: mock(() => {
      cells.clear();
    }),

    getAllInRange: mock(() => {
      // Simple implementation for testing
      return new Map<string, Cell>();
    }),

    getAll: mock(() => {
      return cells;
    }),

    count: mock(() => {
      return cells.size;
    }),

    // Add helper method to set initial cell values
    _setCellForTest: (
      address: CellAddress,
      value: CellValue,
      formula?: string,
    ) => {
      const key = `${address.row},${address.col}`;
      let cellResult: Result<Cell>;
      if (formula) {
        // For formula cells, create using the formula string as the value
        cellResult = Cell.create(formula, address);
        if (cellResult.ok) {
          // Set the computed value manually for testing
          const cell = Cell.createWithComputedValue(
            formula,
            value,
            cellResult.value.formula,
          );
          cells.set(key, cell);
        }
      } else {
        cellResult = Cell.create(value);
        if (cellResult.ok) {
          cells.set(key, cellResult.value);
        }
      }
    },
  } as ICellRepository & {
    _setCellForTest: (
      address: CellAddress,
      value: CellValue,
      formula?: string,
    ) => void;
  };
};

describe("FindReplaceOperation", () => {
  let cellRepository: ICellRepository & {
    _setCellForTest: (
      address: CellAddress,
      value: CellValue,
      formula?: string,
    ) => void;
  };
  let selection: CellSelection;

  beforeEach(() => {
    cellRepository = createMockCellRepository();
    selection = new CellSelection();
  });

  const createCell = (
    row: number,
    col: number,
    value: CellValue,
    formula?: string,
  ): CellAddress => {
    const addressResult = CellAddress.create(row, col);
    if (!addressResult.ok) throw new Error("Failed to create address");

    const address = addressResult.value;
    cellRepository._setCellForTest(address, value, formula);
    selection.addCell(address);
    return address;
  };

  describe("Pattern Compilation", () => {
    it("should compile literal patterns correctly", () => {
      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "TEST",
        useRegex: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      expect(operation).toBeInstanceOf(FindReplaceOperation);
    });

    it("should compile regex patterns correctly", () => {
      const options: FindReplaceOptions = {
        findPattern: "\\d+",
        replaceWith: "NUMBER",
        useRegex: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      expect(operation).toBeInstanceOf(FindReplaceOperation);
    });

    it("should throw error for invalid regex patterns", () => {
      const options: FindReplaceOptions = {
        findPattern: "[invalid",
        replaceWith: "TEST",
        useRegex: true,
      };

      expect(() => {
        new FindReplaceOperation(selection, options, cellRepository);
      }).toThrow("Invalid search pattern");
    });

    it("should handle case sensitivity flag", () => {
      const options: FindReplaceOptions = {
        findPattern: "Test",
        replaceWith: "FOUND",
        caseSensitive: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      expect(operation).toBeInstanceOf(FindReplaceOperation);
    });
  });

  describe("Basic Find and Replace", () => {
    it("should find and replace literal text", async () => {
      createCell(1, 1, "Hello World");
      createCell(1, 2, "World Peace");

      const options: FindReplaceOptions = {
        findPattern: "World",
        replaceWith: "Universe",
        useRegex: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(2);
      expect(Array.from(preview.changes.values())[0].before).toBe(
        "Hello World",
      );
      expect(Array.from(preview.changes.values())[0].after).toBe(
        "Hello Universe",
      );
      expect(Array.from(preview.changes.values())[1].before).toBe(
        "World Peace",
      );
      expect(Array.from(preview.changes.values())[1].after).toBe(
        "Universe Peace",
      );
    });

    it("should handle case-insensitive matching", async () => {
      createCell(1, 1, "Hello WORLD");
      createCell(1, 2, "world peace");

      const options: FindReplaceOptions = {
        findPattern: "world",
        replaceWith: "universe",
        caseSensitive: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(2);
      expect(Array.from(preview.changes.values())[0].after).toBe(
        "Hello universe",
      );
      expect(Array.from(preview.changes.values())[1].after).toBe(
        "universe peace",
      );
    });

    it("should handle case-sensitive matching", async () => {
      createCell(1, 1, "Hello WORLD");
      createCell(1, 2, "Hello world");

      const options: FindReplaceOptions = {
        findPattern: "world",
        replaceWith: "universe",
        caseSensitive: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].before).toBe(
        "Hello world",
      );
      expect(Array.from(preview.changes.values())[0].after).toBe(
        "Hello universe",
      );
    });

    it("should handle global replacement", async () => {
      createCell(1, 1, "test test test");

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
        global: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].after).toBe(
        "PASS PASS PASS",
      );
      expect(Array.from(preview.changes.values())[0].metadata?.matchCount).toBe(
        3,
      );
    });

    it("should handle non-global replacement", async () => {
      createCell(1, 1, "test test test");

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
        global: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].after).toBe(
        "PASS test test",
      );
      expect(Array.from(preview.changes.values())[0].metadata?.matchCount).toBe(
        1,
      );
    });
  });

  describe("Regex Find and Replace", () => {
    it("should find and replace using regex patterns", async () => {
      createCell(1, 1, "Phone: 123-456-7890");
      createCell(1, 2, "Call 555-1234");

      const options: FindReplaceOptions = {
        findPattern: "\\d{3}-\\d{3}-\\d{4}",
        replaceWith: "XXX-XXX-XXXX",
        useRegex: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].after).toBe(
        "Phone: XXX-XXX-XXXX",
      );
    });

    it("should handle regex with capture groups", async () => {
      createCell(1, 1, "John Doe");
      createCell(1, 2, "Jane Smith");

      const options: FindReplaceOptions = {
        findPattern: "(\\w+) (\\w+)",
        replaceWith: "$2, $1",
        useRegex: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(2);
      expect(Array.from(preview.changes.values())[0].after).toBe("Doe, John");
      expect(Array.from(preview.changes.values())[1].after).toBe("Smith, Jane");
    });

    it("should handle complex regex patterns", async () => {
      createCell(1, 1, "email@example.com");
      createCell(1, 2, "test@domain.org");
      createCell(1, 3, "not an email");

      const options: FindReplaceOptions = {
        findPattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
        replaceWith: "[EMAIL]",
        useRegex: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(2);
      expect(Array.from(preview.changes.values())[0].after).toBe("[EMAIL]");
      expect(Array.from(preview.changes.values())[1].after).toBe("[EMAIL]");
    });
  });

  describe("Whole Cell Matching", () => {
    it("should match entire cell content only", async () => {
      createCell(1, 1, "test");
      createCell(1, 2, "testing");
      createCell(1, 3, "test case");

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
        wholeCellMatch: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].before).toBe("test");
      expect(Array.from(preview.changes.values())[0].after).toBe("PASS");
    });
  });

  describe("Formula Handling", () => {
    it("should search in formula content when enabled", async () => {
      const addressResult = CellAddress.create(1, 1);
      if (!addressResult.ok) throw new Error("Failed to create address");

      const address = addressResult.value;
      cellRepository._setCellForTest(address, 10, "=SUM(A1:A5)");
      selection.addCell(address);

      const options: FindReplaceOptions = {
        findPattern: "A1:A5",
        replaceWith: "B1:B5",
        searchInFormulas: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].before).toBe(
        "=SUM(A1:A5)",
      );
      expect(Array.from(preview.changes.values())[0].metadata?.searchType).toBe(
        "formula",
      );
    });

    it("should skip formulas when searchInFormulas is disabled", async () => {
      const addressResult = CellAddress.create(1, 1);
      if (!addressResult.ok) throw new Error("Failed to create address");

      const address = addressResult.value;
      cellRepository._setCellForTest(address, 10, "=SUM(A1:A5)");
      selection.addCell(address);

      const options: FindReplaceOptions = {
        findPattern: "SUM",
        replaceWith: "AVERAGE",
        searchInFormulas: false,
        searchInValues: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(0);
    });
  });

  describe("Preview Generation", () => {
    it("should generate preview with match highlighting", async () => {
      createCell(1, 1, "Hello World Hello");

      const options: FindReplaceOptions = {
        findPattern: "Hello",
        replaceWith: "Hi",
        global: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(
        Array.from(preview.changes.values())[0].metadata?.matches,
      ).toHaveLength(2);
      expect(
        Array.from(preview.changes.values())[0].metadata?.matches[0],
      ).toEqual({
        start: 0,
        end: 5,
        matchedText: "Hello",
        replacementText: "Hi",
      });
      expect(
        Array.from(preview.changes.values())[0].metadata?.matches[1],
      ).toEqual({
        start: 12,
        end: 17,
        matchedText: "Hello",
        replacementText: "Hi",
      });
    });

    it("should include summary with match statistics", async () => {
      createCell(1, 1, "test test");
      createCell(1, 2, "test");
      createCell(1, 3, "no match");

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
        global: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.summary.totalMatches).toBe(3);
      expect(preview.summary.findPattern).toBe("test");
      expect(preview.summary.replaceWith).toBe("PASS");
      expect(preview.summary.modifiedCells).toBe(2);
    });

    it("should handle preview limit correctly", async () => {
      // Create many cells with matches
      for (let i = 1; i <= 150; i++) {
        createCell(i, 1, `test ${i}`);
      }

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview(100);

      expect(preview.changes.size).toBe(100);
      expect(preview.isTruncated).toBe(true);
    });
  });

  describe("Execution", () => {
    it("should execute find and replace operation", async () => {
      createCell(1, 1, "Hello World");
      createCell(1, 2, "World Peace");

      const options: FindReplaceOptions = {
        findPattern: "World",
        replaceWith: "Universe",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(2);

      // Verify cells were actually updated
      const cell1 = cellRepository.get(new CellAddress(1, 1));
      const cell2 = cellRepository.get(new CellAddress(1, 2));

      expect(cell1?.value).toBe("Hello Universe");
      expect(cell2?.value).toBe("Universe Peace");
    });

    it("should handle empty selection gracefully", async () => {
      const emptySelection = new CellSelection();

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
      };

      const operation = new FindReplaceOperation(
        emptySelection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Selection is empty");
    });
  });

  describe("Validation", () => {
    it("should validate empty find pattern", () => {
      const options: FindReplaceOptions = {
        findPattern: "",
        replaceWith: "replacement",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Find pattern cannot be empty");
    });

    it("should validate invalid regex patterns", () => {
      const options: FindReplaceOptions = {
        findPattern: "[invalid",
        replaceWith: "replacement",
        useRegex: true,
      };

      expect(() => {
        new FindReplaceOperation(selection, options, cellRepository);
      }).toThrow();
    });

    it("should validate selection size", () => {
      // Create a very large selection (mock)
      const largeSelection = new CellSelection();
      for (let i = 0; i < 1000001; i++) {
        largeSelection.addCell(new CellAddress(i, 1));
      }

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
      };

      const operation = new FindReplaceOperation(
        largeSelection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Selection is too large (max 1,000,000 cells)");
    });
  });

  describe("Undo/Redo Support", () => {
    it("should create undo operation for simple replacements", async () => {
      createCell(1, 1, "Hello World");

      const options: FindReplaceOptions = {
        findPattern: "World",
        replaceWith: "Universe",
        useRegex: false,
        searchInFormulas: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      expect(operation.canUndo()).toBe(true);

      const undoOperation = await operation.createUndoOperation();
      expect(undoOperation).toBeInstanceOf(FindReplaceOperation);
    });

    it("should not allow undo for regex operations", async () => {
      createCell(1, 1, "123-456");

      const options: FindReplaceOptions = {
        findPattern: "\\d+",
        replaceWith: "NUM",
        useRegex: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      expect(operation.canUndo()).toBe(false);
    });

    it("should not allow undo for formula operations", async () => {
      const addressResult = CellAddress.create(1, 1);
      if (!addressResult.ok) throw new Error("Failed to create address");

      const address = addressResult.value;
      cellRepository._setCellForTest(address, 10, "=SUM(A1:A5)");
      selection.addCell(address);

      const options: FindReplaceOptions = {
        findPattern: "SUM",
        replaceWith: "AVERAGE",
        searchInFormulas: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      expect(operation.canUndo()).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should estimate execution time based on operation complexity", () => {
      // Create large enough selection to exceed minimum time
      for (let i = 1; i <= 5000; i++) {
        createCell(i, 1, "test");
      }

      const simpleOptions: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
        useRegex: false,
      };

      const regexOptions: FindReplaceOptions = {
        findPattern: "\\w+",
        replaceWith: "WORD",
        useRegex: true,
      };

      const formulaOptions: FindReplaceOptions = {
        findPattern: "SUM",
        replaceWith: "AVERAGE",
        searchInFormulas: true,
      };

      const simpleOp = new FindReplaceOperation(
        selection,
        simpleOptions,
        cellRepository,
      );
      const regexOp = new FindReplaceOperation(
        selection,
        regexOptions,
        cellRepository,
      );
      const formulaOp = new FindReplaceOperation(
        selection,
        formulaOptions,
        cellRepository,
      );

      const simpleTime = simpleOp.estimateTime();
      const regexTime = regexOp.estimateTime();
      const formulaTime = formulaOp.estimateTime();

      // Regex and formula operations should take longer
      expect(regexTime).toBeGreaterThan(simpleTime);
      expect(formulaTime).toBeGreaterThan(simpleTime);
    });

    it("should track match results for analysis", async () => {
      createCell(1, 1, "test test");
      createCell(1, 2, "test");

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
        global: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.preview();

      const matchResults = operation.getMatchResults();
      expect(matchResults).toHaveLength(2);
      expect(operation.getTotalMatches()).toBe(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty cells", async () => {
      createCell(1, 1, "");
      createCell(1, 2, null);
      createCell(1, 3, "test");

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].before).toBe("test");
    });

    it("should handle numeric cell values", async () => {
      createCell(1, 1, 123);
      createCell(1, 2, 456.789);

      const options: FindReplaceOptions = {
        findPattern: "123",
        replaceWith: "999",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].before).toBe("123");
      expect(Array.from(preview.changes.values())[0].after).toBe("999");
    });

    it("should handle special characters in replacement text", async () => {
      createCell(1, 1, "test");

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "!@#$%^&*()",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.changes.size).toBe(1);
      expect(Array.from(preview.changes.values())[0].after).toBe("!@#$%^&*()");
    });

    it("should handle zero-length regex matches", async () => {
      createCell(1, 1, "abc");

      const options: FindReplaceOptions = {
        findPattern: "(?=a)", // Lookahead that matches zero-length
        replaceWith: "X",
        useRegex: true,
        global: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      // Should handle zero-length matches without infinite loop
      expect(preview.changes.size).toBe(1);
    });
  });

  describe("Description and Metadata", () => {
    it("should provide accurate operation description", () => {
      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "PASS",
        caseSensitive: true,
        useRegex: false,
        scope: "selection",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const description = operation.getDescription();

      expect(description).toContain('Find "test"');
      expect(description).toContain('replace with "PASS"');
      expect(description).toContain("literal");
      expect(description).toContain("case-sensitive");
      expect(description).toContain("selection");
    });

    it("should indicate regex and case-insensitive options in description", () => {
      const options: FindReplaceOptions = {
        findPattern: "\\d+",
        replaceWith: "NUM",
        caseSensitive: false,
        useRegex: true,
        scope: "sheet",
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );
      const description = operation.getDescription();

      expect(description).toContain("regex");
      expect(description).toContain("case-insensitive");
      expect(description).toContain("sheet");
    });
  });
});

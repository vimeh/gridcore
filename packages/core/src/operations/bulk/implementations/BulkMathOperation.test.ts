import { beforeEach, describe, expect, it } from "bun:test";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Cell } from "../../../domain/models";
import { CellAddress } from "../../../domain/models";
import type { Result } from "../../../shared/types/Result";
import { CellSelection } from "../base/CellSelection";
import {
  BulkMathOperation,
  type BulkMathOptions,
  NumericUtils,
} from "./BulkMathOperation";

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

  // Helper method for tests
  setCellValue(address: CellAddress, value: any): void {
    const key = `${address.row},${address.col}`;
    this.cells.set(key, { value });
  }

  getCellValue(address: CellAddress): any {
    const key = `${address.row},${address.col}`;
    return this.cells.get(key)?.value;
  }
}

describe("NumericUtils", () => {
  describe("toNumber", () => {
    it("should convert numbers correctly", () => {
      expect(NumericUtils.toNumber(42)).toBe(42);
      expect(NumericUtils.toNumber(-3.14)).toBe(-3.14);
      expect(NumericUtils.toNumber(0)).toBe(0);
    });

    it("should convert numeric strings correctly", () => {
      expect(NumericUtils.toNumber("42")).toBe(42);
      expect(NumericUtils.toNumber("-3.14")).toBe(-3.14);
      expect(NumericUtils.toNumber("0")).toBe(0);
      expect(NumericUtils.toNumber("")).toBe(null);
    });

    it("should handle formatted strings", () => {
      expect(NumericUtils.toNumber("$42")).toBe(42);
      expect(NumericUtils.toNumber("1,234")).toBe(1234);
      expect(NumericUtils.toNumber("50%")).toBe(50);
      expect(NumericUtils.toNumber(" 123 ")).toBe(123);
    });

    it("should convert booleans correctly", () => {
      expect(NumericUtils.toNumber(true)).toBe(1);
      expect(NumericUtils.toNumber(false)).toBe(0);
    });

    it("should return null for non-numeric values", () => {
      expect(NumericUtils.toNumber("hello")).toBe(null);
      expect(NumericUtils.toNumber(null)).toBe(null);
      expect(NumericUtils.toNumber(undefined)).toBe(null);
    });
  });

  describe("isNumeric", () => {
    it("should correctly identify numeric values", () => {
      expect(NumericUtils.isNumeric(42)).toBe(true);
      expect(NumericUtils.isNumeric("42")).toBe(true);
      expect(NumericUtils.isNumeric("$42")).toBe(true);
      expect(NumericUtils.isNumeric(true)).toBe(true);
      expect(NumericUtils.isNumeric("hello")).toBe(false);
      expect(NumericUtils.isNumeric(null)).toBe(false);
    });
  });

  describe("formatResult", () => {
    it("should preserve number format by default", () => {
      expect(NumericUtils.formatResult(42, "42", true)).toBe("42");
      expect(NumericUtils.formatResult(42.5, "42.5", true)).toBe(42.5);
      expect(NumericUtils.formatResult(42, "$42", true)).toBe("$42");
      expect(NumericUtils.formatResult(42, "42%", true)).toBe("42%");
    });

    it("should return number when not preserving type", () => {
      expect(NumericUtils.formatResult(42, "42", false)).toBe(42);
      expect(NumericUtils.formatResult(42, "$42", false)).toBe(42);
    });

    it("should handle special numeric values", () => {
      expect(NumericUtils.formatResult(NaN, 42)).toBe(NaN);
      expect(NumericUtils.formatResult(Infinity, 42)).toBe(Infinity);
      expect(NumericUtils.formatResult(-Infinity, 42)).toBe(-Infinity);
    });
  });

  describe("performOperation", () => {
    it("should perform basic arithmetic operations", () => {
      expect(NumericUtils.performOperation("add", 10, 5)).toBe(15);
      expect(NumericUtils.performOperation("subtract", 10, 5)).toBe(5);
      expect(NumericUtils.performOperation("multiply", 10, 5)).toBe(50);
      expect(NumericUtils.performOperation("divide", 10, 5)).toBe(2);
      expect(NumericUtils.performOperation("modulo", 10, 3)).toBe(1);
    });

    it("should handle division and modulo by zero", () => {
      expect(NumericUtils.performOperation("divide", 10, 0)).toBe(NaN);
      expect(NumericUtils.performOperation("modulo", 10, 0)).toBe(NaN);
    });

    it("should perform percentage operations", () => {
      expect(NumericUtils.performOperation("percent", 100, 20)).toBe(120);
      expect(NumericUtils.performOperation("percentDecrease", 100, 20)).toBe(
        80,
      );
    });

    it("should perform rounding operations", () => {
      expect(NumericUtils.performOperation("round", Math.PI, 0, 2)).toBe(3.14);
      expect(NumericUtils.performOperation("round", Math.PI, 0, 0)).toBe(3);
      expect(NumericUtils.performOperation("floor", 3.7, 0)).toBe(3);
      expect(NumericUtils.performOperation("ceil", 3.1, 0)).toBe(4);
    });

    it("should throw error for unsupported operations", () => {
      expect(() =>
        NumericUtils.performOperation("invalid" as any, 10, 5),
      ).toThrow();
    });
  });
});

describe("BulkMathOperation", () => {
  let cellRepository: MockCellRepository;
  let selection: CellSelection;

  beforeEach(() => {
    cellRepository = new MockCellRepository();
    selection = new CellSelection();

    // Add some test cells with various types of values
    selection.addCell(new CellAddress(1, 1));
    selection.addCell(new CellAddress(1, 2));
    selection.addCell(new CellAddress(1, 3));
    selection.addCell(new CellAddress(1, 4));
    selection.addCell(new CellAddress(1, 5));

    cellRepository.setCellValue(new CellAddress(1, 1), 10);
    cellRepository.setCellValue(new CellAddress(1, 2), "20");
    cellRepository.setCellValue(new CellAddress(1, 3), "$30");
    cellRepository.setCellValue(new CellAddress(1, 4), "hello");
    cellRepository.setCellValue(new CellAddress(1, 5), "");
  });

  describe("Basic Math Operations", () => {
    it("should perform addition correctly", async () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(15);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("25");
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe("$35");
      expect(cellRepository.getCellValue(new CellAddress(1, 4))).toBe("hello"); // Unchanged
    });

    it("should perform subtraction correctly", async () => {
      const options: BulkMathOptions = {
        operation: "subtract",
        value: 3,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(7);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("17");
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe("$27");
    });

    it("should perform multiplication correctly", async () => {
      const options: BulkMathOptions = {
        operation: "multiply",
        value: 2,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(20);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("40");
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe("$60");
    });

    it("should perform division correctly", async () => {
      const options: BulkMathOptions = {
        operation: "divide",
        value: 2,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(5);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("10");
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe("$15");
    });

    it("should handle division by zero", async () => {
      const options: BulkMathOptions = {
        operation: "divide",
        value: 0,
        skipNonNumeric: true,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      // Values should remain unchanged since division by zero results in NaN
      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(10);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("20");
    });

    it("should perform modulo correctly", async () => {
      cellRepository.setCellValue(new CellAddress(1, 1), 17);
      cellRepository.setCellValue(new CellAddress(1, 2), 23);

      const options: BulkMathOptions = {
        operation: "modulo",
        value: 5,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(2);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe(3);
    });
  });

  describe("Percentage Operations", () => {
    it("should increase by percentage correctly", async () => {
      const options: BulkMathOptions = {
        operation: "percent",
        value: 50, // 50% increase
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(15); // 10 + 50%
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("30"); // 20 + 50%
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe("$45"); // 30 + 50%
    });

    it("should decrease by percentage correctly", async () => {
      const options: BulkMathOptions = {
        operation: "percentDecrease",
        value: 25, // 25% decrease
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(7.5); // 10 - 25%
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("15"); // 20 - 25%
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe("$22.5"); // 30 - 25%
    });
  });

  describe("Rounding Operations", () => {
    beforeEach(() => {
      cellRepository.setCellValue(new CellAddress(1, 1), Math.PI);
      cellRepository.setCellValue(new CellAddress(1, 2), 2.7);
      cellRepository.setCellValue(new CellAddress(1, 3), 4.2);
    });

    it("should round to integer correctly", async () => {
      const options: BulkMathOptions = {
        operation: "round",
        value: 0,
        decimalPlaces: 0,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(3);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe(3);
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe(4);
    });

    it("should round to decimal places correctly", async () => {
      const options: BulkMathOptions = {
        operation: "round",
        value: 0,
        decimalPlaces: 2,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(3.14);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe(2.7);
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe(4.2);
    });

    it("should apply floor correctly", async () => {
      const options: BulkMathOptions = {
        operation: "floor",
        value: 0,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(3);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe(2);
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe(4);
    });

    it("should apply ceiling correctly", async () => {
      const options: BulkMathOptions = {
        operation: "ceil",
        value: 0,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(4);
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe(3);
      expect(cellRepository.getCellValue(new CellAddress(1, 3))).toBe(5);
    });
  });

  describe("Options and Behavior", () => {
    it("should skip non-numeric cells when configured", async () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
        skipNonNumeric: true,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const result = await operation.execute();

      expect(result.success).toBe(true);
      expect(cellRepository.getCellValue(new CellAddress(1, 4))).toBe("hello"); // Unchanged
    });

    it("should not convert strings when configured", async () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
        convertStrings: false,
        skipNonNumeric: true,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 1))).toBe(15); // Number modified
      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe("20"); // String unchanged
    });

    it("should not preserve type when configured", async () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
        preserveType: false,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 2))).toBe(25); // Returns number, not string
    });

    it("should skip empty cells when configured", async () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
        skipEmpty: true,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      await operation.execute();

      expect(cellRepository.getCellValue(new CellAddress(1, 5))).toBe(""); // Empty cell unchanged
    });
  });

  describe("Preview System", () => {
    it("should generate correct preview", async () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: 10,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.affectedCells).toBe(5);
      expect(preview.changes.size).toBe(3); // Only numeric cells
      expect(preview.summary.operationSpecific?.numericCells).toBe(3);
      expect(preview.summary.operationSpecific?.nonNumericCells).toBe(1);
    });

    it("should include calculation examples in preview", async () => {
      const options: BulkMathOptions = {
        operation: "multiply",
        value: 2,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.summary.examples).toContain("10 × 2");
      expect(typeof preview.summary.examples).toBe("string");
    });

    it("should show operation summary in preview", async () => {
      const options: BulkMathOptions = {
        operation: "percent",
        value: 25,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const preview = await operation.preview();

      expect(preview.summary.operationSummary).toContain(
        "Math Operation: PERCENT 25%",
      );
      expect(preview.summary.operationSummary).toContain(
        "3 numeric cells will be modified",
      );
    });
  });

  describe("Validation", () => {
    it("should validate division by zero", () => {
      const options: BulkMathOptions = {
        operation: "divide",
        value: 0,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Cannot divide by zero");
    });

    it("should validate modulo by zero", () => {
      const options: BulkMathOptions = {
        operation: "modulo",
        value: 0,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Cannot modulo by zero");
    });

    it("should validate percentage decrease limits", () => {
      const options: BulkMathOptions = {
        operation: "percentDecrease",
        value: 150,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Percentage decrease cannot be 100% or greater");
    });

    it("should validate decimal places for rounding", () => {
      const options: BulkMathOptions = {
        operation: "round",
        value: 0,
        decimalPlaces: 15,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe(
        "Decimal places must be an integer between 0 and 10",
      );
    });

    it("should validate finite operand values", () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: Infinity,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Math operation requires a valid finite number");
    });

    it("should validate empty selection", () => {
      const emptySelection = new CellSelection();
      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
      };

      const operation = new BulkMathOperation(
        emptySelection,
        options,
        cellRepository,
      );
      const validation = operation.validate();

      expect(validation).toBe("Selection is empty");
    });
  });

  describe("Description and Time Estimation", () => {
    it("should generate correct descriptions", () => {
      const addOp = new BulkMathOperation(
        selection,
        { operation: "add", value: 10 },
        cellRepository,
      );
      expect(addOp.getDescription()).toBe("Add 10 to 5 numeric cells");

      const percentOp = new BulkMathOperation(
        selection,
        { operation: "percent", value: 25 },
        cellRepository,
      );
      expect(percentOp.getDescription()).toBe(
        "Increase 5 numeric cells by 25%",
      );

      const roundOp = new BulkMathOperation(
        selection,
        { operation: "round", value: 0, decimalPlaces: 2 },
        cellRepository,
      );
      expect(roundOp.getDescription()).toBe(
        "Round 5 numeric cells to 2 decimal places",
      );
    });

    it("should estimate execution time", () => {
      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const estimatedTime = operation.estimateTime();

      expect(estimatedTime).toBeGreaterThan(0);
      expect(estimatedTime).toBeLessThan(1000); // Should be very fast for small selection
    });
  });

  describe("Error Handling", () => {
    it("should handle cell repository errors gracefully", async () => {
      // Create a failing repository
      const failingRepo = {
        ...cellRepository,
        getCell: () => Promise.resolve({ ok: false, error: "Cell not found" }),
      } as ICellRepository;

      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
      };

      const operation = new BulkMathOperation(selection, options, failingRepo);
      const result = await operation.execute();

      expect(result.success).toBe(false); // Should fail if no cells can be read
      expect(result.warnings.length).toBeGreaterThan(0); // But with warnings
      expect(result.cellsModified).toBe(0); // No cells should be modified
    });

    it("should handle update failures gracefully", async () => {
      // Create a repository that fails on updates
      const failingRepo = {
        ...cellRepository,
        setCell: () => Promise.resolve({ ok: false, error: "Update failed" }),
      } as ICellRepository;

      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
      };

      const operation = new BulkMathOperation(selection, options, failingRepo);
      const result = await operation.execute();

      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });
});

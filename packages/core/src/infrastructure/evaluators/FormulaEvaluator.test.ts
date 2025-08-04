import { beforeEach, describe, expect, test } from "bun:test";
import type {
  EvaluationContext,
  FormulaAST,
  FormulaFunction,
} from "../../domain/interfaces/IFormulaEvaluator";
import { CellAddress } from "../../domain/models/CellAddress";
import { CellRange } from "../../domain/models/CellRange";
import type { CellValue } from "../../domain/models/CellValue";
import { ok } from "../../shared/types/Result";
import { FormulaEvaluator } from "./FormulaEvaluator";

describe("FormulaEvaluator", () => {
  let evaluator: FormulaEvaluator;
  let mockContext: EvaluationContext;

  beforeEach(() => {
    evaluator = new FormulaEvaluator();

    // Create mock context
    mockContext = {
      getCellValue: (address: CellAddress): CellValue => {
        const key = address.toString();
        const values: Record<string, CellValue> = {
          A1: 10,
          A2: 20,
          A3: 30,
          B1: 5,
          B2: 15,
          B3: 25,
          C1: "Hello",
          C2: "World",
          D1: true,
          D2: false,
          E1: null,
        };
        return values[key] ?? null;
      },
      getRangeValues: (range): CellValue[] => {
        const values: CellValue[] = [];
        for (const addr of range) {
          values.push(mockContext.getCellValue(addr));
        }
        return values;
      },
      getCell: () => undefined,
      formulaAddress: CellAddress.create(0, 0).value,
    };
  });

  describe("literal values", () => {
    test("evaluates number literal", () => {
      const ast: FormulaAST = { type: "literal", value: 42 };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    test("evaluates string literal", () => {
      const ast: FormulaAST = { type: "literal", value: "test" };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("test");
      }
    });

    test("evaluates boolean literal", () => {
      const ast: FormulaAST = { type: "literal", value: true };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    test("evaluates null literal", () => {
      const ast: FormulaAST = { type: "literal", value: null };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });
  });

  describe("cell references", () => {
    test("evaluates cell reference", () => {
      const address = CellAddress.create(0, 0).value;
      const ast: FormulaAST = { type: "cellRef", address };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(10); // A1
      }
    });

    test("evaluates null cell reference", () => {
      const address = CellAddress.create(4, 0).value; // E1
      const ast: FormulaAST = { type: "cellRef", address };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });

    test("handles missing address", () => {
      const ast: FormulaAST = { type: "cellRef" };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("missing address");
      }
    });
  });

  describe("range references", () => {
    test("evaluates range reference", () => {
      const range = CellRange.create(
        CellAddress.create(0, 0).value, // A1
        CellAddress.create(2, 0).value, // A3
      ).value;
      const ast: FormulaAST = { type: "rangeRef", range };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([10, 20, 30]);
      }
    });

    test("handles missing range", () => {
      const ast: FormulaAST = { type: "rangeRef" };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("missing range");
      }
    });
  });

  describe("binary operations", () => {
    test("evaluates addition", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "+",
        left: { type: "literal", value: 10 },
        right: { type: "literal", value: 5 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(15);
      }
    });

    test("evaluates subtraction", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "-",
        left: { type: "literal", value: 10 },
        right: { type: "literal", value: 5 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(5);
      }
    });

    test("evaluates multiplication", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "*",
        left: { type: "literal", value: 10 },
        right: { type: "literal", value: 5 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(50);
      }
    });

    test("evaluates division", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "/",
        left: { type: "literal", value: 10 },
        right: { type: "literal", value: 5 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(2);
      }
    });

    test("handles division by zero", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "/",
        left: { type: "literal", value: 10 },
        right: { type: "literal", value: 0 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Division by zero");
      }
    });

    test("evaluates exponentiation", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "^",
        left: { type: "literal", value: 2 },
        right: { type: "literal", value: 3 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(8);
      }
    });

    test("evaluates equality", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "=",
        left: { type: "literal", value: 10 },
        right: { type: "literal", value: 10 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    test("evaluates inequality", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "<>",
        left: { type: "literal", value: 10 },
        right: { type: "literal", value: 5 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    test("evaluates less than", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "<",
        left: { type: "literal", value: 5 },
        right: { type: "literal", value: 10 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    test("handles non-numeric operands for arithmetic", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "+",
        left: { type: "literal", value: "hello" },
        right: { type: "literal", value: 5 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("numeric operands");
      }
    });

    test("handles missing operands", () => {
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "+",
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("missing operands");
      }
    });
  });

  describe("unary operations", () => {
    test("evaluates negation", () => {
      const ast: FormulaAST = {
        type: "unaryOp",
        operator: "-",
        operand: { type: "literal", value: 10 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(-10);
      }
    });

    test("evaluates unary plus", () => {
      const ast: FormulaAST = {
        type: "unaryOp",
        operator: "+",
        operand: { type: "literal", value: 10 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(10);
      }
    });

    test("handles non-numeric operand", () => {
      const ast: FormulaAST = {
        type: "unaryOp",
        operator: "-",
        operand: { type: "literal", value: "hello" },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("numeric operand");
      }
    });

    test("handles missing operand", () => {
      const ast: FormulaAST = {
        type: "unaryOp",
        operator: "-",
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("missing operand");
      }
    });
  });

  describe("functions", () => {
    test("evaluates SUM function", () => {
      const range = CellRange.create(
        CellAddress.create(0, 0).value, // A1
        CellAddress.create(2, 0).value, // A3
      ).value;
      const ast: FormulaAST = {
        type: "function",
        name: "SUM",
        arguments: [{ type: "rangeRef", range }],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(60); // 10 + 20 + 30
      }
    });

    test("evaluates AVERAGE function", () => {
      const range = CellRange.create(
        CellAddress.create(0, 0).value, // A1
        CellAddress.create(2, 0).value, // A3
      ).value;
      const ast: FormulaAST = {
        type: "function",
        name: "AVERAGE",
        arguments: [{ type: "rangeRef", range }],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(20); // (10 + 20 + 30) / 3
      }
    });

    test("evaluates COUNT function", () => {
      const range = CellRange.create(
        CellAddress.create(0, 0).value, // A1
        CellAddress.create(0, 4).value, // E1 (includes null)
      ).value;
      const ast: FormulaAST = {
        type: "function",
        name: "COUNT",
        arguments: [{ type: "rangeRef", range }],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(4); // A1, B1, C1, D1 (E1 is null)
      }
    });

    test("evaluates MAX function", () => {
      const range = CellRange.create(
        CellAddress.create(0, 0).value, // A1
        CellAddress.create(2, 1).value, // B3
      ).value;
      const ast: FormulaAST = {
        type: "function",
        name: "MAX",
        arguments: [{ type: "rangeRef", range }],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(30); // Max of A1-A3, B1-B3
      }
    });

    test("evaluates MIN function", () => {
      const range = CellRange.create(
        CellAddress.create(0, 0).value, // A1
        CellAddress.create(2, 1).value, // B3
      ).value;
      const ast: FormulaAST = {
        type: "function",
        name: "MIN",
        arguments: [{ type: "rangeRef", range }],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(5); // Min of A1-A3, B1-B3
      }
    });

    test("evaluates IF function", () => {
      const ast: FormulaAST = {
        type: "function",
        name: "IF",
        arguments: [
          { type: "literal", value: true },
          { type: "literal", value: "YES" },
          { type: "literal", value: "NO" },
        ],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("YES");
      }
    });

    test("evaluates CONCAT function", () => {
      const ast: FormulaAST = {
        type: "function",
        name: "CONCAT",
        arguments: [
          { type: "cellRef", address: CellAddress.create(0, 2).value }, // C1 = "Hello"
          { type: "literal", value: " " },
          { type: "cellRef", address: CellAddress.create(1, 2).value }, // C2 = "World"
        ],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("Hello World");
      }
    });

    test("evaluates LEN function", () => {
      const ast: FormulaAST = {
        type: "function",
        name: "LEN",
        arguments: [
          { type: "cellRef", address: CellAddress.create(0, 2).value }, // C1 = "Hello"
        ],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(5);
      }
    });

    test("evaluates UPPER function", () => {
      const ast: FormulaAST = {
        type: "function",
        name: "UPPER",
        arguments: [
          { type: "cellRef", address: CellAddress.create(0, 2).value }, // C1 = "Hello"
        ],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("HELLO");
      }
    });

    test("evaluates LOWER function", () => {
      const ast: FormulaAST = {
        type: "function",
        name: "LOWER",
        arguments: [{ type: "literal", value: "HELLO" }],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("hello");
      }
    });

    test.skip("evaluates custom function", () => {
      // Custom functions are not implemented in the current version
      const ast: FormulaAST = {
        type: "function",
        name: "CUSTOM",
        arguments: [
          { type: "literal", value: 1 },
          { type: "literal", value: 2 },
          { type: "literal", value: 3 },
        ],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(3); // Returns argument count
      }
    });

    test("handles unknown function", () => {
      const ast: FormulaAST = {
        type: "function",
        name: "UNKNOWN",
        arguments: [],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Unknown function");
      }
    });

    test("handles missing function name", () => {
      const ast: FormulaAST = {
        type: "function",
        arguments: [],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("missing name");
      }
    });
  });

  describe("complex expressions", () => {
    test("evaluates nested arithmetic", () => {
      // (A1 + B1) * 2
      const ast: FormulaAST = {
        type: "binaryOp",
        operator: "*",
        left: {
          type: "binaryOp",
          operator: "+",
          left: { type: "cellRef", address: CellAddress.create(0, 0).value }, // A1 = 10
          right: { type: "cellRef", address: CellAddress.create(0, 1).value }, // B1 = 5
        },
        right: { type: "literal", value: 2 },
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(30); // (10 + 5) * 2
      }
    });

    test("evaluates function with expression arguments", () => {
      // SUM(A1 + B1, A2 * 2)
      const ast: FormulaAST = {
        type: "function",
        name: "SUM",
        arguments: [
          {
            type: "binaryOp",
            operator: "+",
            left: { type: "cellRef", address: CellAddress.create(0, 0).value }, // A1 = 10
            right: { type: "cellRef", address: CellAddress.create(0, 1).value }, // B1 = 5
          },
          {
            type: "binaryOp",
            operator: "*",
            left: { type: "cellRef", address: CellAddress.create(1, 0).value }, // A2 = 20
            right: { type: "literal", value: 2 },
          },
        ],
      };
      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(55); // (10 + 5) + (20 * 2) = 15 + 40
      }
    });
  });

  describe("custom function registration", () => {
    test("registerFunction adds a custom function", () => {
      const customFunction: FormulaFunction = {
        name: "DOUBLE",
        minArgs: 1,
        maxArgs: 1,
        evaluate: (args: CellValue[]) => {
          const value = args[0];
          if (typeof value === "number") {
            return ok(value * 2);
          }
          return ok(0);
        },
      };

      // Register the function
      evaluator.registerFunction(customFunction);

      // Test that the function can be used
      const ast: FormulaAST = {
        type: "function",
        name: "DOUBLE",
        arguments: [{ type: "literal", value: 21 }],
      };

      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    test("registerFunction handles case-insensitive function names", () => {
      const customFunction: FormulaFunction = {
        name: "triple",
        minArgs: 1,
        maxArgs: 1,
        evaluate: (args: CellValue[]) => {
          const value = args[0];
          if (typeof value === "number") {
            return ok(value * 3);
          }
          return ok(0);
        },
      };

      evaluator.registerFunction(customFunction);

      // Test with uppercase name
      const ast: FormulaAST = {
        type: "function",
        name: "TRIPLE",
        arguments: [{ type: "literal", value: 10 }],
      };

      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(30);
      }
    });

    test("unregisterFunction removes a function", () => {
      const customFunction: FormulaFunction = {
        name: "QUAD",
        minArgs: 1,
        maxArgs: 1,
        evaluate: (args: CellValue[]) => {
          const value = args[0];
          if (typeof value === "number") {
            return ok(value * 4);
          }
          return ok(0);
        },
      };

      // Register the function
      evaluator.registerFunction(customFunction);

      // Verify it works
      const ast: FormulaAST = {
        type: "function",
        name: "QUAD",
        arguments: [{ type: "literal", value: 5 }],
      };

      let result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(20);
      }

      // Unregister the function
      evaluator.unregisterFunction("QUAD");

      // Verify it no longer works
      result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Unknown function: QUAD");
      }
    });

    test("unregisterFunction is case-insensitive", () => {
      const customFunction: FormulaFunction = {
        name: "PENTA",
        minArgs: 1,
        maxArgs: 1,
        evaluate: (args: CellValue[]) => {
          const value = args[0];
          if (typeof value === "number") {
            return ok(value * 5);
          }
          return ok(0);
        },
      };

      evaluator.registerFunction(customFunction);

      // Unregister with lowercase name
      evaluator.unregisterFunction("penta");

      // Verify it no longer works
      const ast: FormulaAST = {
        type: "function",
        name: "PENTA",
        arguments: [{ type: "literal", value: 3 }],
      };

      const result = evaluator.evaluate(ast, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Unknown function: PENTA");
      }
    });

    test("hasFunction checks if function exists", () => {
      const customFunction: FormulaFunction = {
        name: "HEXA",
        minArgs: 1,
        maxArgs: 1,
        evaluate: (_args: CellValue[]) => ok(0),
      };

      expect(evaluator.hasFunction("HEXA")).toBe(false);

      evaluator.registerFunction(customFunction);
      expect(evaluator.hasFunction("HEXA")).toBe(true);
      expect(evaluator.hasFunction("hexa")).toBe(true); // Case-insensitive

      evaluator.unregisterFunction("HEXA");
      expect(evaluator.hasFunction("HEXA")).toBe(false);
    });
  });
});

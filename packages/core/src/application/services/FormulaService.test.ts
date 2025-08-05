import { beforeEach, describe, expect, test } from "bun:test";
import type { EvaluationContext } from "../../domain/interfaces/IFormulaEvaluator";
import { CellAddress } from "../../domain/models/CellAddress";
import type { CellValue } from "../../domain/models/CellValue";
import { Formula } from "../../domain/models/Formula";
import { FormulaEvaluator } from "../../infrastructure/evaluators/FormulaEvaluator";
import { FormulaParser } from "../../infrastructure/parsers/FormulaParser";
import { err } from "../../shared/types/Result";
import { FormulaService } from "./FormulaService";

describe("FormulaService", () => {
  let service: FormulaService;
  let mockContext: EvaluationContext;

  beforeEach(() => {
    const parser = new FormulaParser();
    const evaluator = new FormulaEvaluator();
    service = new FormulaService(parser, evaluator);

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
      getFunction: () => err("No custom functions"),
    };
  });

  describe("parseFormula", () => {
    test("parses simple formula", () => {
      const result = service.parseFormula("=A1+B1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.has("A1")).toBe(true);
        expect(result.value.dependencies.has("B1")).toBe(true);
        expect(result.value.dependencies.size).toBe(2);
      }
    });

    test("parses complex formula", () => {
      const result = service.parseFormula("=SUM(A1:A3) + AVERAGE(B1:B2)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.has("A1")).toBe(true);
        expect(result.value.dependencies.has("A2")).toBe(true);
        expect(result.value.dependencies.has("A3")).toBe(true);
        expect(result.value.dependencies.has("B1")).toBe(true);
        expect(result.value.dependencies.has("B2")).toBe(true);
        expect(result.value.dependencies.size).toBe(5);
      }
    });

    test("handles parse errors", () => {
      const result = service.parseFormula("=A1 +");
      expect(result.ok).toBe(false);
    });
  });

  describe("evaluateFormula", () => {
    test("evaluates simple arithmetic formula", () => {
      const address = CellAddress.create(2, 0).value; // C1
      const formula = Formula.create("=A1+B1", address).value;

      const result = service.evaluateFormula(formula, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(15); // 10 + 5
      }
    });

    test("evaluates formula with functions", () => {
      const address = CellAddress.create(3, 0).value; // D1
      const formula = Formula.create("=SUM(A1:A3)", address).value;

      const result = service.evaluateFormula(formula, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(60); // 10 + 20 + 30
      }
    });

    test("evaluates nested functions", () => {
      const address = CellAddress.create(4, 0).value; // E1
      const formula = Formula.create(
        "=SUM(A1:A2) * AVERAGE(B1:B2)",
        address,
      ).value;

      const result = service.evaluateFormula(formula, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(300); // (10 + 20) * ((5 + 15) / 2) = 30 * 10
      }
    });

    test("handles parse errors in evaluation", () => {
      const address = CellAddress.create(2, 0).value;
      const formula = Formula.create("=A1 +", address).value;

      const result = service.evaluateFormula(formula, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Parse error");
      }
    });

    test("handles evaluation errors", () => {
      const address = CellAddress.create(2, 0).value;
      const formula = Formula.create("=A1/0", address).value;

      const result = service.evaluateFormula(formula, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Division by zero");
      }
    });

    test("evaluates string operations", () => {
      const stringContext: EvaluationContext = {
        getCellValue: (address: CellAddress): CellValue => {
          const key = address.toString();
          const values: Record<string, CellValue> = {
            A1: "Hello",
            A2: "World",
          };
          return values[key] ?? null;
        },
        getRangeValues: (range): CellValue[] => {
          const values: CellValue[] = [];
          for (const addr of range) {
            values.push(stringContext.getCellValue(addr));
          }
          return values;
        },
        getCell: () => undefined,
        formulaAddress: CellAddress.create(2, 0).value,
      };

      const address = CellAddress.create(2, 0).value;
      const formula = Formula.create('=CONCAT(A1, " ", A2)', address).value;

      const result = service.evaluateFormula(formula, stringContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("Hello World");
      }
    });
  });

  describe("getDependencies", () => {
    test("gets dependencies from simple formula", () => {
      const address = CellAddress.create(2, 0).value;
      const formula = Formula.create("=A1+B1", address).value;

      const deps = service.getDependencies(formula);
      expect(deps.size).toBe(2);
      expect(deps.has("A1")).toBe(true);
      expect(deps.has("B1")).toBe(true);
    });

    test("gets dependencies from range formula", () => {
      const address = CellAddress.create(3, 0).value;
      const formula = Formula.create("=SUM(A1:A3)", address).value;

      const deps = service.getDependencies(formula);
      expect(deps.size).toBe(3);
      expect(deps.has("A1")).toBe(true);
      expect(deps.has("A2")).toBe(true);
      expect(deps.has("A3")).toBe(true);
    });

    test("returns empty set for invalid formula", () => {
      const address = CellAddress.create(2, 0).value;
      const formula = Formula.create("=INVALID +", address).value;

      const deps = service.getDependencies(formula);
      expect(deps.size).toBe(0);
    });
  });

  describe("transformFormulaForCopy", () => {
    test("transforms relative references for copy operation", () => {
      const source = CellAddress.create(0, 0).value; // A1
      const target = CellAddress.create(1, 1).value; // B2

      const result = service.transformFormulaForCopy(
        "=A1 + B1",
        source,
        target,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=B2 + C2");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2);
      }
    });

    test("preserves absolute references during copy", () => {
      const source = CellAddress.create(0, 0).value; // A1
      const target = CellAddress.create(1, 1).value; // B2

      const result = service.transformFormulaForCopy(
        "=$A$1 + A1",
        source,
        target,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=$A$1 + B2");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(1); // Only A1 changes
      }
    });

    test("handles formulas without references", () => {
      const source = CellAddress.create(0, 0).value;
      const target = CellAddress.create(1, 1).value;

      const result = service.transformFormulaForCopy(
        "=42 + 3.14",
        source,
        target,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=42 + 3.14");
        expect(result.value.changed).toBe(false);
        expect(result.value.adjustedCount).toBe(0);
      }
    });
  });

  describe("transformFormulaForFill", () => {
    test("transforms references for down fill", () => {
      const fillStart = CellAddress.create(0, 0).value; // A1
      const fillTarget = CellAddress.create(2, 0).value; // A3

      const result = service.transformFormulaForFill(
        "=A1 + B1",
        fillStart,
        fillTarget,
        "down",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=A3 + B3");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2);
      }
    });

    test("transforms references for right fill", () => {
      const fillStart = CellAddress.create(0, 0).value; // A1
      const fillTarget = CellAddress.create(0, 2).value; // C1

      const result = service.transformFormulaForFill(
        "=A1 + B1",
        fillStart,
        fillTarget,
        "right",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=C1 + D1");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2);
      }
    });

    test("respects absolute references in fill operations", () => {
      const fillStart = CellAddress.create(0, 0).value; // A1
      const fillTarget = CellAddress.create(1, 0).value; // A2

      const result = service.transformFormulaForFill(
        "=$A$1 + A1",
        fillStart,
        fillTarget,
        "down",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=$A$1 + A2");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(1); // Only A1 changes
      }
    });
  });

  describe("previewFormulaTransformation", () => {
    test("provides preview of transformation changes", () => {
      const source = CellAddress.create(0, 0).value; // A1
      const target = CellAddress.create(1, 1).value; // B2

      const result = service.previewFormulaTransformation(
        "=A1 + B1 + $C$1",
        source,
        target,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.original).toBe("=A1 + B1 + $C$1");
        expect(result.value.transformed).toBe("=B2 + C2 + $C$1");
        expect(result.value.changes).toHaveLength(2);

        const changes = result.value.changes;
        expect(changes).toContainEqual({ from: "A1", to: "B2" });
        expect(changes).toContainEqual({ from: "B1", to: "C2" });
      }
    });

    test("shows no changes for absolute references", () => {
      const source = CellAddress.create(0, 0).value;
      const target = CellAddress.create(1, 1).value;

      const result = service.previewFormulaTransformation(
        "=$A$1 + $B$1",
        source,
        target,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.original).toBe("=$A$1 + $B$1");
        expect(result.value.transformed).toBe("=$A$1 + $B$1");
        expect(result.value.changes).toHaveLength(0);
      }
    });
  });
});

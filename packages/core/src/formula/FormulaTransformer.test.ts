import { beforeEach, describe, expect, test } from "bun:test";
import { CellAddress } from "../domain/models/CellAddress";
import { FormulaTransformer } from "./FormulaTransformer";

describe("FormulaTransformer", () => {
  let transformer: FormulaTransformer;
  let sourceA1: CellAddress;
  let targetB2: CellAddress;

  beforeEach(() => {
    transformer = new FormulaTransformer();

    const sourceResult = CellAddress.create(0, 0); // A1
    const targetResult = CellAddress.create(1, 1); // B2

    if (!sourceResult.ok || !targetResult.ok) {
      throw new Error("Failed to create test addresses");
    }

    sourceA1 = sourceResult.value;
    targetB2 = targetResult.value;
  });

  describe("transformForCopy", () => {
    test("transforms simple relative reference", () => {
      const result = transformer.transformForCopy("=A1", sourceA1, targetB2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=B2");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(1);
        expect(result.value.clampedReferences).toHaveLength(0);
      }
    });

    test("transforms absolute references correctly", () => {
      const result = transformer.transformForCopy("=$A$1", sourceA1, targetB2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Absolute references should not change
        expect(result.value.formula).toBe("=$A$1");
        expect(result.value.changed).toBe(false);
        expect(result.value.adjustedCount).toBe(0);
      }
    });

    test("transforms mixed references correctly", () => {
      const result = transformer.transformForCopy(
        "=$A1 + B$2",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // $A1: absolute column, relative row -> $A2
        // B$2: relative column, absolute row -> C$2
        expect(result.value.formula).toBe("=$A2 + C$2");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2);
      }
    });

    test("handles complex formula with multiple references", () => {
      const formula = "=SUM(A1:A3) + B1 * $C$1 + D$5";
      const result = transformer.transformForCopy(formula, sourceA1, targetB2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // A1:A3 -> B2:B4 (relative range)
        // B1 -> C2 (relative)
        // $C$1 -> $C$1 (absolute, no change)
        // D$5 -> E$5 (mixed: relative col, absolute row)
        expect(result.value.formula).toBe("=SUM(B2:B4) + C2 * $C$1 + E$5");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(4); // A1, A3, B1, D$5
      }
    });

    test("handles formula without references", () => {
      const result = transformer.transformForCopy(
        "=42 + 3.14",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=42 + 3.14");
        expect(result.value.changed).toBe(false);
        expect(result.value.adjustedCount).toBe(0);
      }
    });

    test("handles formula without leading equals sign", () => {
      const result = transformer.transformForCopy(
        "A1 + B1",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("B2 + C2");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2);
      }
    });

    test("handles function calls with references", () => {
      const result = transformer.transformForCopy(
        "=SUM(A1, B1, $C$1)",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=SUM(B2, C2, $C$1)");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2); // A1 and B1 change, $C$1 doesn't
      }
    });

    test("preserves string literals", () => {
      const result = transformer.transformForCopy(
        '=A1 & " + " & B1',
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe('=B2 & " + " & C2');
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2);
      }
    });
  });

  describe("transformForFill", () => {
    test("transforms for down fill", () => {
      const fillStart = sourceA1; // A1
      const fillTargetResult = CellAddress.create(2, 0); // A3
      expect(fillTargetResult.ok).toBe(true);
      if (!fillTargetResult.ok) return;

      const fillTarget = fillTargetResult.value;
      const result = transformer.transformForFill(
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

    test("transforms for right fill", () => {
      const fillStart = sourceA1; // A1
      const fillTargetResult = CellAddress.create(0, 2); // C1
      expect(fillTargetResult.ok).toBe(true);
      if (!fillTargetResult.ok) return;

      const fillTarget = fillTargetResult.value;
      const result = transformer.transformForFill(
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

    test("respects absolute references in fill", () => {
      const fillStart = sourceA1; // A1
      const fillTargetResult = CellAddress.create(1, 0); // A2
      expect(fillTargetResult.ok).toBe(true);
      if (!fillTargetResult.ok) return;

      const fillTarget = fillTargetResult.value;
      const result = transformer.transformForFill(
        "=$A$1 + A1",
        fillStart,
        fillTarget,
        "down",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // $A$1 stays the same (absolute), A1 becomes A2 (relative)
        expect(result.value.formula).toBe("=$A$1 + A2");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(1); // Only A1 changes
      }
    });
  });

  describe("previewTransformation", () => {
    test("provides preview of changes", () => {
      const result = transformer.previewTransformation(
        "=A1 + B1 + $C$1",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.original).toBe("=A1 + B1 + $C$1");
        expect(result.value.transformed).toBe("=B2 + C2 + $C$1");
        expect(result.value.changes).toHaveLength(2);

        const changes = result.value.changes;
        expect(changes).toContainEqual({ from: "A1", to: "B2" });
        expect(changes).toContainEqual({ from: "B1", to: "C2" });
        // $C$1 should not be in changes as it's absolute
      }
    });

    test("shows no changes for absolute references", () => {
      const result = transformer.previewTransformation(
        "=$A$1 + $B$1",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.original).toBe("=$A$1 + $B$1");
        expect(result.value.transformed).toBe("=$A$1 + $B$1");
        expect(result.value.changes).toHaveLength(0);
      }
    });
  });

  describe("edge cases", () => {
    test("handles empty formula", () => {
      const result = transformer.transformForCopy("", sourceA1, targetB2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("");
        expect(result.value.changed).toBe(false);
      }
    });

    test("handles formula with only operators", () => {
      const result = transformer.transformForCopy(
        "=1 + 2 * 3",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=1 + 2 * 3");
        expect(result.value.changed).toBe(false);
      }
    });

    test("handles formulas with range references", () => {
      const result = transformer.transformForCopy(
        "=SUM(A1:B2)",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.formula).toBe("=SUM(B2:C3)");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(2); // A1 and B2 in the range
      }
    });

    test("handles mixed absolute/relative ranges", () => {
      const result = transformer.transformForCopy(
        "=SUM($A$1:B2)",
        sourceA1,
        targetB2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // $A$1 stays absolute, B2 becomes C3
        expect(result.value.formula).toBe("=SUM($A$1:C3)");
        expect(result.value.changed).toBe(true);
        expect(result.value.adjustedCount).toBe(1); // Only B2 changes
      }
    });
  });

  describe("bounds checking", () => {
    test("handles references near sheet boundaries", () => {
      // Create a source near the right edge
      const nearEdgeResult = CellAddress.create(0, 16382); // XFC1 (one before XFD)
      const targetResult = CellAddress.create(0, 16383); // XFD1 (last column)

      expect(nearEdgeResult.ok).toBe(true);
      expect(targetResult.ok).toBe(true);
      if (!nearEdgeResult.ok || !targetResult.ok) return;

      const nearEdge = nearEdgeResult.value;
      const target = targetResult.value;

      const result = transformer.transformForCopy("=A1", nearEdge, target, {
        clampToBounds: true,
        maxColumn: 16383,
        maxRow: 1048575,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // A1 from XFC1 to XFD1 should become B1
        expect(result.value.formula).toBe("=B1");
        expect(result.value.changed).toBe(true);
      }
    });
  });
});

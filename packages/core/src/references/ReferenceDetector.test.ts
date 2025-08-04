import { describe, expect, test } from "bun:test";
import { ReferenceDetector } from "./ReferenceDetector";

describe("ReferenceDetector", () => {
  describe("analyzeFormula", () => {
    test("should find simple relative references", () => {
      const detector = new ReferenceDetector();
      const analysis = detector.analyzeFormula("=A1+B2");

      expect(analysis.references).toHaveLength(2);
      expect(analysis.references[0]).toEqual({
        text: "A1",
        position: 1,
        length: 2,
        type: "relative",
        reference: {
          column: 0,
          row: 0,
          columnAbsolute: false,
          rowAbsolute: false,
        },
      });
      expect(analysis.references[1]).toEqual({
        text: "B2",
        position: 4,
        length: 2,
        type: "relative",
        reference: {
          column: 1,
          row: 1,
          columnAbsolute: false,
          rowAbsolute: false,
        },
      });
    });

    test("should find absolute references", () => {
      const detector = new ReferenceDetector();
      const analysis = detector.analyzeFormula("=$A$1+$B$2");

      expect(analysis.references).toHaveLength(2);
      expect(analysis.references[0].type).toBe("absolute");
      expect(analysis.references[0].text).toBe("$A$1");
      expect(analysis.references[1].type).toBe("absolute");
      expect(analysis.references[1].text).toBe("$B$2");
    });

    test("should find mixed references", () => {
      const detector = new ReferenceDetector();
      const analysis = detector.analyzeFormula("=$A1+A$2");

      expect(analysis.references).toHaveLength(2);
      expect(analysis.references[0].type).toBe("mixed-column");
      expect(analysis.references[0].text).toBe("$A1");
      expect(analysis.references[1].type).toBe("mixed-row");
      expect(analysis.references[1].text).toBe("A$2");
    });

    test("should handle formulas without equals sign", () => {
      const detector = new ReferenceDetector();
      const analysis = detector.analyzeFormula("A1+B2");

      expect(analysis.references).toHaveLength(2);
      expect(analysis.references[0].position).toBe(0);
      expect(analysis.references[1].position).toBe(3);
    });

    test("should sort references by position", () => {
      const detector = new ReferenceDetector();
      const analysis = detector.analyzeFormula("=Z99+A1+M50");

      expect(analysis.references).toHaveLength(3);
      expect(analysis.references[0].text).toBe("Z99");
      expect(analysis.references[1].text).toBe("A1");
      expect(analysis.references[2].text).toBe("M50");
    });
  });

  describe("findReferenceAtPosition", () => {
    test("should find reference at cursor position", () => {
      const detector = new ReferenceDetector();
      const formula = "=A1+B2";

      const ref1 = detector.findReferenceAtPosition(formula, 2);
      expect(ref1?.text).toBe("A1");

      const ref2 = detector.findReferenceAtPosition(formula, 5);
      expect(ref2?.text).toBe("B2");

      const ref3 = detector.findReferenceAtPosition(formula, 3);
      expect(ref3).toBeNull();
    });
  });

  describe("findNextReference", () => {
    test("should find next reference after position", () => {
      const detector = new ReferenceDetector();
      const formula = "=A1+B2+C3";

      const next1 = detector.findNextReference(formula, 0);
      expect(next1?.text).toBe("A1");

      const next2 = detector.findNextReference(formula, 2);
      expect(next2?.text).toBe("B2");

      const next3 = detector.findNextReference(formula, 5);
      expect(next3?.text).toBe("C3");

      const next4 = detector.findNextReference(formula, 8);
      expect(next4).toBeNull();
    });
  });

  describe("findPreviousReference", () => {
    test("should find previous reference before position", () => {
      const detector = new ReferenceDetector();
      const formula = "=A1+B2+C3";

      const prev1 = detector.findPreviousReference(formula, 10);
      expect(prev1?.text).toBe("C3");

      const prev2 = detector.findPreviousReference(formula, 7);
      expect(prev2?.text).toBe("B2");

      const prev3 = detector.findPreviousReference(formula, 4);
      expect(prev3?.text).toBe("A1");

      const prev4 = detector.findPreviousReference(formula, 1);
      expect(prev4).toBeNull();
    });
  });

  describe("countReferences", () => {
    test("should count all references in formula", () => {
      const detector = new ReferenceDetector();
      expect(detector.countReferences("=A1")).toBe(1);
      expect(detector.countReferences("=A1+B2")).toBe(2);
      expect(detector.countReferences("=A1+B2+C3+D4")).toBe(4);
      expect(detector.countReferences("=5+10")).toBe(0);
    });
  });

  describe("hasAbsoluteReferences", () => {
    test("should detect absolute references", () => {
      const detector = new ReferenceDetector();
      expect(detector.hasAbsoluteReferences("=A1")).toBe(false);
      expect(detector.hasAbsoluteReferences("=$A$1")).toBe(true);
      expect(detector.hasAbsoluteReferences("=$A1")).toBe(true);
      expect(detector.hasAbsoluteReferences("=A$1")).toBe(true);
      expect(detector.hasAbsoluteReferences("=A1+$B$2")).toBe(true);
    });
  });

  describe("hasOnlyRelativeReferences", () => {
    test("should detect when all references are relative", () => {
      const detector = new ReferenceDetector();
      expect(detector.hasOnlyRelativeReferences("=A1")).toBe(true);
      expect(detector.hasOnlyRelativeReferences("=A1+B2")).toBe(true);
      expect(detector.hasOnlyRelativeReferences("=$A$1")).toBe(false);
      expect(detector.hasOnlyRelativeReferences("=A1+$B$2")).toBe(false);
      expect(detector.hasOnlyRelativeReferences("=5+10")).toBe(false);
    });
  });

  describe("replaceReferenceAtPosition", () => {
    test("should replace reference at cursor position", () => {
      const detector = new ReferenceDetector();
      const formula = "=A1+B2";

      const result1 = detector.replaceReferenceAtPosition(formula, 2, "$A$1");
      expect(result1?.formula).toBe("=$A$1+B2");
      expect(result1?.newPosition).toBe(5);

      const result2 = detector.replaceReferenceAtPosition(formula, 5, "$B$2");
      expect(result2?.formula).toBe("=A1+$B$2");
    });

    test("should return null when no reference at position", () => {
      const detector = new ReferenceDetector();
      const formula = "=A1+B2";
      const result = detector.replaceReferenceAtPosition(formula, 3, "$A$1");
      expect(result).toBeNull();
    });
  });

  describe("getReferenceStats", () => {
    test("should provide comprehensive reference statistics", () => {
      const detector = new ReferenceDetector();
      const stats = detector.getReferenceStats("=A1+$B$2+$C3+D$4");

      expect(stats.total).toBe(4);
      expect(stats.relative).toBe(1); // A1
      expect(stats.absolute).toBe(1); // $B$2
      expect(stats.mixedColumn).toBe(1); // $C3
      expect(stats.mixedRow).toBe(1); // D$4
    });

    test("should handle empty formulas", () => {
      const detector = new ReferenceDetector();
      const stats = detector.getReferenceStats("=5+10");

      expect(stats.total).toBe(0);
      expect(stats.relative).toBe(0);
      expect(stats.absolute).toBe(0);
      expect(stats.mixedColumn).toBe(0);
      expect(stats.mixedRow).toBe(0);
      expect(stats.crossSheet).toBe(0);
    });
  });

  describe("isPositionInReference", () => {
    test("should detect when position is within a reference", () => {
      const detector = new ReferenceDetector();
      const formula = "=A1+B2";

      expect(detector.isPositionInReference(formula, 1)).toBe(true);
      expect(detector.isPositionInReference(formula, 2)).toBe(true);
      expect(detector.isPositionInReference(formula, 3)).toBe(false);
      expect(detector.isPositionInReference(formula, 4)).toBe(true);
      expect(detector.isPositionInReference(formula, 5)).toBe(true);
      expect(detector.isPositionInReference(formula, 6)).toBe(false);
    });
  });
});

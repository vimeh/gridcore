import { describe, expect, it } from "bun:test";
import type { CellValue } from "../../domain/models";
import { LinearPatternDetector } from "./LinearPatternDetector";

describe("LinearPatternDetector", () => {
  const detector = new LinearPatternDetector();

  describe("Pattern Detection", () => {
    it("should detect simple ascending sequence", () => {
      const values: CellValue[] = [1, 2, 3] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("linear");
      expect(pattern?.step).toBe(1);
      expect(pattern?.confidence).toBeGreaterThan(0.7);
    });

    it("should detect descending sequence", () => {
      const values: CellValue[] = [10, 8, 6] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("linear");
      expect(pattern?.step).toBe(-2);
      expect(pattern?.confidence).toBeGreaterThan(0.7);
    });

    it("should detect decimal sequences", () => {
      const values: CellValue[] = [1.5, 2.0, 2.5] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("linear");
      expect(pattern?.step).toBe(0.5);
    });

    it("should reject inconsistent sequences", () => {
      const values: CellValue[] = [1, 2, 4, 5] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject non-numeric values", () => {
      const values: CellValue[] = ["a", "b", "c"] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should handle mixed numeric and non-numeric values", () => {
      const values: CellValue[] = [1, "text", 3] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      // Should extract just the numbers [1, 3] and detect pattern with step 2
      expect(pattern).toBeDefined();
      expect(pattern?.step).toBe(2);
    });

    it("should require at least 2 values", () => {
      const values: CellValue[] = [42] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });
  });

  describe("Confidence Scoring", () => {
    it("should give higher confidence for more samples", () => {
      const values2: CellValue[] = [1, 2] as unknown as CellValue[];
      const values4: CellValue[] = [1, 2, 3, 4] as unknown as CellValue[];

      const pattern2 = detector.detect(values2, "down");
      const pattern4 = detector.detect(values4, "down");

      expect(pattern2).toBeDefined();
      expect(pattern4).toBeDefined();
      expect(pattern4?.confidence).toBeGreaterThan(pattern2?.confidence);
    });

    it("should give higher confidence for integer steps", () => {
      const integerValues: CellValue[] = [1, 2, 3] as unknown as CellValue[];
      const decimalValues: CellValue[] = [
        1.333, 2.666, 3.999,
      ] as unknown as CellValue[];

      const intPattern = detector.detect(integerValues, "down");
      const decPattern = detector.detect(decimalValues, "down");

      expect(intPattern).toBeDefined();
      expect(decPattern).toBeDefined();
      expect(intPattern?.confidence).toBeGreaterThan(decPattern?.confidence);
    });
  });

  describe("Pattern Generation", () => {
    it("should generate correct next values", () => {
      const values: CellValue[] = [5, 10, 15] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Generate next value (should be 20)
      const nextValue = pattern?.generator.generateValue(
        values,
        0, // First generated value
        {} as any, // Mock source range
        {} as any, // Mock target cell
      );

      expect(Number(nextValue)).toBe(20);
    });

    it("should generate multiple values correctly", () => {
      const values: CellValue[] = [2, 4] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Generate next 3 values
      const generated = [];
      for (let i = 0; i < 3; i++) {
        const value = pattern?.generator.generateValue(
          values,
          i,
          {} as any,
          {} as any,
        );
        generated.push(Number(value));
      }

      expect(generated).toEqual([6, 8, 10]);
    });
  });
});

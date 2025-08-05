import { describe, expect, it } from "bun:test";
import type { CellAddress, CellRange, CellValue } from "../../domain/models";
import { FibonacciPatternDetector } from "./FibonacciPatternDetector";

// Mock types for testing
const mockCellRange = {} as unknown as CellRange;
const mockCellAddress = {} as unknown as CellAddress;

describe("FibonacciPatternDetector", () => {
  const detector = new FibonacciPatternDetector();

  describe("Classic Fibonacci Detection", () => {
    it("should detect classic Fibonacci sequence 1,1,2,3,5", () => {
      const values: CellValue[] = [1, 1, 2, 3, 5] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
      expect(pattern?.confidence).toBeGreaterThan(0.6);
      expect(pattern?.metadata?.fibonacciType).toBe("classic");
      expect(pattern?.description).toContain("Fibonacci sequence");
    });

    it("should detect classic Fibonacci starting from F(3): 2,3,5,8", () => {
      const values: CellValue[] = [2, 3, 5, 8] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
      expect(pattern?.confidence).toBeGreaterThan(0.6);
      expect(pattern?.metadata?.fibonacciType).toBe("classic");
    });

    it("should detect longer Fibonacci sequence", () => {
      const values: CellValue[] = [
        1, 1, 2, 3, 5, 8, 13, 21,
      ] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
      expect(pattern?.confidence).toBeGreaterThan(0.8); // Higher confidence for longer sequence
    });
  });

  describe("Scaled Fibonacci Detection", () => {
    it("should detect scaled Fibonacci: 2,2,4,6,10 (2*Fibonacci)", () => {
      const values: CellValue[] = [2, 2, 4, 6, 10] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
      expect(pattern?.metadata?.fibonacciType).toBe("scaled");
      expect(pattern?.metadata?.multiplier).toBe(2);
    });

    it("should detect scaled Fibonacci: 5,5,10,15,25 (5*Fibonacci)", () => {
      const values: CellValue[] = [5, 5, 10, 15, 25] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
      expect(pattern?.metadata?.fibonacciType).toBe("scaled");
      expect(pattern?.metadata?.multiplier).toBe(5);
    });

    it("should detect fractional scaled Fibonacci: 0.5,0.5,1,1.5,2.5", () => {
      const values: CellValue[] = [
        0.5, 0.5, 1, 1.5, 2.5,
      ] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
      expect(pattern?.metadata?.multiplier).toBe(0.5);
    });
  });

  describe("Rejection Cases", () => {
    it("should reject non-Fibonacci sequences", () => {
      const values: CellValue[] = [1, 2, 4, 8, 16] as unknown as CellValue[]; // Powers of 2
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject arithmetic sequences", () => {
      const values: CellValue[] = [2, 4, 6, 8, 10] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject random sequences", () => {
      const values: CellValue[] = [1, 4, 7, 2, 9] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject sequences with insufficient values", () => {
      const values: CellValue[] = [1, 1] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject non-numeric values", () => {
      const values: CellValue[] = ["a", "b", "c"] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });
  });

  describe("Mixed Value Handling", () => {
    it("should handle mixed numeric and non-numeric values", () => {
      const values: CellValue[] = [
        1,
        "text",
        1,
        2,
        "",
        3,
        5,
      ] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      // Should extract [1, 1, 2, 3, 5] and detect Fibonacci
      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
    });

    it("should require at least 3 numeric values", () => {
      const values: CellValue[] = [
        1,
        "text",
        1,
        "more text",
      ] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });
  });

  describe("Confidence Scoring", () => {
    it("should give higher confidence for longer sequences", () => {
      const shortSeq: CellValue[] = [1, 1, 2] as unknown as CellValue[];
      const longSeq: CellValue[] = [1, 1, 2, 3, 5, 8] as unknown as CellValue[];

      const shortPattern = detector.detect(shortSeq, "down");
      const longPattern = detector.detect(longSeq, "down");

      expect(shortPattern).toBeDefined();
      expect(longPattern).toBeDefined();
      expect(longPattern?.confidence).toBeGreaterThan(shortPattern?.confidence);
    });

    it("should give higher confidence for classic Fibonacci", () => {
      const classicFib: CellValue[] = [1, 1, 2, 3, 5] as unknown as CellValue[];
      const scaledFib: CellValue[] = [3, 3, 6, 9, 15] as unknown as CellValue[];

      const classicPattern = detector.detect(classicFib, "down");
      const scaledPattern = detector.detect(scaledFib, "down");

      expect(classicPattern).toBeDefined();
      expect(scaledPattern).toBeDefined();
      expect(classicPattern?.confidence).toBeGreaterThan(
        scaledPattern?.confidence,
      );
    });

    it("should reduce confidence for very large multipliers", () => {
      const normalFib: CellValue[] = [2, 2, 4, 6, 10] as unknown as CellValue[];
      const largeFib: CellValue[] = [
        200, 200, 400, 600, 1000,
      ] as unknown as CellValue[];

      const normalPattern = detector.detect(normalFib, "down");
      const largePattern = detector.detect(largeFib, "down");

      expect(normalPattern).toBeDefined();
      expect(largePattern).toBeDefined();
      expect(normalPattern?.confidence).toBeGreaterThan(
        largePattern?.confidence,
      );
    });
  });

  describe("Pattern Generation", () => {
    it("should generate correct next Fibonacci values", () => {
      const values: CellValue[] = [1, 1, 2, 3, 5] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Next values should be 8, 13, 21
      const nextValues = [];
      for (let i = 0; i < 3; i++) {
        const value = pattern?.generator.generateValue(
          values,
          i,
          mockCellRange,
          mockCellAddress,
        );
        nextValues.push(Number(value));
      }

      expect(nextValues).toEqual([8, 13, 21]);
    });

    it("should generate correct scaled Fibonacci values", () => {
      const values: CellValue[] = [2, 2, 4, 6, 10] as unknown as CellValue[]; // 2*Fibonacci
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Next values should be 16, 26, 42 (2 * [8, 13, 21])
      const nextValues = [];
      for (let i = 0; i < 3; i++) {
        const value = pattern?.generator.generateValue(
          values,
          i,
          mockCellRange,
          mockCellAddress,
        );
        nextValues.push(Number(value));
      }

      expect(nextValues).toEqual([16, 26, 42]);
    });

    it("should generate values for shifted Fibonacci", () => {
      const values: CellValue[] = [3, 5, 8, 13] as unknown as CellValue[]; // Fibonacci starting from F(4)
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Next values should be 21, 34, 55
      const nextValues = [];
      for (let i = 0; i < 3; i++) {
        const value = pattern?.generator.generateValue(
          values,
          i,
          mockCellRange,
          mockCellAddress,
        );
        nextValues.push(Number(value));
      }

      expect(nextValues).toEqual([21, 34, 55]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle Fibonacci starting with 0", () => {
      const values: CellValue[] = [0, 1, 1, 2, 3] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
    });

    it("should handle large Fibonacci numbers", () => {
      const values: CellValue[] = [
        89, 144, 233, 377, 610,
      ] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
    });

    it("should handle negative Fibonacci (Negafibonacci)", () => {
      const values: CellValue[] = [
        -1, -1, -2, -3, -5,
      ] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("fibonacci");
    });
  });

  describe("Priority and Type", () => {
    it("should have correct pattern type", () => {
      expect(detector.patternType).toBe("fibonacci");
    });

    it("should have high priority", () => {
      expect(detector.priority).toBe(75);
    });
  });
});

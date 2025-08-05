import { describe, expect, it } from "bun:test";
import type { CellValue } from "../../domain/models";
import { ExponentialPatternDetector } from "./ExponentialPatternDetector";

describe("ExponentialPatternDetector", () => {
  const detector = new ExponentialPatternDetector();

  describe("Standard Geometric Sequences", () => {
    it("should detect powers of 2: 2,4,8,16", () => {
      const values: CellValue[] = [2, 4, 8, 16] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(2);
      expect(pattern?.confidence).toBeGreaterThan(0.6);
      expect(pattern?.description).toContain("Double each time");
    });

    it("should detect powers of 3: 3,9,27,81", () => {
      const values: CellValue[] = [3, 9, 27, 81] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(3);
      expect(pattern?.confidence).toBeGreaterThan(0.6);
    });

    it("should detect decreasing geometric: 16,8,4,2", () => {
      const values: CellValue[] = [16, 8, 4, 2] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(0.5);
      expect(pattern?.description).toContain("Half each time");
    });

    it("should detect powers of 10: 1,10,100,1000", () => {
      const values: CellValue[] = [1, 10, 100, 1000] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(10);
      expect(pattern?.description).toContain("Multiply by 10");
    });
  });

  describe("Power-of-Base Sequences", () => {
    it("should detect pure powers of 2: 1,2,4,8,16", () => {
      const values: CellValue[] = [1, 2, 4, 8, 16] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      // May be detected as standard geometric with ratio 2
      expect(pattern?.ratio).toBe(2);
      expect(pattern?.description).toContain("Double each time");
    });

    it("should detect powers of 3 starting from 3¹: 3,9,27", () => {
      const values: CellValue[] = [3, 9, 27] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(3);
      expect(pattern?.description).toContain("Multiply by 3");
    });

    it("should detect powers of 4: 1,4,16,64", () => {
      const values: CellValue[] = [1, 4, 16, 64] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(4);
    });

    it("should detect powers of 5: 5,25,125", () => {
      const values: CellValue[] = [5, 25, 125] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(5);
      expect(pattern?.description).toContain("Multiply by 5");
    });
  });

  describe("Fractional Ratios", () => {
    it("should detect ratio 0.25: 4,1,0.25", () => {
      const values: CellValue[] = [4, 1, 0.25] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(0.25);
    });

    it("should detect ratio 0.1: 100,10,1,0.1", () => {
      const values: CellValue[] = [100, 10, 1, 0.1] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(0.1);
    });

    it("should detect ratio 1.5: 2,3,4.5", () => {
      const values: CellValue[] = [2, 3, 4.5] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(1.5);
    });
  });

  describe("Rejection Cases", () => {
    it("should reject arithmetic sequences", () => {
      const values: CellValue[] = [2, 4, 6, 8] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject Fibonacci sequences", () => {
      const values: CellValue[] = [1, 1, 2, 3, 5] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject inconsistent ratios", () => {
      const values: CellValue[] = [1, 2, 5, 10] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject sequences with zeros", () => {
      const values: CellValue[] = [1, 0, 0] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should reject non-numeric values", () => {
      const values: CellValue[] = ["a", "b", "c"] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should require at least 2 values", () => {
      const values: CellValue[] = [42] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });
  });

  describe("Mixed Value Handling", () => {
    it("should handle mixed numeric and non-numeric values", () => {
      const values: CellValue[] = [
        1,
        "text",
        2,
        "",
        4,
        8,
      ] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      // Should extract [1, 2, 4, 8] and detect exponential pattern
      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(2);
    });

    it("should filter out zeros from mixed values", () => {
      const values: CellValue[] = [2, 0, 4, 0, 8] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      // Should extract [2, 4, 8] and detect exponential pattern
      expect(pattern).toBeDefined();
      expect(pattern?.type).toBe("exponential");
      expect(pattern?.ratio).toBe(2);
    });
  });

  describe("Confidence Scoring", () => {
    it("should give higher confidence for longer sequences", () => {
      const shortSeq: CellValue[] = [2, 4] as unknown as CellValue[];
      const longSeq: CellValue[] = [2, 4, 8, 16, 32] as unknown as CellValue[];

      const shortPattern = detector.detect(shortSeq, "down");
      const longPattern = detector.detect(longSeq, "down");

      expect(shortPattern).toBeDefined();
      expect(longPattern).toBeDefined();
      expect(longPattern?.confidence).toBeGreaterThan(shortPattern?.confidence);
    });

    it("should give higher confidence for nice ratios", () => {
      const niceRatio: CellValue[] = [1, 2, 4] as unknown as CellValue[];
      const uglyRatio: CellValue[] = [
        1, 2.333, 5.444,
      ] as unknown as CellValue[];

      const nicePattern = detector.detect(niceRatio, "down");
      const uglyPattern = detector.detect(uglyRatio, "down");

      expect(nicePattern).toBeDefined();
      expect(uglyPattern).toBeDefined();
      expect(nicePattern?.confidence).toBeGreaterThan(uglyPattern?.confidence);
    });

    it("should give higher confidence for power-of-base sequences", () => {
      const standardGeo: CellValue[] = [3, 6, 12] as unknown as CellValue[]; // Multiply by 2
      const powerOfBase: CellValue[] = [1, 2, 4, 8] as unknown as CellValue[]; // Powers of 2

      const standardPattern = detector.detect(standardGeo, "down");
      const powerPattern = detector.detect(powerOfBase, "down");

      expect(standardPattern).toBeDefined();
      expect(powerPattern).toBeDefined();
      expect(powerPattern?.confidence).toBeGreaterThan(
        standardPattern?.confidence,
      );
    });

    it("should reduce confidence for very large/small ratios", () => {
      const normalRatio: CellValue[] = [1, 2, 4] as unknown as CellValue[];
      const largeRatio: CellValue[] = [1, 100, 10000] as unknown as CellValue[];

      const normalPattern = detector.detect(normalRatio, "down");
      const largePattern = detector.detect(largeRatio, "down");

      expect(normalPattern).toBeDefined();
      expect(largePattern).toBeDefined();
      expect(normalPattern?.confidence).toBeGreaterThan(
        largePattern?.confidence,
      );
    });

    it("should reduce confidence for negative ratios", () => {
      const positiveRatio: CellValue[] = [1, 2, 4] as unknown as CellValue[];
      const negativeRatio: CellValue[] = [1, -2, 4] as unknown as CellValue[];

      const positivePattern = detector.detect(positiveRatio, "down");
      const negativePattern = detector.detect(negativeRatio, "down");

      expect(positivePattern).toBeDefined();
      expect(negativePattern).toBeDefined();
      expect(positivePattern?.confidence).toBeGreaterThan(
        negativePattern?.confidence,
      );
    });
  });

  describe("Pattern Generation", () => {
    it("should generate correct next exponential values", () => {
      const values: CellValue[] = [1, 2, 4, 8] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Next values should be 16, 32, 64
      const nextValues = [];
      for (let i = 0; i < 3; i++) {
        const value = pattern?.generator.generateValue(
          values,
          i,
          {} as any,
          {} as any,
        );
        nextValues.push(Number(value));
      }

      expect(nextValues).toEqual([16, 32, 64]);
    });

    it("should generate correct values for fractional ratios", () => {
      const values: CellValue[] = [8, 4, 2] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Next values should be 1, 0.5, 0.25
      const nextValues = [];
      for (let i = 0; i < 3; i++) {
        const value = pattern?.generator.generateValue(
          values,
          i,
          {} as any,
          {} as any,
        );
        nextValues.push(Number(value));
      }

      expect(nextValues).toEqual([1, 0.5, 0.25]);
    });

    it("should generate values for powers of 3", () => {
      const values: CellValue[] = [1, 3, 9] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Next values should be 27, 81, 243
      const nextValues = [];
      for (let i = 0; i < 3; i++) {
        const value = pattern?.generator.generateValue(
          values,
          i,
          {} as any,
          {} as any,
        );
        nextValues.push(Number(value));
      }

      expect(nextValues).toEqual([27, 81, 243]);
    });

    it("should round values for nice ratios", () => {
      const values: CellValue[] = [1, 2, 4] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      const nextValue = pattern?.generator.generateValue(
        values,
        0,
        {} as any,
        {} as any,
      );

      // Should be exactly 8, not 8.000000001
      expect(Number(nextValue)).toBe(8);
      expect(Number.isInteger(Number(nextValue))).toBe(true);
    });
  });

  describe("Overflow Protection", () => {
    it("should reduce confidence for sequences that will overflow", () => {
      const largeValues: CellValue[] = [
        1000000, 10000000, 100000000,
      ] as unknown as CellValue[];
      const smallValues: CellValue[] = [1, 10, 100] as unknown as CellValue[];

      const largePattern = detector.detect(largeValues, "down");
      const smallPattern = detector.detect(smallValues, "down");

      expect(largePattern).toBeDefined();
      expect(smallPattern).toBeDefined();
      // Large values should have reduced confidence due to potential overflow
      expect(smallPattern?.confidence).toBeGreaterThanOrEqual(
        largePattern?.confidence,
      );
    });

    it("should throw error for values that overflow", () => {
      const values: CellValue[] = [1, 1000] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();

      // Try to generate a value that would overflow
      expect(() => {
        pattern?.generator.generateValue(
          values,
          20, // This should create a huge number
          {} as any,
          {} as any,
        );
      }).toThrow("out of safe range");
    });
  });

  describe("Edge Cases", () => {
    it("should handle single element arrays", () => {
      const values: CellValue[] = [42] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeNull();
    });

    it("should handle sequences starting with 1", () => {
      const values: CellValue[] = [1, 3, 9, 27] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.ratio).toBe(3);
    });

    it("should handle decimal sequences", () => {
      const values: CellValue[] = [0.5, 1, 2, 4] as unknown as CellValue[];
      const pattern = detector.detect(values, "down");

      expect(pattern).toBeDefined();
      expect(pattern?.ratio).toBe(2);
    });
  });

  describe("Priority and Type", () => {
    it("should have correct pattern type", () => {
      expect(detector.patternType).toBe("exponential");
    });

    it("should have high priority", () => {
      expect(detector.priority).toBe(70);
    });
  });
});

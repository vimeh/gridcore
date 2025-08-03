import { describe, expect, test } from "bun:test";
import type { CellValueType } from "../types";
import { aggregators, getAggregator } from "./PivotAggregators";

describe("PivotAggregators", () => {
  describe("SUM aggregator", () => {
    const sum = aggregators.get("SUM")?.fn;

    test("sums numeric values", () => {
      const values: CellValueType[] = [10, 20, 30];
      expect(sum(values)).toBe(60);
    });

    test("handles mixed types", () => {
      const values: CellValueType[] = [10, "20", true, false, null, undefined];
      expect(sum(values)).toBe(31); // 10 + 20 + 1 + 0 + 0 + 0
    });

    test("handles empty array", () => {
      expect(sum([])).toBe(0);
    });

    test("handles string numbers", () => {
      const values: CellValueType[] = ["10.5", "20.5", "not a number"];
      expect(sum(values)).toBe(31); // 10.5 + 20.5 + 0
    });
  });

  describe("AVERAGE aggregator", () => {
    const average = aggregators.get("AVERAGE")?.fn;

    test("calculates average of numeric values", () => {
      const values: CellValueType[] = [10, 20, 30];
      expect(average(values)).toBe(20);
    });

    test("ignores non-numeric values", () => {
      const values: CellValueType[] = [10, 20, "not a number", null];
      expect(average(values)).toBe(15); // (10 + 20) / 2
    });

    test("handles empty array", () => {
      expect(average([])).toBe(0);
    });

    test("handles all non-numeric values", () => {
      const values: CellValueType[] = ["not", "numeric", null];
      expect(average(values)).toBe(0);
    });
  });

  describe("COUNT aggregator", () => {
    const count = aggregators.get("COUNT")?.fn;

    test("counts numeric values only", () => {
      const values: CellValueType[] = [1, 2, "3", "text", null, undefined];
      expect(count(values)).toBe(3); // 1, 2, and "3"
    });

    test("handles empty array", () => {
      expect(count([])).toBe(0);
    });
  });

  describe("COUNTA aggregator", () => {
    const counta = aggregators.get("COUNTA")?.fn;

    test("counts non-empty values", () => {
      const values: CellValueType[] = [
        1,
        "text",
        "",
        null,
        undefined,
        0,
        false,
      ];
      expect(counta(values)).toBe(4); // 1, "text", 0, false (not "", null, undefined)
    });

    test("handles empty array", () => {
      expect(counta([])).toBe(0);
    });
  });

  describe("MIN aggregator", () => {
    const min = aggregators.get("MIN")?.fn;

    test("finds minimum numeric value", () => {
      const values: CellValueType[] = [30, 10, 20, 5];
      expect(min(values)).toBe(5);
    });

    test("ignores non-numeric values", () => {
      const values: CellValueType[] = [30, "10", 20, "text", null];
      expect(min(values)).toBe(10); // "10" converts to 10
    });

    test("handles negative numbers", () => {
      const values: CellValueType[] = [-10, 0, 10];
      expect(min(values)).toBe(-10);
    });

    test("handles no numeric values", () => {
      const values: CellValueType[] = ["text", null, undefined];
      expect(min(values)).toBe(0);
    });
  });

  describe("MAX aggregator", () => {
    const max = aggregators.get("MAX")?.fn;

    test("finds maximum numeric value", () => {
      const values: CellValueType[] = [30, 10, 20, 50];
      expect(max(values)).toBe(50);
    });

    test("handles negative numbers", () => {
      const values: CellValueType[] = [-10, -20, -5];
      expect(max(values)).toBe(-5);
    });

    test("handles no numeric values", () => {
      const values: CellValueType[] = ["text", null, undefined];
      expect(max(values)).toBe(0);
    });
  });

  describe("PRODUCT aggregator", () => {
    const product = aggregators.get("PRODUCT")?.fn;

    test("multiplies numeric values", () => {
      const values: CellValueType[] = [2, 3, 4];
      expect(product(values)).toBe(24);
    });

    test("ignores non-numeric values", () => {
      const values: CellValueType[] = [2, "3", "text", 4];
      expect(product(values)).toBe(24); // 2 * 3 * 4
    });

    test("handles empty array", () => {
      expect(product([])).toBe(0);
    });

    test("handles zero in values", () => {
      const values: CellValueType[] = [2, 0, 4];
      expect(product(values)).toBe(0);
    });
  });

  describe("getAggregator", () => {
    test("returns correct aggregator", () => {
      const sumAgg = getAggregator("SUM");
      expect(sumAgg.name).toBe("SUM");
      expect(sumAgg.requiresNumeric).toBe(true);
    });

    test("throws for unknown aggregator", () => {
      expect(() => getAggregator("UNKNOWN" as any)).toThrow(
        "Unknown aggregator type: UNKNOWN",
      );
    });
  });
});

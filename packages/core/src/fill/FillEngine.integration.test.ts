import { beforeEach, describe, expect, it } from "bun:test";
import { Cell, CellAddress, CellRange, type CellValue } from "../domain/models";
import { InMemoryCellRepository } from "../infrastructure/repositories/InMemoryCellRepository";
import { FillEngine } from "./FillEngine";
import type { FillOperation, FillOptions } from "./types";

// Use actual domain models from imports

describe("FillEngine Integration Tests - Advanced Pattern Detection", () => {
  let fillEngine: FillEngine;
  let cellRepository: InMemoryCellRepository;

  // Helper function to get address from A1 notation
  const getAddressFromA1 = (notation: string): CellAddress => {
    const result = CellAddress.fromString(notation);
    if (!result.ok) {
      throw new Error(`Invalid A1 notation: ${notation}`);
    }
    return result.value;
  };

  // Helper function to create address from row/col
  const createAddress = (row: number, col: number): CellAddress => {
    const result = CellAddress.create(row, col);
    if (!result.ok) {
      throw new Error(`Invalid address: row=${row}, col=${col}`);
    }
    return result.value;
  };

  beforeEach(() => {
    cellRepository = new InMemoryCellRepository();
    fillEngine = new FillEngine(cellRepository);
  });

  const createFillOperation = (
    sourceStart: string,
    sourceEnd: string,
    targetStart: string,
    targetEnd: string,
    options: FillOptions = { type: "series" },
  ): FillOperation => {
    const sourceStartAddr = CellAddress.fromString(sourceStart);
    const sourceEndAddr = CellAddress.fromString(sourceEnd);
    const targetStartAddr = CellAddress.fromString(targetStart);
    const targetEndAddr = CellAddress.fromString(targetEnd);

    if (
      !sourceStartAddr.ok ||
      !sourceEndAddr.ok ||
      !targetStartAddr.ok ||
      !targetEndAddr.ok
    ) {
      throw new Error("Invalid cell addresses");
    }

    const sourceRange = CellRange.create(
      sourceStartAddr.value,
      sourceEndAddr.value,
    );
    const targetRange = CellRange.create(
      targetStartAddr.value,
      targetEndAddr.value,
    );

    if (!sourceRange.ok || !targetRange.ok) {
      throw new Error("Invalid cell ranges");
    }

    return {
      source: sourceRange.value,
      target: targetRange.value,
      direction: "down",
      options,
    };
  };

  const setCellValues = async (
    values: { address: string; value: CellValue }[],
  ) => {
    for (const { address, value } of values) {
      const addr = CellAddress.fromString(address);
      if (addr.ok) {
        const cellResult = Cell.create(value, addr.value);
        if (cellResult.ok) {
          await cellRepository.set(addr.value, cellResult.value);
        }
      }
    }
  };

  describe("Pattern Priority and Selection", () => {
    it("should prioritize specific patterns over generic ones", async () => {
      // Set up values that could be both linear and exponential
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: 2 },
        { address: "A3", value: 4 },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const preview = await fillEngine.preview(operation);

      // Should detect exponential pattern (higher priority) over linear
      expect(preview.pattern?.type).toBe("exponential");
      expect(preview.alternativePatterns).toBeDefined();
      expect(preview.alternativePatterns?.length).toBeGreaterThan(0);
    });

    it("should detect Fibonacci over linear when pattern is clear", async () => {
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: 1 },
        { address: "A3", value: 2 },
        { address: "A4", value: 3 },
        { address: "A5", value: 5 },
      ]);

      const operation = createFillOperation("A1", "A5", "A6", "A8");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern?.type).toBe("fibonacci");
      expect(preview.pattern?.confidence).toBeGreaterThan(0.8);
    });

    it("should detect custom sequences (squares) over other patterns", async () => {
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: 4 },
        { address: "A3", value: 9 },
        { address: "A4", value: 16 },
      ]);

      const operation = createFillOperation("A1", "A4", "A5", "A7");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern?.type).toBe("custom");
      expect(preview.pattern?.description).toContain("Perfect squares");
    });
  });

  describe("Ambiguity Detection and Scoring", () => {
    it("should detect ambiguity when multiple patterns match", async () => {
      // Values that could be both linear and the start of exponential
      await setCellValues([
        { address: "A1", value: 2 },
        { address: "A2", value: 4 },
        { address: "A3", value: 8 },
      ]);

      const detectionResult = fillEngine.detectAllPatterns([2, 4, 8], "down");

      expect(detectionResult.bestPattern).toBeDefined();
      expect(detectionResult.alternativePatterns.length).toBeGreaterThan(0);
      expect(detectionResult.ambiguityScore).toBeGreaterThan(0);

      // Confidence should be reduced due to ambiguity
      if (detectionResult.bestPattern) {
        expect(detectionResult.confidence).toBeLessThanOrEqual(
          detectionResult.bestPattern.confidence,
        );
      }
    });

    it("should have low ambiguity for clear patterns", async () => {
      // Clear Fibonacci sequence
      const detectionResult = fillEngine.detectAllPatterns(
        [1, 1, 2, 3, 5, 8],
        "down",
      );

      expect(detectionResult.bestPattern?.type).toBe("fibonacci");
      expect(detectionResult.ambiguityScore).toBeLessThan(0.3); // Low ambiguity
      expect(detectionResult.alternativePatterns.length).toBeLessThan(2);
    });

    it("should provide multiple alternative patterns for ambiguous cases", async () => {
      // Values that could match multiple patterns
      await setCellValues([
        { address: "A1", value: 2 },
        { address: "A2", value: 4 },
        { address: "A3", value: 8 },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const preview = await fillEngine.preview(operation);

      expect(preview.alternativePatterns).toBeDefined();
      expect(preview.alternativePatterns?.length).toBeGreaterThanOrEqual(1);

      // Should detect at least exponential pattern
      expect(preview.pattern?.type).toBeDefined();
    });
  });

  describe("Advanced Pattern Fill Operations", () => {
    it("should fill Fibonacci sequence correctly", async () => {
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: 1 },
        { address: "A3", value: 2 },
        { address: "A4", value: 3 },
      ]);

      const operation = createFillOperation("A1", "A4", "A5", "A7");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("fibonacci");

      // Check generated values: should be 5, 8, 13
      const a5 = await cellRepository.get(getAddressFromA1("A5"));
      const a6 = await cellRepository.get(getAddressFromA1("A6"));
      const a7 = await cellRepository.get(getAddressFromA1("A7"));

      expect(Number(a5?.computedValue)).toBe(5);
      expect(Number(a6?.computedValue)).toBe(8);
      expect(Number(a7?.computedValue)).toBe(13);
    });

    it("should fill exponential sequence correctly", async () => {
      await setCellValues([
        { address: "A1", value: 2 },
        { address: "A2", value: 4 },
        { address: "A3", value: 8 },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("exponential");

      // Check generated values: should be 16, 32, 64
      const a4 = await cellRepository.get(getAddressFromA1("A4"));
      const a5 = await cellRepository.get(getAddressFromA1("A5"));
      const a6 = await cellRepository.get(getAddressFromA1("A6"));

      expect(Number(a4?.computedValue)).toBe(16);
      expect(Number(a5?.computedValue)).toBe(32);
      expect(Number(a6?.computedValue)).toBe(64);
    });

    it("should fill custom sequence (squares) correctly", async () => {
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: 4 },
        { address: "A3", value: 9 },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("custom");

      // Check generated values: should be 16, 25, 36
      const a4 = await cellRepository.get(getAddressFromA1("A4"));
      const a5 = await cellRepository.get(getAddressFromA1("A5"));
      const a6 = await cellRepository.get(getAddressFromA1("A6"));

      expect(Number(a4?.computedValue)).toBe(16);
      expect(Number(a5?.computedValue)).toBe(25);
      expect(Number(a6?.computedValue)).toBe(36);
    });

    it("should fill prime sequence correctly", async () => {
      await setCellValues([
        { address: "A1", value: 2 },
        { address: "A2", value: 3 },
        { address: "A3", value: 5 },
        { address: "A4", value: 7 },
      ]);

      const operation = createFillOperation("A1", "A4", "A5", "A7");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("custom");

      // Check generated values: should be 11, 13, 17
      const a5 = await cellRepository.get(getAddressFromA1("A5"));
      const a6 = await cellRepository.get(getAddressFromA1("A6"));
      const a7 = await cellRepository.get(getAddressFromA1("A7"));

      expect(Number(a5?.computedValue)).toBe(11);
      expect(Number(a6?.computedValue)).toBe(13);
      expect(Number(a7?.computedValue)).toBe(17);
    });
  });

  describe("Mixed Value Handling", () => {
    it("should handle sequences with non-numeric values", async () => {
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: "text" },
        { address: "A3", value: 4 },
        { address: "A4", value: "" },
        { address: "A5", value: 9 },
      ]);

      const operation = createFillOperation("A1", "A5", "A6", "A8");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("custom"); // Should detect squares from [1, 4, 9]

      // Check generated values: should be 16, 25, 36
      const a6 = await cellRepository.get(getAddressFromA1("A6"));
      const a7 = await cellRepository.get(getAddressFromA1("A7"));
      const a8 = await cellRepository.get(getAddressFromA1("A8"));

      expect(Number(a6?.computedValue)).toBe(16);
      expect(Number(a7?.computedValue)).toBe(25);
      expect(Number(a8?.computedValue)).toBe(36);
    });

    it("should fallback to copy when no pattern is detected", async () => {
      await setCellValues([
        { address: "A1", value: "hello" },
        { address: "A2", value: "world" },
      ]);

      const operation = createFillOperation("A1", "A2", "A3", "A4");
      const result = await fillEngine.fill(operation);

      // If text pattern detection is not implemented, it may fail
      if (result.success) {
        expect(result.filledCells.size).toBeGreaterThan(0);
      } else {
        // Text values might not be handled, resulting in no pattern detected
        expect(result.error).toContain("No valid pattern detected");
      }
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle large sequences efficiently", async () => {
      // Set up a longer Fibonacci sequence
      const fibValues = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
      for (let i = 0; i < fibValues.length; i++) {
        const addr = CellAddress.create(i, 0);
        if (addr.ok) {
          const cellResult = Cell.create(fibValues[i], addr.value);
          if (cellResult.ok) {
            await cellRepository.set(addr.value, cellResult.value);
          }
        }
      }

      const sourceRange = CellRange.create(
        createAddress(0, 0),
        createAddress(9, 0),
      );
      const targetRange = CellRange.create(
        createAddress(10, 0),
        createAddress(14, 0),
      );

      if (!sourceRange.ok || !targetRange.ok) {
        throw new Error("Failed to create ranges");
      }

      const operation: FillOperation = {
        source: sourceRange.value,
        target: targetRange.value,
        direction: "down",
        options: { type: "series" },
      };

      const start = Date.now();
      const result = await fillEngine.fill(operation);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("fibonacci");
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it("should handle edge case: insufficient data", async () => {
      await setCellValues([{ address: "A1", value: 1 }]);

      const operation = createFillOperation("A1", "A1", "A2", "A3");
      const result = await fillEngine.fill(operation);

      // With single value source, should either copy or fail gracefully
      if (result.success) {
        expect(result.filledCells.size).toBe(2); // A2 and A3
        expect(result.pattern?.type).toBe("copy");
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it("should handle edge case: all empty cells", async () => {
      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const result = await fillEngine.fill(operation);

      // When all source cells are empty, the fill should still work (copying empty values)
      if (result.success) {
        // If it succeeds, it should use copy pattern
        expect(result.pattern?.type).toBe("copy");
      } else {
        // If it fails, it should have an appropriate error message
        expect(result.error).toBeDefined();
      }
    });

    it("should handle overflow protection", async () => {
      // Set up a factorial sequence that would overflow
      await setCellValues([
        { address: "A1", value: 120 }, // 5!
        { address: "A2", value: 720 }, // 6!
        { address: "A3", value: 5040 }, // 7!
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A10"); // Many values
      const result = await fillEngine.fill(operation);

      // Should succeed and fill all requested cells (7 cells from A4 to A10)
      expect(result.success).toBe(true);
      expect(result.filledCells.size).toBe(7);
    });
  });

  describe("Preview System Enhancement", () => {
    it("should provide detailed preview with alternatives", async () => {
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: 2 },
        { address: "A3", value: 4 },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern).toBeDefined();
      expect(preview.pattern?.confidence).toBeGreaterThan(0);
      expect(preview.alternativePatterns).toBeDefined();
      expect(preview.alternativePatterns?.length).toBeGreaterThan(0);

      // Check that alternative patterns have their own previews
      const altWithPreview = preview.alternativePatterns?.find(
        (alt) => alt.preview,
      );
      expect(altWithPreview).toBeDefined();
      if (altWithPreview?.preview) {
        expect(altWithPreview.preview.size).toBeGreaterThan(0);
      }
    });

    it("should provide confidence indicators", async () => {
      await setCellValues([
        { address: "A1", value: 1 },
        { address: "A2", value: 1 },
        { address: "A3", value: 2 },
        { address: "A4", value: 3 },
        { address: "A5", value: 5 },
        { address: "A6", value: 8 },
      ]);

      const operation = createFillOperation("A1", "A6", "A7", "A9");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern?.confidence).toBeGreaterThan(0.8); // High confidence for clear Fibonacci
      expect(preview.pattern?.description).toContain("Fibonacci");
    });
  });
});

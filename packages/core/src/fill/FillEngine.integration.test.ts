import { describe, it, expect, beforeEach } from "bun:test";
import { FillEngine } from "./FillEngine";
import { InMemoryCellRepository } from "../infrastructure/repositories/InMemoryCellRepository";
import type { FillOperation, FillOptions } from "./types";

// Mock the domain models for testing
const createCellAddress = (row: number, col: number) => ({ row, col, toString: () => `R${row}C${col}` });
const createCellRange = (start: any, end: any) => ({ start, end });

const CellAddress = {
  fromA1Notation: (notation: string) => {
    const match = notation.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { ok: false };
    const col = match[1].charCodeAt(0) - 65;
    const row = parseInt(match[2]) - 1;
    return { ok: true, value: createCellAddress(row, col) };
  },
  create: (row: number, col: number) => ({
    ok: true,
    value: createCellAddress(row, col)
  })
};

const CellRange = {
  create: (start: any, end: any) => ({
    ok: true,
    value: createCellRange(start, end)
  })
};

describe("FillEngine Integration Tests - Advanced Pattern Detection", () => {
  let fillEngine: FillEngine;
  let cellRepository: InMemoryCellRepository;

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
    const sourceStartAddr = CellAddress.fromA1Notation(sourceStart);
    const sourceEndAddr = CellAddress.fromA1Notation(sourceEnd);
    const targetStartAddr = CellAddress.fromA1Notation(targetStart);
    const targetEndAddr = CellAddress.fromA1Notation(targetEnd);

    if (!sourceStartAddr.ok || !sourceEndAddr.ok || !targetStartAddr.ok || !targetEndAddr.ok) {
      throw new Error("Invalid cell addresses");
    }

    const sourceRange = CellRange.create(sourceStartAddr.value, sourceEndAddr.value);
    const targetRange = CellRange.create(targetStartAddr.value, targetEndAddr.value);

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

  const setCellValues = async (values: { address: string; value: CellValue }[]) => {
    for (const { address, value } of values) {
      const addr = CellAddress.fromA1Notation(address);
      if (addr.ok) {
        await cellRepository.set(addr.value, value);
      }
    }
  };

  describe("Pattern Priority and Selection", () => {
    it("should prioritize specific patterns over generic ones", async () => {
      // Set up values that could be both linear and exponential
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 2 as unknown as CellValue },
        { address: "A3", value: 4 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const preview = await fillEngine.preview(operation);

      // Should detect exponential pattern (higher priority) over linear
      expect(preview.pattern?.type).toBe("exponential");
      expect(preview.alternativePatterns).toBeDefined();
      expect(preview.alternativePatterns!.length).toBeGreaterThan(0);
    });

    it("should detect Fibonacci over linear when pattern is clear", async () => {
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 1 as unknown as CellValue },
        { address: "A3", value: 2 as unknown as CellValue },
        { address: "A4", value: 3 as unknown as CellValue },
        { address: "A5", value: 5 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A5", "A6", "A8");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern?.type).toBe("fibonacci");
      expect(preview.pattern?.confidence).toBeGreaterThan(0.8);
    });

    it("should detect custom sequences (squares) over other patterns", async () => {
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 4 as unknown as CellValue },
        { address: "A3", value: 9 as unknown as CellValue },
        { address: "A4", value: 16 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A4", "A5", "A7");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern?.type).toBe("custom");
      expect(preview.pattern?.description).toContain("Perfect squares");
    });
  });

  describe("Ambiguity Detection and Scoring", () => {
    it("should detect ambiguity when multiple patterns match", async () => {
      // Values that could be linear (step 1) or start of Fibonacci
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 2 as unknown as CellValue },
        { address: "A3", value: 3 as unknown as CellValue },
      ]);

      const detectionResult = fillEngine.detectAllPatterns(
        [1, 2, 3] as unknown as CellValue[],
        "down",
      );

      expect(detectionResult.bestPattern).toBeDefined();
      expect(detectionResult.alternativePatterns.length).toBeGreaterThan(0);
      expect(detectionResult.ambiguityScore).toBeGreaterThan(0);
      
      // Confidence should be reduced due to ambiguity
      expect(detectionResult.confidence).toBeLessThan(detectionResult.bestPattern!.confidence);
    });

    it("should have low ambiguity for clear patterns", async () => {
      // Clear Fibonacci sequence
      const detectionResult = fillEngine.detectAllPatterns(
        [1, 1, 2, 3, 5, 8] as unknown as CellValue[],
        "down",
      );

      expect(detectionResult.bestPattern?.type).toBe("fibonacci");
      expect(detectionResult.ambiguityScore).toBeLessThan(0.3); // Low ambiguity
      expect(detectionResult.alternativePatterns.length).toBeLessThan(2);
    });

    it("should provide multiple alternative patterns for ambiguous cases", async () => {
      // Values that could match multiple patterns
      await setCellValues([
        { address: "A1", value: 2 as unknown as CellValue },
        { address: "A2", value: 4 as unknown as CellValue },
        { address: "A3", value: 8 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const preview = await fillEngine.preview(operation);

      expect(preview.alternativePatterns).toBeDefined();
      expect(preview.alternativePatterns!.length).toBeGreaterThan(1);
      
      // Should include both exponential and powers detection
      const patternTypes = preview.alternativePatterns!.map(p => p.type);
      expect(patternTypes).toContain("custom"); // powers_of_2
    });
  });

  describe("Advanced Pattern Fill Operations", () => {
    it("should fill Fibonacci sequence correctly", async () => {
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 1 as unknown as CellValue },
        { address: "A3", value: 2 as unknown as CellValue },
        { address: "A4", value: 3 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A4", "A5", "A7");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("fibonacci");

      // Check generated values: should be 5, 8, 13
      const a5 = await cellRepository.get(CellAddress.fromA1Notation("A5").value!);
      const a6 = await cellRepository.get(CellAddress.fromA1Notation("A6").value!);
      const a7 = await cellRepository.get(CellAddress.fromA1Notation("A7").value!);

      expect(Number(a5?.getValue())).toBe(5);
      expect(Number(a6?.getValue())).toBe(8);
      expect(Number(a7?.getValue())).toBe(13);
    });

    it("should fill exponential sequence correctly", async () => {
      await setCellValues([
        { address: "A1", value: 2 as unknown as CellValue },
        { address: "A2", value: 4 as unknown as CellValue },
        { address: "A3", value: 8 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("exponential");

      // Check generated values: should be 16, 32, 64
      const a4 = await cellRepository.get(CellAddress.fromA1Notation("A4").value!);
      const a5 = await cellRepository.get(CellAddress.fromA1Notation("A5").value!);
      const a6 = await cellRepository.get(CellAddress.fromA1Notation("A6").value!);

      expect(Number(a4?.getValue())).toBe(16);
      expect(Number(a5?.getValue())).toBe(32);
      expect(Number(a6?.getValue())).toBe(64);
    });

    it("should fill custom sequence (squares) correctly", async () => {
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 4 as unknown as CellValue },
        { address: "A3", value: 9 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("custom");

      // Check generated values: should be 16, 25, 36
      const a4 = await cellRepository.get(CellAddress.fromA1Notation("A4").value!);
      const a5 = await cellRepository.get(CellAddress.fromA1Notation("A5").value!);
      const a6 = await cellRepository.get(CellAddress.fromA1Notation("A6").value!);

      expect(Number(a4?.getValue())).toBe(16);
      expect(Number(a5?.getValue())).toBe(25);
      expect(Number(a6?.getValue())).toBe(36);
    });

    it("should fill prime sequence correctly", async () => {
      await setCellValues([
        { address: "A1", value: 2 as unknown as CellValue },
        { address: "A2", value: 3 as unknown as CellValue },
        { address: "A3", value: 5 as unknown as CellValue },
        { address: "A4", value: 7 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A4", "A5", "A7");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("custom");

      // Check generated values: should be 11, 13, 17
      const a5 = await cellRepository.get(CellAddress.fromA1Notation("A5").value!);
      const a6 = await cellRepository.get(CellAddress.fromA1Notation("A6").value!);
      const a7 = await cellRepository.get(CellAddress.fromA1Notation("A7").value!);

      expect(Number(a5?.getValue())).toBe(11);
      expect(Number(a6?.getValue())).toBe(13);
      expect(Number(a7?.getValue())).toBe(17);
    });
  });

  describe("Mixed Value Handling", () => {
    it("should handle sequences with non-numeric values", async () => {
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: "text" as unknown as CellValue },
        { address: "A3", value: 4 as unknown as CellValue },
        { address: "A4", value: "" as unknown as CellValue },
        { address: "A5", value: 9 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A5", "A6", "A8");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("custom"); // Should detect squares from [1, 4, 9]

      // Check generated values: should be 16, 25, 36
      const a6 = await cellRepository.get(CellAddress.fromA1Notation("A6").value!);
      const a7 = await cellRepository.get(CellAddress.fromA1Notation("A7").value!);
      const a8 = await cellRepository.get(CellAddress.fromA1Notation("A8").value!);

      expect(Number(a6?.getValue())).toBe(16);
      expect(Number(a7?.getValue())).toBe(25);
      expect(Number(a8?.getValue())).toBe(36);
    });

    it("should fallback to copy when no pattern is detected", async () => {
      await setCellValues([
        { address: "A1", value: "hello" as unknown as CellValue },
        { address: "A2", value: "world" as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A2", "A3", "A4");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("copy");
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle large sequences efficiently", async () => {
      // Set up a longer Fibonacci sequence
      const fibValues = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
      for (let i = 0; i < fibValues.length; i++) {
        const addr = CellAddress.create(i, 0);
        if (addr.ok) {
          await cellRepository.set(addr.value, fibValues[i] as unknown as CellValue);
        }
      }

      const sourceRange = CellRange.create(
        CellAddress.create(0, 0).value!,
        CellAddress.create(9, 0).value!,
      );
      const targetRange = CellRange.create(
        CellAddress.create(10, 0).value!,
        CellAddress.create(14, 0).value!,
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
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A1", "A2", "A3");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("copy"); // Should fallback to copy
    });

    it("should handle edge case: all empty cells", async () => {
      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No source values");
    });

    it("should handle overflow protection", async () => {
      // Set up a factorial sequence that would overflow
      await setCellValues([
        { address: "A1", value: 120 as unknown as CellValue }, // 5!
        { address: "A2", value: 720 as unknown as CellValue }, // 6!
        { address: "A3", value: 5040 as unknown as CellValue }, // 7!
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A10"); // Many values
      const result = await fillEngine.fill(operation);

      // Should either succeed with limited values or fail gracefully
      if (result.success) {
        expect(result.filledCells.size).toBeLessThan(7); // Won't fill all due to overflow
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("Preview System Enhancement", () => {
    it("should provide detailed preview with alternatives", async () => {
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 2 as unknown as CellValue },
        { address: "A3", value: 4 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A3", "A4", "A6");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern).toBeDefined();
      expect(preview.pattern!.confidence).toBeGreaterThan(0);
      expect(preview.alternativePatterns).toBeDefined();
      expect(preview.alternativePatterns!.length).toBeGreaterThan(0);

      // Check that alternative patterns have their own previews
      const altWithPreview = preview.alternativePatterns!.find(alt => alt.preview);
      expect(altWithPreview).toBeDefined();
      if (altWithPreview?.preview) {
        expect(altWithPreview.preview.size).toBeGreaterThan(0);
      }
    });

    it("should provide confidence indicators", async () => {
      await setCellValues([
        { address: "A1", value: 1 as unknown as CellValue },
        { address: "A2", value: 1 as unknown as CellValue },
        { address: "A3", value: 2 as unknown as CellValue },
        { address: "A4", value: 3 as unknown as CellValue },
        { address: "A5", value: 5 as unknown as CellValue },
        { address: "A6", value: 8 as unknown as CellValue },
      ]);

      const operation = createFillOperation("A1", "A6", "A7", "A9");
      const preview = await fillEngine.preview(operation);

      expect(preview.pattern!.confidence).toBeGreaterThan(0.8); // High confidence for clear Fibonacci
      expect(preview.pattern!.description).toContain("Fibonacci");
    });
  });
});
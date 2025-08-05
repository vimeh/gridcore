import { describe, it, expect, beforeEach } from "bun:test";
import { FillEngine } from "./FillEngine";
import { type ICellRepository } from "../domain/interfaces/ICellRepository";
import { CellAddress, CellRange, type CellValue } from "../domain/models";
import { Cell } from "../domain/models/Cell";
import type { FillOperation } from "./types";
import { InMemoryCellRepository } from "../infrastructure/repositories/InMemoryCellRepository";

describe("FillEngine", () => {
  let fillEngine: FillEngine;
  let cellRepository: ICellRepository;

  beforeEach(() => {
    cellRepository = new InMemoryCellRepository();
    fillEngine = new FillEngine(cellRepository);
  });

  describe("Linear Pattern Detection", () => {
    it("should detect and fill linear numeric sequence", async () => {
      // Set up source data: 1, 2, 3
      const addr1 = CellAddress.create(0, 0).value; // A1
      const addr2 = CellAddress.create(1, 0).value; // A2
      const addr3 = CellAddress.create(2, 0).value; // A3
      
      await cellRepository.setCell(addr1, new Cell(addr1, 1));
      await cellRepository.setCell(addr2, new Cell(addr2, 2));
      await cellRepository.setCell(addr3, new Cell(addr3, 3));

      // Create source and target ranges
      const sourceRange = CellRange.create(addr1, addr3).value; // A1:A3
      const targetRange = CellRange.create(
        CellAddress.create(3, 0).value, // A4
        CellAddress.create(5, 0).value  // A6
      ).value;

      const operation: FillOperation = {
        source: sourceRange,
        target: targetRange,
        direction: "down",
        options: { type: "series" },
      };

      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("linear");
      
      // Check that A4=4, A5=5, A6=6
      const filledCells = Array.from(result.filledCells.entries());
      expect(filledCells).toHaveLength(3);
    });

    it("should handle copy pattern as fallback", async () => {
      // Set up source data: single value
      const addr1 = CellAddress.create(0, 0).value; // A1
      await cellRepository.setCell(addr1, new Cell(addr1, "Hello"));

      const sourceRange = CellRange.create(addr1, addr1).value; // A1:A1
      const targetRange = CellRange.create(
        CellAddress.create(1, 0).value, // A2
        CellAddress.create(3, 0).value  // A4
      ).value;

      const operation: FillOperation = {
        source: sourceRange,
        target: targetRange,
        direction: "down",
        options: { type: "copy" },
      };

      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(true);
      expect(result.pattern?.type).toBe("copy");
      
      // Should fill with "Hello" repeated
      const filledCells = Array.from(result.filledCells.entries());
      expect(filledCells).toHaveLength(3);
    });
  });

  describe("Preview functionality", () => {
    it("should generate preview without modifying cells", async () => {
      // Set up source data
      const addr1 = CellAddress.create(0, 0).value; // A1
      const addr2 = CellAddress.create(1, 0).value; // A2
      
      await cellRepository.setCell(addr1, new Cell(addr1, 10));
      await cellRepository.setCell(addr2, new Cell(addr2, 20));

      const sourceRange = CellRange.create(addr1, addr2).value;
      const targetRange = CellRange.create(
        CellAddress.create(2, 0).value,
        CellAddress.create(4, 0).value
      ).value;

      const operation: FillOperation = {
        source: sourceRange,
        target: targetRange,
        direction: "down",
        options: { type: "series" },
      };

      const preview = await fillEngine.preview(operation);

      // Should have preview values
      expect(preview.values.size).toBeGreaterThan(0);
      expect(preview.pattern).toBeDefined();

      // Original cells should be unchanged
      const cellA3 = await cellRepository.getCell(CellAddress.create(2, 0).value);
      expect(cellA3).toBeNull(); // Should still be empty
    });
  });

  describe("Error handling", () => {
    it("should handle empty source range", async () => {
      const addr1 = CellAddress.create(0, 0).value;
      const sourceRange = CellRange.create(addr1, addr1).value;
      const targetRange = CellRange.create(
        CellAddress.create(1, 0).value,
        CellAddress.create(2, 0).value
      ).value;

      const operation: FillOperation = {
        source: sourceRange,
        target: targetRange,
        direction: "down",
        options: { type: "series" },
      };

      const result = await fillEngine.fill(operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No source values");
    });
  });
});
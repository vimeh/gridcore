import { beforeEach, describe, expect, test } from "bun:test";
import { Sheet } from "./Sheet";
import type { CellAddress } from "./types";
import type { WorkbookState } from "./types/WorkbookState";
import { Workbook } from "./Workbook";

describe("WorkbookState", () => {
  let workbook: Workbook;

  beforeEach(() => {
    workbook = new Workbook();
  });

  describe("Sheet state management", () => {
    test("converts sheet to state", () => {
      const sheet = workbook.getActiveSheet();
      sheet.setName("Test Sheet");
      sheet.setHidden(true);
      sheet.setProtected(true);

      const address: CellAddress = { row: 0, col: 0 };
      sheet.getEngine().setCell(address, "Test Value");

      const state = sheet.toState();

      expect(state.id).toBe(sheet.getId());
      expect(state.name).toBe("Test Sheet");
      expect(state.index).toBe(0);
      expect(state.hidden).toBe(true);
      expect(state.protected).toBe(true);
      expect(state.cells).toBeDefined();
      expect(state.dimensions).toBeDefined();
    });

    test("restores sheet from state", () => {
      const sheet = workbook.getActiveSheet();
      sheet.setName("Original");
      sheet.setHidden(true);

      const address: CellAddress = { row: 1, col: 1 };
      sheet.getEngine().setCell(address, 42);

      const state = sheet.toState();
      const restored = Sheet.fromState(state);

      expect(restored.getId()).toBe(sheet.getId());
      expect(restored.getName()).toBe("Original");
      expect(restored.isHidden()).toBe(true);
      expect(restored.getEngine().getCell(address)?.rawValue).toBe(42);
    });

    test("preserves formulas in state", () => {
      const sheet = workbook.getActiveSheet();
      const address: CellAddress = { row: 0, col: 0 };
      sheet.getEngine().setCell(address, "=A2+B2", "=A2+B2");

      const state = sheet.toState();
      const restored = Sheet.fromState(state);

      const cell = restored.getEngine().getCell(address);
      expect(cell?.formula).toBe("=A2+B2");
    });
  });

  describe("Workbook state management", () => {
    test("converts workbook to state with default options", () => {
      workbook.setTitle("Test Workbook");
      workbook.setAuthor("Test Author");

      const sheet2 = workbook.addSheet("Sheet2");
      const address: CellAddress = { row: 0, col: 0 };
      sheet2.getEngine().setCell(address, "Data");

      workbook.setActiveSheet(sheet2.getId());

      const state = workbook.toState();

      expect(state.version).toBe("2.0");
      expect(state.sheets.length).toBe(2);
      expect(state.activeSheetId).toBe(sheet2.getId());
      expect(state.sheetOrder).toEqual(workbook.sheetOrder);
      expect(state.metadata?.title).toBe("Test Workbook");
      expect(state.metadata?.author).toBe("Test Author");
    });

    test("excludes hidden sheets when option is false", () => {
      const sheet2 = workbook.addSheet("Hidden Sheet");
      sheet2.setHidden(true);

      const _sheet3 = workbook.addSheet("Visible Sheet");

      const state = workbook.toState({ includeHiddenSheets: false });

      expect(state.sheets.length).toBe(2); // Sheet1 and Visible Sheet
      expect(
        state.sheets.find((s) => s.name === "Hidden Sheet"),
      ).toBeUndefined();
    });

    test("includes hidden sheets when option is true", () => {
      const sheet2 = workbook.addSheet("Hidden Sheet");
      sheet2.setHidden(true);

      const state = workbook.toState({ includeHiddenSheets: true });

      expect(state.sheets.length).toBe(2);
      expect(state.sheets.find((s) => s.name === "Hidden Sheet")).toBeDefined();
    });

    test("excludes metadata when option is false", () => {
      workbook.setTitle("Test Workbook");

      const state = workbook.toState({ includeMetadata: false });

      expect(state.metadata).toBeUndefined();
    });

    test("restores workbook from state", () => {
      // Setup original workbook
      workbook.setTitle("Original Workbook");
      workbook.setAuthor("Original Author");

      const sheet2 = workbook.addSheet("Sheet2");
      const sheet3 = workbook.addSheet("Sheet3");

      sheet2.setHidden(true);
      sheet3.setProtected(true);

      const address: CellAddress = { row: 2, col: 3 };
      sheet2.getEngine().setCell(address, "Test Data");

      workbook.setActiveSheet(sheet3.getId());
      workbook.moveSheet(sheet3.getId(), 0);

      // Convert to state and restore
      const state = workbook.toState({ includeHiddenSheets: true });
      const restored = Workbook.fromState(state);

      // Verify structure
      expect(restored.getSheetCount()).toBe(3);
      expect(restored.getMetadata().title).toBe("Original Workbook");
      expect(restored.getMetadata().author).toBe("Original Author");

      // Verify sheet order
      const restoredSheets = restored.getAllSheets();
      expect(restoredSheets[0].getName()).toBe("Sheet3");
      expect(restoredSheets[1].getName()).toBe("Sheet1");
      expect(restoredSheets[2].getName()).toBe("Sheet2");

      // Verify sheet properties
      const restoredSheet2 = restored.getSheetByName("Sheet2");
      const restoredSheet3 = restored.getSheetByName("Sheet3");

      expect(restoredSheet2?.isHidden()).toBe(true);
      expect(restoredSheet3?.isProtected()).toBe(true);

      // Verify data
      expect(restoredSheet2?.getEngine().getCell(address)?.rawValue).toBe(
        "Test Data",
      );

      // Verify active sheet
      expect(restored.getActiveSheet().getName()).toBe("Sheet3");
    });

    test("handles empty workbook state", () => {
      const state: WorkbookState = {
        version: "2.0",
        sheets: [],
        activeSheetId: "",
        sheetOrder: [],
      };

      // Should create a workbook with at least one sheet
      const workbook = Workbook.fromState(state);
      expect(workbook.getSheetCount()).toBeGreaterThan(0);
    });

    test("preserves sheet IDs in state", () => {
      const sheet1Id = workbook.getActiveSheet().getId();
      const sheet2 = workbook.addSheet("Sheet2");
      const sheet2Id = sheet2.getId();

      const state = workbook.toState();
      const restored = Workbook.fromState(state);

      expect(restored.getSheetById(sheet1Id)).toBeDefined();
      expect(restored.getSheetById(sheet2Id)).toBeDefined();
    });

    test("state version compatibility", () => {
      const state = workbook.toState();
      expect(state.version).toBe("2.0");

      // Future: Could add version migration logic tests here
    });
  });

  describe("State round-trip integrity", () => {
    test("maintains data integrity through state conversion", () => {
      // Create complex workbook
      workbook.setTitle("Complex Workbook");

      // Add multiple sheets with different properties
      const sheet2 = workbook.addSheet("Sales Data");
      const sheet3 = workbook.addSheet("Hidden Report");
      const sheet4 = workbook.addSheet("Protected Summary");

      sheet3.setHidden(true);
      sheet4.setProtected(true);

      // Add various data types
      const addresses = [
        { address: { row: 0, col: 0 }, value: "Text", sheet: sheet2 },
        { address: { row: 1, col: 1 }, value: 123.45, sheet: sheet2 },
        { address: { row: 2, col: 2 }, value: true, sheet: sheet3 },
        { address: { row: 3, col: 3 }, value: "=A1+B2", sheet: sheet4 },
      ];

      for (const { address, value, sheet } of addresses) {
        if (typeof value === "string" && value.startsWith("=")) {
          sheet.getEngine().setCell(address, value, value);
        } else {
          sheet.getEngine().setCell(address, value);
        }
      }

      // Reorder sheets
      workbook.moveSheet(sheet4.getId(), 1);
      workbook.setActiveSheet(sheet2.getId());

      // Convert to state and back
      const state = workbook.toState({ includeHiddenSheets: true });
      const restored = Workbook.fromState(state);

      // Verify all data is preserved
      expect(restored.getSheetCount()).toBe(4);
      expect(restored.getActiveSheet().getName()).toBe("Sales Data");

      const restoredSheets = restored.getAllSheets();
      expect(restoredSheets[0].getName()).toBe("Sheet1");
      expect(restoredSheets[1].getName()).toBe("Protected Summary");
      expect(restoredSheets[2].getName()).toBe("Sales Data");
      expect(restoredSheets[3].getName()).toBe("Hidden Report");

      // Verify data preservation
      const restoredSheet2 = restored.getSheetByName("Sales Data")!;
      const restoredSheet3 = restored.getSheetByName("Hidden Report")!;
      const restoredSheet4 = restored.getSheetByName("Protected Summary")!;

      expect(
        restoredSheet2.getEngine().getCell({ row: 0, col: 0 })?.rawValue,
      ).toBe("Text");
      expect(
        restoredSheet2.getEngine().getCell({ row: 1, col: 1 })?.rawValue,
      ).toBe(123.45);
      expect(
        restoredSheet3.getEngine().getCell({ row: 2, col: 2 })?.rawValue,
      ).toBe(true);
      expect(
        restoredSheet4.getEngine().getCell({ row: 3, col: 3 })?.formula,
      ).toBe("=A1+B2");

      // Verify properties
      expect(restoredSheet3.isHidden()).toBe(true);
      expect(restoredSheet4.isProtected()).toBe(true);
    });
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import type { CellAddress } from "./types";
import { Workbook } from "./Workbook";

describe("Workbook", () => {
  let workbook: Workbook;

  beforeEach(() => {
    workbook = new Workbook();
  });

  describe("constructor", () => {
    test("creates workbook with default sheet", () => {
      expect(workbook.getSheetCount()).toBe(1);
      const defaultSheet = workbook.getActiveSheet();
      expect(defaultSheet.getName()).toBe("Sheet1");
      expect(defaultSheet.getIndex()).toBe(0);
    });

    test("sets initial metadata", () => {
      const metadata = workbook.getMetadata();
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.modifiedAt).toBeInstanceOf(Date);
      expect(metadata.title).toBeUndefined();
      expect(metadata.author).toBeUndefined();
    });
  });

  describe("sheet management", () => {
    test("adds new sheet with auto-generated name", () => {
      const sheet2 = workbook.addSheet();
      expect(sheet2.getName()).toBe("Sheet2");
      expect(sheet2.getIndex()).toBe(1);
      expect(workbook.getSheetCount()).toBe(2);
    });

    test("adds new sheet with custom name", () => {
      const customSheet = workbook.addSheet("Custom Sheet");
      expect(customSheet.getName()).toBe("Custom Sheet");
      expect(workbook.getSheetCount()).toBe(2);
    });

    test("ensures unique sheet names", () => {
      const sheet2 = workbook.addSheet("Sheet1");
      expect(sheet2.getName()).toBe("Sheet1 (1)");

      const sheet3 = workbook.addSheet("Sheet1");
      expect(sheet3.getName()).toBe("Sheet1 (2)");
    });

    test("generates sequential default names", () => {
      const sheet2 = workbook.addSheet();
      const sheet3 = workbook.addSheet();
      const sheet4 = workbook.addSheet();

      expect(sheet2.getName()).toBe("Sheet2");
      expect(sheet3.getName()).toBe("Sheet3");
      expect(sheet4.getName()).toBe("Sheet4");
    });

    test("removes sheet", () => {
      const sheet2 = workbook.addSheet("ToRemove");
      const sheet2Id = sheet2.getId();

      expect(workbook.removeSheet(sheet2Id)).toBe(true);
      expect(workbook.getSheetCount()).toBe(1);
      expect(workbook.getSheetById(sheet2Id)).toBeUndefined();
    });

    test("cannot remove last sheet", () => {
      const sheet1Id = workbook.getActiveSheet().getId();

      expect(() => workbook.removeSheet(sheet1Id)).toThrow(
        "Cannot remove the last sheet in the workbook",
      );
    });

    test("switches active sheet when removing active sheet", () => {
      const sheet2 = workbook.addSheet("Sheet2");
      const _sheet3 = workbook.addSheet("Sheet3");

      workbook.setActiveSheet(sheet2.getId());
      workbook.removeSheet(sheet2.getId());

      // Should switch to previous sheet (Sheet1)
      expect(workbook.getActiveSheet().getName()).toBe("Sheet1");
    });

    test("returns false when removing non-existent sheet", () => {
      expect(workbook.removeSheet("non-existent-id")).toBe(false);
    });
  });

  describe("sheet access", () => {
    test("gets sheet by ID", () => {
      const sheet2 = workbook.addSheet("Sheet2");
      const found = workbook.getSheetById(sheet2.getId());
      expect(found).toBe(sheet2);
    });

    test("gets sheet by name", () => {
      const sheet2 = workbook.addSheet("Custom Name");
      const found = workbook.getSheetByName("Custom Name");
      expect(found).toBe(sheet2);
    });

    test("gets sheet by index", () => {
      const _sheet2 = workbook.addSheet("Sheet2");
      const _sheet3 = workbook.addSheet("Sheet3");

      expect(workbook.getSheetByIndex(0)?.getName()).toBe("Sheet1");
      expect(workbook.getSheetByIndex(1)?.getName()).toBe("Sheet2");
      expect(workbook.getSheetByIndex(2)?.getName()).toBe("Sheet3");
    });

    test("returns undefined for invalid index", () => {
      expect(workbook.getSheetByIndex(-1)).toBeUndefined();
      expect(workbook.getSheetByIndex(999)).toBeUndefined();
    });

    test("gets all sheets in order", () => {
      const _sheet2 = workbook.addSheet("Sheet2");
      const _sheet3 = workbook.addSheet("Sheet3");

      const allSheets = workbook.getAllSheets();
      expect(allSheets.length).toBe(3);
      expect(allSheets[0].getName()).toBe("Sheet1");
      expect(allSheets[1].getName()).toBe("Sheet2");
      expect(allSheets[2].getName()).toBe("Sheet3");
    });
  });

  describe("active sheet management", () => {
    test("gets active sheet", () => {
      const activeSheet = workbook.getActiveSheet();
      expect(activeSheet.getName()).toBe("Sheet1");
    });

    test("sets active sheet", () => {
      const sheet2 = workbook.addSheet("Sheet2");
      workbook.setActiveSheet(sheet2.getId());

      expect(workbook.getActiveSheet()).toBe(sheet2);
    });

    test("throws error when setting invalid active sheet", () => {
      expect(() => workbook.setActiveSheet("invalid-id")).toThrow(
        "Sheet with id invalid-id not found",
      );
    });
  });

  describe("sheet renaming", () => {
    test("renames sheet", () => {
      const sheet1Id = workbook.getActiveSheet().getId();
      workbook.renameSheet(sheet1Id, "Renamed Sheet");

      expect(workbook.getActiveSheet().getName()).toBe("Renamed Sheet");
    });

    test("ensures unique name when renaming", () => {
      const _sheet2 = workbook.addSheet("Sheet2");
      const sheet1Id = workbook.getActiveSheet().getId();

      workbook.renameSheet(sheet1Id, "Sheet2");
      expect(workbook.getActiveSheet().getName()).toBe("Sheet2 (1)");
    });

    test("allows renaming to same name", () => {
      const sheet1Id = workbook.getActiveSheet().getId();
      workbook.renameSheet(sheet1Id, "Sheet1");
      expect(workbook.getActiveSheet().getName()).toBe("Sheet1");
    });

    test("throws error for invalid sheet ID", () => {
      expect(() => workbook.renameSheet("invalid-id", "New Name")).toThrow(
        "Sheet with id invalid-id not found",
      );
    });
  });

  describe("sheet reordering", () => {
    test("moves sheet to new position", () => {
      const sheet2 = workbook.addSheet("Sheet2");
      const sheet3 = workbook.addSheet("Sheet3");

      // Move Sheet3 to position 0
      workbook.moveSheet(sheet3.getId(), 0);

      const allSheets = workbook.getAllSheets();
      expect(allSheets[0].getName()).toBe("Sheet3");
      expect(allSheets[1].getName()).toBe("Sheet1");
      expect(allSheets[2].getName()).toBe("Sheet2");

      // Check indices are updated
      expect(sheet3.getIndex()).toBe(0);
      expect(workbook.getActiveSheet().getIndex()).toBe(1);
      expect(sheet2.getIndex()).toBe(2);
    });

    test("does nothing when moving to same position", () => {
      const sheet2 = workbook.addSheet("Sheet2");
      const _originalModifiedAt = workbook.getMetadata().modifiedAt;

      // Move to same position
      workbook.moveSheet(sheet2.getId(), 1);

      expect(sheet2.getIndex()).toBe(1);
    });

    test("throws error for invalid sheet ID", () => {
      expect(() => workbook.moveSheet("invalid-id", 0)).toThrow(
        "Sheet with id invalid-id not found",
      );
    });

    test("throws error for invalid index", () => {
      const sheet1Id = workbook.getActiveSheet().getId();

      expect(() => workbook.moveSheet(sheet1Id, -1)).toThrow(
        "Invalid sheet index",
      );
      expect(() => workbook.moveSheet(sheet1Id, 999)).toThrow(
        "Invalid sheet index",
      );
    });
  });

  describe("sheet duplication", () => {
    test("duplicates sheet with data", () => {
      const sheet1 = workbook.getActiveSheet();
      const address: CellAddress = { row: 0, col: 0 };
      sheet1.getEngine().setCell(address, "Test Data");

      const duplicated = workbook.duplicateSheet(sheet1.getId());

      expect(duplicated.getName()).toBe("Sheet1 (Copy)");
      expect(duplicated.getEngine().getCell(address)?.rawValue).toBe(
        "Test Data",
      );
      expect(workbook.getSheetCount()).toBe(2);
    });

    test("ensures unique name for duplicated sheet", () => {
      const sheet1 = workbook.getActiveSheet();

      // First duplication
      const dup1 = workbook.duplicateSheet(sheet1.getId());
      expect(dup1.getName()).toBe("Sheet1 (Copy)");

      // Second duplication
      const dup2 = workbook.duplicateSheet(sheet1.getId());
      expect(dup2.getName()).toBe("Sheet1 (Copy) (1)");
    });

    test("duplicated sheets are independent", () => {
      const sheet1 = workbook.getActiveSheet();
      const address: CellAddress = { row: 0, col: 0 };
      sheet1.getEngine().setCell(address, "Original");

      const duplicated = workbook.duplicateSheet(sheet1.getId());

      // Modify original
      sheet1.getEngine().setCell(address, "Modified");

      // Duplicated should still have original value
      expect(duplicated.getEngine().getCell(address)?.rawValue).toBe(
        "Original",
      );
    });

    test("throws error for invalid sheet ID", () => {
      expect(() => workbook.duplicateSheet("invalid-id")).toThrow(
        "Sheet with id invalid-id not found",
      );
    });
  });

  describe("metadata operations", () => {
    test("sets title", () => {
      workbook.setTitle("My Workbook");
      expect(workbook.getMetadata().title).toBe("My Workbook");
    });

    test("sets author", () => {
      workbook.setAuthor("John Doe");
      expect(workbook.getMetadata().author).toBe("John Doe");
    });

    test("updates modifiedAt when changing metadata", (done) => {
      const originalModifiedAt = workbook.getMetadata().modifiedAt;

      setTimeout(() => {
        workbook.setTitle("Updated Title");
        expect(workbook.getMetadata().modifiedAt.getTime()).toBeGreaterThan(
          originalModifiedAt.getTime(),
        );
        done();
      }, 10);
    });

    test("getMetadata returns a copy", () => {
      const metadata1 = workbook.getMetadata();
      const metadata2 = workbook.getMetadata();

      expect(metadata1).not.toBe(metadata2);
      expect(metadata1).toEqual(metadata2);

      // Modifying returned metadata doesn't affect workbook
      metadata1.title = "Modified";
      expect(workbook.getMetadata().title).toBeUndefined();
    });
  });

  describe("serialization", () => {
    test("serializes to JSON", () => {
      workbook.setTitle("Test Workbook");
      workbook.setAuthor("Test Author");

      const sheet2 = workbook.addSheet("Sheet2");
      const address: CellAddress = { row: 0, col: 0 };
      sheet2.getEngine().setCell(address, "Test Value");

      workbook.setActiveSheet(sheet2.getId());

      const json = workbook.toJSON();

      expect(json.sheets.length).toBe(2);
      expect(json.activeSheetId).toBe(sheet2.getId());
      expect(json.metadata.title).toBe("Test Workbook");
      expect(json.metadata.author).toBe("Test Author");
      expect(json.sheetOrder.length).toBe(2);
    });

    test("deserializes from JSON", () => {
      // Setup original workbook
      workbook.setTitle("Original Workbook");
      const sheet2 = workbook.addSheet("Custom Sheet");
      const sheet3 = workbook.addSheet("Another Sheet");

      const address: CellAddress = { row: 1, col: 1 };
      sheet2.getEngine().setCell(address, 42);

      workbook.setActiveSheet(sheet2.getId());
      workbook.removeSheet(sheet3.getId());

      // Serialize and deserialize
      const json = workbook.toJSON();
      const restored = Workbook.fromJSON(json);

      // Verify structure
      expect(restored.getSheetCount()).toBe(2);
      expect(restored.getMetadata().title).toBe("Original Workbook");

      // Verify sheets
      const restoredSheets = restored.getAllSheets();
      expect(restoredSheets[0].getName()).toBe("Sheet1");
      expect(restoredSheets[1].getName()).toBe("Custom Sheet");

      // Verify active sheet
      expect(restored.getActiveSheet().getName()).toBe("Custom Sheet");

      // Verify data
      const restoredSheet2 = restored.getSheetByName("Custom Sheet");
      expect(restoredSheet2?.getEngine().getCell(address)?.rawValue).toBe(42);
    });

    test("handles missing active sheet during deserialization", () => {
      const json = workbook.toJSON();
      json.activeSheetId = "non-existent-id";

      const restored = Workbook.fromJSON(json);

      // Should fall back to first sheet
      expect(restored.getActiveSheet().getName()).toBe("Sheet1");
    });

    test("preserves sheet order during serialization", () => {
      const _sheet2 = workbook.addSheet("Sheet2");
      const sheet3 = workbook.addSheet("Sheet3");

      // Reorder sheets
      workbook.moveSheet(sheet3.getId(), 0);

      const json = workbook.toJSON();
      const restored = Workbook.fromJSON(json);

      const restoredSheets = restored.getAllSheets();
      expect(restoredSheets[0].getName()).toBe("Sheet3");
      expect(restoredSheets[1].getName()).toBe("Sheet1");
      expect(restoredSheets[2].getName()).toBe("Sheet2");
    });

    test("generates new IDs during deserialization", () => {
      const originalId = workbook.getActiveSheet().getId();

      const json = workbook.toJSON();
      const restored = Workbook.fromJSON(json);

      const restoredId = restored.getActiveSheet().getId();
      expect(restoredId).not.toBe(originalId);
    });
  });
});

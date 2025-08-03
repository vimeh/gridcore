import { beforeEach, describe, expect, test } from "bun:test";
import { Workbook } from "./Workbook";

describe("Workbook", () => {
  let workbook: Workbook;

  beforeEach(() => {
    workbook = new Workbook();
  });

  test("should create with initial sheet", () => {
    expect(workbook.getSheetCount()).toBe(1);

    const activeSheet = workbook.getActiveSheet();
    expect(activeSheet).toBeDefined();
    expect(activeSheet?.getName()).toBe("Sheet1");
  });

  test("should create new sheets with auto-generated names", () => {
    const sheet2 = workbook.createSheet();
    expect(sheet2.getName()).toBe("Sheet2");
    expect(workbook.getSheetCount()).toBe(2);

    const sheet3 = workbook.createSheet();
    expect(sheet3.getName()).toBe("Sheet3");
    expect(workbook.getSheetCount()).toBe(3);
  });

  test("should create sheet with custom name", () => {
    const customSheet = workbook.createSheet("CustomName");
    expect(customSheet.getName()).toBe("CustomName");
  });

  test("should get sheet by ID", () => {
    const sheet = workbook.createSheet("TestSheet");
    const retrieved = workbook.getSheet(sheet.getId());
    expect(retrieved).toBe(sheet);
  });

  test("should get sheet by name", () => {
    const sheet = workbook.createSheet("UniqueSheet");
    const retrieved = workbook.getSheetByName("UniqueSheet");
    expect(retrieved).toBe(sheet);
  });

  test("should set active sheet", () => {
    const sheet2 = workbook.createSheet();
    const result = workbook.setActiveSheet(sheet2.getId());

    expect(result).toBe(true);
    expect(workbook.getActiveSheet()).toBe(sheet2);
  });

  test("should not set invalid sheet as active", () => {
    const result = workbook.setActiveSheet("invalid-id");
    expect(result).toBe(false);
  });

  test("should remove sheet", () => {
    const sheet2 = workbook.createSheet();
    const sheet2Id = sheet2.getId();

    const result = workbook.removeSheet(sheet2Id);
    expect(result).toBe(true);
    expect(workbook.getSheetCount()).toBe(1);
    expect(workbook.getSheet(sheet2Id)).toBeUndefined();
  });

  test("should not remove last sheet", () => {
    const activeSheet = workbook.getActiveSheet();
    if (activeSheet) {
      const result = workbook.removeSheet(activeSheet.getId());
      expect(result).toBe(false);
      expect(workbook.getSheetCount()).toBe(1);
    }
  });

  test("should update active sheet when active sheet is removed", () => {
    const sheet2 = workbook.createSheet();
    workbook.setActiveSheet(sheet2.getId());

    workbook.removeSheet(sheet2.getId());

    const newActive = workbook.getActiveSheet();
    expect(newActive).toBeDefined();
    expect(newActive?.getName()).toBe("Sheet1");
  });

  test("should rename sheet", () => {
    const sheet = workbook.getActiveSheet();
    if (sheet) {
      const result = workbook.renameSheet(sheet.getId(), "RenamedSheet");
      expect(result).toBe(true);
      expect(sheet.getName()).toBe("RenamedSheet");
    }
  });

  test("should not rename to duplicate name", () => {
    const sheet1 = workbook.getActiveSheet();
    const sheet2 = workbook.createSheet();

    if (sheet1 && sheet2) {
      const result = workbook.renameSheet(sheet2.getId(), sheet1.getName());
      expect(result).toBe(false);
      expect(sheet2.getName()).not.toBe(sheet1.getName());
    }
  });

  test("should get all sheets in order", () => {
    const _sheet2 = workbook.createSheet("Sheet2");
    const _sheet3 = workbook.createSheet("Sheet3");

    const allSheets = workbook.getAllSheets();
    expect(allSheets.length).toBe(3);
    expect(allSheets[0].getName()).toBe("Sheet1");
    expect(allSheets[1].getName()).toBe("Sheet2");
    expect(allSheets[2].getName()).toBe("Sheet3");
  });
});

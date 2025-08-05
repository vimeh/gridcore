import { describe, expect, test } from "bun:test";
import { Sheet } from "./Sheet";
import { parseCellAddress } from "./utils/cellAddress";

describe("Sheet", () => {
  test("should create a sheet with name and dimensions", () => {
    const sheet = new Sheet("TestSheet", 100, 26);

    expect(sheet.getName()).toBe("TestSheet");
    expect(sheet.getRows()).toBe(100);
    expect(sheet.getCols()).toBe(26);
    expect(sheet.getId()).toMatch(/^sheet-\d+-\d+$/);
  });

  test("should use default dimensions when not specified", () => {
    const sheet = new Sheet("DefaultSheet");

    expect(sheet.getRows()).toBe(2000);
    expect(sheet.getCols()).toBe(52);
  });

  test("should allow setting sheet name", () => {
    const sheet = new Sheet("OldName");
    sheet.setName("NewName");

    expect(sheet.getName()).toBe("NewName");
  });

  test("should provide access to facade", () => {
    const sheet = new Sheet("TestSheet");
    const facade = sheet.getFacade();

    expect(facade).toBeDefined();

    // Test setting and getting a cell value through the facade
    const addr = parseCellAddress("A1");
    if (addr) {
      const setResult = facade.setCellValue(addr, "Hello");
      if (!setResult.ok) {
        console.error("Set failed:", setResult.error);
      }
      expect(setResult.ok).toBe(true);

      const getResult = facade.getCellValue(addr);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value).toBe("Hello");
      }
    }
  });

  test("each sheet should have a unique ID", () => {
    const sheet1 = new Sheet("Sheet1");
    const sheet2 = new Sheet("Sheet2");

    expect(sheet1.getId()).not.toBe(sheet2.getId());
  });
});

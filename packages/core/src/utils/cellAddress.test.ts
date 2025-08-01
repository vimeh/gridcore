import { describe, test, expect } from "bun:test";
import {
  columnLetterToNumber,
  numberToColumnLetter,
  parseCellAddress,
  cellAddressToString,
  parseCellRange,
  isValidCellAddress,
  getCellsInRange,
} from "./cellAddress";

describe("columnLetterToNumber", () => {
  test("converts single letters", () => {
    expect(columnLetterToNumber("A")).toBe(1);
    expect(columnLetterToNumber("B")).toBe(2);
    expect(columnLetterToNumber("Z")).toBe(26);
  });

  test("converts multiple letters", () => {
    expect(columnLetterToNumber("AA")).toBe(27);
    expect(columnLetterToNumber("AB")).toBe(28);
    expect(columnLetterToNumber("AZ")).toBe(52);
    expect(columnLetterToNumber("BA")).toBe(53);
    expect(columnLetterToNumber("ZZ")).toBe(702);
  });
});

describe("numberToColumnLetter", () => {
  test("converts single digit columns", () => {
    expect(numberToColumnLetter(1)).toBe("A");
    expect(numberToColumnLetter(2)).toBe("B");
    expect(numberToColumnLetter(26)).toBe("Z");
  });

  test("converts multi-letter columns", () => {
    expect(numberToColumnLetter(27)).toBe("AA");
    expect(numberToColumnLetter(28)).toBe("AB");
    expect(numberToColumnLetter(52)).toBe("AZ");
    expect(numberToColumnLetter(53)).toBe("BA");
    expect(numberToColumnLetter(702)).toBe("ZZ");
  });
});

describe("parseCellAddress", () => {
  test("parses valid cell addresses", () => {
    expect(parseCellAddress("A1")).toEqual({ row: 0, col: 0 });
    expect(parseCellAddress("B2")).toEqual({ row: 1, col: 1 });
    expect(parseCellAddress("Z100")).toEqual({ row: 99, col: 25 });
    expect(parseCellAddress("AA1")).toEqual({ row: 0, col: 26 });
  });

  test("returns null for invalid addresses", () => {
    expect(parseCellAddress("1A")).toBeNull();
    expect(parseCellAddress("A")).toBeNull();
    expect(parseCellAddress("123")).toBeNull();
    expect(parseCellAddress("")).toBeNull();
    expect(parseCellAddress("A0")).toBeNull();
  });
});

describe("cellAddressToString", () => {
  test("converts addresses to string", () => {
    expect(cellAddressToString({ row: 0, col: 0 })).toBe("A1");
    expect(cellAddressToString({ row: 1, col: 1 })).toBe("B2");
    expect(cellAddressToString({ row: 99, col: 25 })).toBe("Z100");
    expect(cellAddressToString({ row: 0, col: 26 })).toBe("AA1");
  });
});

describe("parseCellRange", () => {
  test("parses valid ranges", () => {
    expect(parseCellRange("A1:B2")).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 1, col: 1 },
    });

    expect(parseCellRange("B2:A1")).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 1, col: 1 },
    });
  });

  test("returns null for invalid ranges", () => {
    expect(parseCellRange("A1")).toBeNull();
    expect(parseCellRange("A1:B")).toBeNull();
    expect(parseCellRange("A1:B2:C3")).toBeNull();
  });
});

describe("isValidCellAddress", () => {
  test("validates cell addresses", () => {
    expect(isValidCellAddress("A1")).toBe(true);
    expect(isValidCellAddress("ZZ999")).toBe(true);
    expect(isValidCellAddress("1A")).toBe(false);
    expect(isValidCellAddress("")).toBe(false);
  });
});

describe("getCellsInRange", () => {
  test("returns all cells in range", () => {
    const range = { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } };
    const cells = getCellsInRange(range);

    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual({ row: 0, col: 0 });
    expect(cells).toContainEqual({ row: 0, col: 1 });
    expect(cells).toContainEqual({ row: 1, col: 0 });
    expect(cells).toContainEqual({ row: 1, col: 1 });
  });
});

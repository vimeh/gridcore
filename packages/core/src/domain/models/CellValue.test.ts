import { describe, expect, test } from "bun:test";
import {
  isBooleanValue,
  isEmptyValue,
  isNumericValue,
  isStringValue,
  parseNumericValue,
} from "./CellValue";

describe("CellValue", () => {
  describe("isNumericValue", () => {
    test("returns true for numbers", () => {
      expect(isNumericValue(42)).toBe(true);
      expect(isNumericValue(0)).toBe(true);
      expect(isNumericValue(-123.45)).toBe(true);
      expect(isNumericValue(Infinity)).toBe(true);
    });

    test("returns false for NaN", () => {
      expect(isNumericValue(NaN)).toBe(false);
    });

    test("returns false for non-numbers", () => {
      expect(isNumericValue("42")).toBe(false);
      expect(isNumericValue(true)).toBe(false);
      expect(isNumericValue(null)).toBe(false);
      expect(isNumericValue(undefined)).toBe(false);
    });
  });

  describe("isStringValue", () => {
    test("returns true for strings", () => {
      expect(isStringValue("hello")).toBe(true);
      expect(isStringValue("")).toBe(true);
      expect(isStringValue("123")).toBe(true);
    });

    test("returns false for non-strings", () => {
      expect(isStringValue(42)).toBe(false);
      expect(isStringValue(true)).toBe(false);
      expect(isStringValue(null)).toBe(false);
      expect(isStringValue(undefined)).toBe(false);
    });
  });

  describe("isBooleanValue", () => {
    test("returns true for booleans", () => {
      expect(isBooleanValue(true)).toBe(true);
      expect(isBooleanValue(false)).toBe(true);
    });

    test("returns false for non-booleans", () => {
      expect(isBooleanValue("true")).toBe(false);
      expect(isBooleanValue(1)).toBe(false);
      expect(isBooleanValue(0)).toBe(false);
      expect(isBooleanValue(null)).toBe(false);
      expect(isBooleanValue(undefined)).toBe(false);
    });
  });

  describe("isEmptyValue", () => {
    test("returns true for null and undefined", () => {
      expect(isEmptyValue(null)).toBe(true);
      expect(isEmptyValue(undefined)).toBe(true);
    });

    test("returns false for non-empty values", () => {
      expect(isEmptyValue("")).toBe(false);
      expect(isEmptyValue(0)).toBe(false);
      expect(isEmptyValue(false)).toBe(false);
      expect(isEmptyValue([])).toBe(false);
    });
  });

  describe("parseNumericValue", () => {
    test("returns number for numeric values", () => {
      expect(parseNumericValue(42)).toBe(42);
      expect(parseNumericValue(0)).toBe(0);
      expect(parseNumericValue(-123.45)).toBe(-123.45);
    });

    test("parses numeric strings", () => {
      expect(parseNumericValue("42")).toBe(42);
      expect(parseNumericValue("123.45")).toBe(123.45);
      expect(parseNumericValue("-67.89")).toBe(-67.89);
      expect(parseNumericValue("0")).toBe(0);
    });

    test("returns null for non-numeric strings", () => {
      expect(parseNumericValue("abc")).toBe(null);
      expect(parseNumericValue("12a34")).toBe(12); // parseFloat parses until it hits non-numeric
      expect(parseNumericValue("")).toBe(null);
      expect(parseNumericValue(" ")).toBe(null);
    });

    test("returns null for non-numeric values", () => {
      expect(parseNumericValue(true)).toBe(null);
      expect(parseNumericValue(false)).toBe(null);
      expect(parseNumericValue(null)).toBe(null);
      expect(parseNumericValue(undefined)).toBe(null);
    });

    test("handles edge cases", () => {
      expect(parseNumericValue("Infinity")).toBe(Infinity);
      expect(parseNumericValue("-Infinity")).toBe(-Infinity);
      expect(parseNumericValue("1e10")).toBe(1e10);
      expect(parseNumericValue("0.0")).toBe(0);
    });
  });
});

import { beforeEach, describe, expect, test } from "bun:test";
import type {
  BinaryOperation,
  FunctionCall,
  SheetCellReference,
  SheetRangeReference,
} from "./ast";
import { FormulaParser } from "./parser";

describe("FormulaParser - Cross-sheet references", () => {
  let parser: FormulaParser;

  beforeEach(() => {
    parser = new FormulaParser();
  });

  describe("sheet cell references", () => {
    test("parses simple sheet cell reference", () => {
      const result = parser.parse("=Sheet1!A1");

      expect(result.error).toBeUndefined();
      expect(result.ast).toBeDefined();

      const node = result.ast as SheetCellReference;
      expect(node.type).toBe("sheet_cell");
      expect(node.sheetName).toBe("Sheet1");
      expect(node.address).toEqual({ row: 0, col: 0 });
      expect(node.reference).toBe("Sheet1!A1");
    });

    test("parses quoted sheet name with spaces", () => {
      const result = parser.parse("='Sales Data'!B2");

      expect(result.error).toBeUndefined();

      const node = result.ast as SheetCellReference;
      expect(node.type).toBe("sheet_cell");
      expect(node.sheetName).toBe("Sales Data");
      expect(node.address).toEqual({ row: 1, col: 1 });
    });

    test("parses sheet reference with absolute cell", () => {
      const result = parser.parse("=Data!$A$1");

      expect(result.error).toBeUndefined();

      const node = result.ast as SheetCellReference;
      expect(node.type).toBe("sheet_cell");
      expect(node.sheetName).toBe("Data");
      expect(node.absolute).toEqual({ row: true, col: true });
    });

    test("parses mixed absolute references", () => {
      const result = parser.parse("=Sheet1!$A1");

      expect(result.error).toBeUndefined();

      const node = result.ast as SheetCellReference;
      expect(node.absolute).toEqual({ row: false, col: true });
    });
  });

  describe("sheet range references", () => {
    test("parses simple sheet range reference", () => {
      const result = parser.parse("=Sheet2!A1:B10");

      expect(result.error).toBeUndefined();
      expect(result.ast).toBeDefined();

      const node = result.ast as SheetRangeReference;
      expect(node.type).toBe("sheet_range");
      expect(node.sheetName).toBe("Sheet2");
      expect(node.range).toEqual({
        start: { row: 0, col: 0 },
        end: { row: 9, col: 1 },
      });
      expect(node.reference).toBe("Sheet2!A1:B10");
    });

    test("parses quoted sheet range", () => {
      const result = parser.parse("='My Sheet'!C3:D5");

      expect(result.error).toBeUndefined();

      const node = result.ast as SheetRangeReference;
      expect(node.type).toBe("sheet_range");
      expect(node.sheetName).toBe("My Sheet");
      expect(node.range).toEqual({
        start: { row: 2, col: 2 },
        end: { row: 4, col: 3 },
      });
    });

    test("parses large ranges", () => {
      const result = parser.parse("='Data Sheet'!A1:D1000");

      expect(result.error).toBeUndefined();

      const node = result.ast as SheetRangeReference;
      expect(node.type).toBe("sheet_range");
      expect(node.sheetName).toBe("Data Sheet");
      expect(node.range).toEqual({
        start: { row: 0, col: 0 },
        end: { row: 999, col: 3 },
      });
    });
  });

  describe("complex formulas with sheet references", () => {
    test("parses binary operation with sheet references", () => {
      const result = parser.parse("=Sheet1!A1 + Sheet2!B2");

      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe("binary");

      const binary = result.ast as BinaryOperation;
      expect(binary.operator).toBe("+");
      expect(binary.left.type).toBe("sheet_cell");
      expect(binary.right.type).toBe("sheet_cell");
      expect(binary.left.sheetName).toBe("Sheet1");
      expect(binary.right.sheetName).toBe("Sheet2");
    });

    test("parses function with sheet range", () => {
      const result = parser.parse("=SUM(Sheet1!A1:A10)");

      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe("function");

      const func = result.ast as FunctionCall;
      expect(func.name).toBe("SUM");
      expect(func.args.length).toBe(1);
      expect(func.args[0].type).toBe("sheet_range");
      expect(func.args[0].sheetName).toBe("Sheet1");
    });

    test("parses VLOOKUP with sheet references", () => {
      const result = parser.parse("=VLOOKUP(A1,'Data Sheet'!A1:D100,2,FALSE)");

      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe("function");

      const func = result.ast as FunctionCall;
      expect(func.name).toBe("VLOOKUP");
      expect(func.args.length).toBe(4);
      expect(func.args[0].type).toBe("cell");
      expect(func.args[1].type).toBe("sheet_range");
      expect(func.args[1].sheetName).toBe("Data Sheet");
      expect(func.args[2].type).toBe("number");
      expect(func.args[3].type).toBe("boolean");
    });

    test("parses nested functions with multiple sheet references", () => {
      const result = parser.parse(
        "=IF(Sheet1!A1>0,SUM(Sheet2!B1:B100),'Summary'!C1)",
      );

      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe("function");

      const ifFunc = result.ast as FunctionCall;
      expect(ifFunc.name).toBe("IF");
      expect(ifFunc.args.length).toBe(3);

      // First argument: comparison
      expect(ifFunc.args[0].type).toBe("binary");
      expect(ifFunc.args[0].left.type).toBe("sheet_cell");
      expect(ifFunc.args[0].left.sheetName).toBe("Sheet1");

      // Second argument: SUM function
      expect(ifFunc.args[1].type).toBe("function");
      expect(ifFunc.args[1].name).toBe("SUM");
      expect(ifFunc.args[1].args[0].type).toBe("sheet_range");
      expect(ifFunc.args[1].args[0].sheetName).toBe("Sheet2");

      // Third argument: sheet cell
      expect(ifFunc.args[2].type).toBe("sheet_cell");
      expect(ifFunc.args[2].sheetName).toBe("Summary");
    });
  });

  describe("error handling", () => {
    test("reports error for invalid sheet reference format", () => {
      const result = parser.parse("=Sheet1A1"); // Missing !

      expect(result.error).toBeDefined();
      expect(result.ast).toBeUndefined();
    });

    test("reports error for empty sheet name", () => {
      const result = parser.parse("=!A1");

      expect(result.error).toBeDefined();
    });
  });

  describe("backward compatibility", () => {
    test("still parses regular cell references", () => {
      const result = parser.parse("=A1");

      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe("cell");
    });

    test("still parses regular ranges", () => {
      const result = parser.parse("=SUM(A1:B10)");

      expect(result.error).toBeUndefined();
      const func = result.ast as FunctionCall;
      expect(func.args[0].type).toBe("range");
    });
  });
});

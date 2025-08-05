import { beforeEach, describe, expect, test } from "bun:test";
import { FormulaParser } from "./FormulaParser";

describe("FormulaParser", () => {
  let parser: FormulaParser;

  beforeEach(() => {
    parser = new FormulaParser();
  });

  describe("tokenize", () => {
    test("tokenizes numbers", () => {
      const result = parser.tokenize("42 3.14 .5");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual({
          type: "literal",
          value: "42",
          position: 0,
        });
        expect(result.value[1]).toEqual({
          type: "literal",
          value: "3.14",
          position: 3,
        });
        expect(result.value[2]).toEqual({
          type: "literal",
          value: ".5",
          position: 8,
        });
      }
    });

    test("tokenizes strings", () => {
      const result = parser.tokenize("\"hello\" 'world'");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toEqual({
          type: "literal",
          value: '"hello"',
          position: 0,
        });
        expect(result.value[1]).toEqual({
          type: "literal",
          value: '"world"',
          position: 8,
        });
      }
    });

    test("tokenizes cell references", () => {
      const result = parser.tokenize("A1 B2 AA99");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual({
          type: "cellRef",
          value: "A1",
          position: 0,
        });
        expect(result.value[1]).toEqual({
          type: "cellRef",
          value: "B2",
          position: 3,
        });
        expect(result.value[2]).toEqual({
          type: "cellRef",
          value: "AA99",
          position: 6,
        });
      }
    });

    test("tokenizes absolute cell references", () => {
      const result = parser.tokenize("$A$1 $B2 C$3 $A$1:$B$2");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(4);

        // Absolute reference $A$1
        expect(result.value[0]).toEqual({
          type: "cellRef",
          value: "$A$1",
          position: 0,
        });

        // Mixed reference $B2 (absolute column, relative row)
        expect(result.value[1]).toEqual({
          type: "cellRef",
          value: "$B2",
          position: 5,
        });

        // Mixed reference C$3 (relative column, absolute row)
        expect(result.value[2]).toEqual({
          type: "cellRef",
          value: "C$3",
          position: 9,
        });

        // Absolute range $A$1:$B$2
        expect(result.value[3]).toEqual({
          type: "rangeRef",
          value: "$A$1:$B$2",
          position: 13,
        });
      }
    });

    test("tokenizes ranges", () => {
      const result = parser.tokenize("A1:B2 C3:D4");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toEqual({
          type: "rangeRef",
          value: "A1:B2",
          position: 0,
        });
        expect(result.value[1]).toEqual({
          type: "rangeRef",
          value: "C3:D4",
          position: 6,
        });
      }
    });

    test("tokenizes functions", () => {
      const result = parser.tokenize("SUM(A1) AVERAGE(B2)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(8);
        expect(result.value[0]).toEqual({
          type: "function",
          value: "SUM",
          position: 0,
        });
        expect(result.value[1]).toEqual({
          type: "parenthesis",
          value: "(",
          position: 3,
        });
        expect(result.value[2]).toEqual({
          type: "cellRef",
          value: "A1",
          position: 4,
        });
        expect(result.value[3]).toEqual({
          type: "parenthesis",
          value: ")",
          position: 6,
        });
        expect(result.value[4]).toEqual({
          type: "function",
          value: "AVERAGE",
          position: 8,
        });
        expect(result.value[5]).toEqual({
          type: "parenthesis",
          value: "(",
          position: 15,
        });
        expect(result.value[6]).toEqual({
          type: "cellRef",
          value: "B2",
          position: 16,
        });
        expect(result.value[7]).toEqual({
          type: "parenthesis",
          value: ")",
          position: 18,
        });
      }
    });

    test("tokenizes operators", () => {
      const result = parser.tokenize("+ - * / ^ = < > <= >= <>");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(11);
        expect(result.value[6]).toEqual({
          type: "operator",
          value: "<",
          position: 12,
        });
        expect(result.value[8]).toEqual({
          type: "operator",
          value: "<=",
          position: 16,
        });
        expect(result.value[10]).toEqual({
          type: "operator",
          value: "<>",
          position: 22,
        });
      }
    });

    test("tokenizes complex expression", () => {
      const result = parser.tokenize("SUM(A1:A10) + B1 * 2");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(8);
        expect(result.value[0].type).toBe("function");
        expect(result.value[2].type).toBe("rangeRef");
        expect(result.value[4].type).toBe("operator");
        expect(result.value[5].type).toBe("cellRef");
        expect(result.value[6].type).toBe("operator");
        expect(result.value[7].type).toBe("literal");
      }
    });

    test("handles unterminated string", () => {
      const result = parser.tokenize('"hello');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Unterminated string");
      }
    });

    test("handles unexpected character", () => {
      const result = parser.tokenize("A1 & B1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Unexpected character '&'");
      }
    });
  });

  describe("buildAST", () => {
    test("builds AST for literal", () => {
      const tokens = parser.tokenize("42");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("literal");
          expect(ast.value.value).toBe(42);
        }
      }
    });

    test("builds AST for cell reference", () => {
      const tokens = parser.tokenize("A1");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("cellRef");
          expect(ast.value.address?.row).toBe(0);
          expect(ast.value.address?.col).toBe(0);
        }
      }
    });

    test("builds AST for absolute cell reference", () => {
      const tokens = parser.tokenize("$A$1");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("cellRef");
          // The legacy CellAddress should still have the correct row/col
          expect(ast.value.address?.row).toBe(0);
          expect(ast.value.address?.col).toBe(0);
        }
      }
    });

    test("builds AST for mixed cell references", () => {
      const tokens = parser.tokenize("$A1 + B$2");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("binaryOp");
          expect(ast.value.operator).toBe("+");

          // Check left operand ($A1)
          expect(ast.value.left?.type).toBe("cellRef");
          expect(ast.value.left?.address?.row).toBe(0);
          expect(ast.value.left?.address?.col).toBe(0);

          // Check right operand (B$2)
          expect(ast.value.right?.type).toBe("cellRef");
          expect(ast.value.right?.address?.row).toBe(1);
          expect(ast.value.right?.address?.col).toBe(1);
        }
      }
    });

    test("builds AST for binary operation", () => {
      const tokens = parser.tokenize("A1 + B1");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("binaryOp");
          expect(ast.value.operator).toBe("+");
          expect(ast.value.left?.type).toBe("cellRef");
          expect(ast.value.right?.type).toBe("cellRef");
        }
      }
    });

    test("builds AST for function call", () => {
      const tokens = parser.tokenize("SUM(A1:A10)");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("function");
          expect(ast.value.name).toBe("SUM");
          expect(ast.value.arguments).toHaveLength(1);
          expect(ast.value.arguments?.[0].type).toBe("rangeRef");
        }
      }
    });

    test("builds AST with operator precedence", () => {
      const tokens = parser.tokenize("A1 + B1 * C1");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("binaryOp");
          expect(ast.value.operator).toBe("+");
          expect(ast.value.right?.type).toBe("binaryOp");
          expect(ast.value.right?.operator).toBe("*");
        }
      }
    });

    test("builds AST with parentheses", () => {
      const tokens = parser.tokenize("(A1 + B1) * C1");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("binaryOp");
          expect(ast.value.operator).toBe("*");
          expect(ast.value.left?.type).toBe("binaryOp");
          expect(ast.value.left?.operator).toBe("+");
        }
      }
    });

    test("builds AST for unary operation", () => {
      const tokens = parser.tokenize("-A1");
      expect(tokens.ok).toBe(true);
      if (tokens.ok) {
        const ast = parser.buildAST(tokens.value);
        expect(ast.ok).toBe(true);
        if (ast.ok) {
          expect(ast.value.type).toBe("unaryOp");
          expect(ast.value.operator).toBe("-");
          expect(ast.value.operand?.type).toBe("cellRef");
        }
      }
    });

    test("handles empty formula", () => {
      const ast = parser.buildAST([]);
      expect(ast.ok).toBe(false);
      if (!ast.ok) {
        expect(ast.error).toContain("Empty formula");
      }
    });
  });

  describe("parse", () => {
    test("parses complete formula with =", () => {
      const result = parser.parse("=A1+B1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ast.type).toBe("binaryOp");
        expect(result.value.tokens).toHaveLength(3);
        expect(result.value.dependencies.size).toBe(2);
        expect(result.value.dependencies.has("A1")).toBe(true);
        expect(result.value.dependencies.has("B1")).toBe(true);
      }
    });

    test("parses formula without =", () => {
      const result = parser.parse("A1+B1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ast.type).toBe("binaryOp");
      }
    });

    test("extracts dependencies from ranges", () => {
      const result = parser.parse("=SUM(A1:A3)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.size).toBe(3);
        expect(result.value.dependencies.has("A1")).toBe(true);
        expect(result.value.dependencies.has("A2")).toBe(true);
        expect(result.value.dependencies.has("A3")).toBe(true);
      }
    });

    test("extracts nested dependencies", () => {
      const result = parser.parse("=IF(A1>0, B1+C1, D1)");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dependencies.size).toBe(4);
        expect(result.value.dependencies.has("A1")).toBe(true);
        expect(result.value.dependencies.has("B1")).toBe(true);
        expect(result.value.dependencies.has("C1")).toBe(true);
        expect(result.value.dependencies.has("D1")).toBe(true);
      }
    });

    test("handles complex formula", () => {
      const result = parser.parse("=SUM(A1:A10) + AVERAGE(B1:B5) * 2");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ast.type).toBe("binaryOp");
        expect(result.value.ast.operator).toBe("+");
        expect(result.value.dependencies.size).toBe(15); // A1-A10 + B1-B5
      }
    });

    test("handles parsing errors", () => {
      const result = parser.parse("=A1 +");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Unexpected token");
      }
    });
  });
});

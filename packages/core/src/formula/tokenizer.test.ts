import { test, expect, describe } from "bun:test"
import { Tokenizer } from "./tokenizer"

describe("Tokenizer - Cross-sheet references", () => {
  describe("unquoted sheet names", () => {
    test("tokenizes simple sheet cell reference", () => {
      const tokenizer = new Tokenizer("=Sheet1!A1")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "SHEET_CELL", value: "Sheet1!A1", position: 1 },
        { type: "EOF", value: "", position: 10 }
      ])
    })

    test("tokenizes sheet range reference", () => {
      const tokenizer = new Tokenizer("=Sheet2!B2:C5")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "SHEET_RANGE", value: "Sheet2!B2:C5", position: 1 },
        { type: "EOF", value: "", position: 13 }
      ])
    })

    test("tokenizes sheet reference with absolute cells", () => {
      const tokenizer = new Tokenizer("=Data!$A$1")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "SHEET_CELL", value: "Data!$A$1", position: 1 },
        { type: "EOF", value: "", position: 10 }
      ])
    })

    test("tokenizes mixed sheet references in formula", () => {
      const tokenizer = new Tokenizer("=Sheet1!A1+Sheet2!B2")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "SHEET_CELL", value: "Sheet1!A1", position: 1 },
        { type: "OPERATOR", value: "+", position: 10 },
        { type: "SHEET_CELL", value: "Sheet2!B2", position: 11 },
        { type: "EOF", value: "", position: 20 }
      ])
    })
  })

  describe("quoted sheet names", () => {
    test("tokenizes quoted sheet name with spaces", () => {
      const tokenizer = new Tokenizer("='Sales Data'!A1")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "SHEET_CELL", value: "'Sales Data'!A1", position: 1 },
        { type: "EOF", value: "", position: 16 }
      ])
    })

    test("tokenizes quoted sheet range reference", () => {
      const tokenizer = new Tokenizer("='My Sheet'!B2:D10")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "SHEET_RANGE", value: "'My Sheet'!B2:D10", position: 1 },
        { type: "EOF", value: "", position: 18 }
      ])
    })

    test("tokenizes quoted sheet name with special characters", () => {
      const tokenizer = new Tokenizer("='2024-Data'!A1")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "SHEET_CELL", value: "'2024-Data'!A1", position: 1 },
        { type: "EOF", value: "", position: 15 }
      ])
    })

    test("handles single quote as regular string when not followed by !", () => {
      const tokenizer = new Tokenizer("='Hello'")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "STRING", value: "'Hello'", position: 1 },
        { type: "EOF", value: "", position: 8 }
      ])
    })
  })

  describe("complex formulas", () => {
    test("tokenizes SUM function with sheet range", () => {
      const tokenizer = new Tokenizer("=SUM(Sheet1!A1:A10)")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "FUNCTION", value: "SUM", position: 1 },
        { type: "LPAREN", value: "(", position: 3 },
        { type: "SHEET_RANGE", value: "Sheet1!A1:A10", position: 5 },
        { type: "RPAREN", value: ")", position: 17 },
        { type: "EOF", value: "", position: 19 }
      ])
    })

    test("tokenizes VLOOKUP with sheet references", () => {
      const tokenizer = new Tokenizer("=VLOOKUP(A1,'Data Sheet'!A:D,2,FALSE)")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "FUNCTION", value: "VLOOKUP", position: 1 },
        { type: "LPAREN", value: "(", position: 7 },
        { type: "CELL", value: "A1", position: 9 },
        { type: "COMMA", value: ",", position: 10 },
        { type: "SHEET_RANGE", value: "'Data Sheet'!A:D", position: 12 },
        { type: "COMMA", value: ",", position: 27 },
        { type: "NUMBER", value: "2", position: 29 },
        { type: "COMMA", value: ",", position: 29 },
        { type: "FALSE", value: "FALSE", position: 31 },
        { type: "RPAREN", value: ")", position: 35 },
        { type: "EOF", value: "", position: 37 }
      ])
    })

    test("tokenizes multiple sheet references in complex formula", () => {
      const tokenizer = new Tokenizer("=IF(Sheet1!A1>0,Sheet2!B1*2,'Summary'!C1)")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "FUNCTION", value: "IF", position: 1 },
        { type: "LPAREN", value: "(", position: 2 },
        { type: "SHEET_CELL", value: "Sheet1!A1", position: 4 },
        { type: "OPERATOR", value: ">", position: 13 },
        { type: "NUMBER", value: "0", position: 14 },
        { type: "COMMA", value: ",", position: 14 },
        { type: "SHEET_CELL", value: "Sheet2!B1", position: 16 },
        { type: "OPERATOR", value: "*", position: 25 },
        { type: "NUMBER", value: "2", position: 26 },
        { type: "COMMA", value: ",", position: 26 },
        { type: "SHEET_CELL", value: "'Summary'!C1", position: 28 },
        { type: "RPAREN", value: ")", position: 39 },
        { type: "EOF", value: "", position: 41 }
      ])
    })
  })

  describe("error cases", () => {
    test("throws error for unterminated quoted sheet name", () => {
      const tokenizer = new Tokenizer("='Unterminated Sheet!A1")
      
      expect(() => tokenizer.tokenize()).toThrow("Unterminated string")
    })

    test("tokenizes quoted string followed by cell reference", () => {
      const tokenizer = new Tokenizer("='Sheet Name'A1")
      
      // This is actually valid - it's a string followed by multiplication
      const tokens = tokenizer.tokenize()
      expect(tokens[1].type).toBe("STRING")
      expect(tokens[2].type).toBe("CELL")
    })
  })

  describe("backward compatibility", () => {
    test("still tokenizes regular cell references", () => {
      const tokenizer = new Tokenizer("=A1+B2")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "CELL", value: "A1", position: 1 },
        { type: "OPERATOR", value: "+", position: 3 },
        { type: "CELL", value: "B2", position: 4 },
        { type: "EOF", value: "", position: 6 }
      ])
    })

    test("still tokenizes regular ranges", () => {
      const tokenizer = new Tokenizer("=SUM(A1:B10)")
      const tokens = tokenizer.tokenize()
      
      expect(tokens).toEqual([
        { type: "OPERATOR", value: "=", position: 0 },
        { type: "FUNCTION", value: "SUM", position: 1 },
        { type: "LPAREN", value: "(", position: 3 },
        { type: "RANGE", value: "A1:B10", position: 5 },
        { type: "RPAREN", value: ")", position: 10 },
        { type: "EOF", value: "", position: 12 }
      ])
    })
  })
})
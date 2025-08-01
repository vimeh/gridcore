import { test, expect, describe, beforeEach } from "bun:test"
import { FormulaEvaluator } from "./evaluator"
import { Cell, CellAddress } from "../types"

describe("FormulaEvaluator", () => {
  let evaluator: FormulaEvaluator

  beforeEach(() => {
    evaluator = new FormulaEvaluator()
  })

  const createContext = (cells: Map<string, Cell>) => {
    return {
      getCellValue: (address: CellAddress) => {
        const key = `${address.row},${address.col}`
        return cells.get(key)
      },
      getRangeValues: (start: CellAddress, end: CellAddress) => {
        const result: Cell[] = []
        for (let row = start.row; row <= end.row; row++) {
          for (let col = start.col; col <= end.col; col++) {
            const key = `${row},${col}`
            const cell = cells.get(key)
            if (cell) result.push(cell)
          }
        }
        return result
      }
    }
  }

  describe("basic arithmetic", () => {
    test("evaluates simple addition", () => {
      const result = evaluator.evaluate("=1+2", createContext(new Map()))
      expect(result.value).toBe(3)
      expect(result.error).toBeUndefined()
    })

    test("evaluates subtraction", () => {
      const result = evaluator.evaluate("=10-3", createContext(new Map()))
      expect(result.value).toBe(7)
    })

    test("evaluates multiplication", () => {
      const result = evaluator.evaluate("=4*5", createContext(new Map()))
      expect(result.value).toBe(20)
    })

    test("evaluates division", () => {
      const result = evaluator.evaluate("=20/4", createContext(new Map()))
      expect(result.value).toBe(5)
    })

    test("handles division by zero", () => {
      const result = evaluator.evaluate("=1/0", createContext(new Map()))
      expect(result.error).toBe("#DIV/0!")
    })

    test("evaluates exponentiation", () => {
      const result = evaluator.evaluate("=2^3", createContext(new Map()))
      expect(result.value).toBe(8)
    })

    test("respects operator precedence", () => {
      const result = evaluator.evaluate("=2+3*4", createContext(new Map()))
      expect(result.value).toBe(14)
    })

    test("evaluates parentheses", () => {
      const result = evaluator.evaluate("=(2+3)*4", createContext(new Map()))
      expect(result.value).toBe(20)
    })
  })

  describe("cell references", () => {
    test("evaluates cell reference", () => {
      const cells = new Map([
        ["0,0", { rawValue: 42, computedValue: 42 }]
      ])
      const result = evaluator.evaluate("=A1", createContext(cells))
      expect(result.value).toBe(42)
    })

    test("evaluates cell arithmetic", () => {
      const cells = new Map([
        ["0,0", { rawValue: 10, computedValue: 10 }],
        ["0,1", { rawValue: 20, computedValue: 20 }]
      ])
      const result = evaluator.evaluate("=A1+B1", createContext(cells))
      expect(result.value).toBe(30)
    })

    test("handles empty cells as zero", () => {
      const cells = new Map([
        ["0,0", { rawValue: 10, computedValue: 10 }]
      ])
      const result = evaluator.evaluate("=A1+B1", createContext(cells))
      expect(result.value).toBe(10)
    })

    test("propagates cell errors", () => {
      const cells = new Map([
        ["0,0", { rawValue: 0, computedValue: "#DIV/0!", error: "#DIV/0!" }]
      ])
      const result = evaluator.evaluate("=A1+1", createContext(cells))
      expect(result.error).toBe("#DIV/0!")
    })
  })

  describe("string operations", () => {
    test("evaluates string concatenation", () => {
      const result = evaluator.evaluate('="Hello"&" "&"World"', createContext(new Map()))
      expect(result.value).toBe("Hello World")
    })

    test("concatenates cell values", () => {
      const cells = new Map([
        ["0,0", { rawValue: "Hello", computedValue: "Hello" }],
        ["0,1", { rawValue: "World", computedValue: "World" }]
      ])
      const result = evaluator.evaluate('=A1&" "&B1', createContext(cells))
      expect(result.value).toBe("Hello World")
    })
  })

  describe("comparison operators", () => {
    test("evaluates equality", () => {
      const result = evaluator.evaluate("=5=5", createContext(new Map()))
      expect(result.value).toBe(true)
    })

    test("evaluates inequality", () => {
      const result = evaluator.evaluate("=5<>3", createContext(new Map()))
      expect(result.value).toBe(true)
    })

    test("evaluates less than", () => {
      const result = evaluator.evaluate("=3<5", createContext(new Map()))
      expect(result.value).toBe(true)
    })

    test("evaluates greater than", () => {
      const result = evaluator.evaluate("=5>3", createContext(new Map()))
      expect(result.value).toBe(true)
    })
  })

  describe("functions", () => {
    describe("SUM", () => {
      test("sums range of cells", () => {
        const cells = new Map([
          ["0,0", { rawValue: 1, computedValue: 1 }],
          ["0,1", { rawValue: 2, computedValue: 2 }],
          ["0,2", { rawValue: 3, computedValue: 3 }]
        ])
        const result = evaluator.evaluate("=SUM(A1:C1)", createContext(cells))
        expect(result.value).toBe(6)
      })

      test("sums multiple arguments", () => {
        const result = evaluator.evaluate("=SUM(1,2,3,4)", createContext(new Map()))
        expect(result.value).toBe(10)
      })

      test("ignores non-numeric values in range", () => {
        const cells = new Map([
          ["0,0", { rawValue: 1, computedValue: 1 }],
          ["0,1", { rawValue: "text", computedValue: "text" }],
          ["0,2", { rawValue: 3, computedValue: 3 }]
        ])
        const result = evaluator.evaluate("=SUM(A1:C1)", createContext(cells))
        expect(result.value).toBe(4)
      })
    })

    describe("AVERAGE", () => {
      test("calculates average of range", () => {
        const cells = new Map([
          ["0,0", { rawValue: 10, computedValue: 10 }],
          ["0,1", { rawValue: 20, computedValue: 20 }],
          ["0,2", { rawValue: 30, computedValue: 30 }]
        ])
        const result = evaluator.evaluate("=AVERAGE(A1:C1)", createContext(cells))
        expect(result.value).toBe(20)
      })

      test("ignores non-numeric values", () => {
        const cells = new Map([
          ["0,0", { rawValue: 10, computedValue: 10 }],
          ["0,1", { rawValue: "text", computedValue: "text" }],
          ["0,2", { rawValue: 30, computedValue: 30 }]
        ])
        const result = evaluator.evaluate("=AVERAGE(A1:C1)", createContext(cells))
        expect(result.value).toBe(20)
      })
    })

    describe("COUNT", () => {
      test("counts numeric values", () => {
        const cells = new Map([
          ["0,0", { rawValue: 1, computedValue: 1 }],
          ["0,1", { rawValue: "text", computedValue: "text" }],
          ["0,2", { rawValue: 3, computedValue: 3 }]
        ])
        const result = evaluator.evaluate("=COUNT(A1:C1)", createContext(cells))
        expect(result.value).toBe(2)
      })
    })

    describe("MAX/MIN", () => {
      test("finds maximum value", () => {
        const cells = new Map([
          ["0,0", { rawValue: 10, computedValue: 10 }],
          ["0,1", { rawValue: 30, computedValue: 30 }],
          ["0,2", { rawValue: 20, computedValue: 20 }]
        ])
        const result = evaluator.evaluate("=MAX(A1:C1)", createContext(cells))
        expect(result.value).toBe(30)
      })

      test("finds minimum value", () => {
        const cells = new Map([
          ["0,0", { rawValue: 10, computedValue: 10 }],
          ["0,1", { rawValue: 30, computedValue: 30 }],
          ["0,2", { rawValue: 20, computedValue: 20 }]
        ])
        const result = evaluator.evaluate("=MIN(A1:C1)", createContext(cells))
        expect(result.value).toBe(10)
      })
    })

    describe("IF", () => {
      test("evaluates true condition", () => {
        const result = evaluator.evaluate('=IF(5>3,"Yes","No")', createContext(new Map()))
        expect(result.value).toBe("Yes")
      })

      test("evaluates false condition", () => {
        const result = evaluator.evaluate('=IF(3>5,"Yes","No")', createContext(new Map()))
        expect(result.value).toBe("No")
      })

      test("handles missing false value", () => {
        const result = evaluator.evaluate('=IF(3>5,"Yes")', createContext(new Map()))
        expect(result.value).toBe(false)
      })
    })

    describe("logical functions", () => {
      test("AND function", () => {
        expect(evaluator.evaluate("=AND(TRUE,TRUE)", createContext(new Map())).value).toBe(true)
        expect(evaluator.evaluate("=AND(TRUE,FALSE)", createContext(new Map())).value).toBe(false)
        expect(evaluator.evaluate("=AND(5>3,10>5)", createContext(new Map())).value).toBe(true)
      })

      test("OR function", () => {
        expect(evaluator.evaluate("=OR(TRUE,FALSE)", createContext(new Map())).value).toBe(true)
        expect(evaluator.evaluate("=OR(FALSE,FALSE)", createContext(new Map())).value).toBe(false)
      })

      test("NOT function", () => {
        expect(evaluator.evaluate("=NOT(TRUE)", createContext(new Map())).value).toBe(false)
        expect(evaluator.evaluate("=NOT(FALSE)", createContext(new Map())).value).toBe(true)
      })
    })

    describe("text functions", () => {
      test("CONCATENATE function", () => {
        const result = evaluator.evaluate('=CONCATENATE("Hello"," ","World")', createContext(new Map()))
        expect(result.value).toBe("Hello World")
      })

      test("UPPER function", () => {
        const result = evaluator.evaluate('=UPPER("hello")', createContext(new Map()))
        expect(result.value).toBe("HELLO")
      })

      test("LOWER function", () => {
        const result = evaluator.evaluate('=LOWER("HELLO")', createContext(new Map()))
        expect(result.value).toBe("hello")
      })

      test("LEN function", () => {
        const result = evaluator.evaluate('=LEN("Hello")', createContext(new Map()))
        expect(result.value).toBe(5)
      })
    })
  })

  describe("error handling", () => {
    test("handles parse errors", () => {
      const result = evaluator.evaluate("=1+", createContext(new Map()))
      expect(result.error).toContain("Parse error")
    })

    test("handles unknown functions", () => {
      const result = evaluator.evaluate("=UNKNOWN()", createContext(new Map()))
      expect(result.error).toContain("#NAME?")
    })

    test("handles wrong number of arguments", () => {
      const result = evaluator.evaluate("=IF(TRUE)", createContext(new Map()))
      expect(result.error).toContain("IF requires 2 or 3 arguments")
    })
  })

  describe("type coercion", () => {
    test("converts strings to numbers", () => {
      const cells = new Map([
        ["0,0", { rawValue: "10", computedValue: "10" }],
        ["0,1", { rawValue: "20", computedValue: "20" }]
      ])
      const result = evaluator.evaluate("=A1+B1", createContext(cells))
      expect(result.value).toBe(30)
    })

    test("converts booleans to numbers", () => {
      const result = evaluator.evaluate("=TRUE+TRUE", createContext(new Map()))
      expect(result.value).toBe(2)
    })

    test("treats non-numeric strings as zero", () => {
      const cells = new Map([
        ["0,0", { rawValue: "text", computedValue: "text" }]
      ])
      const result = evaluator.evaluate("=A1+10", createContext(cells))
      expect(result.value).toBe(10)
    })
  })
})
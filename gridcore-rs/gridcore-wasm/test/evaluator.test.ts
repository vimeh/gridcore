import { test, expect, beforeAll } from "bun:test"
import init, { WasmEvaluator } from "../pkg/gridcore_wasm"

beforeAll(async () => {
  await init()
})

test("evaluator: basic arithmetic", () => {
  const evaluator = new WasmEvaluator()
  
  // Create a simple cell value getter
  const getCellValue = (address: string) => {
    // Return some test values
    if (address === "A1") return 10
    if (address === "B1") return 20
    return 0
  }
  
  // Test basic addition
  const result1 = evaluator.evaluate("10 + 5", getCellValue)
  expect(result1).toBe(15)
  
  // Test multiplication
  const result2 = evaluator.evaluate("3 * 4", getCellValue)
  expect(result2).toBe(12)
  
  // Test division
  const result3 = evaluator.evaluate("15 / 3", getCellValue)
  expect(result3).toBe(5)
  
  // Test power
  const result4 = evaluator.evaluate("2 ^ 3", getCellValue)
  expect(result4).toBe(8)
})

test("evaluator: cell references", () => {
  const evaluator = new WasmEvaluator()
  
  // Create a cell value getter with test data
  const getCellValue = (address: string) => {
    const cells: Record<string, number> = {
      "A1": 10,
      "B1": 20,
      "C1": 30,
    }
    return cells[address] || 0
  }
  
  // Test single cell reference
  const result1 = evaluator.evaluate("A1", getCellValue)
  expect(result1).toBe(10)
  
  // Test cell arithmetic
  const result2 = evaluator.evaluate("A1 + B1", getCellValue)
  expect(result2).toBe(30)
  
  // Test complex formula
  const result3 = evaluator.evaluate("(A1 + B1) * C1 / 10", getCellValue)
  expect(result3).toBe(90)
})

test("evaluator: functions", () => {
  const evaluator = new WasmEvaluator()
  
  const getCellValue = (address: string) => {
    const cells: Record<string, number> = {
      "A1": 10,
      "A2": 20,
      "A3": 30,
      "B1": 5,
      "B2": 15,
      "B3": 25,
    }
    return cells[address] || 0
  }
  
  // Test SUM function with range
  const result1 = evaluator.evaluate("SUM(A1:A3)", getCellValue)
  expect(result1).toBe(60)
  
  // Test AVERAGE function
  const result2 = evaluator.evaluate("AVERAGE(B1:B3)", getCellValue)
  expect(result2).toBe(15)
  
  // Test MIN function
  const result3 = evaluator.evaluate("MIN(A1:B3)", getCellValue)
  expect(result3).toBe(5)
  
  // Test MAX function
  const result4 = evaluator.evaluate("MAX(A1:B3)", getCellValue)
  expect(result4).toBe(30)
})

test("evaluator: logical functions", () => {
  const evaluator = new WasmEvaluator()
  const getCellValue = (address: string) => 0
  
  // Test IF function
  const result1 = evaluator.evaluate("IF(5 > 3, 100, 200)", getCellValue)
  expect(result1).toBe(100)
  
  const result2 = evaluator.evaluate("IF(2 > 5, 100, 200)", getCellValue)
  expect(result2).toBe(200)
  
  // Test AND function
  const result3 = evaluator.evaluate("AND(TRUE, TRUE)", getCellValue)
  expect(result3).toBe(true)
  
  const result4 = evaluator.evaluate("AND(TRUE, FALSE)", getCellValue)
  expect(result4).toBe(false)
  
  // Test OR function
  const result5 = evaluator.evaluate("OR(FALSE, TRUE)", getCellValue)
  expect(result5).toBe(true)
  
  // Test NOT function
  const result6 = evaluator.evaluate("NOT(FALSE)", getCellValue)
  expect(result6).toBe(true)
})

test("evaluator: string functions", () => {
  const evaluator = new WasmEvaluator()
  const getCellValue = (address: string) => ""
  
  // Test CONCATENATE
  const result1 = evaluator.evaluate('CONCATENATE("Hello", " ", "World")', getCellValue)
  expect(result1).toBe("Hello World")
  
  // Test LEN
  const result2 = evaluator.evaluate('LEN("Hello")', getCellValue)
  expect(result2).toBe(5)
  
  // Test UPPER
  const result3 = evaluator.evaluate('UPPER("hello")', getCellValue)
  expect(result3).toBe("HELLO")
  
  // Test LOWER
  const result4 = evaluator.evaluate('LOWER("HELLO")', getCellValue)
  expect(result4).toBe("hello")
  
  // Test TRIM
  const result5 = evaluator.evaluate('TRIM("  hello  ")', getCellValue)
  expect(result5).toBe("hello")
})

test("evaluator: error handling", () => {
  const evaluator = new WasmEvaluator()
  const getCellValue = (address: string) => 0
  
  // Test division by zero
  expect(() => evaluator.evaluate("10 / 0", getCellValue)).toThrow()
  
  // Test invalid function
  expect(() => evaluator.evaluate("INVALID_FUNC()", getCellValue)).toThrow()
  
  // Test syntax error
  expect(() => evaluator.evaluate("10 + ", getCellValue)).toThrow()
})
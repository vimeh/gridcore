import { test, expect } from "bun:test"
import init, { WasmFormulaParser, parseFormula } from "../pkg/gridcore_wasm.js"

// Initialize WASM once
await init()

test("parse number literals", () => {
  const parser = new WasmFormulaParser()
  
  let result = parser.parse("42")
  expect(result.type).toBe("literal")
  expect(result.value.Number).toBe(42)
  
  result = parser.parse("3.14")
  expect(result.type).toBe("literal")
  expect(result.value.Number).toBe(3.14)
})

test("parse boolean literals", () => {
  const parser = new WasmFormulaParser()
  
  let result = parser.parse("TRUE")
  expect(result.type).toBe("literal")
  expect(result.value.Boolean).toBe(true)
  
  result = parser.parse("FALSE")
  expect(result.type).toBe("literal")
  expect(result.value.Boolean).toBe(false)
})

test("parse string literals", () => {
  const parser = new WasmFormulaParser()
  
  const result = parser.parse('"hello world"')
  expect(result.type).toBe("literal")
  expect(result.value.String).toBe("hello world")
})

test("parse cell references", () => {
  const parser = new WasmFormulaParser()
  
  let result = parser.parse("A1")
  expect(result.type).toBe("reference")
  expect(result.address.col).toBe(0)
  expect(result.address.row).toBe(0)
  expect(result.absolute_col).toBe(false)
  expect(result.absolute_row).toBe(false)
  
  result = parser.parse("$B$2")
  expect(result.type).toBe("reference")
  expect(result.address.col).toBe(1)
  expect(result.address.row).toBe(1)
  expect(result.absolute_col).toBe(true)
  expect(result.absolute_row).toBe(true)
})

test("parse cell ranges", () => {
  const parser = new WasmFormulaParser()
  
  const result = parser.parse("A1:B2")
  expect(result.type).toBe("range")
  expect(result.range.start.col).toBe(0)
  expect(result.range.start.row).toBe(0)
  expect(result.range.end.col).toBe(1)
  expect(result.range.end.row).toBe(1)
})

test("parse function calls", () => {
  const parser = new WasmFormulaParser()
  
  const result = parser.parse("SUM(A1, B2, 10)")
  expect(result.type).toBe("functionCall")
  expect(result.name).toBe("SUM")
  expect(result.args).toHaveLength(3)
  expect(result.args[0].type).toBe("reference")
  expect(result.args[1].type).toBe("reference")
  expect(result.args[2].type).toBe("literal")
})

test("parse unary operations", () => {
  const parser = new WasmFormulaParser()
  
  let result = parser.parse("-42")
  expect(result.type).toBe("unaryOp")
  expect(result.op).toBe("negate")
  expect(result.expr.type).toBe("literal")
  expect(result.expr.value.Number).toBe(42)
  
  result = parser.parse("50%")
  expect(result.type).toBe("unaryOp")
  expect(result.op).toBe("percent")
  expect(result.expr.type).toBe("literal")
  expect(result.expr.value.Number).toBe(50)
})

test("parse binary operations", () => {
  const parser = new WasmFormulaParser()
  
  const result = parser.parse("A1 + B1")
  expect(result.type).toBe("binaryOp")
  expect(result.op).toBe("add")
  expect(result.left.type).toBe("reference")
  expect(result.right.type).toBe("reference")
})

test("convenience function parseFormula", () => {
  const result = parseFormula("=SUM(A1:A10)")
  expect(result.type).toBe("functionCall")
  expect(result.name).toBe("SUM")
  expect(result.args[0].type).toBe("range")
})

test("parse errors", () => {
  const parser = new WasmFormulaParser()
  
  expect(() => parser.parse("@@@")).toThrow("Parse error")
})

test("parseToJson method", () => {
  const parser = new WasmFormulaParser()
  
  const json = parser.parseToJson("A1 + B1")
  const parsed = JSON.parse(json)
  expect(parsed.type).toBe("binaryOp")
  expect(parsed.op).toBe("add")
})
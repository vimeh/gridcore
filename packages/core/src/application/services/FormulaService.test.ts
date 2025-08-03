import { describe, test, expect, beforeEach } from "bun:test"
import { FormulaService } from "./FormulaService"
import { FormulaParser } from "../../infrastructure/parsers/FormulaParser"
import { FormulaEvaluator } from "../../infrastructure/evaluators/FormulaEvaluator"
import { CellAddress } from "../../domain/models/CellAddress"
import { Formula } from "../../domain/models/Formula"
import { ok, err } from "../../shared/types/Result"
import type { EvaluationContext } from "../../domain/interfaces/IFormulaEvaluator"
import type { CellValue } from "../../domain/models/CellValue"

describe("FormulaService", () => {
  let service: FormulaService
  let mockContext: EvaluationContext

  beforeEach(() => {
    const parser = new FormulaParser()
    const evaluator = new FormulaEvaluator()
    service = new FormulaService(parser, evaluator)

    // Create mock context
    mockContext = {
      getCellValue: (address: CellAddress) => {
        const key = address.toString()
        const values: Record<string, CellValue> = {
          "A1": 10,
          "A2": 20,
          "A3": 30,
          "B1": 5,
          "B2": 15,
        }
        return ok(values[key] ?? null)
      },
      getFunction: () => err("No custom functions"),
    }
  })

  describe("parseFormula", () => {
    test("parses simple formula", () => {
      const result = service.parseFormula("=A1+B1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.dependencies.has("A1")).toBe(true)
        expect(result.value.dependencies.has("B1")).toBe(true)
        expect(result.value.dependencies.size).toBe(2)
      }
    })

    test("parses complex formula", () => {
      const result = service.parseFormula("=SUM(A1:A3) + AVERAGE(B1:B2)")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.dependencies.has("A1")).toBe(true)
        expect(result.value.dependencies.has("A2")).toBe(true)
        expect(result.value.dependencies.has("A3")).toBe(true)
        expect(result.value.dependencies.has("B1")).toBe(true)
        expect(result.value.dependencies.has("B2")).toBe(true)
        expect(result.value.dependencies.size).toBe(5)
      }
    })

    test("handles parse errors", () => {
      const result = service.parseFormula("=A1 +")
      expect(result.ok).toBe(false)
    })
  })

  describe("evaluateFormula", () => {
    test("evaluates simple arithmetic formula", () => {
      const address = CellAddress.create(2, 0).value // C1
      const formula = Formula.create("=A1+B1", address).value
      
      const result = service.evaluateFormula(formula, mockContext)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(15) // 10 + 5
      }
    })

    test("evaluates formula with functions", () => {
      const address = CellAddress.create(3, 0).value // D1
      const formula = Formula.create("=SUM(A1:A3)", address).value
      
      const result = service.evaluateFormula(formula, mockContext)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(60) // 10 + 20 + 30
      }
    })

    test("evaluates nested functions", () => {
      const address = CellAddress.create(4, 0).value // E1
      const formula = Formula.create("=SUM(A1:A2) * AVERAGE(B1:B2)", address).value
      
      const result = service.evaluateFormula(formula, mockContext)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(300) // (10 + 20) * ((5 + 15) / 2) = 30 * 10
      }
    })

    test("handles parse errors in evaluation", () => {
      const address = CellAddress.create(2, 0).value
      const formula = Formula.create("=A1 +", address).value
      
      const result = service.evaluateFormula(formula, mockContext)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain("Parse error")
      }
    })

    test("handles evaluation errors", () => {
      const address = CellAddress.create(2, 0).value
      const formula = Formula.create("=A1/0", address).value
      
      const result = service.evaluateFormula(formula, mockContext)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain("Division by zero")
      }
    })

    test("evaluates string operations", () => {
      const stringContext: EvaluationContext = {
        getCellValue: (address: CellAddress) => {
          const key = address.toString()
          const values: Record<string, CellValue> = {
            "A1": "Hello",
            "A2": "World",
          }
          return ok(values[key] ?? null)
        },
        getFunction: () => err("No custom functions"),
      }

      const address = CellAddress.create(2, 0).value
      const formula = Formula.create('=CONCAT(A1, " ", A2)', address).value
      
      const result = service.evaluateFormula(formula, stringContext)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe("Hello World")
      }
    })
  })

  describe("getDependencies", () => {
    test("gets dependencies from simple formula", () => {
      const address = CellAddress.create(2, 0).value
      const formula = Formula.create("=A1+B1", address).value
      
      const deps = service.getDependencies(formula)
      expect(deps.size).toBe(2)
      expect(deps.has("A1")).toBe(true)
      expect(deps.has("B1")).toBe(true)
    })

    test("gets dependencies from range formula", () => {
      const address = CellAddress.create(3, 0).value
      const formula = Formula.create("=SUM(A1:A3)", address).value
      
      const deps = service.getDependencies(formula)
      expect(deps.size).toBe(3)
      expect(deps.has("A1")).toBe(true)
      expect(deps.has("A2")).toBe(true)
      expect(deps.has("A3")).toBe(true)
    })

    test("returns empty set for invalid formula", () => {
      const address = CellAddress.create(2, 0).value
      const formula = Formula.create("=INVALID +", address).value
      
      const deps = service.getDependencies(formula)
      expect(deps.size).toBe(0)
    })
  })
})
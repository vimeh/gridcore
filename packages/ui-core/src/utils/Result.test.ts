import { expect, test, describe } from "bun:test"
import { ok, err, unwrap, unwrapOr, type Result } from "./Result"

describe("Result", () => {
  describe("ok", () => {
    test("creates successful result", () => {
      const result = ok(42)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(42)
    })

    test("works with different types", () => {
      const stringResult = ok("hello")
      expect(stringResult.value).toBe("hello")
      
      const objectResult = ok({ foo: "bar" })
      expect(objectResult.value).toEqual({ foo: "bar" })
      
      const arrayResult = ok([1, 2, 3])
      expect(arrayResult.value).toEqual([1, 2, 3])
    })
  })

  describe("err", () => {
    test("creates error result", () => {
      const result = err("Something went wrong")
      expect(result.ok).toBe(false)
      expect(result.error).toBe("Something went wrong")
    })

    test("works with different error types", () => {
      const stringError = err("error message")
      expect(stringError.error).toBe("error message")
      
      const errorObject = err(new Error("actual error"))
      expect(errorObject.error).toBeInstanceOf(Error)
      expect(errorObject.error.message).toBe("actual error")
    })
  })

  describe("unwrap", () => {
    test("returns value for successful result", () => {
      const result = ok(42)
      expect(unwrap(result)).toBe(42)
    })

    test("throws for error result", () => {
      const result = err("error message")
      expect(() => unwrap(result)).toThrow("error message")
    })

    test("throws with Error object", () => {
      const error = new Error("test error")
      const result = err(error)
      expect(() => unwrap(result)).toThrow("test error")
    })
  })

  describe("unwrapOr", () => {
    test("returns value for successful result", () => {
      const result = ok(42)
      expect(unwrapOr(result, 0)).toBe(42)
    })

    test("returns default for error result", () => {
      const result = err("error")
      expect(unwrapOr(result, 0)).toBe(0)
    })

    test("works with different default types", () => {
      const stringResult: Result<string> = err("error")
      expect(unwrapOr(stringResult, "default")).toBe("default")
      
      const objectResult: Result<{ foo: string }> = err("error")
      expect(unwrapOr(objectResult, { foo: "default" })).toEqual({ foo: "default" })
    })
  })

  describe("type guards", () => {
    test("ok result type guard works", () => {
      const result = ok(42)
      if (result.ok) {
        // TypeScript knows result.value exists here
        const value: number = result.value
        expect(value).toBe(42)
      }
    })

    test("error result type guard works", () => {
      const result = err("error message")
      if (!result.ok) {
        // TypeScript knows result.error exists here
        const error: string = result.error
        expect(error).toBe("error message")
      }
    })
  })

  describe("real-world usage patterns", () => {
    function divide(a: number, b: number): Result<number> {
      if (b === 0) {
        return err("Division by zero")
      }
      return ok(a / b)
    }

    test("function returning Result", () => {
      const successResult = divide(10, 2)
      expect(successResult.ok).toBe(true)
      expect(unwrap(successResult)).toBe(5)
      
      const errorResult = divide(10, 0)
      expect(errorResult.ok).toBe(false)
      expect(errorResult.error).toBe("Division by zero")
    })

    test("chaining Results", () => {
      function parseNumber(s: string): Result<number> {
        const n = Number(s)
        if (isNaN(n)) {
          return err(`Invalid number: ${s}`)
        }
        return ok(n)
      }

      function safeDivide(aStr: string, bStr: string): Result<number> {
        const aResult = parseNumber(aStr)
        if (!aResult.ok) return aResult
        
        const bResult = parseNumber(bStr)
        if (!bResult.ok) return bResult
        
        return divide(aResult.value, bResult.value)
      }

      expect(unwrap(safeDivide("10", "2"))).toBe(5)
      expect(safeDivide("abc", "2").error).toBe("Invalid number: abc")
      expect(safeDivide("10", "0").error).toBe("Division by zero")
    })
  })
})
import { test, expect, beforeAll, describe } from "bun:test"
import { RustSpreadsheetFacade, initializeWasm } from "./adapter"
import { CellAddress } from "@gridcore/core"

// Mock the WASM module for testing
const mockWasmModule = {
  WasmWorkbook: class {
    getActiveFacade() {
      return mockFacade
    }
  },
  WasmCellAddress: class {
    constructor(public col: number, public row: number) {}
    free() {}
  }
}

const mockFacade = {
  setCellValue: (address: any, value: string) => {
    // Store the value to verify it was converted to string
    mockFacade.lastSetValue = value
    mockFacade.lastSetType = typeof value
  },
  getCellValue: (address: any) => {
    return mockFacade.lastSetValue
  },
  getCellFormula: (address: any) => {
    return null
  },
  lastSetValue: null as any,
  lastSetType: null as any
}

// We need to directly test the adapter behavior without the initialization check
// So we'll create a test version that bypasses the constructor check
class TestableRustSpreadsheetFacade extends RustSpreadsheetFacade {
  constructor() {
    // Skip the parent constructor that checks initialization
    // and directly set up our mocked facade
    const instance = Object.create(RustSpreadsheetFacade.prototype)
    instance.workbook = new mockWasmModule.WasmWorkbook()
    instance.facade = mockFacade
    return instance
  }
}

describe("RustSpreadsheetFacade", () => {
  beforeAll(() => {
    // Mock the global wasmModule
    (global as any).wasmModule = mockWasmModule
  })

  test("should convert number to string when setting cell value", () => {
    const facade = new TestableRustSpreadsheetFacade()
    const address = CellAddress.create(0, 0)
    
    if (!address.ok) throw new Error("Failed to create address")
    
    facade.setCellValue(address.value, 42)
    
    expect(mockFacade.lastSetValue).toBe("42")
    expect(mockFacade.lastSetType).toBe("string")
  })

  test("should convert boolean to string when setting cell value", () => {
    const facade = new TestableRustSpreadsheetFacade()
    const address = CellAddress.create(0, 0)
    
    if (!address.ok) throw new Error("Failed to create address")
    
    facade.setCellValue(address.value, true)
    
    expect(mockFacade.lastSetValue).toBe("true")
    expect(mockFacade.lastSetType).toBe("string")
  })

  test("should handle null by converting to string", () => {
    const facade = new TestableRustSpreadsheetFacade()
    const address = CellAddress.create(0, 0)
    
    if (!address.ok) throw new Error("Failed to create address")
    
    facade.setCellValue(address.value, null)
    
    expect(mockFacade.lastSetValue).toBe("null")
    expect(mockFacade.lastSetType).toBe("string")
  })

  test("should handle undefined by converting to string", () => {
    const facade = new TestableRustSpreadsheetFacade()
    const address = CellAddress.create(0, 0)
    
    if (!address.ok) throw new Error("Failed to create address")
    
    facade.setCellValue(address.value, undefined)
    
    expect(mockFacade.lastSetValue).toBe("undefined")
    expect(mockFacade.lastSetType).toBe("string")
  })

  test("should pass string values unchanged", () => {
    const facade = new TestableRustSpreadsheetFacade()
    const address = CellAddress.create(0, 0)
    
    if (!address.ok) throw new Error("Failed to create address")
    
    facade.setCellValue(address.value, "Hello World")
    
    expect(mockFacade.lastSetValue).toBe("Hello World")
    expect(mockFacade.lastSetType).toBe("string")
  })

  test("should handle formulas correctly", () => {
    const facade = new TestableRustSpreadsheetFacade()
    const address = CellAddress.create(0, 0)
    
    if (!address.ok) throw new Error("Failed to create address")
    
    facade.setCellValue(address.value, "=A1+B1")
    
    expect(mockFacade.lastSetValue).toBe("=A1+B1")
    expect(mockFacade.lastSetType).toBe("string")
  })

  test("should convert decimal numbers to string", () => {
    const facade = new TestableRustSpreadsheetFacade()
    const address = CellAddress.create(0, 0)
    
    if (!address.ok) throw new Error("Failed to create address")
    
    facade.setCellValue(address.value, 3.14159)
    
    expect(mockFacade.lastSetValue).toBe("3.14159")
    expect(mockFacade.lastSetType).toBe("string")
  })
})
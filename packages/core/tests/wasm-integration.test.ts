import { beforeAll, describe, expect, test } from 'bun:test'
import init, { 
  WasmCellAddress, 
  WasmCellValue,
  version 
} from '../../../gridcore-rs/gridcore-wasm/pkg/gridcore_wasm'

describe('WASM Integration Tests', () => {
  beforeAll(async () => {
    // Initialize the WASM module
    await init()
  })
  
  describe('Module Loading', () => {
    test('should load WASM module and get version', () => {
      const ver = version()
      expect(ver).toBe('0.1.0')
    })
  })
  
  describe('CellAddress', () => {
    test('should create cell address with col and row', () => {
      const addr = new WasmCellAddress(0, 0)
      expect(addr.col).toBe(0)
      expect(addr.row).toBe(0)
      expect(addr.toString()).toBe('A1')
    })
    
    test('should parse A1 notation', () => {
      const addr = WasmCellAddress.fromString('B2')
      expect(addr.col).toBe(1)
      expect(addr.row).toBe(1)
      expect(addr.toString()).toBe('B2')
    })
    
    test('should parse complex addresses', () => {
      const cases = [
        { input: 'A1', col: 0, row: 0 },
        { input: 'Z1', col: 25, row: 0 },
        { input: 'AA1', col: 26, row: 0 },
        { input: 'AB10', col: 27, row: 9 },
        { input: 'ZZ100', col: 701, row: 99 },
      ]
      
      for (const { input, col, row } of cases) {
        const addr = WasmCellAddress.fromString(input)
        expect(addr.col).toBe(col)
        expect(addr.row).toBe(row)
        expect(addr.toString()).toBe(input)
      }
    })
    
    test('should handle invalid addresses', () => {
      const invalidCases = ['', '1A', 'A', '123', 'a1', 'A0']
      
      for (const invalid of invalidCases) {
        expect(() => WasmCellAddress.fromString(invalid)).toThrow()
      }
    })
    
    test('should offset addresses', () => {
      const addr = new WasmCellAddress(5, 5)
      
      const offset1 = addr.offset(3, 2)
      expect(offset1.col).toBe(7)
      expect(offset1.row).toBe(8)
      
      const offset2 = addr.offset(-2, -3)
      expect(offset2.col).toBe(2)
      expect(offset2.row).toBe(3)
    })
    
    test('should fail on negative offset', () => {
      const addr = new WasmCellAddress(2, 2)
      expect(() => addr.offset(-5, 0)).toThrow()
      expect(() => addr.offset(0, -5)).toThrow()
    })
    
    test('should compare addresses for equality', () => {
      const addr1 = new WasmCellAddress(1, 1)
      const addr2 = new WasmCellAddress(1, 1)
      const addr3 = new WasmCellAddress(2, 2)
      
      expect(addr1.equals(addr2)).toBe(true)
      expect(addr1.equals(addr3)).toBe(false)
    })
    
    test('should get column label', () => {
      const addr = new WasmCellAddress(26, 0)
      expect(addr.columnLabel()).toBe('AA')
    })
  })
  
  describe('CellValue', () => {
    test('should create null value', () => {
      const value = new WasmCellValue()
      expect(value.isNull()).toBe(true)
      expect(value.isNumber()).toBe(false)
      expect(value.isString()).toBe(false)
      expect(value.isBoolean()).toBe(false)
      expect(value.isError()).toBe(false)
    })
    
    test('should create number value', () => {
      const value = WasmCellValue.fromNumber(42.5)
      expect(value.isNumber()).toBe(true)
      expect(value.isNull()).toBe(false)
      expect(value.toString()).toBe('42.5')
    })
    
    test('should create string value', () => {
      const value = WasmCellValue.fromString('Hello, World!')
      expect(value.isString()).toBe(true)
      expect(value.isNull()).toBe(false)
      expect(value.toString()).toBe('Hello, World!')
    })
    
    test('should create boolean value', () => {
      const value = WasmCellValue.fromBoolean(true)
      expect(value.isBoolean()).toBe(true)
      expect(value.isNull()).toBe(false)
      expect(value.toString()).toBe('TRUE')
      
      const falsyValue = WasmCellValue.fromBoolean(false)
      expect(falsyValue.toString()).toBe('FALSE')
    })
    
    test('should create error value', () => {
      const value = WasmCellValue.fromError('#DIV/0!')
      expect(value.isError()).toBe(true)
      expect(value.isNull()).toBe(false)
      expect(value.toString()).toBe('#DIV/0!')
    })
    
    test('should convert from JS values', () => {
      const nullValue = WasmCellValue.fromJS(null)
      expect(nullValue.isNull()).toBe(true)
      
      const undefinedValue = WasmCellValue.fromJS(undefined)
      expect(undefinedValue.isNull()).toBe(true)
      
      const numberValue = WasmCellValue.fromJS(123)
      expect(numberValue.isNumber()).toBe(true)
      
      const stringValue = WasmCellValue.fromJS('test')
      expect(stringValue.isString()).toBe(true)
      
      const boolValue = WasmCellValue.fromJS(false)
      expect(boolValue.isBoolean()).toBe(true)
    })
    
    test('should convert to JS values', () => {
      const nullValue = new WasmCellValue()
      expect(nullValue.toJS()).toBe(null)
      
      const numberValue = WasmCellValue.fromNumber(42)
      expect(numberValue.toJS()).toBe(42)
      
      const stringValue = WasmCellValue.fromString('test')
      expect(stringValue.toJS()).toBe('test')
      
      const boolValue = WasmCellValue.fromBoolean(true)
      expect(boolValue.toJS()).toBe(true)
      
      const errorValue = WasmCellValue.fromError('#REF!')
      const errorJS = errorValue.toJS()
      expect(errorJS).toHaveProperty('error', '#REF!')
    })
  })
})
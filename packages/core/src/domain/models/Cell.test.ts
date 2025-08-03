import { describe, test, expect } from 'bun:test'
import { Cell } from './Cell'
import { CellAddress } from './CellAddress'
import { Formula } from './Formula'

describe('Cell', () => {
  describe('create', () => {
    test('creates cell with string value', () => {
      const result = Cell.create('hello')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rawValue).toBe('hello')
        expect(result.value.computedValue).toBe('hello')
        expect(result.value.hasFormula()).toBe(false)
      }
    })

    test('creates cell with number value', () => {
      const result = Cell.create(42)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rawValue).toBe(42)
        expect(result.value.computedValue).toBe(42)
      }
    })

    test('creates cell with boolean value', () => {
      const result = Cell.create(true)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rawValue).toBe(true)
        expect(result.value.computedValue).toBe(true)
      }
    })

    test('creates empty cell from null', () => {
      const result = Cell.create(null)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rawValue).toBe(null)
        expect(result.value.computedValue).toBe(null)
        expect(result.value.isEmpty()).toBe(true)
      }
    })

    test('creates empty cell from undefined', () => {
      const result = Cell.create(undefined)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rawValue).toBe(null)
        expect(result.value.computedValue).toBe(null)
        expect(result.value.isEmpty()).toBe(true)
      }
    })

    test('creates formula cell', () => {
      const address = CellAddress.create(0, 0)
      expect(address.ok).toBe(true)
      if (address.ok) {
        const result = Cell.create('=A1+B1', address.value)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.rawValue).toBe('=A1+B1')
          expect(result.value.computedValue).toBe(null)
          expect(result.value.hasFormula()).toBe(true)
          expect(result.value.formula?.expression).toBe('=A1+B1')
        }
      }
    })

    test('rejects invalid formula', () => {
      const address = CellAddress.create(0, 0)
      expect(address.ok).toBe(true)
      if (address.ok) {
        const result = Cell.create('=', address.value)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('must have content after =')
        }
      }
    })

    test('rejects invalid value type', () => {
      const result = Cell.create({ invalid: 'object' } as unknown)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid cell value type')
      }
    })

    test('string starting with = without address is treated as string', () => {
      const result = Cell.create('=SUM(A1:A10)')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rawValue).toBe('=SUM(A1:A10)')
        expect(result.value.hasFormula()).toBe(false)
      }
    })
  })

  describe('empty', () => {
    test('creates empty cell', () => {
      const cell = Cell.empty()
      expect(cell.rawValue).toBe(null)
      expect(cell.computedValue).toBe(null)
      expect(cell.isEmpty()).toBe(true)
    })
  })

  describe('createWithComputedValue', () => {
    test('creates cell with different raw and computed values', () => {
      const formula = Formula.create('=A1+B1', CellAddress.create(0, 0).value)
      expect(formula.ok).toBe(true)
      if (formula.ok) {
        const cell = Cell.createWithComputedValue('=A1+B1', 42, formula.value)
        expect(cell.rawValue).toBe('=A1+B1')
        expect(cell.computedValue).toBe(42)
        expect(cell.hasFormula()).toBe(true)
      }
    })

    test('creates cell with error', () => {
      const cell = Cell.createWithComputedValue('=1/0', null, undefined, 'Division by zero')
      expect(cell.hasError()).toBe(true)
      expect(cell.error).toBe('Division by zero')
    })
  })

  describe('value and displayValue', () => {
    test('value returns computed value', () => {
      const cell = Cell.create(42)
      expect(cell.ok).toBe(true)
      if (cell.ok) {
        expect(cell.value.value).toBe(42)
      }
    })

    test('value returns error when has error', () => {
      const cell = Cell.createWithComputedValue('=1/0', null, undefined, 'Division by zero')
      expect(cell.value).toBe('Division by zero')
    })

    test('displayValue formats number', () => {
      const cell = Cell.create(42)
      expect(cell.ok).toBe(true)
      if (cell.ok) {
        expect(cell.value.displayValue).toBe('42')
      }
    })

    test('displayValue formats string', () => {
      const cell = Cell.create('hello')
      expect(cell.ok).toBe(true)
      if (cell.ok) {
        expect(cell.value.displayValue).toBe('hello')
      }
    })

    test('displayValue formats boolean', () => {
      const cell = Cell.create(true)
      expect(cell.ok).toBe(true)
      if (cell.ok) {
        expect(cell.value.displayValue).toBe('true')
      }
    })

    test('displayValue formats empty cell', () => {
      const cell = Cell.empty()
      expect(cell.displayValue).toBe('')
    })

    test('displayValue formats error', () => {
      const cell = Cell.createWithComputedValue('=1/0', null, undefined, 'Division by zero')
      expect(cell.displayValue).toBe('#ERROR: Division by zero')
    })
  })

  describe('withComputedValue', () => {
    test('updates computed value', () => {
      const original = Cell.create('=A1+B1', CellAddress.create(0, 0).value)
      expect(original.ok).toBe(true)
      if (original.ok) {
        const updated = original.value.withComputedValue(42)
        expect(updated.rawValue).toBe('=A1+B1')
        expect(updated.computedValue).toBe(42)
        expect(updated.hasError()).toBe(false)
      }
    })
  })

  describe('withError', () => {
    test('sets error on cell', () => {
      const original = Cell.create(42)
      expect(original.ok).toBe(true)
      if (original.ok) {
        const withError = original.value.withError('Invalid operation')
        expect(withError.rawValue).toBe(42)
        expect(withError.computedValue).toBe(42)
        expect(withError.hasError()).toBe(true)
        expect(withError.error).toBe('Invalid operation')
      }
    })
  })

  describe('equals', () => {
    test('same cells are equal', () => {
      const cell1 = Cell.create(42)
      const cell2 = Cell.create(42)
      expect(cell1.ok && cell2.ok).toBe(true)
      if (cell1.ok && cell2.ok) {
        expect(cell1.value.equals(cell2.value)).toBe(true)
      }
    })

    test('different values are not equal', () => {
      const cell1 = Cell.create(42)
      const cell2 = Cell.create(43)
      expect(cell1.ok && cell2.ok).toBe(true)
      if (cell1.ok && cell2.ok) {
        expect(cell1.value.equals(cell2.value)).toBe(false)
      }
    })

    test('cells with same formula are equal', () => {
      const addr = CellAddress.create(0, 0).value
      const cell1 = Cell.create('=A1+B1', addr)
      const cell2 = Cell.create('=A1+B1', addr)
      expect(cell1.ok && cell2.ok).toBe(true)
      if (cell1.ok && cell2.ok) {
        expect(cell1.value.equals(cell2.value)).toBe(true)
      }
    })

    test('cells with different errors are not equal', () => {
      const cell1 = Cell.createWithComputedValue(42, 42, undefined, 'Error 1')
      const cell2 = Cell.createWithComputedValue(42, 42, undefined, 'Error 2')
      expect(cell1.equals(cell2)).toBe(false)
    })
  })
})
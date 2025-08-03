import { describe, test, expect } from 'bun:test'
import { Formula } from './Formula'
import { CellAddress } from './CellAddress'

describe('Formula', () => {
  const testAddress = CellAddress.create(0, 0).value

  describe('create', () => {
    test('creates valid formula', () => {
      const result = Formula.create('=A1+B1', testAddress)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.expression).toBe('=A1+B1')
        expect(result.value.address).toBe(testAddress)
      }
    })

    test('rejects empty expression', () => {
      const result = Formula.create('', testAddress)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('cannot be empty')
      }
    })

    test('rejects formula without =', () => {
      const result = Formula.create('A1+B1', testAddress)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('must start with =')
      }
    })

    test('rejects formula with only =', () => {
      const result = Formula.create('=', testAddress)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('must have content after =')
      }
    })
  })

  describe('normalizedExpression', () => {
    test('removes leading =', () => {
      const formula = Formula.create('=SUM(A1:A10)', testAddress)
      expect(formula.ok).toBe(true)
      if (formula.ok) {
        expect(formula.value.normalizedExpression).toBe('SUM(A1:A10)')
      }
    })
  })

  describe('containsReference', () => {
    test('detects direct cell reference', () => {
      const formula = Formula.create('=A1+B1', testAddress)
      const cellA1 = CellAddress.fromString('A1')
      const cellB1 = CellAddress.fromString('B1')
      const cellC1 = CellAddress.fromString('C1')
      
      expect(formula.ok && cellA1.ok && cellB1.ok && cellC1.ok).toBe(true)
      if (formula.ok && cellA1.ok && cellB1.ok && cellC1.ok) {
        expect(formula.value.containsReference(cellA1.value)).toBe(true)
        expect(formula.value.containsReference(cellB1.value)).toBe(true)
        expect(formula.value.containsReference(cellC1.value)).toBe(false)
      }
    })

    test('detects reference in function', () => {
      const formula = Formula.create('=SUM(A1,B2,C3)', testAddress)
      const cellB2 = CellAddress.fromString('B2')
      
      expect(formula.ok && cellB2.ok).toBe(true)
      if (formula.ok && cellB2.ok) {
        expect(formula.value.containsReference(cellB2.value)).toBe(true)
      }
    })

    test('handles case-insensitive references', () => {
      const formula = Formula.create('=a1+b1', testAddress)
      const cellA1 = CellAddress.fromString('A1')
      
      expect(formula.ok && cellA1.ok).toBe(true)
      if (formula.ok && cellA1.ok) {
        expect(formula.value.containsReference(cellA1.value)).toBe(true)
      }
    })

    test('avoids partial matches', () => {
      const formula = Formula.create('=A10+A100', testAddress)
      const cellA1 = CellAddress.fromString('A1')
      
      expect(formula.ok && cellA1.ok).toBe(true)
      if (formula.ok && cellA1.ok) {
        expect(formula.value.containsReference(cellA1.value)).toBe(false)
      }
    })
  })

  describe('containsRangeReference', () => {
    test('detects range reference', () => {
      const formula = Formula.create('=SUM(A1:A10)', testAddress)
      expect(formula.ok).toBe(true)
      if (formula.ok) {
        expect(formula.value.containsRangeReference('A1:A10')).toBe(true)
        expect(formula.value.containsRangeReference('B1:B10')).toBe(false)
      }
    })

    test('detects multiple range references', () => {
      const formula = Formula.create('=SUM(A1:A10)+AVERAGE(B1:B5)', testAddress)
      expect(formula.ok).toBe(true)
      if (formula.ok) {
        expect(formula.value.containsRangeReference('A1:A10')).toBe(true)
        expect(formula.value.containsRangeReference('B1:B5')).toBe(true)
      }
    })
  })

  describe('equals', () => {
    test('same formulas are equal', () => {
      const formula1 = Formula.create('=A1+B1', testAddress)
      const formula2 = Formula.create('=A1+B1', testAddress)
      expect(formula1.ok && formula2.ok).toBe(true)
      if (formula1.ok && formula2.ok) {
        expect(formula1.value.equals(formula2.value)).toBe(true)
      }
    })

    test('different expressions are not equal', () => {
      const formula1 = Formula.create('=A1+B1', testAddress)
      const formula2 = Formula.create('=A1-B1', testAddress)
      expect(formula1.ok && formula2.ok).toBe(true)
      if (formula1.ok && formula2.ok) {
        expect(formula1.value.equals(formula2.value)).toBe(false)
      }
    })

    test('same expression at different addresses are not equal', () => {
      const addr1 = CellAddress.create(0, 0).value
      const addr2 = CellAddress.create(1, 1).value
      const formula1 = Formula.create('=A1+B1', addr1)
      const formula2 = Formula.create('=A1+B1', addr2)
      expect(formula1.ok && formula2.ok).toBe(true)
      if (formula1.ok && formula2.ok) {
        expect(formula1.value.equals(formula2.value)).toBe(false)
      }
    })
  })
})
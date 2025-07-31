import { describe, test, expect } from 'bun:test';
import { FormulaParser } from './parser';

describe('FormulaParser', () => {
  const parser = new FormulaParser();

  describe('literals', () => {
    test('parses numbers', () => {
      const result = parser.parse('42');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({ type: 'number', value: 42 });
    });

    test('parses decimal numbers', () => {
      const result = parser.parse('3.14159');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({ type: 'number', value: 3.14159 });
    });

    test('parses strings', () => {
      const result = parser.parse('"Hello World"');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({ type: 'string', value: 'Hello World' });
    });

    test('parses strings with escaped quotes', () => {
      const result = parser.parse('"Say \\"Hello\\""');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({ type: 'string', value: 'Say "Hello"' });
    });

    test('parses boolean literals', () => {
      let result = parser.parse('TRUE');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({ type: 'boolean', value: true });

      result = parser.parse('FALSE');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({ type: 'boolean', value: false });
    });
  });

  describe('cell references', () => {
    test('parses simple cell references', () => {
      const result = parser.parse('A1');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'cell',
        address: { row: 0, col: 0 },
        reference: 'A1',
        absolute: { row: false, col: false }
      });
    });

    test('parses absolute cell references', () => {
      const result = parser.parse('$A$1');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'cell',
        address: { row: 0, col: 0 },
        reference: '$A$1',
        absolute: { row: true, col: true }
      });
    });

    test('parses mixed absolute references', () => {
      let result = parser.parse('$A1');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('cell');
      if (result.ast?.type === 'cell') {
        expect(result.ast.absolute).toEqual({ row: false, col: true });
      }

      result = parser.parse('A$1');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('cell');
      if (result.ast?.type === 'cell') {
        expect(result.ast.absolute).toEqual({ row: true, col: false });
      }
    });

    test('parses range references', () => {
      const result = parser.parse('A1:B2');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'range',
        range: {
          start: { row: 0, col: 0 },
          end: { row: 1, col: 1 }
        },
        reference: 'A1:B2'
      });
    });
  });

  describe('operators', () => {
    test('parses addition', () => {
      const result = parser.parse('1 + 2');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'binary',
        operator: '+',
        left: { type: 'number', value: 1 },
        right: { type: 'number', value: 2 }
      });
    });

    test('parses subtraction', () => {
      const result = parser.parse('10 - 5');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'binary',
        operator: '-',
        left: { type: 'number', value: 10 },
        right: { type: 'number', value: 5 }
      });
    });

    test('parses multiplication', () => {
      const result = parser.parse('3 * 4');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'binary',
        operator: '*',
        left: { type: 'number', value: 3 },
        right: { type: 'number', value: 4 }
      });
    });

    test('parses division', () => {
      const result = parser.parse('10 / 2');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'binary',
        operator: '/',
        left: { type: 'number', value: 10 },
        right: { type: 'number', value: 2 }
      });
    });

    test('parses exponentiation', () => {
      const result = parser.parse('2 ^ 3');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'binary',
        operator: '^',
        left: { type: 'number', value: 2 },
        right: { type: 'number', value: 3 }
      });
    });

    test('parses concatenation', () => {
      const result = parser.parse('"Hello" & " " & "World"');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('binary');
    });

    test('parses comparison operators', () => {
      const operators = ['=', '<>', '<', '>', '<=', '>='];
      for (const op of operators) {
        const result = parser.parse(`1 ${op} 2`);
        expect(result.error).toBeUndefined();
        expect(result.ast?.type).toBe('binary');
        if (result.ast?.type === 'binary') {
          expect(result.ast.operator).toBe(op);
        }
      }
    });

    test('parses unary operators', () => {
      let result = parser.parse('-5');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'unary',
        operator: '-',
        operand: { type: 'number', value: 5 }
      });

      result = parser.parse('+5');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'unary',
        operator: '+',
        operand: { type: 'number', value: 5 }
      });
    });
  });

  describe('operator precedence', () => {
    test('multiplication before addition', () => {
      const result = parser.parse('2 + 3 * 4');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'binary',
        operator: '+',
        left: { type: 'number', value: 2 },
        right: {
          type: 'binary',
          operator: '*',
          left: { type: 'number', value: 3 },
          right: { type: 'number', value: 4 }
        }
      });
    });

    test('exponentiation before multiplication', () => {
      const result = parser.parse('2 * 3 ^ 4');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('binary');
      if (result.ast?.type === 'binary') {
        expect(result.ast.operator).toBe('*');
        expect(result.ast.right.type).toBe('binary');
        if (result.ast.right.type === 'binary') {
          expect(result.ast.right.operator).toBe('^');
        }
      }
    });

    test('parentheses override precedence', () => {
      const result = parser.parse('(2 + 3) * 4');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('binary');
      if (result.ast?.type === 'binary') {
        expect(result.ast.operator).toBe('*');
        expect(result.ast.left.type).toBe('binary');
        if (result.ast.left.type === 'binary') {
          expect(result.ast.left.operator).toBe('+');
        }
      }
    });
  });

  describe('functions', () => {
    test('parses function with no arguments', () => {
      const result = parser.parse('NOW()');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'function',
        name: 'NOW',
        args: []
      });
    });

    test('parses function with single argument', () => {
      const result = parser.parse('SUM(A1:A10)');
      expect(result.error).toBeUndefined();
      expect(result.ast).toEqual({
        type: 'function',
        name: 'SUM',
        args: [{
          type: 'range',
          range: {
            start: { row: 0, col: 0 },
            end: { row: 9, col: 0 }
          },
          reference: 'A1:A10'
        }]
      });
    });

    test('parses function with multiple arguments', () => {
      const result = parser.parse('IF(A1 > 10, "Yes", "No")');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('function');
      if (result.ast?.type === 'function') {
        expect(result.ast.name).toBe('IF');
        expect(result.ast.args).toHaveLength(3);
      }
    });

    test('parses nested functions', () => {
      const result = parser.parse('SUM(A1, MAX(B1:B10), C1)');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('function');
      if (result.ast?.type === 'function') {
        expect(result.ast.name).toBe('SUM');
        expect(result.ast.args).toHaveLength(3);
        expect(result.ast.args[1].type).toBe('function');
      }
    });
  });

  describe('complex expressions', () => {
    test('parses cell arithmetic', () => {
      const result = parser.parse('A1 + B1 * C1');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('binary');
    });

    test('parses mixed expressions', () => {
      const result = parser.parse('SUM(A1:A10) * 2 + IF(B1 > 0, 10, -10)');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('binary');
    });

    test('handles formula with leading =', () => {
      const result = parser.parse('=A1 + B1');
      expect(result.error).toBeUndefined();
      expect(result.ast?.type).toBe('binary');
    });
  });

  describe('error handling', () => {
    test('reports invalid cell references', () => {
      const result = parser.parse('ZZZ99999');
      expect(result.error).toBeDefined();
    });

    test('reports unterminated strings', () => {
      const result = parser.parse('"unterminated');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Unterminated string');
    });

    test('reports missing closing parenthesis', () => {
      const result = parser.parse('SUM(A1:A10');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Expected ')'");
    });

    test('handles double operators as unary', () => {
      const result = parser.parse('1 + + 2');
      expect(result.error).toBeUndefined();
      // This should parse as 1 + (+2)
      expect(result.ast?.type).toBe('binary');
    });

    test('reports invalid expressions', () => {
      const result = parser.parse('()');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Expected expression');
    });
  });
});

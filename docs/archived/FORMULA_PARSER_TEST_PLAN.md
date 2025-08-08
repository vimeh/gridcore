# Formula Parser Test Plan

## Overview
This document outlines additional test cases needed for the Rust formula parser to ensure comprehensive coverage before proceeding to Phase 3 (Formula Evaluation Engine).

## Current Test Coverage
- ✅ Basic literals (numbers, booleans, strings)
- ✅ Simple cell references (A1, $A$1)
- ✅ Basic ranges (A1:B2)
- ✅ Simple functions (SUM with multiple args)
- ✅ Unary operators (negation, percent)
- ✅ Single binary operator (addition)

## Additional Tests Needed

### 1. Edge Cases and Error Handling
- [ ] Invalid formulas that should return errors
  - [ ] Empty formula strings
  - [ ] Malformed cell references (e.g., "1A", "A0", "A-1")
  - [ ] Unclosed parentheses in functions
  - [ ] Invalid ranges (e.g., "B2:A1" where end comes before start)
  - [ ] Missing function arguments where required
  - [ ] Invalid characters in formulas

### 2. Complex Formula Constructs
- [ ] Nested functions
  - [ ] `SUM(A1:A10, AVERAGE(B1:B10))`
  - [ ] `IF(ISBLANK(A1), 0, SUM(B1:B10))`
  - [ ] Deeply nested functions (3+ levels)
- [ ] Functions with ranges as arguments
  - [ ] `SUM(A1:A10)` - explicit test for the bug we fixed
  - [ ] `AVERAGE(A1:C10)`
  - [ ] Multiple ranges: `SUM(A1:A10, C1:C10)`
- [ ] Mixed absolute/relative references
  - [ ] `$A1` (absolute column only)
  - [ ] `A$1` (absolute row only)
  - [ ] Mixed in ranges: `$A$1:B2`
- [ ] Multi-column ranges
  - [ ] `A1:C10`
  - [ ] `$A$1:$Z$100`

### 3. All Binary Operators
Test each operator individually and in combination:
- [ ] Arithmetic operators
  - [ ] Subtraction: `A1 - B1`
  - [ ] Multiplication: `A1 * B1`
  - [ ] Division: `A1 / B1`
  - [ ] Power: `A1 ^ 2`
- [ ] Comparison operators
  - [ ] Equal: `A1 = B1`
  - [ ] Not equal: `A1 <> B1`
  - [ ] Less than: `A1 < B1`
  - [ ] Less than or equal: `A1 <= B1`
  - [ ] Greater than: `A1 > B1`
  - [ ] Greater than or equal: `A1 >= B1`
- [ ] Text operator
  - [ ] Concatenation: `A1 & " " & B1`
- [ ] Operator precedence tests
  - [ ] `A1 + B1 * C1` (should multiply first)
  - [ ] `A1 ^ 2 + B1` (power before addition)
  - [ ] `A1 + B1 = C1 * D1` (arithmetic before comparison)

### 4. Special Cases
- [ ] Negative numbers vs unary negation
  - [ ] `-42` as literal
  - [ ] `-(A1)` as negation of reference
  - [ ] `--42` (double negation)
- [ ] Leading `=` handling
  - [ ] `=A1+B1` should parse same as `A1+B1`
  - [ ] `==A1` (double equals)
- [ ] Whitespace handling
  - [ ] Leading/trailing spaces: `  A1 + B1  `
  - [ ] Spaces around operators: `A1   +   B1`
  - [ ] Spaces in function calls: `SUM( A1 , B1 )`
- [ ] Function edge cases
  - [ ] Empty arguments: `SUM()`
  - [ ] Single argument: `ABS(A1)`
  - [ ] Trailing comma: `SUM(A1,)`
  - [ ] Multiple commas: `SUM(A1,,B1)`

### 5. Complex Expressions
- [ ] Combined operators with precedence
  - [ ] `A1 + B1 * C1 - D1 / E1`
  - [ ] `A1 * B1 + C1 * D1`
- [ ] Parentheses for grouping
  - [ ] `(A1 + B1) * C1`
  - [ ] `((A1 + B1) * C1) / D1`
  - [ ] Nested parentheses: `((A1 + (B1 * C1)) / D1)`
- [ ] Mixed types in expressions
  - [ ] `A1 + 10`
  - [ ] `"Total: " & A1`
  - [ ] `TRUE = (A1 > 10)`

### 6. Cell Reference Edge Cases
- [ ] Large column references
  - [ ] `AA1`, `AB1`, `AZ1`
  - [ ] `AAA1` (three letters)
  - [ ] `XFD1` (Excel's max column - 16384)
- [ ] Large row numbers
  - [ ] `A100`, `A1000`, `A10000`
  - [ ] `A1048576` (Excel's max row)
- [ ] Case sensitivity
  - [ ] `a1` should parse same as `A1`
  - [ ] `sum(a1:b10)` should parse same as `SUM(A1:B10)`

### 7. String Handling
- [ ] Special characters in strings
  - [ ] Escaped quotes: `"He said \"hello\""`
  - [ ] Newlines: `"Line 1\nLine 2"`
  - [ ] Tabs: `"Col1\tCol2"`
- [ ] Empty strings: `""`
- [ ] Very long strings (1000+ characters)
- [ ] Unicode in strings: `"Hello 世界 🌍"`

### 8. Formula Composition (Real-world Examples)
- [ ] Conditional formulas
  - [ ] `IF(A1>10, SUM(B1:B10), AVERAGE(C1:C10))`
  - [ ] `IF(AND(A1>0, A1<100), "Valid", "Invalid")`
- [ ] Lookup formulas
  - [ ] `VLOOKUP(A1, B1:D10, 2, FALSE)`
  - [ ] `INDEX(A1:C10, MATCH(E1, A1:A10, 0), 2)`
- [ ] Date/time formulas
  - [ ] `DATE(2024, 1, 1) + 30`
  - [ ] `NOW() - A1`
- [ ] Array formulas
  - [ ] `SUM(A1:A10 * B1:B10)`
  - [ ] `SUMPRODUCT(A1:A10, B1:B10)`

### 9. Parser Robustness
- [ ] Very long formulas (1000+ characters)
- [ ] Deeply nested structures (10+ levels)
- [ ] Maximum number of function arguments
- [ ] Circular reference detection (for future)
- [ ] Memory safety with malicious inputs

### 10. Fuzzing Tests
- [ ] Random valid formula generation and parsing
- [ ] Random invalid input to ensure no panics
- [ ] Property-based testing with quickcheck

## Test Implementation Strategy

1. **Priority 1 (Must Have)**: Error handling, all operators, complex functions
2. **Priority 2 (Should Have)**: Edge cases, complex expressions, string handling
3. **Priority 3 (Nice to Have)**: Extreme cases, fuzzing, performance tests

## Notes
- Tests should verify both successful parsing and the structure of the resulting AST
- Error tests should verify specific error messages where appropriate
- Consider using test macros to reduce boilerplate for similar test cases
- Add benchmarks for common formula patterns
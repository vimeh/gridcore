use super::ast::{BinaryOperator, Expr, UnaryOperator};
use super::parser::FormulaParser;
use crate::types::CellValue;

#[test]
fn test_parse_number() {
    let expr = FormulaParser::parse("42").expect("Failed to parse formula '42' in test");
    assert!(matches!(expr, Expr::Literal { value: CellValue::Number(n) } if n == 42.0));

    let expr = FormulaParser::parse("3.14").expect("Failed to parse formula '3.14' in test");
    // Compare with the parsed value 3.14
    assert!(
        matches!(expr, Expr::Literal { value: CellValue::Number(n) } if (n - 3.140).abs() < 0.001)
    );
}

#[test]
fn test_parse_boolean() {
    let expr = FormulaParser::parse("TRUE").expect("Failed to parse formula 'TRUE' in test");
    assert!(matches!(
        expr,
        Expr::Literal {
            value: CellValue::Boolean(true)
        }
    ));

    let expr = FormulaParser::parse("FALSE").expect("Failed to parse formula 'FALSE' in test");
    assert!(matches!(
        expr,
        Expr::Literal {
            value: CellValue::Boolean(false)
        }
    ));
}

#[test]
fn test_parse_string() {
    let expr = FormulaParser::parse("\"hello world\"").unwrap();
    match expr {
        Expr::Literal {
            value: CellValue::String(s),
        } => {
            assert_eq!(s.as_ref(), "hello world");
        }
        _ => panic!("Expected string literal"),
    }
}

#[test]
fn test_parse_cell_reference() {
    let expr = FormulaParser::parse("A1").expect("Failed to parse formula 'A1' in test");
    match expr {
        Expr::Reference {
            address,
            absolute_col,
            absolute_row,
        } => {
            assert_eq!(address.col, 0);
            assert_eq!(address.row, 0);
            assert!(!absolute_col);
            assert!(!absolute_row);
        }
        _ => panic!("Expected cell reference"),
    }

    // Absolute references
    let expr = FormulaParser::parse("$A$1").expect("Failed to parse formula '$A$1' in test");
    match expr {
        Expr::Reference {
            address,
            absolute_col,
            absolute_row,
        } => {
            assert_eq!(address.col, 0);
            assert_eq!(address.row, 0);
            assert!(absolute_col);
            assert!(absolute_row);
        }
        _ => panic!("Expected absolute cell reference"),
    }
}

#[test]
fn test_parse_range() {
    let expr = FormulaParser::parse("A1:B2").expect("Failed to parse formula 'A1:B2' in test");
    match expr {
        Expr::Range { range, .. } => {
            assert_eq!(range.start.col, 0);
            assert_eq!(range.start.row, 0);
            assert_eq!(range.end.col, 1);
            assert_eq!(range.end.row, 1);
        }
        _ => panic!("Expected range"),
    }
}

#[test]
fn test_parse_function() {
    let expr = FormulaParser::parse("SUM(A1, B2, 10)")
        .expect("Failed to parse formula 'SUM(A1, B2, 10)' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUM");
            assert_eq!(args.len(), 3);
        }
        _ => panic!("Expected function call"),
    }
}

#[test]
fn test_parse_function_with_range() {
    // This was the bug we fixed before - make sure it still works
    let expr =
        FormulaParser::parse("SUM(A1:A10)").expect("Failed to parse formula 'SUM(A1:A10)' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUM");
            assert_eq!(args.len(), 1);
            assert!(matches!(args[0], Expr::Range { .. }));
        }
        _ => panic!("Expected function call with range"),
    }
}

#[test]
fn test_parse_unary() {
    let expr = FormulaParser::parse("-42").expect("Failed to parse formula '-42' in test");
    match expr {
        Expr::UnaryOp {
            op: UnaryOperator::Negate,
            ..
        } => {}
        _ => panic!("Expected negation"),
    }

    let expr = FormulaParser::parse("50%").expect("Failed to parse formula '50%' in test");
    match expr {
        Expr::UnaryOp {
            op: UnaryOperator::Percent,
            ..
        } => {}
        _ => panic!("Expected percent"),
    }
}

#[test]
fn test_parse_binary() {
    let expr = FormulaParser::parse("A1 + B1").expect("Failed to parse formula 'A1 + B1' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Add,
            ..
        } => {}
        _ => panic!("Expected addition"),
    }
}

#[test]
fn test_operator_precedence() {
    // Test that multiplication happens before addition
    let expr =
        FormulaParser::parse("2 + 3 * 4").expect("Failed to parse formula '2 + 3 * 4' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Add,
            left,
            right,
        } => {
            // Left should be 2
            assert!(
                matches!(left.as_ref(), Expr::Literal { value: CellValue::Number(n) } if n == &2.0)
            );
            // Right should be 3 * 4
            assert!(matches!(
                right.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Multiply,
                    ..
                }
            ));
        }
        _ => panic!("Expected addition with multiplication on right"),
    }

    // Test that power is right-associative
    let expr =
        FormulaParser::parse("2 ^ 3 ^ 2").expect("Failed to parse formula '2 ^ 3 ^ 2' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Power,
            left,
            right,
        } => {
            // Left should be 2
            assert!(
                matches!(left.as_ref(), Expr::Literal { value: CellValue::Number(n) } if n == &2.0)
            );
            // Right should be 3 ^ 2
            assert!(matches!(
                right.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Power,
                    ..
                }
            ));
        }
        _ => panic!("Expected power operation"),
    }
}

#[test]
fn test_complex_expression() {
    // Test a complex expression with multiple operators
    let expr = FormulaParser::parse("(A1 + B1) * 2 - C1 / 4")
        .expect("Failed to parse formula '(A1 + B1) * 2 - C1 / 4' in test");
    // Just verify it parses without error
    assert!(matches!(
        expr,
        Expr::BinaryOp {
            op: BinaryOperator::Subtract,
            ..
        }
    ));
}

#[test]
fn test_comparison_operators() {
    let tests = vec![
        ("A1 = B1", BinaryOperator::Equal),
        ("A1 <> B1", BinaryOperator::NotEqual),
        ("A1 < B1", BinaryOperator::LessThan),
        ("A1 > B1", BinaryOperator::GreaterThan),
        ("A1 <= B1", BinaryOperator::LessThanOrEqual),
        ("A1 >= B1", BinaryOperator::GreaterThanOrEqual),
    ];

    for (formula, expected_op) in tests {
        let expr = FormulaParser::parse(formula).unwrap();
        match expr {
            Expr::BinaryOp { op, .. } => {
                assert_eq!(op, expected_op, "Failed for formula: {}", formula);
            }
            _ => panic!("Expected binary operation for: {}", formula),
        }
    }
}

#[test]
fn test_concat_operator() {
    let expr = FormulaParser::parse("A1 & \" \" & B1").unwrap();
    // Should parse as (A1 & " ") & B1 due to left associativity
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Concat,
            left,
            right: _,
        } => {
            // Left should be A1 & " "
            assert!(matches!(
                left.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Concat,
                    ..
                }
            ));
        }
        _ => panic!("Expected concatenation"),
    }
}

// ==================== ERROR HANDLING TESTS ====================

#[test]
fn test_empty_formula() {
    let result = FormulaParser::parse("");
    assert!(result.is_err(), "Empty formula should return error");
}

#[test]
fn test_malformed_cell_references() {
    // Row 0 is invalid
    let result = FormulaParser::parse("A0");
    assert!(result.is_err(), "A0 should be invalid (row must be > 0)");

    // Number before letter is invalid
    let result = FormulaParser::parse("1A");
    assert!(result.is_err(), "1A should be invalid");

    // Negative row is invalid
    let result = FormulaParser::parse("A-1");
    assert!(result.is_err(), "A-1 should be invalid");
}

#[test]
fn test_unclosed_parentheses() {
    let result = FormulaParser::parse("SUM(A1, B1");
    assert!(result.is_err(), "Unclosed parenthesis should return error");

    let result = FormulaParser::parse("(A1 + B1");
    assert!(
        result.is_err(),
        "Unclosed parenthesis in expression should return error"
    );
}

#[test]
fn test_invalid_ranges() {
    // End before start (column-wise)
    let expr = FormulaParser::parse("B1:A1").expect("Failed to parse formula 'B1:A1' in test");
    // Parser allows this - range validation happens at evaluation
    assert!(matches!(expr, Expr::Range { .. }));
}

// ==================== COMPLEX FORMULA TESTS ====================

#[test]
fn test_nested_functions() {
    // Simple nested function
    let expr = FormulaParser::parse("SUM(A1:A10, AVERAGE(B1:B10))")
        .expect("Failed to parse formula 'SUM(A1:A10, AVERAGE(B1:B10))' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUM");
            assert_eq!(args.len(), 2);
            // Second arg should be AVERAGE function
            assert!(matches!(&args[1], Expr::FunctionCall { name, .. } if name == "AVERAGE"));
        }
        _ => panic!("Expected nested function call"),
    }

    // Deeply nested (3+ levels)
    let expr = FormulaParser::parse("IF(ISBLANK(A1), SUM(B1:B10), MAX(C1:C10))")
        .expect("Failed to parse formula 'IF(ISBLANK(A1), SUM(B1:B10), MAX(C1:C10))' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "IF");
            assert_eq!(args.len(), 3);
            // First arg is ISBLANK
            assert!(matches!(&args[0], Expr::FunctionCall { name, .. } if name == "ISBLANK"));
            // Second arg is SUM
            assert!(matches!(&args[1], Expr::FunctionCall { name, .. } if name == "SUM"));
            // Third arg is MAX
            assert!(matches!(&args[2], Expr::FunctionCall { name, .. } if name == "MAX"));
        }
        _ => panic!("Expected deeply nested function"),
    }
}

#[test]
fn test_multiple_ranges_in_function() {
    let expr = FormulaParser::parse("SUM(A1:A10, C1:C10, E1:E10)")
        .expect("Failed to parse formula 'SUM(A1:A10, C1:C10, E1:E10)' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUM");
            assert_eq!(args.len(), 3);
            for arg in args {
                assert!(matches!(arg, Expr::Range { .. }));
            }
        }
        _ => panic!("Expected function with multiple ranges"),
    }
}

// ==================== MIXED ABSOLUTE/RELATIVE REFERENCES ====================

#[test]
fn test_mixed_absolute_relative() {
    // Absolute column only
    let expr = FormulaParser::parse("$A1").expect("Failed to parse formula '$A1' in test");
    match expr {
        Expr::Reference {
            absolute_col,
            absolute_row,
            ..
        } => {
            assert!(absolute_col, "Column should be absolute");
            assert!(!absolute_row, "Row should be relative");
        }
        _ => panic!("Expected mixed reference"),
    }

    // Absolute row only
    let expr = FormulaParser::parse("A$1").expect("Failed to parse formula 'A$1' in test");
    match expr {
        Expr::Reference {
            absolute_col,
            absolute_row,
            ..
        } => {
            assert!(!absolute_col, "Column should be relative");
            assert!(absolute_row, "Row should be absolute");
        }
        _ => panic!("Expected mixed reference"),
    }

    // Mixed in ranges
    let expr = FormulaParser::parse("$A$1:B2").expect("Failed to parse formula '$A$1:B2' in test");
    match expr {
        Expr::Range {
            absolute_start_col,
            absolute_start_row,
            absolute_end_col,
            absolute_end_row,
            ..
        } => {
            assert!(absolute_start_col);
            assert!(absolute_start_row);
            assert!(!absolute_end_col);
            assert!(!absolute_end_row);
        }
        _ => panic!("Expected mixed absolute range"),
    }
}

// ==================== ARITHMETIC OPERATORS ====================

#[test]
fn test_all_arithmetic_operators() {
    let tests = vec![
        ("A1 - B1", BinaryOperator::Subtract),
        ("A1 * B1", BinaryOperator::Multiply),
        ("A1 / B1", BinaryOperator::Divide),
        ("A1 ^ 2", BinaryOperator::Power),
    ];

    for (formula, expected_op) in tests {
        let expr = FormulaParser::parse(formula).unwrap();
        match expr {
            Expr::BinaryOp { op, .. } => {
                assert_eq!(op, expected_op, "Failed for formula: {}", formula);
            }
            _ => panic!("Expected binary operation for: {}", formula),
        }
    }
}

#[test]
fn test_complex_operator_precedence() {
    // A1 + B1 * C1 - D1 / E1
    // Should parse as: (A1 + (B1 * C1)) - (D1 / E1)
    let expr = FormulaParser::parse("A1 + B1 * C1 - D1 / E1")
        .expect("Failed to parse formula 'A1 + B1 * C1 - D1 / E1' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Subtract,
            left,
            right,
        } => {
            // Left should be A1 + (B1 * C1)
            assert!(matches!(
                left.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Add,
                    ..
                }
            ));
            // Right should be D1 / E1
            assert!(matches!(
                right.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Divide,
                    ..
                }
            ));
        }
        _ => panic!("Expected complex precedence expression"),
    }

    // Test power has higher precedence than multiplication
    let expr =
        FormulaParser::parse("A1 * B1 ^ 2").expect("Failed to parse formula 'A1 * B1 ^ 2' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Multiply,
            right,
            ..
        } => {
            // Right should be B1 ^ 2
            assert!(matches!(
                right.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Power,
                    ..
                }
            ));
        }
        _ => panic!("Expected power precedence"),
    }
}

// ==================== SPECIAL CASES ====================

#[test]
fn test_negative_numbers_vs_negation() {
    // Direct negative number
    let expr = FormulaParser::parse("-42").expect("Failed to parse formula '-42' in test");
    match expr {
        Expr::UnaryOp {
            op: UnaryOperator::Negate,
            expr,
        } => {
            assert!(matches!(
                expr.as_ref(),
                Expr::Literal {
                    value: CellValue::Number(n)
                } if n == &42.0
            ));
        }
        _ => panic!("Expected negation of positive number"),
    }

    // Negation of reference
    let expr = FormulaParser::parse("-(A1)").expect("Failed to parse formula '-(A1)' in test");
    match expr {
        Expr::UnaryOp {
            op: UnaryOperator::Negate,
            expr,
        } => {
            assert!(matches!(expr.as_ref(), Expr::Reference { .. }));
        }
        _ => panic!("Expected negation of reference"),
    }

    // Double negation
    let expr = FormulaParser::parse("--42").expect("Failed to parse formula '--42' in test");
    match expr {
        Expr::UnaryOp {
            op: UnaryOperator::Negate,
            expr,
        } => {
            // Inner should also be negation
            assert!(matches!(
                expr.as_ref(),
                Expr::UnaryOp {
                    op: UnaryOperator::Negate,
                    ..
                }
            ));
        }
        _ => panic!("Expected double negation"),
    }
}

#[test]
fn test_leading_equals() {
    // Should parse the same with or without leading =
    let expr1 = FormulaParser::parse("=A1+B1").expect("Failed to parse formula '=A1+B1' in test");
    let expr2 = FormulaParser::parse("A1+B1").expect("Failed to parse formula 'A1+B1' in test");

    // Both should be addition
    assert!(matches!(
        expr1,
        Expr::BinaryOp {
            op: BinaryOperator::Add,
            ..
        }
    ));
    assert!(matches!(
        expr2,
        Expr::BinaryOp {
            op: BinaryOperator::Add,
            ..
        }
    ));
}

#[test]
fn test_invalid_column_reference() {
    // XYZ999 exceeds Excel's column limit (XYZ = column 16899, max is 16383)
    let result = FormulaParser::parse("=XYZ999");
    assert!(result.is_err());
    match result {
        Err(crate::SpreadsheetError::RefError) => {
            // Expected - XYZ exceeds column limit
        }
        Err(e) => panic!("Expected RefError for XYZ999, got: {:?}", e),
        Ok(_) => panic!("XYZ999 should not parse successfully"),
    }
    
    // XFD is the maximum valid column in Excel
    let result = FormulaParser::parse("=XFD1");
    assert!(result.is_ok(), "XFD1 should be valid");
    
    // XFE exceeds the limit
    let result = FormulaParser::parse("=XFE1");
    assert!(result.is_err());
    match result {
        Err(crate::SpreadsheetError::RefError) => {
            // Expected - XFE exceeds column limit
        }
        Err(e) => panic!("Expected RefError for XFE1, got: {:?}", e),
        Ok(_) => panic!("XFE1 should not parse successfully"),
    }
}

#[test]
fn test_whitespace_handling() {
    // Leading/trailing spaces
    let expr =
        FormulaParser::parse("  A1 + B1  ").expect("Failed to parse formula '  A1 + B1  ' in test");
    assert!(matches!(
        expr,
        Expr::BinaryOp {
            op: BinaryOperator::Add,
            ..
        }
    ));

    // Extra spaces around operators
    let expr =
        FormulaParser::parse("A1   +   B1").expect("Failed to parse formula 'A1   +   B1' in test");
    assert!(matches!(
        expr,
        Expr::BinaryOp {
            op: BinaryOperator::Add,
            ..
        }
    ));

    // Spaces in function calls
    let expr = FormulaParser::parse("SUM( A1 , B1 )")
        .expect("Failed to parse formula 'SUM( A1 , B1 )' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUM");
            assert_eq!(args.len(), 2);
        }
        _ => panic!("Expected function call"),
    }
}

#[test]
fn test_function_edge_cases() {
    // Empty arguments
    let expr = FormulaParser::parse("SUM()").expect("Failed to parse formula 'SUM()' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUM");
            assert_eq!(args.len(), 0);
        }
        _ => panic!("Expected empty function call"),
    }

    // Single argument
    let expr = FormulaParser::parse("ABS(A1)").expect("Failed to parse formula 'ABS(A1)' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "ABS");
            assert_eq!(args.len(), 1);
        }
        _ => panic!("Expected single arg function"),
    }

    // Trailing comma is handled gracefully
    let expr =
        FormulaParser::parse("SUM(A1,)").expect("Failed to parse formula 'SUM(A1,)' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUM");
            assert_eq!(args.len(), 1); // Parser allows trailing comma
        }
        _ => panic!("Expected function with trailing comma"),
    }
}

// ==================== PARENTHESES GROUPING ====================

#[test]
fn test_parentheses_grouping() {
    // (A1 + B1) * C1 should multiply the sum by C1
    let expr = FormulaParser::parse("(A1 + B1) * C1")
        .expect("Failed to parse formula '(A1 + B1) * C1' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Multiply,
            left,
            ..
        } => {
            // Left should be A1 + B1
            assert!(matches!(
                left.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Add,
                    ..
                }
            ));
        }
        _ => panic!("Expected grouped addition"),
    }

    // Nested parentheses
    let expr = FormulaParser::parse("((A1 + (B1 * C1)) / D1)")
        .expect("Failed to parse formula '((A1 + (B1 * C1)) / D1)' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Divide,
            left,
            ..
        } => {
            // Left should be A1 + (B1 * C1)
            assert!(matches!(
                left.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::Add,
                    ..
                }
            ));
        }
        _ => panic!("Expected nested parentheses"),
    }
}

// ==================== MIXED TYPE EXPRESSIONS ====================

#[test]
fn test_mixed_types() {
    // Number with reference
    let expr = FormulaParser::parse("A1 + 10").expect("Failed to parse formula 'A1 + 10' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Add,
            left,
            right,
        } => {
            assert!(matches!(left.as_ref(), Expr::Reference { .. }));
            assert!(matches!(
                right.as_ref(),
                Expr::Literal {
                    value: CellValue::Number(n)
                } if n == &10.0
            ));
        }
        _ => panic!("Expected mixed type addition"),
    }

    // String concatenation with reference
    let expr = FormulaParser::parse("\"Total: \" & A1").unwrap();
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Concat,
            left,
            right,
        } => {
            assert!(matches!(
                left.as_ref(),
                Expr::Literal {
                    value: CellValue::String(_)
                }
            ));
            assert!(matches!(right.as_ref(), Expr::Reference { .. }));
        }
        _ => panic!("Expected string concat with reference"),
    }

    // Boolean comparison
    let expr = FormulaParser::parse("TRUE = (A1 > 10)")
        .expect("Failed to parse formula 'TRUE = (A1 > 10)' in test");
    match expr {
        Expr::BinaryOp {
            op: BinaryOperator::Equal,
            left,
            right,
        } => {
            assert!(matches!(
                left.as_ref(),
                Expr::Literal {
                    value: CellValue::Boolean(true)
                }
            ));
            assert!(matches!(
                right.as_ref(),
                Expr::BinaryOp {
                    op: BinaryOperator::GreaterThan,
                    ..
                }
            ));
        }
        _ => panic!("Expected boolean comparison"),
    }
}

// ==================== CELL REFERENCE EDGE CASES ====================

#[test]
fn test_large_column_references() {
    // Two-letter columns
    let expr = FormulaParser::parse("AA1").expect("Failed to parse formula 'AA1' in test");
    match expr {
        Expr::Reference { address, .. } => {
            assert_eq!(address.col, 26); // AA = 26
        }
        _ => panic!("Expected AA1 reference"),
    }

    let expr = FormulaParser::parse("AZ1").expect("Failed to parse formula 'AZ1' in test");
    match expr {
        Expr::Reference { address, .. } => {
            assert_eq!(address.col, 51); // AZ = 51
        }
        _ => panic!("Expected AZ1 reference"),
    }

    // Three-letter columns
    let expr = FormulaParser::parse("AAA1").expect("Failed to parse formula 'AAA1' in test");
    match expr {
        Expr::Reference { address, .. } => {
            assert_eq!(address.col, 702); // AAA = 702
        }
        _ => panic!("Expected AAA1 reference"),
    }
}

#[test]
fn test_large_row_numbers() {
    let expr = FormulaParser::parse("A100").expect("Failed to parse formula 'A100' in test");
    match expr {
        Expr::Reference { address, .. } => {
            assert_eq!(address.row, 99); // 0-indexed
        }
        _ => panic!("Expected A100 reference"),
    }

    let expr = FormulaParser::parse("A1000").expect("Failed to parse formula 'A1000' in test");
    match expr {
        Expr::Reference { address, .. } => {
            assert_eq!(address.row, 999); // 0-indexed
        }
        _ => panic!("Expected A1000 reference"),
    }

    let expr =
        FormulaParser::parse("A1048576").expect("Failed to parse formula 'A1048576' in test");
    match expr {
        Expr::Reference { address, .. } => {
            assert_eq!(address.row, 1048575); // Excel's max row, 0-indexed
        }
        _ => panic!("Expected A1048576 reference"),
    }
}

#[test]
fn test_case_insensitivity() {
    // Lowercase cell references should work
    let expr = FormulaParser::parse("a1").expect("Failed to parse formula 'a1' in test");
    match expr {
        Expr::Reference { address, .. } => {
            assert_eq!(address.col, 0);
            assert_eq!(address.row, 0);
        }
        _ => panic!("Expected lowercase reference"),
    }

    // Lowercase function names should work
    let expr =
        FormulaParser::parse("sum(a1:b10)").expect("Failed to parse formula 'sum(a1:b10)' in test");
    match expr {
        Expr::FunctionCall { name, .. } => {
            assert_eq!(name, "SUM"); // Should be uppercase internally
        }
        _ => panic!("Expected lowercase function"),
    }
}

// ==================== STRING HANDLING ====================

#[test]
fn test_empty_string() {
    let expr = FormulaParser::parse("\"\"").unwrap();
    match expr {
        Expr::Literal {
            value: CellValue::String(s),
        } => {
            assert_eq!(s.as_ref(), "");
        }
        _ => panic!("Expected empty string"),
    }
}

#[test]
fn test_string_with_spaces() {
    let expr = FormulaParser::parse("\"  spaces  \"").unwrap();
    match expr {
        Expr::Literal {
            value: CellValue::String(s),
        } => {
            assert_eq!(s.as_ref(), "  spaces  ");
        }
        _ => panic!("Expected string with spaces"),
    }
}

// ==================== REAL-WORLD FORMULA EXAMPLES ====================

#[test]
fn test_if_formula() {
    let expr = FormulaParser::parse("IF(A1>10, \"High\", \"Low\")").unwrap();
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "IF");
            assert_eq!(args.len(), 3);
            // First arg is comparison
            assert!(matches!(
                &args[0],
                Expr::BinaryOp {
                    op: BinaryOperator::GreaterThan,
                    ..
                }
            ));
            // Second and third are strings
            assert!(matches!(
                &args[1],
                Expr::Literal {
                    value: CellValue::String(_)
                }
            ));
            assert!(matches!(
                &args[2],
                Expr::Literal {
                    value: CellValue::String(_)
                }
            ));
        }
        _ => panic!("Expected IF formula"),
    }
}

#[test]
fn test_sumproduct_formula() {
    let expr = FormulaParser::parse("SUMPRODUCT(A1:A10, B1:B10)")
        .expect("Failed to parse formula 'SUMPRODUCT(A1:A10, B1:B10)' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "SUMPRODUCT");
            assert_eq!(args.len(), 2);
            assert!(matches!(&args[0], Expr::Range { .. }));
            assert!(matches!(&args[1], Expr::Range { .. }));
        }
        _ => panic!("Expected SUMPRODUCT formula"),
    }
}

#[test]
fn test_vlookup_formula() {
    let expr = FormulaParser::parse("VLOOKUP(A1, B1:D10, 2, FALSE)")
        .expect("Failed to parse formula 'VLOOKUP(A1, B1:D10, 2, FALSE)' in test");
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "VLOOKUP");
            assert_eq!(args.len(), 4);
            assert!(matches!(&args[0], Expr::Reference { .. }));
            assert!(matches!(&args[1], Expr::Range { .. }));
            assert!(matches!(
                &args[2],
                Expr::Literal {
                    value: CellValue::Number(_)
                }
            ));
            assert!(matches!(
                &args[3],
                Expr::Literal {
                    value: CellValue::Boolean(false)
                }
            ));
        }
        _ => panic!("Expected VLOOKUP formula"),
    }
}

#[test]
fn test_and_or_formulas() {
    let expr = FormulaParser::parse("IF(AND(A1>0, A1<100), \"Valid\", \"Invalid\")").unwrap();
    match expr {
        Expr::FunctionCall { name, args } => {
            assert_eq!(name, "IF");
            assert_eq!(args.len(), 3);
            // First arg should be AND function
            match &args[0] {
                Expr::FunctionCall { name, args } => {
                    assert_eq!(name, "AND");
                    assert_eq!(args.len(), 2);
                }
                _ => panic!("Expected AND function"),
            }
        }
        _ => panic!("Expected IF with AND"),
    }
}

#[test]
fn test_multi_column_range() {
    let expr = FormulaParser::parse("A1:C10").expect("Failed to parse formula 'A1:C10' in test");
    match expr {
        Expr::Range { range, .. } => {
            assert_eq!(range.start.col, 0); // A
            assert_eq!(range.start.row, 0); // 1
            assert_eq!(range.end.col, 2); // C
            assert_eq!(range.end.row, 9); // 10
        }
        _ => panic!("Expected multi-column range"),
    }

    // Large absolute range
    let expr =
        FormulaParser::parse("$A$1:$Z$100").expect("Failed to parse formula '$A$1:$Z$100' in test");
    match expr {
        Expr::Range {
            range,
            absolute_start_col,
            absolute_start_row,
            absolute_end_col,
            absolute_end_row,
        } => {
            assert_eq!(range.start.col, 0); // A
            assert_eq!(range.end.col, 25); // Z
            assert_eq!(range.end.row, 99); // 100 (0-indexed)
            assert!(absolute_start_col);
            assert!(absolute_start_row);
            assert!(absolute_end_col);
            assert!(absolute_end_row);
        }
        _ => panic!("Expected absolute multi-column range"),
    }
}

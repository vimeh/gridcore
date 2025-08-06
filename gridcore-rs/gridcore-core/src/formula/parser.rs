use crate::{Result, SpreadsheetError};
use crate::types::{CellAddress, CellValue};
use super::ast::{Expr, BinaryOperator, UnaryOperator, CellRange};
use chumsky::prelude::*;
use chumsky::pratt::*;

pub struct FormulaParser;

impl FormulaParser {
    /// Parse a formula string into an AST
    pub fn parse(formula: &str) -> Result<Expr> {
        // Remove leading '=' if present
        let formula = formula.trim_start_matches('=').trim();
        
        // Parse and handle errors
        match Self::parser().parse(formula).into_result() {
            Ok(expr) => Ok(expr),
            Err(errors) => {
                // Combine error messages
                let msg = errors
                    .iter()
                    .map(|e| format!("{:?}", e))
                    .collect::<Vec<_>>()
                    .join("; ");
                Err(SpreadsheetError::Parse(msg))
            }
        }
    }
    
    /// Build the Chumsky 0.10 parser
    fn parser<'a>() -> impl Parser<'a, &'a str, Expr, extra::Err<Rich<'a, char>>> {
        recursive(|expr| {
            // Numbers
            let number = text::int(10)
                .then(just('.').then(text::digits(10)).or_not())
                .to_slice()
                .map(|s: &str| {
                    let num = s.parse::<f64>().unwrap_or(0.0);
                    Expr::Literal { value: CellValue::Number(num) }
                })
                .padded();
            
            // Booleans
            let boolean = choice((
                text::keyword("TRUE").to(Expr::Literal { value: CellValue::Boolean(true) }),
                text::keyword("FALSE").to(Expr::Literal { value: CellValue::Boolean(false) }),
            ))
            .padded();
            
            // Strings
            let string = just('"')
                .ignore_then(
                    none_of('"')
                        .repeated()
                        .to_slice()
                )
                .then_ignore(just('"'))
                .map(|s: &str| Expr::Literal { value: CellValue::String(s.to_string()) })
                .padded();
            
            // Cell reference parser helper
            let cell_ref_parser = {
                let dollar = just('$').or_not().map(|d| d.is_some());
                // Parse column letters (A-Z repeated)
                let col_letters = one_of('A'..='Z')
                    .repeated()
                    .at_least(1)
                    .to_slice();
                let row_num = text::int(10);
                
                dollar
                    .then(col_letters)
                    .then(dollar)
                    .then(row_num)
                    .try_map(|(((abs_col, col_str), abs_row), row_str): (((bool, &str), bool), &str), span| {
                        let col = CellAddress::column_label_to_number(col_str)
                            .map_err(|e| Rich::custom(span, e.to_string()))?;
                        let row: u32 = row_str.parse()
                            .map_err(|_| Rich::custom(span, "Invalid row number"))?;
                        if row == 0 {
                            return Err(Rich::custom(span, "Row must be greater than 0"));
                        }
                        Ok((CellAddress::new(col, row - 1), abs_col, abs_row))
                    })
            };
            
            // Cell range (A1:B10)
            let range = cell_ref_parser.clone()
                .then_ignore(just(':'))
                .then(cell_ref_parser.clone())
                .map(|((start_addr, abs_start_col, abs_start_row), (end_addr, abs_end_col, abs_end_row))| {
                    Expr::Range {
                        range: CellRange::new(start_addr, end_addr),
                        absolute_start_col: abs_start_col,
                        absolute_start_row: abs_start_row,
                        absolute_end_col: abs_end_col,
                        absolute_end_row: abs_end_row,
                    }
                })
                .padded();
            
            // Single cell reference
            let cell_reference = cell_ref_parser
                .map(|(addr, abs_col, abs_row)| Expr::Reference {
                    address: addr,
                    absolute_col: abs_col,
                    absolute_row: abs_row,
                })
                .padded();
            
            // Function names (case insensitive)
            let func_name = text::ascii::ident()
                .map(|s: &str| s.to_uppercase())
                .padded();
            
            // Function call
            let function_call = func_name
                .then(
                    expr.clone()
                        .separated_by(just(',').padded())
                        .allow_trailing()
                        .collect::<Vec<_>>()
                        .delimited_by(just('('), just(')'))
                        .padded()
                )
                .map(|(name, args)| Expr::FunctionCall { name, args });
            
            // Atoms - the basic units that can appear in expressions
            let atom = choice((
                // Order matters: try more specific patterns first
                function_call,
                range,
                cell_reference,
                number,
                boolean,
                string,
                // Parenthesized expression
                expr.clone()
                    .delimited_by(just('(').padded(), just(')').padded()),
            ));
            
            // Build the expression parser with operator precedence using pratt
            // Note: Chumsky 0.10 pratt operators expect an extra span parameter
            atom.pratt((
                // Percent postfix operator
                postfix(6, just('%').padded(), |expr, _, _span| {
                    Expr::UnaryOp {
                        op: UnaryOperator::Percent,
                        expr: Box::new(expr),
                    }
                }),
                // Unary minus prefix operator
                prefix(5, just('-').padded(), |_, expr, _span| {
                    Expr::UnaryOp {
                        op: UnaryOperator::Negate,
                        expr: Box::new(expr),
                    }
                }),
                // Power operator (right associative, highest precedence for binary ops)
                infix(right(4), just('^').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Power,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Multiplication and division
                infix(left(3), just('*').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Multiply,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(3), just('/').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Divide,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Addition and subtraction
                infix(left(2), just('+').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Add,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(2), just('-').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Subtract,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Comparison operators
                infix(left(1), just("<=").padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::LessThanOrEqual,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just(">=").padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::GreaterThanOrEqual,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just("<>").padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::NotEqual,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just('<').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::LessThan,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just('>').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::GreaterThan,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                infix(left(1), just('=').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Equal,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
                // Concatenation operator (lowest precedence)
                infix(left(0), just('&').padded(), |left, _, right, _span| {
                    Expr::BinaryOp {
                        op: BinaryOperator::Concat,
                        left: Box::new(left),
                        right: Box::new(right),
                    }
                }),
            ))
            .padded()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_number() {
        let expr = FormulaParser::parse("42").unwrap();
        assert!(matches!(expr, Expr::Literal { value: CellValue::Number(n) } if n == 42.0));
        
        let expr = FormulaParser::parse("3.14").unwrap();
        assert!(matches!(expr, Expr::Literal { value: CellValue::Number(n) } if n == 3.14));
    }
    
    #[test]
    fn test_parse_boolean() {
        let expr = FormulaParser::parse("TRUE").unwrap();
        assert!(matches!(expr, Expr::Literal { value: CellValue::Boolean(true) }));
        
        let expr = FormulaParser::parse("FALSE").unwrap();
        assert!(matches!(expr, Expr::Literal { value: CellValue::Boolean(false) }));
    }
    
    #[test]
    fn test_parse_string() {
        let expr = FormulaParser::parse("\"hello world\"").unwrap();
        match expr {
            Expr::Literal { value: CellValue::String(s) } => {
                assert_eq!(s, "hello world");
            }
            _ => panic!("Expected string literal"),
        }
    }
    
    #[test]
    fn test_parse_cell_reference() {
        let expr = FormulaParser::parse("A1").unwrap();
        match expr {
            Expr::Reference { address, absolute_col, absolute_row } => {
                assert_eq!(address.col, 0);
                assert_eq!(address.row, 0);
                assert!(!absolute_col);
                assert!(!absolute_row);
            }
            _ => panic!("Expected cell reference"),
        }
        
        // Absolute references
        let expr = FormulaParser::parse("$A$1").unwrap();
        match expr {
            Expr::Reference { address, absolute_col, absolute_row } => {
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
        let expr = FormulaParser::parse("A1:B2").unwrap();
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
        let expr = FormulaParser::parse("SUM(A1, B2, 10)").unwrap();
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
        let expr = FormulaParser::parse("SUM(A1:A10)").unwrap();
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
        let expr = FormulaParser::parse("-42").unwrap();
        match expr {
            Expr::UnaryOp { op: UnaryOperator::Negate, .. } => {}
            _ => panic!("Expected negation"),
        }
        
        let expr = FormulaParser::parse("50%").unwrap();
        match expr {
            Expr::UnaryOp { op: UnaryOperator::Percent, .. } => {}
            _ => panic!("Expected percent"),
        }
    }
    
    #[test]
    fn test_parse_binary() {
        let expr = FormulaParser::parse("A1 + B1").unwrap();
        match expr {
            Expr::BinaryOp { op: BinaryOperator::Add, .. } => {}
            _ => panic!("Expected addition"),
        }
    }
    
    #[test]
    fn test_operator_precedence() {
        // Test that multiplication happens before addition
        let expr = FormulaParser::parse("2 + 3 * 4").unwrap();
        match expr {
            Expr::BinaryOp { op: BinaryOperator::Add, left, right } => {
                // Left should be 2
                assert!(matches!(left.as_ref(), Expr::Literal { value: CellValue::Number(n) } if n == &2.0));
                // Right should be 3 * 4
                assert!(matches!(right.as_ref(), Expr::BinaryOp { op: BinaryOperator::Multiply, .. }));
            }
            _ => panic!("Expected addition with multiplication on right"),
        }
        
        // Test that power is right-associative
        let expr = FormulaParser::parse("2 ^ 3 ^ 2").unwrap();
        match expr {
            Expr::BinaryOp { op: BinaryOperator::Power, left, right } => {
                // Left should be 2
                assert!(matches!(left.as_ref(), Expr::Literal { value: CellValue::Number(n) } if n == &2.0));
                // Right should be 3 ^ 2
                assert!(matches!(right.as_ref(), Expr::BinaryOp { op: BinaryOperator::Power, .. }));
            }
            _ => panic!("Expected power operation"),
        }
    }
    
    #[test]
    fn test_complex_expression() {
        // Test a complex expression with multiple operators
        let expr = FormulaParser::parse("(A1 + B1) * 2 - C1 / 4").unwrap();
        // Just verify it parses without error
        assert!(matches!(expr, Expr::BinaryOp { op: BinaryOperator::Subtract, .. }));
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
            Expr::BinaryOp { op: BinaryOperator::Concat, left, right } => {
                // Left should be A1 & " "
                assert!(matches!(left.as_ref(), Expr::BinaryOp { op: BinaryOperator::Concat, .. }));
            }
            _ => panic!("Expected concatenation"),
        }
    }
}
use crate::{Result, SpreadsheetError};
use crate::types::{CellAddress, CellValue};
use super::ast::{Expr, BinaryOperator, UnaryOperator, CellRange};

pub struct FormulaParser;

impl FormulaParser {
    /// Parse a formula string into an AST
    pub fn parse(formula: &str) -> Result<Expr> {
        // Remove leading '=' if present
        let formula = formula.trim_start_matches('=').trim();
        
        // For now, use a simple manual parser
        // TODO: Implement full chumsky parser once API is stabilized
        Self::simple_parse(formula)
    }
    
    /// Simple manual parser (temporary implementation)
    fn simple_parse(formula: &str) -> Result<Expr> {
        let formula = formula.trim();
        
        // Check for unary minus
        if formula.starts_with('-') && formula.len() > 1 {
            // Parse what comes after the minus
            let inner = Self::simple_parse(&formula[1..].trim())?;
            return Ok(Expr::UnaryOp {
                op: UnaryOperator::Negate,
                expr: Box::new(inner),
            });
        }
        
        // Try to parse as number
        if let Ok(num) = formula.parse::<f64>() {
            return Ok(Expr::Literal {
                value: CellValue::Number(num),
            });
        }
        
        // Try to parse as boolean
        if formula == "TRUE" {
            return Ok(Expr::Literal {
                value: CellValue::Boolean(true),
            });
        }
        if formula == "FALSE" {
            return Ok(Expr::Literal {
                value: CellValue::Boolean(false),
            });
        }
        
        // Try to parse as string literal
        if formula.starts_with('"') && formula.ends_with('"') && formula.len() > 1 {
            let content = &formula[1..formula.len()-1];
            return Ok(Expr::Literal {
                value: CellValue::String(content.to_string()),
            });
        }
        
        // Try to parse as function call FIRST (before checking for ranges)
        // This way SUM(A1:A10) gets parsed as a function, not a range
        if let Some(paren_pos) = formula.find('(') {
            if formula.ends_with(')') {
                let func_name = formula[..paren_pos].trim().to_uppercase();
                let args_str = &formula[paren_pos+1..formula.len()-1];
                
                let args = if args_str.trim().is_empty() {
                    Vec::new()
                } else {
                    // Split by comma, but be careful with nested structures
                    let mut args = Vec::new();
                    let mut current_arg = String::new();
                    let mut paren_depth = 0;
                    
                    for ch in args_str.chars() {
                        match ch {
                            '(' => {
                                paren_depth += 1;
                                current_arg.push(ch);
                            }
                            ')' => {
                                paren_depth -= 1;
                                current_arg.push(ch);
                            }
                            ',' if paren_depth == 0 => {
                                args.push(Self::simple_parse(current_arg.trim())?);
                                current_arg.clear();
                            }
                            _ => current_arg.push(ch),
                        }
                    }
                    
                    if !current_arg.trim().is_empty() {
                        args.push(Self::simple_parse(current_arg.trim())?);
                    }
                    
                    args
                };
                
                return Ok(Expr::FunctionCall {
                    name: func_name,
                    args,
                });
            }
        }
        
        // Try to parse as cell reference or range (after function check)
        if let Some(colon_pos) = formula.find(':') {
            // It's a range
            let start_str = &formula[..colon_pos];
            let end_str = &formula[colon_pos+1..];
            
            let start = Self::parse_cell_ref(start_str)?;
            let end = Self::parse_cell_ref(end_str)?;
            
            return Ok(Expr::Range {
                range: CellRange::new(start.0, end.0),
                absolute_start_col: start.1,
                absolute_start_row: start.2,
                absolute_end_col: end.1,
                absolute_end_row: end.2,
            });
        }
        
        // Try to parse as single cell reference
        if let Ok((addr, abs_col, abs_row)) = Self::parse_cell_ref(formula) {
            return Ok(Expr::Reference {
                address: addr,
                absolute_col: abs_col,
                absolute_row: abs_row,
            });
        }
        
        // Try to parse simple binary operations (very basic)
        for (op_str, op) in &[
            ("+", BinaryOperator::Add),
            ("-", BinaryOperator::Subtract),
            ("*", BinaryOperator::Multiply),
            ("/", BinaryOperator::Divide),
            ("^", BinaryOperator::Power),
            ("&", BinaryOperator::Concat),
            ("=", BinaryOperator::Equal),
            ("<>", BinaryOperator::NotEqual),
            ("<=", BinaryOperator::LessThanOrEqual),
            (">=", BinaryOperator::GreaterThanOrEqual),
            ("<", BinaryOperator::LessThan),
            (">", BinaryOperator::GreaterThan),
        ] {
            if let Some(op_pos) = formula.find(op_str) {
                // Make sure it's not inside quotes
                let before = &formula[..op_pos];
                let after = &formula[op_pos + op_str.len()..];
                
                if !before.contains('"') && !after.contains('"') {
                    let left = Self::simple_parse(before.trim())?;
                    let right = Self::simple_parse(after.trim())?;
                    
                    return Ok(Expr::BinaryOp {
                        op: *op,
                        left: Box::new(left),
                        right: Box::new(right),
                    });
                }
            }
        }
        
        // Try to parse percent
        if formula.ends_with('%') {
            let inner = Self::simple_parse(&formula[..formula.len()-1].trim())?;
            return Ok(Expr::UnaryOp {
                op: UnaryOperator::Percent,
                expr: Box::new(inner),
            });
        }
        
        Err(SpreadsheetError::Parse(format!(
            "Unable to parse formula: {}",
            formula
        )))
    }
    
    /// Parse a cell reference (e.g., A1, $A$1)
    fn parse_cell_ref(s: &str) -> Result<(CellAddress, bool, bool)> {
        let s = s.trim();
        let mut chars = s.chars().peekable();
        
        // Check for absolute column marker
        let abs_col = if chars.peek() == Some(&'$') {
            chars.next();
            true
        } else {
            false
        };
        
        // Parse column letters
        let mut col_str = String::new();
        while let Some(&c) = chars.peek() {
            if c.is_ascii_uppercase() {
                col_str.push(c);
                chars.next();
            } else {
                break;
            }
        }
        
        if col_str.is_empty() {
            return Err(SpreadsheetError::InvalidAddress(format!(
                "No column in address: {}",
                s
            )));
        }
        
        // Check for absolute row marker
        let abs_row = if chars.peek() == Some(&'$') {
            chars.next();
            true
        } else {
            false
        };
        
        // Parse row number
        let row_str: String = chars.collect();
        if row_str.is_empty() {
            return Err(SpreadsheetError::InvalidAddress(format!(
                "No row in address: {}",
                s
            )));
        }
        
        let col = CellAddress::column_label_to_number(&col_str)?;
        let row: u32 = row_str.parse()
            .map_err(|e| SpreadsheetError::InvalidAddress(format!("Invalid row: {}", e)))?;
        
        if row == 0 {
            return Err(SpreadsheetError::InvalidAddress(
                "Row must be greater than 0".to_string()
            ));
        }
        
        Ok((CellAddress::new(col, row - 1), abs_col, abs_row))
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
}
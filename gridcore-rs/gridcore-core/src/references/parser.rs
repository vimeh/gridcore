use super::{Reference, ReferenceType};
use crate::formula::Expr;
use crate::types::CellAddress;
use crate::Result;
use regex::Regex;
use std::collections::HashSet;

/// Parser for extracting references from formulas
pub struct ReferenceParser {
    cell_ref_regex: Regex,
    range_ref_regex: Regex,
    sheet_ref_regex: Regex,
}

impl ReferenceParser {
    pub fn new() -> Self {
        Self {
            cell_ref_regex: Regex::new(r"(\$?)([A-Z]+)(\$?)(\d+)").unwrap(),
            range_ref_regex: Regex::new(r"(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)").unwrap(),
            sheet_ref_regex: Regex::new(r"([A-Za-z0-9_]+)!(\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?)").unwrap(),
        }
    }

    /// Extract all references from a formula string
    pub fn parse_formula(&self, formula: &str) -> Vec<Reference> {
        let mut references = Vec::new();

        // Check for sheet references first
        for cap in self.sheet_ref_regex.captures_iter(formula) {
            let sheet_name = cap.get(1).unwrap().as_str();
            let ref_text = cap.get(2).unwrap().as_str();
            
            if let Some(inner_ref) = self.parse_single_reference(ref_text) {
                references.push(Reference::new(
                    ReferenceType::Sheet(sheet_name.to_string(), Box::new(inner_ref)),
                    cap.get(0).unwrap().as_str().to_string(),
                ));
            }
        }

        // Check for range references
        for cap in self.range_ref_regex.captures_iter(formula) {
            let start_text = cap.get(1).unwrap().as_str();
            let end_text = cap.get(2).unwrap().as_str();
            
            if let (Some(start_ref), Some(end_ref)) = (
                self.parse_single_reference(start_text),
                self.parse_single_reference(end_text),
            ) {
                references.push(Reference::new(
                    ReferenceType::Range(Box::new(start_ref), Box::new(end_ref)),
                    cap.get(0).unwrap().as_str().to_string(),
                ));
            }
        }

        // Check for individual cell references
        for cap in self.cell_ref_regex.captures_iter(formula) {
            let full_match = cap.get(0).unwrap().as_str();
            // Skip if this is part of a range or sheet reference
            if !self.is_part_of_complex_reference(formula, full_match) {
                if let Some(reference) = self.parse_single_reference(full_match) {
                    references.push(reference);
                }
            }
        }

        references
    }

    /// Extract references from an expression AST
    pub fn extract_from_expr(&self, expr: &Expr) -> HashSet<CellAddress> {
        let mut references = HashSet::new();
        self.extract_from_expr_recursive(expr, &mut references);
        references
    }

    fn extract_from_expr_recursive(&self, expr: &Expr, references: &mut HashSet<CellAddress>) {
        match expr {
            Expr::Reference { address, .. } => {
                references.insert(address.clone());
            }
            Expr::Range { range, .. } => {
                // Add all cells in the range
                for row in range.start.row..=range.end.row {
                    for col in range.start.col..=range.end.col {
                        references.insert(CellAddress::new(col, row));
                    }
                }
            }
            Expr::FunctionCall { args, .. } => {
                for arg in args {
                    self.extract_from_expr_recursive(arg, references);
                }
            }
            Expr::BinaryOp { left, right, .. } => {
                self.extract_from_expr_recursive(left, references);
                self.extract_from_expr_recursive(right, references);
            }
            Expr::UnaryOp { expr, .. } => {
                self.extract_from_expr_recursive(expr, references);
            }
            _ => {}
        }
    }

    /// Parse a single cell reference
    fn parse_single_reference(&self, text: &str) -> Option<Reference> {
        if let Some(captures) = self.cell_ref_regex.captures(text) {
            let col_absolute = !captures.get(1)?.as_str().is_empty();
            let col_str = captures.get(2)?.as_str();
            let row_absolute = !captures.get(3)?.as_str().is_empty();
            let row_str = captures.get(4)?.as_str();

            let col = self.column_to_number(col_str)?;
            let row = row_str.parse::<u32>().ok()? - 1; // Convert to 0-based

            let ref_type = match (col_absolute, row_absolute) {
                (true, true) => ReferenceType::Absolute(col, row),
                (true, false) => ReferenceType::MixedCol(col, row as i32),
                (false, true) => ReferenceType::MixedRow(col as i32, row),
                (false, false) => ReferenceType::Relative(col as i32, row as i32),
            };

            Some(Reference::new(ref_type, text.to_string()))
        } else {
            None
        }
    }

    /// Check if a reference is part of a more complex reference
    fn is_part_of_complex_reference(&self, formula: &str, reference: &str) -> bool {
        let Some(pos) = formula.find(reference) else {
            return false;
        };
        
        // Check if preceded by '!' (sheet reference)
        if pos > 0 {
            if let Some(prev_char) = formula.chars().nth(pos - 1) {
                if prev_char == '!' {
                    return true;
                }
            }
        }
        
        // Check if followed by ':' (range reference)
        let end_pos = pos + reference.len();
        if end_pos < formula.len() {
            if let Some(next_char) = formula.chars().nth(end_pos) {
                if next_char == ':' {
                    return true;
                }
            }
        }
        
        // Check if preceded by ':' (range reference)
        if pos > 0 {
            if let Some(prev_char) = formula.chars().nth(pos - 1) {
                if prev_char == ':' {
                    return true;
                }
            }
        }
        
        false
    }

    /// Convert column letters to 0-based column number
    fn column_to_number(&self, col_str: &str) -> Option<u32> {
        let mut result = 0u32;
        for c in col_str.chars() {
            result = result * 26 + (c as u32 - 'A' as u32 + 1);
        }
        Some(result - 1) // Convert to 0-based
    }

    /// Convert 0-based column number to column letters
    pub fn number_to_column(&self, mut col: u32) -> String {
        let mut result = String::new();
        col += 1; // Convert to 1-based

        while col > 0 {
            col -= 1;
            result = format!("{}{}", (b'A' + (col % 26) as u8) as char, result);
            col /= 26;
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_reference() {
        let parser = ReferenceParser::new();
        let refs = parser.parse_formula("=A1+B2");
        
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0].text, "A1");
        assert_eq!(refs[1].text, "B2");
    }

    #[test]
    fn test_parse_absolute_reference() {
        let parser = ReferenceParser::new();
        let refs = parser.parse_formula("=$A$1+$B2+C$3");
        
        assert_eq!(refs.len(), 3);
        assert!(matches!(refs[0].ref_type, ReferenceType::Absolute(_, _)));
        assert!(matches!(refs[1].ref_type, ReferenceType::MixedCol(_, _)));
        assert!(matches!(refs[2].ref_type, ReferenceType::MixedRow(_, _)));
    }

    #[test]
    fn test_parse_range_reference() {
        let parser = ReferenceParser::new();
        let refs = parser.parse_formula("=SUM(A1:B10)");
        
        assert_eq!(refs.len(), 1);
        assert!(matches!(refs[0].ref_type, ReferenceType::Range(_, _)));
    }

    #[test]
    fn test_parse_sheet_reference() {
        let parser = ReferenceParser::new();
        let refs = parser.parse_formula("=Sheet1!A1+Sheet2!B2:C3");
        
        assert_eq!(refs.len(), 2);
        assert!(matches!(refs[0].ref_type, ReferenceType::Sheet(_, _)));
    }
}
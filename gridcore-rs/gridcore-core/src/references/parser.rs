use super::{Reference, ReferenceType};
use crate::formula::Expr;
use crate::types::CellAddress;
use regex::Regex;
use std::collections::HashSet;
use std::sync::LazyLock;

// Compile regexes once at runtime using LazyLock
static CELL_REF_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(\$?)([A-Z]+)(\$?)([0-9]+)").expect("Invalid cell reference regex - this is a bug")
});

static RANGE_REF_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(\$?[A-Z]+\$?[0-9]+):(\$?[A-Z]+\$?[0-9]+)").expect("Invalid range reference regex - this is a bug")
});

static SHEET_REF_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"([A-Za-z0-9_]+)!(\$?[A-Z]+\$?[0-9]+(?::\$?[A-Z]+\$?[0-9]+)?)",
    ).expect("Invalid sheet reference regex - this is a bug")
});

/// Parser for extracting references from formulas
pub struct ReferenceParser {}

impl Default for ReferenceParser {
    fn default() -> Self {
        Self::new()
    }
}

impl ReferenceParser {
    pub fn new() -> Self {
        // Force lazy initialization of regexes
        let _ = &*CELL_REF_REGEX;
        let _ = &*RANGE_REF_REGEX;
        let _ = &*SHEET_REF_REGEX;
        Self {}
    }

    /// Extract all references from a formula string
    pub fn parse_formula(&self, formula: &str) -> Vec<Reference> {
        let mut references = Vec::new();
        let mut processed_positions = std::collections::HashSet::new();

        // Check for sheet references first
        for cap in SHEET_REF_REGEX.captures_iter(formula) {
            // These unwraps are safe because the regex guarantees these groups exist
            let Some(full_match) = cap.get(0) else { continue; };
            let match_range = full_match.range();
            processed_positions.insert(match_range.clone());

            let Some(sheet_match) = cap.get(1) else { continue; };
            let Some(ref_match) = cap.get(2) else { continue; };
            let sheet_name = sheet_match.as_str();
            let ref_text = ref_match.as_str();

            // Check if the inner reference is a range
            if ref_text.contains(':') {
                // Parse as a range within the sheet
                if let Some(range_cap) = RANGE_REF_REGEX.captures(ref_text) {
                    let Some(start_match) = range_cap.get(1) else { continue; };
                    let Some(end_match) = range_cap.get(2) else { continue; };
                    let start_text = start_match.as_str();
                    let end_text = end_match.as_str();

                    if let (Some(start_ref), Some(end_ref)) = (
                        self.parse_single_reference(start_text),
                        self.parse_single_reference(end_text),
                    ) {
                        let range_ref = Reference::new(
                            ReferenceType::Range(Box::new(start_ref), Box::new(end_ref)),
                            ref_text.to_string(),
                        );
                        references.push(Reference::new(
                            ReferenceType::Sheet(sheet_name.to_string(), Box::new(range_ref)),
                            full_match.as_str().to_string(),
                        ));
                    }
                }
            } else if let Some(inner_ref) = self.parse_single_reference(ref_text) {
                references.push(Reference::new(
                    ReferenceType::Sheet(sheet_name.to_string(), Box::new(inner_ref)),
                    full_match.as_str().to_string(),
                ));
            }
        }

        // Check for range references (not part of sheet references)
        for cap in RANGE_REF_REGEX.captures_iter(formula) {
            let Some(full_match) = cap.get(0) else { continue; };
            let match_range = full_match.range();
            // Skip if this range is part of a sheet reference
            if processed_positions
                .iter()
                .any(|r| r.contains(&match_range.start) || r.contains(&(match_range.end - 1)))
            {
                continue;
            }

            let Some(start_match) = cap.get(1) else { continue; };
            let Some(end_match) = cap.get(2) else { continue; };
            let start_text = start_match.as_str();
            let end_text = end_match.as_str();

            if let (Some(start_ref), Some(end_ref)) = (
                self.parse_single_reference(start_text),
                self.parse_single_reference(end_text),
            ) {
                processed_positions.insert(match_range);
                references.push(Reference::new(
                    ReferenceType::Range(Box::new(start_ref), Box::new(end_ref)),
                    full_match.as_str().to_string(),
                ));
            }
        }

        // Check for individual cell references
        for cap in CELL_REF_REGEX.captures_iter(formula) {
            let Some(match_obj) = cap.get(0) else { continue; };
            let match_range = match_obj.range();
            // Skip if this is part of an already processed reference
            if processed_positions
                .iter()
                .any(|r| r.contains(&match_range.start) || r.contains(&(match_range.end - 1)))
            {
                continue;
            }

            let full_match = match_obj.as_str();
            // Also skip if this is part of a range or sheet reference not yet processed
            if !self.is_part_of_complex_reference(formula, full_match)
                && let Some(reference) = self.parse_single_reference(full_match)
            {
                references.push(reference);
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

    #[allow(clippy::only_used_in_recursion)]
    fn extract_from_expr_recursive(&self, expr: &Expr, references: &mut HashSet<CellAddress>) {
        match expr {
            Expr::Reference { address, .. } => {
                references.insert(*address);
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
        if let Some(captures) = CELL_REF_REGEX.captures(text) {
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
        if pos > 0
            && let Some(prev_char) = formula.chars().nth(pos - 1)
            && prev_char == '!'
        {
            return true;
        }

        // Check if followed by ':' (range reference)
        let end_pos = pos + reference.len();
        if end_pos < formula.len()
            && let Some(next_char) = formula.chars().nth(end_pos)
            && next_char == ':'
        {
            return true;
        }

        // Check if preceded by ':' (range reference)
        if pos > 0
            && let Some(prev_char) = formula.chars().nth(pos - 1)
            && prev_char == ':'
        {
            return true;
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

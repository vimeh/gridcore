use super::{FillDirection, FormulaAdjuster};
use crate::types::CellAddress;
use crate::{Result, SpreadsheetError};
use regex::Regex;

pub struct DefaultFormulaAdjuster;

impl DefaultFormulaAdjuster {
    pub fn new() -> Self {
        Self
    }

    fn parse_cell_reference(&self, reference: &str) -> Option<(bool, u32, bool, u32)> {
        let re = Regex::new(r"^(\$?)([A-Z]+)(\$?)(\d+)$").ok()?;

        if let Some(captures) = re.captures(reference) {
            let col_absolute = !captures.get(1)?.as_str().is_empty();
            let col_str = captures.get(2)?.as_str();
            let row_absolute = !captures.get(3)?.as_str().is_empty();
            let row_str = captures.get(4)?.as_str();

            let col = self.column_to_number(col_str)?;
            let row = row_str.parse::<u32>().ok()?;

            Some((col_absolute, col, row_absolute, row))
        } else {
            None
        }
    }

    fn column_to_number(&self, col_str: &str) -> Option<u32> {
        let mut result = 0u32;
        for c in col_str.chars() {
            result = result * 26 + (c as u32 - 'A' as u32 + 1);
        }
        Some(result - 1) // Convert to 0-based
    }

    fn number_to_column(&self, mut col: u32) -> String {
        let mut result = String::new();
        col += 1; // Convert to 1-based

        while col > 0 {
            col -= 1;
            result = format!("{}{}", (b'A' + (col % 26) as u8) as char, result);
            col /= 26;
        }

        result
    }

    fn adjust_reference(&self, reference: &str, from: &CellAddress, to: &CellAddress) -> String {
        if let Some((col_abs, col, row_abs, row)) = self.parse_cell_reference(reference) {
            let mut new_col = col;
            let mut new_row = row - 1; // Convert to 0-based for calculation

            // Adjust relative references
            if !col_abs {
                let col_diff = to.col as i32 - from.col as i32;
                new_col = ((col as i32) + col_diff).max(0) as u32;
            }

            if !row_abs {
                let row_diff = to.row as i32 - from.row as i32;
                new_row = ((new_row as i32) + row_diff).max(0) as u32;
            }

            // Reconstruct the reference
            format!(
                "{}{}{}{}",
                if col_abs { "$" } else { "" },
                self.number_to_column(new_col),
                if row_abs { "$" } else { "" },
                new_row + 1 // Convert back to 1-based
            )
        } else {
            reference.to_string()
        }
    }
}

impl FormulaAdjuster for DefaultFormulaAdjuster {
    fn adjust_formula(
        &self,
        formula: &str,
        from: &CellAddress,
        to: &CellAddress,
        _direction: FillDirection,
    ) -> Result<String> {
        if !formula.starts_with('=') {
            return Err(SpreadsheetError::InvalidOperation(
                "Not a formula".to_string(),
            ));
        }

        let formula_content = &formula[1..];

        // Simple regex to find cell references
        // This is a simplified version - a real implementation would use the formula parser
        let re = Regex::new(r"\$?[A-Z]+\$?\d+")
            .map_err(|e| SpreadsheetError::InvalidOperation(format!("Regex error: {}", e)))?;

        let mut result = String::from("=");
        let mut last_end = 0;

        for mat in re.find_iter(formula_content) {
            // Add the text before the match
            result.push_str(&formula_content[last_end..mat.start()]);

            // Adjust the reference
            let adjusted = self.adjust_reference(mat.as_str(), from, to);
            result.push_str(&adjusted);

            last_end = mat.end();
        }

        // Add any remaining text
        result.push_str(&formula_content[last_end..]);

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adjust_relative_reference() {
        let adjuster = DefaultFormulaAdjuster::new();
        let from = CellAddress::new(0, 0); // A1
        let to = CellAddress::new(1, 1); // B2

        let result = adjuster
            .adjust_formula("=A1+B1", &from, &to, FillDirection::Down)
            .unwrap();
        assert_eq!(result, "=B2+C2");
    }

    #[test]
    fn test_adjust_absolute_reference() {
        let adjuster = DefaultFormulaAdjuster::new();
        let from = CellAddress::new(0, 0); // A1
        let to = CellAddress::new(1, 1); // B2

        let result = adjuster
            .adjust_formula("=$A$1+B1", &from, &to, FillDirection::Down)
            .unwrap();
        assert_eq!(result, "=$A$1+C2");
    }

    #[test]
    fn test_adjust_mixed_reference() {
        let adjuster = DefaultFormulaAdjuster::new();
        let from = CellAddress::new(0, 0); // A1
        let to = CellAddress::new(1, 1); // B2

        let result = adjuster
            .adjust_formula("=$A1+A$1", &from, &to, FillDirection::Down)
            .unwrap();
        assert_eq!(result, "=$A2+B$1");
    }

    #[test]
    fn test_column_conversions() {
        let adjuster = DefaultFormulaAdjuster::new();

        assert_eq!(adjuster.column_to_number("A"), Some(0));
        assert_eq!(adjuster.column_to_number("Z"), Some(25));
        assert_eq!(adjuster.column_to_number("AA"), Some(26));
        assert_eq!(adjuster.column_to_number("AZ"), Some(51));

        assert_eq!(adjuster.number_to_column(0), "A");
        assert_eq!(adjuster.number_to_column(25), "Z");
        assert_eq!(adjuster.number_to_column(26), "AA");
        assert_eq!(adjuster.number_to_column(51), "AZ");
    }

    #[test]
    fn test_parse_cell_reference() {
        let adjuster = DefaultFormulaAdjuster::new();

        assert_eq!(
            adjuster.parse_cell_reference("A1"),
            Some((false, 0, false, 1))
        );
        assert_eq!(
            adjuster.parse_cell_reference("$A1"),
            Some((true, 0, false, 1))
        );
        assert_eq!(
            adjuster.parse_cell_reference("A$1"),
            Some((false, 0, true, 1))
        );
        assert_eq!(
            adjuster.parse_cell_reference("$A$1"),
            Some((true, 0, true, 1))
        );
        assert_eq!(
            adjuster.parse_cell_reference("AA10"),
            Some((false, 26, false, 10))
        );
    }

    #[test]
    fn test_complex_formula_adjustment() {
        let adjuster = DefaultFormulaAdjuster::new();
        let from = CellAddress::new(0, 0); // A1
        let to = CellAddress::new(0, 1); // A2

        let result = adjuster
            .adjust_formula(
                "=SUM(A1:A10)+AVERAGE(B1:B10)*$C$1",
                &from,
                &to,
                FillDirection::Down,
            )
            .unwrap();

        assert_eq!(result, "=SUM(A2:A11)+AVERAGE(B2:B11)*$C$1");
    }
}

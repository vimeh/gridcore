use super::parser::ReferenceParser;
use super::{CellRange, Reference, ReferenceType, StructuralOperation};
use crate::Result;
use crate::types::CellAddress;

/// Adjusts references in formulas when structural changes occur
pub struct ReferenceAdjuster {
    parser: ReferenceParser,
}

impl Default for ReferenceAdjuster {
    fn default() -> Self {
        Self::new()
    }
}

impl ReferenceAdjuster {
    pub fn new() -> Self {
        Self {
            parser: ReferenceParser::new(),
        }
    }

    /// Adjust references in a formula based on a structural operation
    pub fn adjust_formula(&self, formula: &str, operation: &StructuralOperation) -> Result<String> {
        if !formula.starts_with('=') {
            return Ok(formula.to_string());
        }

        let references = self.parser.parse_formula(formula);
        let mut adjusted_formula = formula.to_string();

        // Process references in reverse order to maintain correct positions
        for reference in references.iter().rev() {
            if let Some(adjusted_ref) = self.adjust_reference(reference, operation) {
                adjusted_formula = adjusted_formula.replace(&reference.text, &adjusted_ref);
            }
        }

        Ok(adjusted_formula)
    }

    /// Adjust a single reference based on a structural operation
    fn adjust_reference(
        &self,
        reference: &Reference,
        operation: &StructuralOperation,
    ) -> Option<String> {
        match operation {
            StructuralOperation::InsertRows { before_row, count } => {
                self.adjust_for_insert_rows(reference, *before_row, *count)
            }
            StructuralOperation::InsertColumns { before_col, count } => {
                self.adjust_for_insert_columns(reference, *before_col, *count)
            }
            StructuralOperation::DeleteRows { start_row, count } => {
                self.adjust_for_delete_rows(reference, *start_row, *count)
            }
            StructuralOperation::DeleteColumns { start_col, count } => {
                self.adjust_for_delete_columns(reference, *start_col, *count)
            }
            StructuralOperation::MoveRange { from, to } => {
                self.adjust_for_move_range(reference, from, to)
            }
        }
    }

    fn adjust_for_insert_rows(
        &self,
        reference: &Reference,
        before_row: u32,
        count: u32,
    ) -> Option<String> {
        match &reference.ref_type {
            ReferenceType::Absolute(col, row) => {
                // before_row is 0-based; we need to check if the reference's row (also 0-based) is affected
                // References at or after the insertion point should be shifted down
                if *row >= before_row {
                    Some(self.format_absolute_reference(*col, row + count))
                } else {
                    None
                }
            }
            ReferenceType::MixedRow(col, row) => {
                if *row >= before_row {
                    Some(self.format_mixed_row_reference(*col, row + count))
                } else {
                    None
                }
            }
            ReferenceType::Range(start, end) => {
                let start_adjusted = self.adjust_for_insert_rows(start, before_row, count);
                let end_adjusted = self.adjust_for_insert_rows(end, before_row, count);

                match (start_adjusted, end_adjusted) {
                    (Some(s), Some(e)) => Some(format!("{}:{}", s, e)),
                    _ => None,
                }
            }
            ReferenceType::Sheet(sheet_name, inner_ref) => {
                // Adjust the inner reference and prepend the sheet name
                self.adjust_for_insert_rows(inner_ref, before_row, count).map(|adjusted| format!("{}!{}", sheet_name, adjusted))
            }
            _ => None,
        }
    }

    fn adjust_for_insert_columns(
        &self,
        reference: &Reference,
        before_col: u32,
        count: u32,
    ) -> Option<String> {
        match &reference.ref_type {
            ReferenceType::Absolute(col, row) => {
                if *col >= before_col {
                    Some(self.format_absolute_reference(col + count, *row))
                } else {
                    None
                }
            }
            ReferenceType::MixedCol(col, row) => {
                if *col >= before_col {
                    Some(self.format_mixed_col_reference(col + count, *row))
                } else {
                    None
                }
            }
            ReferenceType::Range(start, end) => {
                let start_adjusted = self.adjust_for_insert_columns(start, before_col, count);
                let end_adjusted = self.adjust_for_insert_columns(end, before_col, count);

                match (start_adjusted, end_adjusted) {
                    (Some(s), Some(e)) => Some(format!("{}:{}", s, e)),
                    _ => None,
                }
            }
            ReferenceType::Sheet(sheet_name, inner_ref) => {
                // Adjust the inner reference and prepend the sheet name
                self.adjust_for_insert_columns(inner_ref, before_col, count).map(|adjusted| format!("{}!{}", sheet_name, adjusted))
            }
            _ => None,
        }
    }

    fn adjust_for_delete_rows(
        &self,
        reference: &Reference,
        start_row: u32,
        count: u32,
    ) -> Option<String> {
        match &reference.ref_type {
            ReferenceType::Absolute(col, row) => {
                if *row >= start_row + count {
                    Some(self.format_absolute_reference(*col, row - count))
                } else if *row >= start_row {
                    Some("#REF!".to_string()) // Reference deleted
                } else {
                    None
                }
            }
            _ => None, // Similar logic for other types
        }
    }

    fn adjust_for_delete_columns(
        &self,
        reference: &Reference,
        start_col: u32,
        count: u32,
    ) -> Option<String> {
        match &reference.ref_type {
            ReferenceType::Absolute(col, row) => {
                if *col >= start_col + count {
                    Some(self.format_absolute_reference(col - count, *row))
                } else if *col >= start_col {
                    Some("#REF!".to_string()) // Reference deleted
                } else {
                    None
                }
            }
            _ => None, // Similar logic for other types
        }
    }

    fn adjust_for_move_range(
        &self,
        reference: &Reference,
        from: &CellRange,
        to: &CellAddress,
    ) -> Option<String> {
        // Check if reference is within the moved range
        if let Some(addr) = reference.to_absolute_address(&CellAddress::new(0, 0))
            && from.contains(&addr) {
                let row_offset = to.row as i32 - from.start.row as i32;
                let col_offset = to.col as i32 - from.start.col as i32;

                let new_row = (addr.row as i32 + row_offset).max(0) as u32;
                let new_col = (addr.col as i32 + col_offset).max(0) as u32;

                return Some(self.format_relative_reference(new_col, new_row));
            }
        None
    }

    fn format_absolute_reference(&self, col: u32, row: u32) -> String {
        format!("${}${}", self.parser.number_to_column(col), row + 1)
    }

    fn format_relative_reference(&self, col: u32, row: u32) -> String {
        format!("{}{}", self.parser.number_to_column(col), row + 1)
    }

    fn format_mixed_col_reference(&self, col: u32, row: i32) -> String {
        format!("${}{}", self.parser.number_to_column(col), row + 1)
    }

    fn format_mixed_row_reference(&self, col: i32, row: u32) -> String {
        format!("{}${}", self.parser.number_to_column(col as u32), row + 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adjust_for_insert_rows() {
        let adjuster = ReferenceAdjuster::new();
        let operation = StructuralOperation::InsertRows {
            before_row: 2,
            count: 3,
        };

        let formula = "=A2+$B$3";
        let adjusted = adjuster.adjust_formula(formula, &operation).unwrap();
        assert_eq!(adjusted, "=A2+$B$6");
    }

    #[test]
    fn test_adjust_for_delete_columns() {
        let adjuster = ReferenceAdjuster::new();
        let operation = StructuralOperation::DeleteColumns {
            start_col: 1,
            count: 1,
        };

        let formula = "=$A$1+$C$1";
        let adjusted = adjuster.adjust_formula(formula, &operation).unwrap();
        assert_eq!(adjusted, "=$A$1+$B$1");
    }
}

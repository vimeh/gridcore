use super::{Reference, ReferenceType};
use crate::types::CellAddress;

/// Detector for identifying reference types and patterns
pub struct ReferenceDetector;

impl Default for ReferenceDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl ReferenceDetector {
    pub fn new() -> Self {
        Self
    }

    /// Check if a reference would be affected by a structural operation
    pub fn is_affected_by_insert_rows(&self, reference: &Reference, before_row: u32) -> bool {
        match &reference.ref_type {
            ReferenceType::Absolute(_, row) | ReferenceType::MixedRow(_, row) => *row >= before_row,
            ReferenceType::Relative(_, _) | ReferenceType::MixedCol(_, _) => true,
            ReferenceType::Range(start, end) => {
                self.is_affected_by_insert_rows(start, before_row)
                    || self.is_affected_by_insert_rows(end, before_row)
            }
            ReferenceType::Sheet(_, inner) => self.is_affected_by_insert_rows(inner, before_row),
            ReferenceType::External(_, inner) => self.is_affected_by_insert_rows(inner, before_row),
        }
    }

    pub fn is_affected_by_insert_columns(&self, reference: &Reference, before_col: u32) -> bool {
        match &reference.ref_type {
            ReferenceType::Absolute(col, _) | ReferenceType::MixedCol(col, _) => *col >= before_col,
            ReferenceType::Relative(_, _) | ReferenceType::MixedRow(_, _) => true,
            ReferenceType::Range(start, end) => {
                self.is_affected_by_insert_columns(start, before_col)
                    || self.is_affected_by_insert_columns(end, before_col)
            }
            ReferenceType::Sheet(_, inner) => self.is_affected_by_insert_columns(inner, before_col),
            ReferenceType::External(_, inner) => {
                self.is_affected_by_insert_columns(inner, before_col)
            }
        }
    }

    pub fn is_affected_by_delete_rows(
        &self,
        reference: &Reference,
        start_row: u32,
        count: u32,
    ) -> bool {
        let end_row = start_row + count;
        match &reference.ref_type {
            ReferenceType::Absolute(_, row) | ReferenceType::MixedRow(_, row) => {
                *row >= start_row && *row < end_row
            }
            ReferenceType::Relative(_, _) | ReferenceType::MixedCol(_, _) => true,
            ReferenceType::Range(start, end) => {
                self.is_affected_by_delete_rows(start, start_row, count)
                    || self.is_affected_by_delete_rows(end, start_row, count)
            }
            ReferenceType::Sheet(_, inner) => {
                self.is_affected_by_delete_rows(inner, start_row, count)
            }
            ReferenceType::External(_, inner) => {
                self.is_affected_by_delete_rows(inner, start_row, count)
            }
        }
    }

    pub fn is_affected_by_delete_columns(
        &self,
        reference: &Reference,
        start_col: u32,
        count: u32,
    ) -> bool {
        let end_col = start_col + count;
        match &reference.ref_type {
            ReferenceType::Absolute(col, _) | ReferenceType::MixedCol(col, _) => {
                *col >= start_col && *col < end_col
            }
            ReferenceType::Relative(_, _) | ReferenceType::MixedRow(_, _) => true,
            ReferenceType::Range(start, end) => {
                self.is_affected_by_delete_columns(start, start_col, count)
                    || self.is_affected_by_delete_columns(end, start_col, count)
            }
            ReferenceType::Sheet(_, inner) => {
                self.is_affected_by_delete_columns(inner, start_col, count)
            }
            ReferenceType::External(_, inner) => {
                self.is_affected_by_delete_columns(inner, start_col, count)
            }
        }
    }

    /// Check if a reference is circular
    pub fn is_circular(&self, from: &CellAddress, reference: &Reference) -> bool {
        if let Some(target) = reference.to_absolute_address(from) {
            target == *from
        } else {
            false
        }
    }
}

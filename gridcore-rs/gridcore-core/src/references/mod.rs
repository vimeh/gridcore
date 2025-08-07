use crate::types::CellAddress;
use crate::Result;

pub mod parser;
pub mod detector;
pub mod adjuster;
pub mod tracker;

#[cfg(test)]
mod tests;

/// Types of cell references in formulas
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReferenceType {
    /// Relative reference (e.g., A1)
    Relative(i32, i32),
    /// Absolute reference (e.g., $A$1)
    Absolute(u32, u32),
    /// Mixed reference with absolute column (e.g., $A1)
    MixedCol(u32, i32),
    /// Mixed reference with absolute row (e.g., A$1)
    MixedRow(i32, u32),
    /// Range reference (e.g., A1:B10)
    Range(Box<Reference>, Box<Reference>),
    /// Sheet reference (e.g., Sheet1!A1)
    Sheet(String, Box<Reference>),
    /// External reference (e.g., [Book1]Sheet1!A1)
    External(String, Box<Reference>),
}

/// A cell reference in a formula
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reference {
    pub ref_type: ReferenceType,
    pub text: String,
}

impl Reference {
    pub fn new(ref_type: ReferenceType, text: String) -> Self {
        Self { ref_type, text }
    }

    /// Convert to absolute address if possible
    pub fn to_absolute_address(&self, from: &CellAddress) -> Option<CellAddress> {
        match &self.ref_type {
            ReferenceType::Relative(col_offset, row_offset) => {
                let col = (from.col as i32 + col_offset).max(0) as u32;
                let row = (from.row as i32 + row_offset).max(0) as u32;
                Some(CellAddress::new(col, row))
            }
            ReferenceType::Absolute(col, row) => Some(CellAddress::new(*col, *row)),
            ReferenceType::MixedCol(col, row_offset) => {
                let row = (from.row as i32 + row_offset).max(0) as u32;
                Some(CellAddress::new(*col, row))
            }
            ReferenceType::MixedRow(col_offset, row) => {
                let col = (from.col as i32 + col_offset).max(0) as u32;
                Some(CellAddress::new(col, *row))
            }
            _ => None,
        }
    }
}

/// Structural operations that affect references
#[derive(Debug, Clone)]
pub enum StructuralOperation {
    InsertRows { before_row: u32, count: u32 },
    InsertColumns { before_col: u32, count: u32 },
    DeleteRows { start_row: u32, count: u32 },
    DeleteColumns { start_col: u32, count: u32 },
    MoveRange { 
        from: CellRange,
        to: CellAddress,
    },
}

/// A range of cells
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CellRange {
    pub start: CellAddress,
    pub end: CellAddress,
}

impl CellRange {
    pub fn new(start: CellAddress, end: CellAddress) -> Self {
        Self { start, end }
    }

    pub fn contains(&self, addr: &CellAddress) -> bool {
        addr.col >= self.start.col
            && addr.col <= self.end.col
            && addr.row >= self.start.row
            && addr.row <= self.end.row
    }
}
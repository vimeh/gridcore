use crate::Result;
use crate::types::{CellAddress, CellValue};
use std::time::Duration;

pub mod adjuster;
pub mod engine;
pub mod patterns;

#[cfg(test)]
mod tests;

pub use engine::FillEngine;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FillDirection {
    Down,
    Up,
    Left,
    Right,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PatternType {
    Linear(f64),      // slope
    Exponential(f64), // growth rate
    Date(Duration),   // increment
    Text,             // copy or increment
    Custom(String),   // formula pattern
    Copy,             // simple copy (fallback)
}

#[derive(Debug, Clone)]
pub struct FillOperation {
    pub source_range: CellRange,
    pub target_range: CellRange,
    pub direction: FillDirection,
    pub pattern: Option<PatternType>,
}

#[derive(Debug, Clone)]
pub struct FillResult {
    pub affected_cells: Vec<(CellAddress, CellValue)>,
    pub formulas_adjusted: Vec<(CellAddress, String)>,
}

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

    pub fn cell_count(&self) -> usize {
        let cols = (self.end.col - self.start.col + 1) as usize;
        let rows = (self.end.row - self.start.row + 1) as usize;
        cols * rows
    }

    pub fn iter_cells(&self) -> impl Iterator<Item = CellAddress> + '_ {
        (self.start.row..=self.end.row).flat_map(move |row| {
            (self.start.col..=self.end.col).map(move |col| CellAddress::new(col, row))
        })
    }
}

pub trait PatternDetector {
    fn detect(&self, values: &[CellValue]) -> Option<PatternType>;

    fn priority(&self) -> u32;

    fn can_handle(&self, values: &[CellValue]) -> bool;
}

pub trait FormulaAdjuster {
    fn adjust_formula(
        &self,
        formula: &str,
        from: &CellAddress,
        to: &CellAddress,
        direction: FillDirection,
    ) -> Result<String>;
}

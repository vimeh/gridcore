use crate::Result;
use crate::types::{CellAddress, CellValue};
use std::collections::HashSet;

/// Trait for providing cell values during formula evaluation
pub trait EvaluationContext {
    /// Get the value of a cell
    fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue>;

    /// Check if we're in a circular dependency
    fn check_circular(&self, address: &CellAddress) -> bool;

    /// Mark a cell as being evaluated (for circular dependency detection)
    fn push_evaluation(&mut self, address: &CellAddress);

    /// Unmark a cell as being evaluated
    fn pop_evaluation(&mut self, address: &CellAddress);
}

/// Basic implementation of EvaluationContext for testing
#[derive(Debug, Clone)]
pub struct BasicContext {
    /// Stack of cells currently being evaluated
    evaluation_stack: HashSet<CellAddress>,
}

impl BasicContext {
    pub fn new() -> Self {
        BasicContext {
            evaluation_stack: HashSet::new(),
        }
    }
}

impl EvaluationContext for BasicContext {
    fn get_cell_value(&self, _address: &CellAddress) -> Result<CellValue> {
        // In a real implementation, this would look up the cell value
        // For now, return empty
        Ok(CellValue::Empty)
    }

    fn check_circular(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.contains(address)
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(address.clone());
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(address);
    }
}

/// Context that delegates to a repository
pub struct RepositoryContext<'a> {
    repository: &'a crate::repository::CellRepository,
    evaluation_stack: HashSet<CellAddress>,
}

impl<'a> RepositoryContext<'a> {
    pub fn new(repository: &'a crate::repository::CellRepository) -> Self {
        RepositoryContext {
            repository,
            evaluation_stack: HashSet::new(),
        }
    }
}

impl<'a> EvaluationContext for RepositoryContext<'a> {
    fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue> {
        if let Some(cell) = self.repository.get(address) {
            Ok(cell.get_computed_value())
        } else {
            Ok(CellValue::Empty)
        }
    }

    fn check_circular(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.contains(address)
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(address.clone());
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(address);
    }
}

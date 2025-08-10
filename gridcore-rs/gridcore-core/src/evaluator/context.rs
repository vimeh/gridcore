use crate::Result;
use crate::ports::RepositoryPort;
use crate::types::{CellAddress, CellValue};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};

/// Trait for providing cell values during formula evaluation
pub trait EvaluationContext {
    /// Get the value of a cell
    fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue>;

    /// Check if a cell is currently being evaluated (for circular dependency detection)
    fn is_evaluating(&self, address: &CellAddress) -> bool;

    /// Push a cell address to the evaluation stack
    fn push_evaluation(&mut self, address: &CellAddress);

    /// Pop a cell address from the evaluation stack
    fn pop_evaluation(&mut self, address: &CellAddress);
}

/// Basic context for testing
pub struct BasicContext {
    evaluation_stack: HashSet<CellAddress>,
}

impl BasicContext {
    pub fn new() -> Self {
        BasicContext {
            evaluation_stack: HashSet::new(),
        }
    }
}

impl Default for BasicContext {
    fn default() -> Self {
        Self::new()
    }
}

impl EvaluationContext for BasicContext {
    fn get_cell_value(&self, _address: &CellAddress) -> Result<CellValue> {
        // Return empty for testing
        Ok(CellValue::Empty)
    }

    fn is_evaluating(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.contains(address)
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(*address);
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(address);
    }
}

/// Context that delegates to a repository
pub struct RepositoryContext<'a> {
    repository: &'a Arc<Mutex<crate::repository::CellRepository>>,
    evaluation_stack: HashSet<CellAddress>,
}

impl<'a> RepositoryContext<'a> {
    pub fn new(repository: &'a Arc<Mutex<crate::repository::CellRepository>>) -> Self {
        RepositoryContext {
            repository,
            evaluation_stack: HashSet::new(),
        }
    }

    pub fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(*address);
    }

    pub fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(address);
    }
}

impl<'a> EvaluationContext for RepositoryContext<'a> {
    fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue> {
        let repository = self.repository.lock().map_err(|_| {
            crate::SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;

        // Check for circular dependency
        if self.is_evaluating(address) {
            return Err(crate::SpreadsheetError::CircularDependency);
        }

        // Get the cell from the repository
        if let Some(cell) = repository.get(address) {
            Ok(cell.get_computed_value())
        } else {
            Ok(CellValue::Empty)
        }
    }

    fn is_evaluating(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.contains(address)
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(*address);
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(address);
    }
}

/// Context that uses a repository port
pub struct PortContext {
    repository: Arc<dyn RepositoryPort>,
    evaluation_stack: HashSet<CellAddress>,
}

impl PortContext {
    pub fn new(repository: Arc<dyn RepositoryPort>) -> Self {
        PortContext {
            repository,
            evaluation_stack: HashSet::new(),
        }
    }
}

impl EvaluationContext for PortContext {
    fn get_cell_value(&self, address: &CellAddress) -> Result<CellValue> {
        // Check for circular dependency
        if self.is_evaluating(address) {
            return Err(crate::SpreadsheetError::CircularDependency);
        }

        // Get the cell from the repository
        if let Some(cell) = self.repository.get(address) {
            Ok(cell.get_computed_value())
        } else {
            Ok(CellValue::Empty)
        }
    }

    fn is_evaluating(&self, address: &CellAddress) -> bool {
        self.evaluation_stack.contains(address)
    }

    fn push_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.insert(*address);
    }

    fn pop_evaluation(&mut self, address: &CellAddress) {
        self.evaluation_stack.remove(address);
    }
}
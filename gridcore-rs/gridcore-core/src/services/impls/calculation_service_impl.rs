//! Implementation of CalculationService trait

use crate::dependency::DependencyGraph;
use crate::evaluator::{Evaluator, context::BasicContext};
use crate::formula::FormulaParser;
use crate::repository::CellRepository;
use crate::traits::CalculationService;
use crate::types::{CellAddress, CellValue};
use crate::{Result, SpreadsheetError};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};

/// Concrete implementation of CalculationService
pub struct CalculationServiceImpl {
    repository: Arc<Mutex<CellRepository>>,
    dependency_graph: Arc<Mutex<DependencyGraph>>,
    needs_recalc: Arc<Mutex<bool>>,
}

impl CalculationServiceImpl {
    /// Create a new CalculationServiceImpl
    pub fn new(
        repository: Arc<Mutex<CellRepository>>,
        dependency_graph: Arc<Mutex<DependencyGraph>>,
    ) -> Self {
        Self {
            repository,
            dependency_graph,
            needs_recalc: Arc::new(Mutex::new(false)),
        }
    }

    /// Mark that recalculation is needed
    pub fn mark_needs_recalculation(&self) {
        if let Ok(mut needs) = self.needs_recalc.lock() {
            *needs = true;
        }
    }

    /// Clear the recalculation flag
    pub fn clear_recalculation_flag(&self) {
        if let Ok(mut needs) = self.needs_recalc.lock() {
            *needs = false;
        }
    }
}

impl CalculationService for CalculationServiceImpl {
    fn recalculate(&self) -> Result<()> {
        let repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;

        // Get calculation order
        let order = dependency_graph.get_calculation_order()?;

        // Create evaluator with basic context
        // TODO: Create a repository-backed context implementation
        let mut context = BasicContext::new();
        let mut evaluator = Evaluator::new(&mut context);

        // Recalculate each cell in order
        for address in order {
            if let Some(cell) = repository.get(&address)
                && cell.has_formula() {
                    // Parse and evaluate formula
                    if let CellValue::String(ref formula_str) = cell.raw_value {
                        if formula_str.starts_with('=') {
                            let formula_text = &formula_str[1..];
                            match FormulaParser::parse(formula_text) {
                                Ok(ast) => match evaluator.evaluate(&ast) {
                        Ok(value) => {
                            // Note: In real implementation, we'd need mutable access
                            // to update the cell's computed value
                            // This is simplified for demonstration
                            let mut updated_cell = cell.clone();
                            updated_cell.set_computed_value(value);
                            // Would need to save back to repository
                        }
                        Err(e) => {
                            let mut updated_cell = cell.clone();
                            updated_cell.set_error(format!("Error: {}", e));
                            // Would need to save back to repository
                                    }
                                }
                                Err(e) => {
                                    let mut updated_cell = cell.clone();
                                    updated_cell.set_error(format!("Parse error: {:?}", e));
                                    // Would need to save back to repository
                                }
                            }
                        }
                    }
                }
        }

        self.clear_recalculation_flag();
        Ok(())
    }

    fn recalculate_cells(&self, addresses: &[CellAddress]) -> Result<()> {
        let repository = self.repository.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire repository lock".to_string())
        })?;
        let dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;

        // Find all cells affected by the given addresses
        let mut affected = HashSet::new();
        for address in addresses {
            affected.insert(*address);
            affected.extend(dependency_graph.get_dependents(address));
        }

        // Get calculation order for all cells (filtering to affected only)
        let all_order = dependency_graph.get_calculation_order()?;
        let affected_set = affected;
        let order: Vec<_> = all_order
            .into_iter()
            .filter(|addr| affected_set.contains(addr))
            .collect();

        // Create evaluator with basic context
        // TODO: Create a repository-backed context implementation
        let mut context = BasicContext::new();
        let mut evaluator = Evaluator::new(&mut context);

        // Recalculate each affected cell
        for address in order {
            if let Some(cell) = repository.get(&address)
                && cell.has_formula() {
                    // Parse and evaluate formula
                    if let CellValue::String(ref formula_str) = cell.raw_value {
                        if formula_str.starts_with('=') {
                            let formula_text = &formula_str[1..];
                            match FormulaParser::parse(formula_text) {
                                Ok(ast) => match evaluator.evaluate(&ast) {
                        Ok(value) => {
                            let mut updated_cell = cell.clone();
                            updated_cell.set_computed_value(value);
                            // Would need to save back to repository
                        }
                        Err(e) => {
                            let mut updated_cell = cell.clone();
                            updated_cell.set_error(format!("Error: {}", e));
                            // Would need to save back to repository
                                    }
                                }
                                Err(e) => {
                                    let mut updated_cell = cell.clone();
                                    updated_cell.set_error(format!("Parse error: {:?}", e));
                                    // Would need to save back to repository
                                }
                            }
                        }
                    }
                }
        }

        Ok(())
    }

    fn get_calculation_order(&self) -> Result<Vec<CellAddress>> {
        let dependency_graph = self.dependency_graph.lock().map_err(|_| {
            SpreadsheetError::LockError("Failed to acquire dependency graph lock".to_string())
        })?;

        dependency_graph.get_calculation_order()
    }

    fn needs_recalculation(&self) -> bool {
        self.needs_recalc
            .lock()
            .map(|needs| *needs)
            .unwrap_or(false)
    }
}

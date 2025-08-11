//! Spreadsheet facade using port interfaces
//!
//! This facade demonstrates clean architecture by using only port interfaces,
//! completely decoupled from infrastructure implementations.

use crate::Result;
use crate::domain::Cell;
use crate::ports::{EventPort, RepositoryPort};
use crate::services::{ServiceContainer, ServiceContainerBuilder};
use crate::types::{CellAddress, CellValue};
use crate::workbook::{Sheet, SheetManager, Workbook};
use std::sync::{Arc, Mutex};

/// Facade for spreadsheet operations using clean architecture
pub struct SpreadsheetFacade {
    container: Arc<ServiceContainer>,
    sheet_manager: Arc<Mutex<SheetManager>>,
    active_sheet: Arc<Mutex<String>>,
}

impl SpreadsheetFacade {
    /// Create a new facade with default adapters
    pub fn new() -> Self {
        use crate::adapters::{EventAdapter, RepositoryAdapter};

        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(EventAdapter::new_empty());

        let container = ServiceContainerBuilder::new()
            .with_repository(repository as Arc<dyn RepositoryPort>)
            .with_events(events as Arc<dyn EventPort>)
            .build();

        // Initialize with a default workbook containing one sheet
        let workbook = Workbook::with_sheet("Sheet1");
        let sheet_manager = SheetManager::with_workbook(workbook);

        Self {
            container: Arc::new(container),
            sheet_manager: Arc::new(Mutex::new(sheet_manager)),
            active_sheet: Arc::new(Mutex::new("Sheet1".to_string())),
        }
    }

    /// Create a new facade with the given container
    pub fn with_container(container: ServiceContainer) -> Self {
        let workbook = Workbook::with_sheet("Sheet1");
        let sheet_manager = SheetManager::with_workbook(workbook);

        Self {
            container: Arc::new(container),
            sheet_manager: Arc::new(Mutex::new(sheet_manager)),
            active_sheet: Arc::new(Mutex::new("Sheet1".to_string())),
        }
    }

    /// Create a facade with specific ports
    pub fn with_ports(repository: Arc<dyn RepositoryPort>, events: Arc<dyn EventPort>) -> Self {
        let container = ServiceContainerBuilder::new()
            .with_repository(repository)
            .with_events(events)
            .build();

        Self::with_container(container)
    }

    /// Get a cell value
    pub fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        self.container.repository()?.get(address)
    }

    /// Set a cell value (simplified version)
    pub fn set_cell(&self, address: &CellAddress, value: CellValue) -> Result<()> {
        let old_value = self.get_cell(address).map(|c| c.get_computed_value());

        // Create and store the new cell
        if let Some(repository) = self.container.repository() {
            let cell = Cell::new(value.clone());
            repository.set(address, cell)?;
        }

        // Emit event through the event port
        if let Some(events) = self.container.events() {
            use crate::ports::event_port::DomainEvent;
            let event = DomainEvent::CellChanged {
                address: *address,
                old_value,
                new_value: value,
            };
            events.publish(event)?;
        }

        Ok(())
    }

    /// Delete a cell
    pub fn delete_cell(&self, address: &CellAddress) -> Result<()> {
        let old_cell = self.get_cell(address);

        // Delete from repository
        if let Some(repository) = self.container.repository() {
            repository.delete(address)?;
        }

        // Emit event through the event port
        if let Some(events) = self.container.events() {
            use crate::ports::event_port::DomainEvent;
            if let Some(cell) = old_cell {
                let event = DomainEvent::CellDeleted {
                    address: *address,
                    old_value: cell.get_computed_value(),
                };
                events.publish(event)?;
            }
        }

        Ok(())
    }

    /// Recalculate all cells
    pub fn recalculate(&self) -> Result<()> {
        if let Some(calc_service) = self.container.calculation_service() {
            calc_service.recalculate()?;
        }
        Ok(())
    }

    /// Get the number of cells
    pub fn cell_count(&self) -> usize {
        self.container
            .repository()
            .map(|repo| repo.count())
            .unwrap_or(0)
    }

    // Methods for command system compatibility

    /// Set cell value (standard API)
    pub fn set_cell_value(&self, address: &CellAddress, value: &str) -> Result<()> {
        if let Some(formula_text) = value.strip_prefix('=') {
            // It's a formula - create a cell with formula
            if let Some(repository) = self.container.repository() {
                let formula_string = formula_text.to_string();
                let mut cell = Cell::with_formula(
                    CellValue::from_string(value.to_string()),
                    formula_string.clone(),
                );

                // Try to evaluate the formula
                if let Some(repo_for_eval) = self.container.repository() {
                    use crate::evaluator::{Evaluator, PortContext};
                    use crate::formula::FormulaParser;

                    // Parse the formula
                    match FormulaParser::parse(&formula_string) {
                        Ok(expr) => {
                            let mut context = PortContext::new(repo_for_eval);
                            let mut evaluator = Evaluator::new(&mut context);

                            // Evaluate and set the computed value
                            match evaluator.evaluate(&expr) {
                                Ok(result) => cell.set_computed_value(result),
                                Err(e) => cell.set_error(e.to_string()),
                            }
                        }
                        Err(e) => {
                            // Parse error - set error on the cell
                            cell.set_error(e.to_string());
                        }
                    }
                }

                repository.set(address, cell)?;
            }
        } else {
            // Regular value
            let cell_value = if let Ok(num) = value.parse::<f64>() {
                CellValue::Number(num)
            } else if let Ok(bool_val) = value.parse::<bool>() {
                CellValue::Boolean(bool_val)
            } else {
                CellValue::from_string(value.to_string())
            };
            self.set_cell(address, cell_value)?;
        }

        Ok(())
    }

    /// Get raw cell value
    pub fn get_cell_raw_value(&self, address: &CellAddress) -> Option<CellValue> {
        self.get_cell(address).map(|cell| cell.get_computed_value())
    }

    /// Get cell value as string
    pub fn get_cell_value(&self, address: &CellAddress) -> Option<String> {
        self.get_cell(address).map(|cell| {
            match cell.get_computed_value() {
                CellValue::Number(n) => n.to_string(),
                CellValue::String(s) => s.as_ref().clone(),
                CellValue::Boolean(b) => b.to_string(),
                CellValue::Error(e) => format!("#{}", e),
                CellValue::Empty => String::new(),
                CellValue::Array(arr) => {
                    // Format array as comma-separated values in braces
                    let values: Vec<String> = arr
                        .iter()
                        .map(|v| match v {
                            CellValue::Number(n) => n.to_string(),
                            CellValue::String(s) => s.as_ref().clone(),
                            CellValue::Boolean(b) => b.to_string(),
                            CellValue::Error(e) => format!("#{}", e),
                            CellValue::Empty => String::new(),
                            CellValue::Array(_) => "[nested array]".to_string(),
                        })
                        .collect();
                    format!("{{{}}}", values.join(", "))
                }
            }
        })
    }

    /// Set cell value without command (for command system)
    pub fn set_cell_value_without_command(&self, address: &CellAddress, value: &str) -> Result<()> {
        self.set_cell_value(address, value)
    }

    /// Delete cell without command (for command system)
    pub fn delete_cell_without_command(&self, address: &CellAddress) -> Result<()> {
        self.delete_cell(address)
    }

    /// Get all cells
    pub fn get_all_cells(&self) -> Vec<(CellAddress, Cell)> {
        self.container
            .repository()
            .map(|repo| {
                let all = repo.get_all();
                all.into_iter().collect()
            })
            .unwrap_or_default()
    }

    /// Insert row without command
    pub fn insert_row_without_command(&self, _index: u32) -> Result<()> {
        // TODO: Implement when we update repository port to support structural operations
        Ok(())
    }

    /// Delete row without command
    pub fn delete_row_without_command(&self, _index: u32) -> Result<()> {
        // TODO: Implement when we update repository port to support structural operations
        Ok(())
    }

    /// Insert column without command
    pub fn insert_column_without_command(&self, _index: u32) -> Result<()> {
        // TODO: Implement when we update repository port to support structural operations
        Ok(())
    }

    /// Delete column without command
    pub fn delete_column_without_command(&self, _index: u32) -> Result<()> {
        // TODO: Implement when we update repository port to support structural operations
        Ok(())
    }
}

impl Default for SpreadsheetFacade {
    fn default() -> Self {
        Self::new()
    }
}

impl SpreadsheetFacade {
    // Sheet management methods

    /// Get list of all sheets
    pub fn get_sheets(&self) -> Vec<(String, usize)> {
        let manager = self.sheet_manager.lock().unwrap();
        manager
            .workbook()
            .sheet_names()
            .iter()
            .enumerate()
            .map(|(idx, name)| (name.clone(), idx))
            .collect()
    }

    /// Get the active sheet name
    pub fn get_active_sheet(&self) -> String {
        self.active_sheet.lock().unwrap().clone()
    }

    /// Set the active sheet
    pub fn set_active_sheet(&self, sheet_name: &str) -> Result<()> {
        let manager = self.sheet_manager.lock().unwrap();
        if manager.workbook().get_sheet(sheet_name).is_some() {
            *self.active_sheet.lock().unwrap() = sheet_name.to_string();
            Ok(())
        } else {
            Err(crate::SpreadsheetError::InvalidOperation(format!(
                "Sheet '{}' does not exist",
                sheet_name
            )))
        }
    }

    /// Add a new sheet
    pub fn add_sheet(&self, name: &str) -> Result<()> {
        let mut manager = self.sheet_manager.lock().unwrap();
        let sheet = Sheet::new(name);
        manager.workbook_mut().add_sheet(sheet)
    }

    /// Remove a sheet
    pub fn remove_sheet(&self, name: &str) -> Result<()> {
        let mut manager = self.sheet_manager.lock().unwrap();

        // Don't allow removing the last sheet
        if manager.workbook().sheet_count() <= 1 {
            return Err(crate::SpreadsheetError::InvalidOperation(
                "Cannot remove the last sheet".to_string(),
            ));
        }

        // If removing the active sheet, switch to another one
        if self.get_active_sheet() == name {
            let sheets = manager.workbook().sheet_names();
            for sheet_name in sheets {
                if sheet_name != name {
                    self.set_active_sheet(sheet_name)?;
                    break;
                }
            }
        }

        manager.workbook_mut().remove_sheet(name)?;
        Ok(())
    }

    /// Rename a sheet
    pub fn rename_sheet(&self, old_name: &str, new_name: &str) -> Result<()> {
        let mut manager = self.sheet_manager.lock().unwrap();
        manager.workbook_mut().rename_sheet(old_name, new_name)?;

        // Update active sheet if it was renamed
        if self.get_active_sheet() == old_name {
            *self.active_sheet.lock().unwrap() = new_name.to_string();
        }

        Ok(())
    }

    /// Get the number of sheets
    pub fn sheet_count(&self) -> usize {
        let manager = self.sheet_manager.lock().unwrap();
        manager.workbook().sheet_count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::{EventAdapter, RepositoryAdapter};

    #[test]
    fn test_facade_creation() {
        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(EventAdapter::new_empty());

        let facade = SpreadsheetFacade::with_ports(
            repository as Arc<dyn RepositoryPort>,
            events as Arc<dyn EventPort>,
        );

        assert_eq!(facade.cell_count(), 0);
    }

    #[test]
    fn test_facade_get_cell() {
        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(EventAdapter::new_empty());

        let facade = SpreadsheetFacade::with_ports(
            repository as Arc<dyn RepositoryPort>,
            events as Arc<dyn EventPort>,
        );

        let address = CellAddress::new(0, 0);
        assert!(facade.get_cell(&address).is_none());
    }

    #[test]
    fn test_facade_set_cell() {
        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(EventAdapter::new_empty());

        let facade = SpreadsheetFacade::with_ports(
            repository as Arc<dyn RepositoryPort>,
            events as Arc<dyn EventPort>,
        );

        let address = CellAddress::new(0, 0);
        let value = CellValue::Number(42.0);

        // This just tests that the method doesn't panic
        // Real implementation would need mutable repository
        assert!(facade.set_cell(&address, value).is_ok());
    }
}

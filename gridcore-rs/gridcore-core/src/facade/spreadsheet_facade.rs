//! Simplified spreadsheet facade
//!
//! This facade provides a clean API for spreadsheet operations,
//! delegating to appropriate services and utilities.

use crate::Result;
use crate::domain::Cell;
use crate::evaluator::evaluate_cell_formula;
use crate::ports::{EventPort, RepositoryPort};
use crate::services::{ServiceContainer, ServiceContainerBuilder};
use crate::types::{CellAddress, CellValue};
use crate::utils::format_cell_value;
use crate::workbook::{Sheet, SheetManager, Workbook};
use std::sync::{Arc, Mutex};

/// Simplified facade for spreadsheet operations
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

    // Core cell operations

    /// Get a cell by address
    pub fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        let manager = self.sheet_manager.lock().unwrap();
        let active_sheet_name = self.active_sheet.lock().unwrap();

        if let Some(sheet) = manager.workbook().get_sheet(&active_sheet_name) {
            sheet.cells().get(address)
        } else {
            self.container.repository()?.get(address)
        }
    }

    /// Set a cell value (handles formulas and regular values)
    pub fn set_cell_value(&self, address: &CellAddress, value: &str) -> Result<()> {
        let old_value = self.get_cell(address).map(|c| c.get_computed_value());

        // Get the repository for the active sheet
        let manager = self.sheet_manager.lock().unwrap();
        let active_sheet_name = self.active_sheet.lock().unwrap();

        let repository = if let Some(sheet) = manager.workbook().get_sheet(&active_sheet_name) {
            Some(sheet.cells())
        } else {
            self.container.repository()
        };

        if let Some(repo) = repository {
            // Use the helper to evaluate formulas
            let cell = evaluate_cell_formula(value, repo.clone())?;
            let new_value = cell.get_computed_value();

            // Store the cell
            repo.set(address, cell)?;

            // Emit event
            if let Some(events) = self.container.events() {
                use crate::ports::event_port::DomainEvent;
                let event = DomainEvent::CellChanged {
                    address: *address,
                    old_value,
                    new_value,
                };
                events.publish(event)?;
            }
        }

        Ok(())
    }

    /// Delete a cell
    pub fn delete_cell(&self, address: &CellAddress) -> Result<()> {
        let old_cell = self.get_cell(address);

        if let Some(repository) = self.container.repository() {
            repository.delete(address)?;
        }

        // Emit event
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

    /// Get cell value as a formatted string
    pub fn get_cell_value(&self, address: &CellAddress) -> Option<String> {
        self.get_cell(address)
            .map(|cell| format_cell_value(cell.get_computed_value()))
    }

    /// Get raw cell value
    pub fn get_cell_raw_value(&self, address: &CellAddress) -> Option<CellValue> {
        self.get_cell(address).map(|cell| cell.get_computed_value())
    }

    /// Get all cells
    pub fn get_all_cells(&self) -> Vec<(CellAddress, Cell)> {
        self.container
            .repository()
            .map(|repo| repo.get_all().into_iter().collect())
            .unwrap_or_default()
    }

    /// Get the number of cells
    pub fn cell_count(&self) -> usize {
        let manager = self.sheet_manager.lock().unwrap();
        let active_sheet_name = self.active_sheet.lock().unwrap();

        if let Some(sheet) = manager.workbook().get_sheet(&active_sheet_name) {
            sheet.cells().count()
        } else {
            self.container
                .repository()
                .map(|repo| repo.count())
                .unwrap_or(0)
        }
    }

    /// Recalculate all cells
    pub fn recalculate(&self) -> Result<()> {
        if let Some(calc_service) = self.container.calculation_service() {
            calc_service.recalculate()?;
        }
        Ok(())
    }

    // Sheet management

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

    // Command system compatibility methods
    // These are thin wrappers that just call the main methods

    /// Set cell value without command (for command system)
    pub fn set_cell_value_without_command(&self, address: &CellAddress, value: &str) -> Result<()> {
        self.set_cell_value(address, value)
    }

    /// Delete cell without command (for command system)
    pub fn delete_cell_without_command(&self, address: &CellAddress) -> Result<()> {
        self.delete_cell(address)
    }

    /// Insert row without command (placeholder)
    pub fn insert_row_without_command(&self, _index: u32) -> Result<()> {
        // Use structural operations service when available
        if let Some(structural_ops) = self.container.structural_operations() {
            structural_ops.insert_rows(_index, 1)?;
        }
        Ok(())
    }

    /// Delete row without command (placeholder)
    pub fn delete_row_without_command(&self, _index: u32) -> Result<()> {
        // Use structural operations service when available
        if let Some(structural_ops) = self.container.structural_operations() {
            structural_ops.delete_rows(_index, 1)?;
        }
        Ok(())
    }

    /// Insert column without command (placeholder)
    pub fn insert_column_without_command(&self, _index: u32) -> Result<()> {
        // Use structural operations service when available
        if let Some(structural_ops) = self.container.structural_operations() {
            structural_ops.insert_columns(_index, 1)?;
        }
        Ok(())
    }

    /// Delete column without command (placeholder)
    pub fn delete_column_without_command(&self, _index: u32) -> Result<()> {
        // Use structural operations service when available
        if let Some(structural_ops) = self.container.structural_operations() {
            structural_ops.delete_columns(_index, 1)?;
        }
        Ok(())
    }
}

impl Default for SpreadsheetFacade {
    fn default() -> Self {
        Self::new()
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
        let facade = SpreadsheetFacade::new();
        let address = CellAddress::new(0, 0);
        assert!(facade.get_cell(&address).is_none());
    }

    #[test]
    fn test_sheet_management() {
        let facade = SpreadsheetFacade::new();

        // Should start with one sheet
        assert_eq!(facade.sheet_count(), 1);
        assert_eq!(facade.get_active_sheet(), "Sheet1");

        // Add a new sheet
        assert!(facade.add_sheet("Sheet2").is_ok());
        assert_eq!(facade.sheet_count(), 2);

        // Switch active sheet
        assert!(facade.set_active_sheet("Sheet2").is_ok());
        assert_eq!(facade.get_active_sheet(), "Sheet2");
    }
}

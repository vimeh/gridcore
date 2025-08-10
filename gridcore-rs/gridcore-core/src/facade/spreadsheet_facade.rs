//! Spreadsheet facade using port interfaces
//!
//! This facade demonstrates clean architecture by using only port interfaces,
//! completely decoupled from infrastructure implementations.

use crate::Result;
use crate::domain::Cell;
use crate::ports::{EventPort, RepositoryPort};
use crate::services::{ServiceContainer, ServiceContainerBuilder};
use crate::types::{CellAddress, CellValue};
use std::sync::Arc;

/// Facade for spreadsheet operations using clean architecture
pub struct SpreadsheetFacade {
    container: Arc<ServiceContainer>,
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

        Self {
            container: Arc::new(container),
        }
    }

    /// Create a new facade with the given container
    pub fn with_container(container: ServiceContainer) -> Self {
        Self {
            container: Arc::new(container),
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
        // This would need a mutable repository port
        // For now, we demonstrate the architecture

        // Emit event through the event port
        if let Some(events) = self.container.events() {
            use crate::ports::event_port::DomainEvent;
            let event = DomainEvent::CellChanged {
                address: *address,
                old_value: self.get_cell(address).map(|c| c.get_computed_value()),
                new_value: value,
            };
            events.publish(event)?;
        }

        Ok(())
    }

    /// Delete a cell
    pub fn delete_cell(&self, address: &CellAddress) -> Result<()> {
        // Emit event through the event port
        if let Some(events) = self.container.events() {
            use crate::ports::event_port::DomainEvent;
            if let Some(cell) = self.get_cell(address) {
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
        // For now, just delegate to set_cell with parsed value
        let cell_value = if value.starts_with('=') {
            CellValue::String(value.to_string())
        } else if let Ok(num) = value.parse::<f64>() {
            CellValue::Number(num)
        } else if let Ok(bool_val) = value.parse::<bool>() {
            CellValue::Boolean(bool_val)
        } else {
            CellValue::String(value.to_string())
        };
        self.set_cell(address, cell_value)
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
                CellValue::String(s) => s,
                CellValue::Boolean(b) => b.to_string(),
                CellValue::Error(e) => format!("#{}", e),
                CellValue::Empty => String::new(),
                CellValue::Array(arr) => {
                    // Format array as comma-separated values in braces
                    let values: Vec<String> = arr.iter().map(|v| match v {
                        CellValue::Number(n) => n.to_string(),
                        CellValue::String(s) => s.clone(),
                        CellValue::Boolean(b) => b.to_string(),
                        CellValue::Error(e) => format!("#{}", e),
                        CellValue::Empty => String::new(),
                        CellValue::Array(_) => "[nested array]".to_string(),
                    }).collect();
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

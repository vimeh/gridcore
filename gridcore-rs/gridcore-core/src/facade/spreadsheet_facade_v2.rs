//! Spreadsheet facade v2 using port interfaces
//!
//! This version demonstrates clean architecture by using only port interfaces,
//! completely decoupled from infrastructure implementations.

use crate::domain::Cell;
use crate::ports::{EventPort, RepositoryPort};
use crate::services::{ServiceContainerV2, ServiceContainerV2Builder};
use crate::traits::CalculationService;
use crate::types::{CellAddress, CellValue};
use crate::Result;
use std::sync::Arc;

/// Facade for spreadsheet operations using clean architecture
pub struct SpreadsheetFacadeV2 {
    container: Arc<ServiceContainerV2>,
}

impl SpreadsheetFacadeV2 {
    /// Create a new facade with the given container
    pub fn new(container: ServiceContainerV2) -> Self {
        Self {
            container: Arc::new(container),
        }
    }
    
    /// Create a facade with specific ports
    pub fn with_ports(
        repository: Arc<dyn RepositoryPort>,
        events: Arc<dyn EventPort>,
    ) -> Self {
        let container = ServiceContainerV2Builder::new()
            .with_repository(repository)
            .with_events(events)
            .build();
        
        Self::new(container)
    }
    
    /// Get a cell value
    pub fn get_cell(&self, address: &CellAddress) -> Option<Cell> {
        self.container
            .repository()?
            .get(address)
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::{RepositoryAdapter, ThreadSafeEventAdapter};
    
    #[test]
    fn test_facade_v2_creation() {
        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(ThreadSafeEventAdapter::new_empty());
        
        let facade = SpreadsheetFacadeV2::with_ports(
            repository as Arc<dyn RepositoryPort>,
            events as Arc<dyn EventPort>,
        );
        
        assert_eq!(facade.cell_count(), 0);
    }
    
    #[test]
    fn test_facade_v2_get_cell() {
        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(ThreadSafeEventAdapter::new_empty());
        
        let facade = SpreadsheetFacadeV2::with_ports(
            repository as Arc<dyn RepositoryPort>,
            events as Arc<dyn EventPort>,
        );
        
        let address = CellAddress::new(0, 0);
        assert!(facade.get_cell(&address).is_none());
    }
    
    #[test]
    fn test_facade_v2_set_cell() {
        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(ThreadSafeEventAdapter::new_empty());
        
        let facade = SpreadsheetFacadeV2::with_ports(
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
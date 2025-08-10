//! Service container using port interfaces
//!
//! This module provides a container that uses port interfaces
//! instead of concrete implementations, enabling clean architecture.

use crate::ports::{EventPort, RepositoryPort};
use crate::traits::{
    BatchOperationsService, CalculationService, CellOperationsService, EventService,
    StructuralOperationsService,
};
use std::sync::Arc;

/// Container for all spreadsheet services using port interfaces
pub struct ServiceContainer {
    // Port interfaces
    repository_port: Option<Arc<dyn RepositoryPort>>,
    event_port: Option<Arc<dyn EventPort>>,

    // Service interfaces
    cell_operations: Option<Arc<dyn CellOperationsService>>,
    structural_operations: Option<Arc<dyn StructuralOperationsService>>,
    calculation_service: Option<Arc<dyn CalculationService>>,
    batch_operations: Option<Arc<dyn BatchOperationsService>>,
    event_service: Option<Arc<dyn EventService>>,
}

impl ServiceContainer {
    /// Create a new service container
    pub fn new() -> Self {
        Self {
            repository_port: None,
            event_port: None,
            cell_operations: None,
            structural_operations: None,
            calculation_service: None,
            batch_operations: None,
            event_service: None,
        }
    }

    /// Get the repository port
    pub fn repository(&self) -> Option<Arc<dyn RepositoryPort>> {
        self.repository_port.clone()
    }

    /// Get the event port
    pub fn events(&self) -> Option<Arc<dyn EventPort>> {
        self.event_port.clone()
    }

    /// Get the cell operations service
    pub fn cell_operations(&self) -> Option<Arc<dyn CellOperationsService>> {
        self.cell_operations.clone()
    }

    /// Get the structural operations service
    pub fn structural_operations(&self) -> Option<Arc<dyn StructuralOperationsService>> {
        self.structural_operations.clone()
    }

    /// Get the calculation service
    pub fn calculation_service(&self) -> Option<Arc<dyn CalculationService>> {
        self.calculation_service.clone()
    }

    /// Get the batch operations service
    pub fn batch_operations(&self) -> Option<Arc<dyn BatchOperationsService>> {
        self.batch_operations.clone()
    }

    /// Get the event service
    pub fn event_service(&self) -> Option<Arc<dyn EventService>> {
        self.event_service.clone()
    }
}

/// Builder for ServiceContainer
pub struct ServiceContainerBuilder {
    container: ServiceContainer,
}

impl ServiceContainerBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            container: ServiceContainer::new(),
        }
    }

    /// Set the repository port
    pub fn with_repository(mut self, repository: Arc<dyn RepositoryPort>) -> Self {
        self.container.repository_port = Some(repository);
        self
    }

    /// Set the event port
    pub fn with_events(mut self, events: Arc<dyn EventPort>) -> Self {
        self.container.event_port = Some(events);
        self
    }

    /// Set the cell operations service
    pub fn with_cell_operations(mut self, service: Arc<dyn CellOperationsService>) -> Self {
        self.container.cell_operations = Some(service);
        self
    }

    /// Set the structural operations service
    pub fn with_structural_operations(
        mut self,
        service: Arc<dyn StructuralOperationsService>,
    ) -> Self {
        self.container.structural_operations = Some(service);
        self
    }

    /// Set the calculation service
    pub fn with_calculation_service(mut self, service: Arc<dyn CalculationService>) -> Self {
        self.container.calculation_service = Some(service);
        self
    }

    /// Set the batch operations service
    pub fn with_batch_operations(mut self, service: Arc<dyn BatchOperationsService>) -> Self {
        self.container.batch_operations = Some(service);
        self
    }

    /// Set the event service
    pub fn with_event_service(mut self, service: Arc<dyn EventService>) -> Self {
        self.container.event_service = Some(service);
        self
    }

    /// Build the container
    pub fn build(self) -> ServiceContainer {
        self.container
    }
}

impl Default for ServiceContainer {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for ServiceContainerBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::{EventAdapter, RepositoryAdapter};

    #[test]
    fn test_service_container_builder() {
        let repository = Arc::new(RepositoryAdapter::new_empty());
        let events = Arc::new(EventAdapter::new_empty());

        let container = ServiceContainerBuilder::new()
            .with_repository(repository as Arc<dyn RepositoryPort>)
            .with_events(events as Arc<dyn EventPort>)
            .build();

        assert!(container.repository().is_some());
        assert!(container.events().is_some());
    }

    #[test]
    fn test_service_container_default() {
        let container = ServiceContainer::default();

        assert!(container.repository().is_none());
        assert!(container.events().is_none());
        assert!(container.cell_operations().is_none());
        assert!(container.structural_operations().is_none());
        assert!(container.calculation_service().is_none());
        assert!(container.batch_operations().is_none());
        assert!(container.event_service().is_none());
    }
}

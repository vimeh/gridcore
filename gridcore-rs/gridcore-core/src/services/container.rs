//! Service container for dependency injection
//!
//! This module provides a container for managing service dependencies
//! and their lifecycle, replacing Rc<RefCell<>> with Arc-based sharing.

use crate::dependency::DependencyGraph;
use crate::references::ReferenceTracker;
use crate::repository::CellRepository;
use crate::services::EventManager;
use crate::traits::{
    BatchOperationsService, CalculationService, CellOperationsService, EventService,
    StructuralOperationsService,
};
use std::sync::{Arc, Mutex};

/// Container for all spreadsheet services
pub struct ServiceContainer {
    cell_repository: Arc<Mutex<CellRepository>>,
    dependency_graph: Arc<Mutex<DependencyGraph>>,
    reference_tracker: Arc<Mutex<ReferenceTracker>>,
    event_manager: Arc<EventManager>,
    cell_operations: Option<Arc<dyn CellOperationsService>>,
    structural_operations: Option<Arc<dyn StructuralOperationsService>>,
    calculation_service: Option<Arc<dyn CalculationService>>,
    batch_operations: Option<Arc<dyn BatchOperationsService>>,
    event_service: Option<Arc<dyn EventService>>,
}

impl ServiceContainer {
    /// Create a new service container with default repositories
    pub fn new() -> Self {
        Self {
            cell_repository: Arc::new(Mutex::new(CellRepository::new())),
            dependency_graph: Arc::new(Mutex::new(DependencyGraph::new())),
            reference_tracker: Arc::new(Mutex::new(ReferenceTracker::new())),
            event_manager: Arc::new(EventManager::new()),
            cell_operations: None,
            structural_operations: None,
            calculation_service: None,
            batch_operations: None,
            event_service: None,
        }
    }

    /// Get the cell repository
    pub fn cell_repository(&self) -> Arc<Mutex<CellRepository>> {
        Arc::clone(&self.cell_repository)
    }

    /// Get the dependency graph
    pub fn dependency_graph(&self) -> Arc<Mutex<DependencyGraph>> {
        Arc::clone(&self.dependency_graph)
    }

    /// Get the reference tracker
    pub fn reference_tracker(&self) -> Arc<Mutex<ReferenceTracker>> {
        Arc::clone(&self.reference_tracker)
    }

    /// Get the event manager
    pub fn event_manager(&self) -> Arc<EventManager> {
        Arc::clone(&self.event_manager)
    }

    /// Set the cell operations service
    pub fn with_cell_operations(mut self, service: Arc<dyn CellOperationsService>) -> Self {
        self.cell_operations = Some(service);
        self
    }

    /// Set the structural operations service
    pub fn with_structural_operations(
        mut self,
        service: Arc<dyn StructuralOperationsService>,
    ) -> Self {
        self.structural_operations = Some(service);
        self
    }

    /// Set the calculation service
    pub fn with_calculation_service(mut self, service: Arc<dyn CalculationService>) -> Self {
        self.calculation_service = Some(service);
        self
    }

    /// Set the batch operations service
    pub fn with_batch_operations(mut self, service: Arc<dyn BatchOperationsService>) -> Self {
        self.batch_operations = Some(service);
        self
    }

    /// Set the event service
    pub fn with_event_service(mut self, service: Arc<dyn EventService>) -> Self {
        self.event_service = Some(service);
        self
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

    /// Set custom repositories
    pub fn with_repositories(
        mut self,
        repository: Arc<Mutex<CellRepository>>,
        dependency_graph: Arc<Mutex<DependencyGraph>>,
        reference_tracker: Arc<Mutex<ReferenceTracker>>,
    ) -> Self {
        self.container.cell_repository = repository;
        self.container.dependency_graph = dependency_graph;
        self.container.reference_tracker = reference_tracker;
        self
    }

    /// Set the event manager
    pub fn with_event_manager(mut self, event_manager: Arc<EventManager>) -> Self {
        self.container.event_manager = event_manager;
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

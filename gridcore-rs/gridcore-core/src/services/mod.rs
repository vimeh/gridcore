pub mod batch_manager;
pub mod container;
pub mod event_manager;
pub mod events;
pub mod impls;

// Re-export RepositoryContext from evaluator module
pub use crate::evaluator::context::RepositoryContext;

pub use batch_manager::{BatchManager, BatchOperation};
pub use container::{ServiceContainer, ServiceContainerBuilder};
pub use event_manager::EventManager;
pub use events::{EventCallback, EventData, EventType, SpreadsheetEvent};
pub use impls::{
    BatchOperationsServiceImpl, CalculationServiceImpl, CellOperationsServiceImpl,
    EventServiceImpl, StructuralOperationsServiceImpl,
};

//! Port interfaces for clean architecture boundaries
//! 
//! This module defines the interfaces (ports) that allow the application layer
//! to communicate with infrastructure without direct dependencies.

pub mod repository_port;
pub mod event_port;

pub use repository_port::RepositoryPort;
pub use event_port::EventPort;
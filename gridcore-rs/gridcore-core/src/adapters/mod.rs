//! Adapter implementations for port interfaces
//!
//! This module contains concrete implementations of the port traits,
//! bridging the application layer with infrastructure components.

mod event_adapter;
mod repository_adapter;

pub use event_adapter::EventAdapter;
pub use repository_adapter::RepositoryAdapter;

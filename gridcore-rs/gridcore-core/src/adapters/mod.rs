//! Adapter implementations for port interfaces
//!
//! This module contains concrete implementations of the port traits,
//! bridging the application layer with infrastructure components.

mod repository_adapter;
mod event_adapter;

pub use repository_adapter::RepositoryAdapter;
pub use event_adapter::EventAdapter;
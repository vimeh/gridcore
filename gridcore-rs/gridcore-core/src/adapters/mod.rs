//! Adapter implementations for port interfaces
//!
//! This module contains concrete implementations of the port traits,
//! bridging the application layer with infrastructure components.

mod repository_adapter;
mod event_adapter;
mod event_adapter_v2;

pub use repository_adapter::RepositoryAdapter;
pub use event_adapter::EventAdapter;
pub use event_adapter_v2::ThreadSafeEventAdapter;
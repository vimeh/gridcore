pub mod benchmark;
pub mod demo;
pub mod utils;

#[cfg(feature = "web")]
pub mod components;

// Re-export main types
pub use demo::{DemoConfig, DemoController, DemoMode};

#[cfg(feature = "web")]
pub use components::{DemoProgressBar, PerformanceOverlay};

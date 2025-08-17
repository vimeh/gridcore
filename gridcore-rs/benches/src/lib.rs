//! GridCore benchmarks library
//!
//! This crate contains performance benchmarks for all three layers:
//! - Core: Business logic and data structures
//! - Controller: State management and coordination
//! - UI: Rendering and interaction (WASM only)

pub mod controller;
pub mod core;
pub mod ui;

pub mod cell_editor;
pub mod error_display;
pub mod grid;
pub mod status_bar;
pub mod tab_bar;
pub mod viewport;

#[cfg(feature = "perf")]
pub mod metrics_display;

// Re-export commonly used grid components for convenience
pub use grid::{
    GridCanvas, GridCells, GridContainer, GridEventHandler, GridKeyboardHandler, GridSelection,
    GridStateProvider, use_grid_state,
};

//! Performance metrics for controller operations

// Metric name constants following Prometheus naming conventions
pub const CURSOR_MOVES: &str = "gridcore_cursor_moves_total";
pub const ACTION_DISPATCHES: &str = "gridcore_action_dispatches_total";
pub const ACTION_DISPATCH_TIME: &str = "gridcore_action_dispatch_duration_seconds";
pub const VIEWPORT_SCROLLS: &str = "gridcore_viewport_scrolls_total";
pub const VIEWPORT_RESIZE: &str = "gridcore_viewport_resize_total";
pub const KEYBOARD_EVENTS: &str = "gridcore_keyboard_events_total";
pub const MOUSE_EVENTS: &str = "gridcore_mouse_events_total";
pub const MODE_CHANGES: &str = "gridcore_mode_changes_total";
pub const SELECTION_CHANGES: &str = "gridcore_selection_changes_total";
pub const SHEET_OPERATIONS: &str = "gridcore_sheet_operations_total";
pub const FORMULA_BAR_UPDATES: &str = "gridcore_formula_bar_updates_total";
pub const EVENT_DISPATCH_TIME: &str = "gridcore_event_dispatch_duration_seconds";

// Labels for metrics
pub const ACTION_LABEL: &str = "action";
pub const EVENT_LABEL: &str = "event";
pub const MODE_LABEL: &str = "mode";
pub const OPERATION_LABEL: &str = "operation";

// Re-export macros from core
#[cfg(feature = "perf")]
pub use gridcore_core::{perf_gauge, perf_incr, perf_time};

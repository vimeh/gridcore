//! Metrics collection system for real-time performance monitoring

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::atomic::{AtomicU64, Ordering};
use wasm_bindgen::prelude::*;
use web_sys::Performance;

/// Metrics snapshot containing current values
#[derive(Debug, Clone, Default)]
#[wasm_bindgen]
pub struct MetricsSnapshot {
    // Counters
    pub formula_evaluations: u64,
    pub cell_reads: u64,
    pub cell_writes: u64,
    pub action_dispatches: u64,
    pub cursor_moves: u64,
    pub viewport_scrolls: u64,
    pub keyboard_events: u64,
    pub mouse_events: u64,

    // Timing metrics (in milliseconds)
    pub formula_eval_time_p50: f64,
    pub formula_eval_time_p95: f64,
    pub formula_eval_time_p99: f64,
    pub action_dispatch_time_p50: f64,
    pub action_dispatch_time_p95: f64,
    pub action_dispatch_time_p99: f64,
    pub render_time_ms: f64,

    // Rates (operations per second)
    pub formula_eval_rate: f64,
    pub cell_read_rate: f64,
    pub cell_write_rate: f64,
    pub action_dispatch_rate: f64,

    // Current values
    pub cell_count: usize,
    pub formula_count: usize,
    pub memory_usage_mb: f64,

    // Timestamp
    pub timestamp: f64,
}

/// Ring buffer for storing historical metrics
pub struct MetricsHistory {
    snapshots: Vec<MetricsSnapshot>,
    capacity: usize,
    current: usize,
}

impl MetricsHistory {
    pub fn new(capacity: usize) -> Self {
        Self {
            snapshots: Vec::with_capacity(capacity),
            capacity,
            current: 0,
        }
    }

    pub fn push(&mut self, snapshot: MetricsSnapshot) {
        if self.snapshots.len() < self.capacity {
            self.snapshots.push(snapshot);
        } else {
            self.snapshots[self.current] = snapshot;
            self.current = (self.current + 1) % self.capacity;
        }
    }

    pub fn get_recent(&self, count: usize) -> Vec<MetricsSnapshot> {
        let len = self.snapshots.len();
        if len == 0 {
            return Vec::new();
        }

        let take = count.min(len);
        let mut result = Vec::with_capacity(take);

        if len < self.capacity {
            // Not yet wrapped
            let start = len.saturating_sub(take);
            result.extend_from_slice(&self.snapshots[start..]);
        } else {
            // Has wrapped, need to handle circular buffer
            let start = (self.current + self.capacity - take) % self.capacity;
            for i in 0..take {
                let idx = (start + i) % self.capacity;
                result.push(self.snapshots[idx].clone());
            }
        }

        result
    }
}

/// Simple metrics registry for WASM environment
#[derive(Default)]
pub struct MetricsRegistry {
    counters: HashMap<String, Rc<AtomicU64>>,
}

impl MetricsRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_or_create_counter(&mut self, key: &str) -> Rc<AtomicU64> {
        self.counters
            .entry(key.to_string())
            .or_insert_with(|| Rc::new(AtomicU64::new(0)))
            .clone()
    }

    pub fn get_counter(&self, key: &str) -> Option<Rc<AtomicU64>> {
        self.counters.get(key).cloned()
    }
}

/// Main metrics collector
pub struct MetricsCollector {
    registry: Rc<RefCell<MetricsRegistry>>,
    history: Rc<RefCell<MetricsHistory>>,
    performance: Performance,
    last_snapshot_time: Rc<RefCell<f64>>,

    // Cached handles for frequently accessed metrics
    formula_eval_counter: Option<Rc<AtomicU64>>,
    cell_read_counter: Option<Rc<AtomicU64>>,
    cell_write_counter: Option<Rc<AtomicU64>>,
    action_dispatch_counter: Option<Rc<AtomicU64>>,
    cursor_move_counter: Option<Rc<AtomicU64>>,

    // Previous values for rate calculation
    prev_values: Rc<RefCell<HashMap<String, u64>>>,
}

impl Default for MetricsCollector {
    fn default() -> Self {
        let window = web_sys::window().expect("Window should exist");
        let performance = window.performance().expect("Performance API should exist");

        Self {
            registry: Rc::new(RefCell::new(MetricsRegistry::new())),
            history: Rc::new(RefCell::new(MetricsHistory::new(100))),
            performance,
            last_snapshot_time: Rc::new(RefCell::new(0.0)),
            formula_eval_counter: None,
            cell_read_counter: None,
            cell_write_counter: None,
            action_dispatch_counter: None,
            cursor_move_counter: None,
            prev_values: Rc::new(RefCell::new(HashMap::new())),
        }
    }
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self::default()
    }

    /// Initialize cached handles after metrics system is set up
    pub fn init_handles(&mut self) {
        let mut registry = self.registry.borrow_mut();
        // Use local constants to avoid cross-crate dependency issues
        self.formula_eval_counter =
            Some(registry.get_or_create_counter("gridcore_formula_evaluations_total"));
        self.cell_read_counter = Some(registry.get_or_create_counter("gridcore_cell_reads_total"));
        self.cell_write_counter =
            Some(registry.get_or_create_counter("gridcore_cell_writes_total"));
        self.action_dispatch_counter =
            Some(registry.get_or_create_counter("gridcore_action_dispatches_total"));
        self.cursor_move_counter =
            Some(registry.get_or_create_counter("gridcore_cursor_moves_total"));
    }

    fn read_counter(&self, handle: Option<&Rc<AtomicU64>>) -> u64 {
        handle.map(|h| h.load(Ordering::Relaxed)).unwrap_or(0)
    }

    fn calculate_rate(&self, key: &str, current_value: u64, time_delta: f64) -> f64 {
        let mut prev_values = self.prev_values.borrow_mut();
        let prev_value = prev_values.get(key).copied().unwrap_or(0);
        prev_values.insert(key.to_string(), current_value);

        if time_delta > 0.0 {
            ((current_value - prev_value) as f64) / time_delta
        } else {
            0.0
        }
    }

    /// Collect current metrics snapshot
    pub fn collect_snapshot(&self) -> MetricsSnapshot {
        let current_time = self.performance.now();
        let last_time = *self.last_snapshot_time.borrow();
        let time_delta = (current_time - last_time) / 1000.0; // Convert to seconds

        *self.last_snapshot_time.borrow_mut() = current_time;

        // Read counter values
        let formula_evaluations = self.read_counter(self.formula_eval_counter.as_ref());
        let cell_reads = self.read_counter(self.cell_read_counter.as_ref());
        let cell_writes = self.read_counter(self.cell_write_counter.as_ref());
        let action_dispatches = self.read_counter(self.action_dispatch_counter.as_ref());
        let cursor_moves = self.read_counter(self.cursor_move_counter.as_ref());

        // Calculate rates
        let formula_eval_rate =
            self.calculate_rate("formula_eval", formula_evaluations, time_delta);
        let cell_read_rate = self.calculate_rate("cell_read", cell_reads, time_delta);
        let cell_write_rate = self.calculate_rate("cell_write", cell_writes, time_delta);
        let action_dispatch_rate =
            self.calculate_rate("action_dispatch", action_dispatches, time_delta);

        // Get memory usage
        let memory_usage_mb = self.get_memory_usage();

        // TODO: Implement histogram percentile calculations
        // For now, use placeholder values

        MetricsSnapshot {
            formula_evaluations,
            cell_reads,
            cell_writes,
            action_dispatches,
            cursor_moves,
            viewport_scrolls: 0, // TODO: Read from handle
            keyboard_events: 0,  // TODO: Read from handle
            mouse_events: 0,     // TODO: Read from handle

            formula_eval_time_p50: 0.0,
            formula_eval_time_p95: 0.0,
            formula_eval_time_p99: 0.0,
            action_dispatch_time_p50: 0.0,
            action_dispatch_time_p95: 0.0,
            action_dispatch_time_p99: 0.0,
            render_time_ms: 0.0,

            formula_eval_rate,
            cell_read_rate,
            cell_write_rate,
            action_dispatch_rate,

            cell_count: 0,    // TODO: Get from controller
            formula_count: 0, // TODO: Get from controller
            memory_usage_mb,

            timestamp: current_time,
        }
    }

    fn get_memory_usage(&self) -> f64 {
        // Try to get memory usage from performance.memory if available
        if let Ok(memory) = js_sys::Reflect::get(&self.performance, &"memory".into())
            && let Ok(used_js_heap_size) = js_sys::Reflect::get(&memory, &"usedJSHeapSize".into())
            && let Some(bytes) = used_js_heap_size.as_f64() {
                return bytes / (1024.0 * 1024.0); // Convert to MB
        }
        0.0
    }

    /// Store snapshot in history
    pub fn record_snapshot(&self, snapshot: MetricsSnapshot) {
        self.history.borrow_mut().push(snapshot);
    }

    /// Get recent metric history
    pub fn get_history(&self, count: usize) -> Vec<MetricsSnapshot> {
        self.history.borrow().get_recent(count)
    }
}

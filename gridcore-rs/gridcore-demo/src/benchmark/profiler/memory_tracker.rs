use std::collections::HashMap;
use wasm_bindgen::JsCast;
use web_sys::Performance;

/// Tracks memory usage during benchmarks
pub struct MemoryTracker {
    performance: Performance,
    snapshots: HashMap<String, MemorySnapshot>,
    peak_heap: f64,
}

#[derive(Debug, Clone)]
struct MemorySnapshot {
    #[allow(dead_code)]
    timestamp: f64,
    heap_used: f64,
    #[allow(dead_code)]
    heap_total: f64,
}

impl MemoryTracker {
    pub fn new(performance: Performance) -> Self {
        Self {
            performance,
            snapshots: HashMap::new(),
            peak_heap: 0.0,
        }
    }

    /// Record a memory snapshot with a label
    pub fn record_snapshot(&mut self, label: &str) {
        let snapshot = self.get_current_memory();

        // Track peak memory
        if snapshot.heap_used > self.peak_heap {
            self.peak_heap = snapshot.heap_used;
        }

        self.snapshots.insert(label.to_string(), snapshot);
    }

    /// Get current memory usage
    fn get_current_memory(&self) -> MemorySnapshot {
        let timestamp = self.performance.now();

        // Try to get memory info from performance.memory (Chrome only)
        let (heap_used, heap_total) =
            if let Ok(memory) = js_sys::Reflect::get(&self.performance, &"memory".into()) {
                let used = js_sys::Reflect::get(&memory, &"usedJSHeapSize".into())
                    .ok()
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);

                let total = js_sys::Reflect::get(&memory, &"totalJSHeapSize".into())
                    .ok()
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);

                // Convert from bytes to MB
                (used / (1024.0 * 1024.0), total / (1024.0 * 1024.0))
            } else {
                (0.0, 0.0)
            };

        MemorySnapshot {
            timestamp,
            heap_used,
            heap_total,
        }
    }

    pub fn clear(&mut self) {
        self.snapshots.clear();
        self.peak_heap = 0.0;
    }

    pub fn get_initial_heap(&self) -> f64 {
        self.snapshots
            .get("start")
            .map(|s| s.heap_used)
            .unwrap_or(0.0)
    }

    pub fn get_final_heap(&self) -> f64 {
        self.snapshots
            .get("end")
            .map(|s| s.heap_used)
            .unwrap_or(0.0)
    }

    pub fn get_peak_heap(&self) -> f64 {
        self.peak_heap
    }

    pub fn get_memory_growth(&self) -> f64 {
        let start = self.get_initial_heap();
        let end = self.get_final_heap();
        end - start
    }

    /// Force garbage collection if available (Chrome only with --expose-gc flag)
    pub fn force_gc() {
        // Try to call gc() if available
        if let Ok(gc_fn) = js_sys::Reflect::get(&js_sys::global(), &"gc".into()) {
            if let Ok(gc_fn) = gc_fn.dyn_into::<js_sys::Function>() {
                let _ = gc_fn.call0(&js_sys::global());
                leptos::logging::log!("Forced garbage collection");
            }
        }
    }
}

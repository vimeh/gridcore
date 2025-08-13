pub mod fps_tracker;
pub mod latency_tracker;
pub mod memory_tracker;
pub mod wasm_profiler;

use crate::benchmark::BenchmarkMetrics;
use web_sys::Performance;

/// Enhanced performance profiler for benchmarking
pub struct PerformanceProfiler {
    performance: Performance,
    fps_tracker: fps_tracker::FpsTracker,
    latency_tracker: latency_tracker::LatencyTracker,
    memory_tracker: memory_tracker::MemoryTracker,
    wasm_profiler: wasm_profiler::WasmProfiler,
    is_recording: bool,
    start_time: f64,
}

impl Default for PerformanceProfiler {
    fn default() -> Self {
        Self::new()
    }
}

impl PerformanceProfiler {
    pub fn new() -> Self {
        let window = web_sys::window().expect("Window should exist");
        let performance = window.performance().expect("Performance API should exist");

        Self {
            performance: performance.clone(),
            fps_tracker: fps_tracker::FpsTracker::new(),
            latency_tracker: latency_tracker::LatencyTracker::new(),
            memory_tracker: memory_tracker::MemoryTracker::new(performance.clone()),
            wasm_profiler: wasm_profiler::WasmProfiler::new(),
            is_recording: false,
            start_time: 0.0,
        }
    }

    /// Start recording performance metrics
    pub fn start_recording(&mut self) {
        self.is_recording = true;
        self.start_time = self.performance.now();

        // Clear previous data
        self.fps_tracker.clear();
        self.latency_tracker.clear();
        self.memory_tracker.clear();
        self.wasm_profiler.clear();

        // Record initial memory state
        self.memory_tracker.record_snapshot("start");

        // Start FPS tracking
        self.fps_tracker.start();
    }

    /// Stop recording and return collected metrics
    pub fn stop_recording(&mut self) -> BenchmarkMetrics {
        if !self.is_recording {
            return BenchmarkMetrics::default();
        }

        self.is_recording = false;
        let end_time = self.performance.now();

        // Stop FPS tracking
        self.fps_tracker.stop();

        // Record final memory state
        self.memory_tracker.record_snapshot("end");

        // Collect all metrics
        let mut metrics = BenchmarkMetrics {
            start_time: self.start_time,
            end_time,
            duration_ms: end_time - self.start_time,

            // FPS metrics
            frame_times: self.fps_tracker.get_frame_times(),
            dropped_frames: self.fps_tracker.get_dropped_frames(),

            // Latency metrics
            interaction_latencies: self.latency_tracker.get_latencies(),

            // Memory metrics
            heap_used_start: self.memory_tracker.get_initial_heap(),
            heap_used_end: self.memory_tracker.get_final_heap(),
            heap_peak: self.memory_tracker.get_peak_heap(),

            // WASM metrics
            wasm_execution_time: self.wasm_profiler.get_total_execution_time(),
            js_interop_calls: self.wasm_profiler.get_interop_call_count(),

            ..Default::default()
        };

        // Finalize calculations
        metrics.finalize();

        metrics
    }

    /// Record a frame render
    pub fn record_frame(&mut self) {
        if self.is_recording {
            self.fps_tracker.record_frame();
        }
    }

    /// Record an interaction event
    pub fn record_interaction(&mut self, event_type: &str, start_time: f64) {
        if self.is_recording {
            let end_time = self.performance.now();
            self.latency_tracker
                .record_interaction(event_type, start_time, end_time);
        }
    }

    /// Record a WASM call
    pub fn record_wasm_call(&mut self, function_name: &str, duration: f64) {
        if self.is_recording {
            self.wasm_profiler.record_call(function_name, duration);
        }
    }

    /// Mark a custom event
    pub fn mark(&mut self, name: &str) {
        if self.is_recording {
            let timestamp = self.performance.now();
            leptos::logging::log!(
                "Benchmark mark '{}' at {}ms",
                name,
                timestamp - self.start_time
            );
        }
    }

    /// Measure between two marks
    pub fn measure(&mut self, name: &str, start_mark: &str, end_mark: &str) {
        if self.is_recording {
            leptos::logging::log!(
                "Benchmark measure '{}' from '{}' to '{}'",
                name,
                start_mark,
                end_mark
            );
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording
    }
}

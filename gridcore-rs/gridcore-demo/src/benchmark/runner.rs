use super::profiler::PerformanceProfiler;
use super::results::ResultsCollector;
use super::{BenchmarkConfig, BenchmarkMetrics, BenchmarkResult, BenchmarkScenario};
use gridcore_controller::controller::SpreadsheetController;
use std::cell::RefCell;
use std::rc::Rc;

/// Main benchmark runner that executes scenarios and collects results
pub struct UIBenchmarkRunner {
    scenarios: Vec<Box<dyn BenchmarkScenario>>,
    profiler: PerformanceProfiler,
    results_collector: ResultsCollector,
    config: BenchmarkConfig,
    controller: Rc<RefCell<SpreadsheetController>>,
}

impl UIBenchmarkRunner {
    pub fn new(controller: Rc<RefCell<SpreadsheetController>>) -> Self {
        Self {
            scenarios: Vec::new(),
            profiler: PerformanceProfiler::new(),
            results_collector: ResultsCollector::new(),
            config: BenchmarkConfig::default(),
            controller,
        }
    }

    pub fn with_config(mut self, config: BenchmarkConfig) -> Self {
        self.config = config;
        self
    }

    pub fn add_scenario(&mut self, scenario: Box<dyn BenchmarkScenario>) {
        self.scenarios.push(scenario);
    }

    pub fn add_scenarios(&mut self, scenarios: Vec<Box<dyn BenchmarkScenario>>) {
        self.scenarios.extend(scenarios);
    }

    /// Run a single benchmark scenario
    pub fn run_scenario(
        &mut self,
        scenario: &mut Box<dyn BenchmarkScenario>,
    ) -> Vec<BenchmarkResult> {
        let mut results = Vec::new();

        leptos::logging::log!("Starting benchmark: {}", scenario.name());
        leptos::logging::log!("Description: {}", scenario.description());

        // Warmup phase
        leptos::logging::log!(
            "Running {} warmup iterations...",
            self.config.warmup_iterations
        );
        for _ in 0..self.config.warmup_iterations {
            scenario.warmup(self.controller.clone());
            scenario.cleanup(self.controller.clone());
        }

        // Setup for measurement
        scenario.warmup(self.controller.clone());

        // Measurement phase
        leptos::logging::log!(
            "Running {} measurement iterations...",
            self.config.measurement_iterations
        );
        for iteration in 0..self.config.measurement_iterations {
            // Start profiling if enabled
            if self.config.enable_profiling {
                self.profiler.start_recording();
            }

            // Run the benchmark
            let mut result = scenario.run(self.controller.clone());
            result.iteration = iteration + 1;

            // Stop profiling and merge metrics
            if self.config.enable_profiling {
                let profile_metrics = self.profiler.stop_recording();
                result.metrics = self.merge_metrics(result.metrics, profile_metrics);
            }

            results.push(result);

            // Brief pause between iterations
            self.pause_between_iterations();
        }

        // Cleanup
        scenario.cleanup(self.controller.clone());

        leptos::logging::log!("Benchmark complete: {}", scenario.name());

        results
    }

    /// Run all registered benchmark scenarios
    pub fn run_all(&mut self) -> BenchmarkReport {
        let mut all_results = Vec::new();

        leptos::logging::log!(
            "Starting benchmark suite with {} scenarios",
            self.scenarios.len()
        );

        // Take ownership of scenarios temporarily
        let mut scenarios = std::mem::take(&mut self.scenarios);

        for scenario in &mut scenarios {
            let results = self.run_scenario(scenario);
            all_results.extend(results);
        }

        // Restore scenarios
        self.scenarios = scenarios;

        // Analyze results
        let report = self.results_collector.analyze(all_results);

        leptos::logging::log!("Benchmark suite complete");

        report
    }

    /// Run a specific benchmark by name
    pub fn run_by_name(&mut self, name: &str) -> Option<Vec<BenchmarkResult>> {
        // Find the scenario
        let scenario_index = self.scenarios.iter().position(|s| s.name() == name)?;

        // Temporarily remove the scenario to get mutable access
        let mut scenario = self.scenarios.remove(scenario_index);
        let results = self.run_scenario(&mut scenario);

        // Put it back
        self.scenarios.insert(scenario_index, scenario);

        Some(results)
    }

    fn merge_metrics(
        &self,
        mut base: BenchmarkMetrics,
        profile: BenchmarkMetrics,
    ) -> BenchmarkMetrics {
        // Merge frame times
        if !profile.frame_times.is_empty() {
            base.frame_times = profile.frame_times;
        }

        // Merge FPS metrics
        if profile.fps_avg > 0.0 {
            base.fps_avg = profile.fps_avg;
            base.fps_p50 = profile.fps_p50;
            base.fps_p95 = profile.fps_p95;
            base.fps_p99 = profile.fps_p99;
            base.dropped_frames = profile.dropped_frames;
        }

        // Merge latency metrics
        if !profile.interaction_latencies.is_empty() {
            base.interaction_latencies
                .extend(profile.interaction_latencies);
        }

        // Merge memory metrics
        if profile.heap_used_start > 0.0 {
            base.heap_used_start = profile.heap_used_start;
            base.heap_used_end = profile.heap_used_end;
            base.heap_peak = profile.heap_peak;
        }

        // Merge WASM metrics
        if profile.wasm_execution_time > 0.0 {
            base.wasm_execution_time = profile.wasm_execution_time;
            base.js_interop_calls = profile.js_interop_calls;
        }

        base
    }

    fn pause_between_iterations(&self) {
        // Small delay to let the browser catch up
        // In a real implementation, this would be an async delay
        leptos::logging::log!("Pausing between iterations...");
    }

    pub fn get_config(&self) -> &BenchmarkConfig {
        &self.config
    }

    pub fn set_config(&mut self, config: BenchmarkConfig) {
        self.config = config;
    }
}

/// Complete benchmark report with analysis
#[derive(Debug, Clone)]
pub struct BenchmarkReport {
    pub timestamp: f64,
    pub config: BenchmarkConfig,
    pub results: Vec<BenchmarkResult>,
    pub summary: BenchmarkSummary,
    pub warnings: Vec<String>,
    pub suggestions: Vec<String>,
}

/// Summary statistics for benchmark results
#[derive(Debug, Clone)]
pub struct BenchmarkSummary {
    pub total_scenarios: usize,
    pub successful_runs: usize,
    pub failed_runs: usize,
    pub avg_fps: f64,
    pub p95_fps: f64,
    pub avg_latency: f64,
    pub p95_latency: f64,
    pub total_memory_growth: f64,
    pub total_duration: f64,
}

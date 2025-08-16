pub mod data_generator;
pub mod performance;
pub mod runner;
pub mod scenarios;

use crate::benchmark::{
    config::BenchmarkPresets,
    runner::{BenchmarkReport, UIBenchmarkRunner},
    scenarios::{
        canvas::{CanvasStateBenchmark, DrawCallBenchmark},
        formula::{ComplexFormulaBenchmark, SimpleFormulaBenchmark},
        interaction::{CellEditBenchmark, SelectionBenchmark},
        memory::{MemoryCleanupBenchmark, MemoryGrowthBenchmark},
        rendering::{InitialRenderBenchmark, LargeGridRenderBenchmark},
        scroll::{JumpNavigationBenchmark, LargeDatasetScrollBenchmark, SmoothScrollBenchmark},
    },
};
use gridcore_controller::controller::SpreadsheetController;
use std::cell::RefCell;
use std::rc::Rc;
#[cfg(feature = "web")]
use wasm_bindgen_futures::spawn_local;

#[derive(Debug, Clone, PartialEq)]
pub enum DemoMode {
    Off,
    Manual,
    Automated,
}

#[derive(Debug, Clone)]
pub struct DemoConfig {
    pub mode: DemoMode,
    pub playback_speed: f32,
    pub show_performance: bool,
    pub auto_repeat: bool,
}

impl Default for DemoConfig {
    fn default() -> Self {
        Self {
            mode: DemoMode::Off,
            playback_speed: 1.0,
            show_performance: true,
            auto_repeat: false,
        }
    }
}

pub struct DemoController {
    config: DemoConfig,
    runner: runner::DemoRunner,
    performance_monitor: performance::PerformanceMonitor,
}

impl Default for DemoController {
    fn default() -> Self {
        Self::new()
    }
}

impl DemoController {
    pub fn new() -> Self {
        Self {
            config: DemoConfig::default(),
            runner: runner::DemoRunner::new(),
            performance_monitor: performance::PerformanceMonitor::new(),
        }
    }

    pub fn start_demo(
        &mut self,
        scenario_name: &str,
        controller: Rc<RefCell<SpreadsheetController>>,
    ) -> Result<(), String> {
        self.config.mode = DemoMode::Automated;
        self.runner.load_scenario(scenario_name)?;
        self.runner.start(controller.clone())?;
        self.performance_monitor.start_monitoring();

        // Initialize cell counts
        let ctrl = controller.borrow();
        let facade = ctrl.facade();
        let cell_count = facade.cell_count();
        let formula_count = 0; // TODO: Add formula count when available
        self.performance_monitor
            .update_cell_counts(cell_count, formula_count);

        Ok(())
    }

    pub fn stop_demo(&mut self) {
        self.config.mode = DemoMode::Off;
        self.runner.stop();
        self.performance_monitor.stop_monitoring();
    }

    pub fn pause_demo(&mut self) {
        self.runner.pause();
    }

    pub fn resume_demo(&mut self) {
        self.runner.resume();
    }

    pub fn step_forward(&mut self, controller: Rc<RefCell<SpreadsheetController>>) {
        self.runner.step(controller.clone());

        // Record performance metrics
        self.performance_monitor.record_operation();

        // Update cell counts from controller
        let ctrl = controller.borrow();
        let facade = ctrl.facade();
        let cell_count = facade.cell_count();
        // TODO: Add formula count when available
        let formula_count = 0;
        self.performance_monitor
            .update_cell_counts(cell_count, formula_count);
    }

    pub fn set_playback_speed(&mut self, speed: f32) {
        self.config.playback_speed = speed.clamp(0.1, 10.0);
        self.runner.set_speed(self.config.playback_speed);
    }

    pub fn toggle_performance_overlay(&mut self) {
        self.config.show_performance = !self.config.show_performance;
    }

    pub fn get_performance_metrics(&mut self) -> performance::Metrics {
        // Record a frame each time metrics are requested (called during UI render)
        if self.performance_monitor.is_monitoring() {
            self.performance_monitor.record_frame();
        }
        self.performance_monitor.get_current_metrics()
    }

    pub fn get_available_scenarios(&self) -> Vec<String> {
        scenarios::get_available_scenarios()
    }

    pub fn is_running(&self) -> bool {
        self.runner.is_running()
    }

    pub fn get_current_scenario(&self) -> Option<String> {
        self.runner.get_current_scenario()
    }

    pub fn get_progress(&self) -> f32 {
        self.runner.get_progress()
    }

    pub fn get_current_step(&self) -> usize {
        self.runner.get_current_step()
    }

    pub fn get_total_steps(&self) -> usize {
        self.runner.get_total_steps()
    }

    /// Run a quick benchmark and return results
    pub fn run_quick_benchmark(
        &mut self,
        controller: Rc<RefCell<SpreadsheetController>>,
    ) -> Result<String, String> {
        crate::log_info!("Starting quick benchmark...");

        // Create benchmark runner
        let mut runner =
            UIBenchmarkRunner::new(controller.clone()).with_config(BenchmarkPresets::smoke_test());

        // Add a simple scroll benchmark
        runner.add_scenario(Box::new(SmoothScrollBenchmark::new()));

        // Run the benchmark
        let report = runner.run_all();

        // Format results
        let summary = format!(
            "Benchmark Complete!\n\
            Scenarios: {}\n\
            Avg FPS: {:.1}\n\
            P95 FPS: {:.1}\n\
            Avg Latency: {:.1}ms\n\
            Memory Growth: {:.1}MB",
            report.summary.total_scenarios,
            report.summary.avg_fps,
            report.summary.p95_fps,
            report.summary.avg_latency,
            report.summary.total_memory_growth
        );

        crate::log_info!("{}", summary);

        // Also log any warnings
        for warning in &report.warnings {
            crate::log_warn!("⚠️ {}", warning);
        }

        Ok(summary)
    }

    /// Run full benchmark suite
    #[cfg(feature = "web")]
    pub fn run_full_benchmark(
        &mut self,
        controller: Rc<RefCell<SpreadsheetController>>,
        callback: impl Fn(BenchmarkReport) + 'static,
    ) {
        let ctrl = controller.clone();

        // Run benchmarks asynchronously
        spawn_local(async move {
            crate::log_info!("Starting full benchmark suite...");

            // Create benchmark runner with standard config
            let mut runner =
                UIBenchmarkRunner::new(ctrl.clone()).with_config(BenchmarkPresets::standard());

            // Add all benchmark scenarios
            runner.add_scenarios(vec![
                // Scroll benchmarks
                Box::new(SmoothScrollBenchmark::new()),
                Box::new(JumpNavigationBenchmark::new()),
                Box::new(LargeDatasetScrollBenchmark::new()),
                // Rendering benchmarks
                Box::new(InitialRenderBenchmark::new()),
                Box::new(LargeGridRenderBenchmark::new()),
                // Interaction benchmarks
                Box::new(CellEditBenchmark::new()),
                Box::new(SelectionBenchmark::new()),
                // Formula benchmarks
                Box::new(SimpleFormulaBenchmark::new()),
                Box::new(ComplexFormulaBenchmark::new()),
                // Memory benchmarks
                Box::new(MemoryGrowthBenchmark::new()),
                Box::new(MemoryCleanupBenchmark::new()),
                // Canvas benchmarks
                Box::new(DrawCallBenchmark::new()),
                Box::new(CanvasStateBenchmark::new()),
            ]);

            // Run benchmarks
            let report = runner.run_all();

            crate::log_info!(
                "Benchmark suite complete: {} scenarios, {} successful",
                report.summary.total_scenarios,
                report.summary.successful_runs
            );

            // Call the callback with results
            callback(report);
        });
    }
    
    /// Run full benchmark suite (non-web version)
    #[cfg(not(feature = "web"))]
    pub fn run_full_benchmark(
        &mut self,
        _controller: Rc<RefCell<SpreadsheetController>>,
        _callback: impl Fn(BenchmarkReport) + 'static,
    ) {
        println!("Full benchmark suite is only available in web mode");
    }

    /// Get available benchmark scenarios
    pub fn get_available_benchmarks() -> Vec<String> {
        vec![
            // Scroll benchmarks
            "Smooth Scroll".to_string(),
            "Jump Navigation".to_string(),
            "Large Dataset Scroll".to_string(),
            // Rendering benchmarks
            "Initial Render".to_string(),
            "Large Grid Render".to_string(),
            // Interaction benchmarks
            "Cell Edit Latency".to_string(),
            "Selection Performance".to_string(),
            // Formula benchmarks
            "Simple Formula".to_string(),
            "Complex Formula".to_string(),
            // Memory benchmarks
            "Memory Growth".to_string(),
            "Memory Cleanup".to_string(),
            // Canvas benchmarks
            "Canvas Draw Calls".to_string(),
            "Canvas State Management".to_string(),
        ]
    }
}

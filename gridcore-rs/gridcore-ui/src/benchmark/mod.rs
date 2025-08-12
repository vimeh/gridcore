pub mod config;
pub mod profiler;
pub mod results;
pub mod runner;
pub mod scenarios;

use gridcore_controller::controller::SpreadsheetController;
use std::cell::RefCell;
use std::rc::Rc;

/// Core trait for benchmark scenarios
pub trait BenchmarkScenario {
    /// Name of the benchmark scenario
    fn name(&self) -> &str;
    
    /// Description of what this benchmark tests
    fn description(&self) -> &str;
    
    /// Warmup phase to prepare the environment
    fn warmup(&mut self, controller: Rc<RefCell<SpreadsheetController>>);
    
    /// Run the benchmark and return results
    fn run(&mut self, controller: Rc<RefCell<SpreadsheetController>>) -> BenchmarkResult;
    
    /// Number of iterations to run
    fn iterations(&self) -> usize {
        10 // Default to 10 iterations
    }
    
    /// Cleanup after benchmark completes
    fn cleanup(&mut self, controller: Rc<RefCell<SpreadsheetController>>);
}

/// Result from a single benchmark run
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BenchmarkResult {
    pub scenario_name: String,
    pub iteration: usize,
    pub metrics: BenchmarkMetrics,
    pub success: bool,
    pub error_message: Option<String>,
}

/// Comprehensive benchmark metrics
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct BenchmarkMetrics {
    // Timing metrics
    pub start_time: f64,
    pub end_time: f64,
    pub duration_ms: f64,
    
    // Frame metrics
    pub frame_times: Vec<f64>,
    pub fps_avg: f64,
    pub fps_p50: f64,
    pub fps_p95: f64,
    pub fps_p99: f64,
    pub dropped_frames: u32,
    
    // Interaction metrics
    pub interaction_latencies: Vec<f64>,
    pub input_latency_avg: f64,
    pub input_latency_p95: f64,
    
    // Memory metrics
    pub heap_used_start: f64,
    pub heap_used_end: f64,
    pub heap_peak: f64,
    pub memory_growth: f64,
    
    // Canvas metrics
    pub draw_calls_per_frame: f64,
    pub canvas_operations: u32,
    
    // WASM metrics
    pub wasm_execution_time: f64,
    pub js_interop_calls: u32,
    
    // Cell metrics
    pub cells_rendered: u32,
    pub cells_updated: u32,
    pub formulas_calculated: u32,
    
    // Custom metrics for specific scenarios
    pub custom_metrics: std::collections::HashMap<String, f64>,
}

impl BenchmarkMetrics {
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Calculate percentile from a sorted vec of values
    pub fn percentile(values: &[f64], p: f64) -> f64 {
        if values.is_empty() {
            return 0.0;
        }
        
        let index = ((values.len() - 1) as f64 * p / 100.0) as usize;
        values[index]
    }
    
    /// Calculate average of values
    pub fn average(values: &[f64]) -> f64 {
        if values.is_empty() {
            return 0.0;
        }
        
        values.iter().sum::<f64>() / values.len() as f64
    }
    
    /// Finalize metrics calculations
    pub fn finalize(&mut self) {
        // Calculate FPS metrics
        if !self.frame_times.is_empty() {
            let mut sorted_fps: Vec<f64> = self.frame_times
                .iter()
                .map(|t| if *t > 0.0 { 1000.0 / t } else { 0.0 })
                .collect();
            sorted_fps.sort_by(|a, b| a.partial_cmp(b).unwrap());
            
            self.fps_avg = Self::average(&sorted_fps);
            self.fps_p50 = Self::percentile(&sorted_fps, 50.0);
            self.fps_p95 = Self::percentile(&sorted_fps, 95.0);
            self.fps_p99 = Self::percentile(&sorted_fps, 99.0);
        }
        
        // Calculate interaction latency metrics
        if !self.interaction_latencies.is_empty() {
            let mut sorted_latencies = self.interaction_latencies.clone();
            sorted_latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
            
            self.input_latency_avg = Self::average(&sorted_latencies);
            self.input_latency_p95 = Self::percentile(&sorted_latencies, 95.0);
        }
        
        // Calculate memory growth
        self.memory_growth = self.heap_used_end - self.heap_used_start;
        
        // Calculate duration
        if self.start_time > 0.0 && self.end_time > 0.0 {
            self.duration_ms = self.end_time - self.start_time;
        }
    }
}

/// Configuration for benchmark execution
#[derive(Debug, Clone)]
pub struct BenchmarkConfig {
    pub warmup_iterations: usize,
    pub measurement_iterations: usize,
    pub enable_profiling: bool,
    pub collect_screenshots: bool,
    pub throttle_cpu: Option<f32>,
    pub throttle_network: Option<NetworkThrottle>,
    pub viewport_size: (u32, u32),
    pub output_format: OutputFormat,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            warmup_iterations: 3,
            measurement_iterations: 10,
            enable_profiling: true,
            collect_screenshots: false,
            throttle_cpu: None,
            throttle_network: None,
            viewport_size: (1920, 1080),
            output_format: OutputFormat::Json,
        }
    }
}

#[derive(Debug, Clone)]
pub enum NetworkThrottle {
    Slow3G,
    Fast3G,
    Slow4G,
    Fast4G,
    Custom { download: u32, upload: u32, latency: u32 },
}

#[derive(Debug, Clone)]
pub enum OutputFormat {
    Json,
    Html,
    Csv,
    Console,
}
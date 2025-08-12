use std::collections::VecDeque;
use web_sys::Performance;

#[derive(Debug, Clone, Default)]
pub struct Metrics {
    pub fps: f64,
    pub render_time_ms: f64,
    pub calculation_time_ms: f64,
    pub memory_usage_mb: f64,
    pub cell_count: usize,
    pub formula_count: usize,
    pub operations_per_second: f64,
}

pub struct PerformanceMonitor {
    performance: Performance,
    metrics_history: VecDeque<Metrics>,
    max_history_size: usize,
    is_monitoring: bool,
    last_frame_time: f64,
    frame_count: u32,
    fps_update_interval: f64,
    last_fps_update: f64,
    current_fps: f64,
    operation_count: u32,
    last_operation_count_time: f64,
}

impl Default for PerformanceMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl PerformanceMonitor {
    pub fn new() -> Self {
        let window = web_sys::window().expect("Window should exist");
        let performance = window.performance().expect("Performance API should exist");

        Self {
            performance,
            metrics_history: VecDeque::with_capacity(100),
            max_history_size: 100,
            is_monitoring: false,
            last_frame_time: 0.0,
            frame_count: 0,
            fps_update_interval: 1000.0, // Update FPS every second
            last_fps_update: 0.0,
            current_fps: 0.0,
            operation_count: 0,
            last_operation_count_time: 0.0,
        }
    }

    pub fn start_monitoring(&mut self) {
        self.is_monitoring = true;
        self.last_frame_time = self.performance.now();
        self.last_fps_update = self.last_frame_time;
        self.last_operation_count_time = self.last_frame_time;
        self.frame_count = 0;
        self.operation_count = 0;
    }

    pub fn stop_monitoring(&mut self) {
        self.is_monitoring = false;
    }

    pub fn record_frame(&mut self) {
        if !self.is_monitoring {
            return;
        }

        let current_time = self.performance.now();
        self.frame_count += 1;

        // Update FPS calculation
        let time_since_fps_update = current_time - self.last_fps_update;
        if time_since_fps_update >= self.fps_update_interval {
            self.current_fps = (self.frame_count as f64 * 1000.0) / time_since_fps_update;
            self.frame_count = 0;
            self.last_fps_update = current_time;
        }

        self.last_frame_time = current_time;
    }

    pub fn record_operation(&mut self) {
        if !self.is_monitoring {
            return;
        }

        self.operation_count += 1;
    }

    pub fn record_render_time(&mut self, start_time: f64) {
        if !self.is_monitoring {
            return;
        }

        let end_time = self.performance.now();
        let render_time = end_time - start_time;

        // Update current metrics
        let mut metrics = self.get_current_metrics();
        metrics.render_time_ms = render_time;
        self.add_metrics(metrics);
    }

    pub fn record_calculation_time(&mut self, start_time: f64) {
        if !self.is_monitoring {
            return;
        }

        let end_time = self.performance.now();
        let calc_time = end_time - start_time;

        // Update current metrics
        let mut metrics = self.get_current_metrics();
        metrics.calculation_time_ms = calc_time;
        self.add_metrics(metrics);
    }

    pub fn update_cell_counts(&mut self, cell_count: usize, formula_count: usize) {
        if !self.is_monitoring {
            return;
        }

        let mut metrics = self.get_current_metrics();
        metrics.cell_count = cell_count;
        metrics.formula_count = formula_count;
        self.add_metrics(metrics);
    }

    pub fn get_current_metrics(&self) -> Metrics {
        let current_time = self.performance.now();
        let time_since_operation_count = (current_time - self.last_operation_count_time) / 1000.0;
        let ops_per_second = if time_since_operation_count > 0.0 {
            self.operation_count as f64 / time_since_operation_count
        } else {
            0.0
        };

        // Get memory usage if available
        let memory_usage_mb = self.get_memory_usage();

        Metrics {
            fps: self.current_fps,
            render_time_ms: 0.0,
            calculation_time_ms: 0.0,
            memory_usage_mb,
            cell_count: 0,
            formula_count: 0,
            operations_per_second: ops_per_second,
        }
    }

    fn get_memory_usage(&self) -> f64 {
        // Try to get memory usage from performance.memory if available
        // This is a non-standard API that may not be available in all browsers
        if let Ok(memory) = js_sys::Reflect::get(&self.performance, &"memory".into()) {
            if let Ok(used_js_heap_size) = js_sys::Reflect::get(&memory, &"usedJSHeapSize".into()) {
                if let Some(bytes) = used_js_heap_size.as_f64() {
                    return bytes / (1024.0 * 1024.0); // Convert to MB
                }
            }
        }
        0.0
    }

    fn add_metrics(&mut self, metrics: Metrics) {
        if self.metrics_history.len() >= self.max_history_size {
            self.metrics_history.pop_front();
        }
        self.metrics_history.push_back(metrics);
    }

    pub fn get_average_metrics(&self) -> Metrics {
        if self.metrics_history.is_empty() {
            return Metrics::default();
        }

        let count = self.metrics_history.len() as f64;
        let mut avg = Metrics::default();

        for metric in &self.metrics_history {
            avg.fps += metric.fps;
            avg.render_time_ms += metric.render_time_ms;
            avg.calculation_time_ms += metric.calculation_time_ms;
            avg.memory_usage_mb += metric.memory_usage_mb;
            avg.operations_per_second += metric.operations_per_second;
        }

        avg.fps /= count;
        avg.render_time_ms /= count;
        avg.calculation_time_ms /= count;
        avg.memory_usage_mb /= count;
        avg.operations_per_second /= count;

        // Use the latest cell counts
        if let Some(latest) = self.metrics_history.back() {
            avg.cell_count = latest.cell_count;
            avg.formula_count = latest.formula_count;
        }

        avg
    }

    pub fn get_percentile_metrics(&self, percentile: f64) -> Metrics {
        if self.metrics_history.is_empty() {
            return Metrics::default();
        }

        let percentile = percentile.clamp(0.0, 100.0);
        let index = ((self.metrics_history.len() as f64 - 1.0) * percentile / 100.0) as usize;

        // Sort metrics by render time for percentile calculation
        let mut render_times: Vec<f64> = self
            .metrics_history
            .iter()
            .map(|m| m.render_time_ms)
            .collect();
        render_times.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let mut calc_times: Vec<f64> = self
            .metrics_history
            .iter()
            .map(|m| m.calculation_time_ms)
            .collect();
        calc_times.sort_by(|a, b| a.partial_cmp(b).unwrap());

        Metrics {
            fps: self.current_fps,
            render_time_ms: render_times[index],
            calculation_time_ms: calc_times[index],
            memory_usage_mb: self.get_memory_usage(),
            cell_count: self
                .metrics_history
                .back()
                .map(|m| m.cell_count)
                .unwrap_or(0),
            formula_count: self
                .metrics_history
                .back()
                .map(|m| m.formula_count)
                .unwrap_or(0),
            operations_per_second: self.get_current_metrics().operations_per_second,
        }
    }

    pub fn clear_history(&mut self) {
        self.metrics_history.clear();
        self.frame_count = 0;
        self.operation_count = 0;
    }

    pub fn is_monitoring(&self) -> bool {
        self.is_monitoring
    }
}

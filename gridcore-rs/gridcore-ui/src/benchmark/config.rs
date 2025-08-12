use super::{BenchmarkConfig, NetworkThrottle, OutputFormat};

impl BenchmarkConfig {
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn with_iterations(mut self, warmup: usize, measurement: usize) -> Self {
        self.warmup_iterations = warmup;
        self.measurement_iterations = measurement;
        self
    }
    
    pub fn with_profiling(mut self, enabled: bool) -> Self {
        self.enable_profiling = enabled;
        self
    }
    
    pub fn with_screenshots(mut self, enabled: bool) -> Self {
        self.collect_screenshots = enabled;
        self
    }
    
    pub fn with_cpu_throttle(mut self, multiplier: f32) -> Self {
        self.throttle_cpu = Some(multiplier);
        self
    }
    
    pub fn with_network_throttle(mut self, throttle: NetworkThrottle) -> Self {
        self.throttle_network = Some(throttle);
        self
    }
    
    pub fn with_viewport(mut self, width: u32, height: u32) -> Self {
        self.viewport_size = (width, height);
        self
    }
    
    pub fn with_output_format(mut self, format: OutputFormat) -> Self {
        self.output_format = format;
        self
    }
}

/// Predefined benchmark configurations for common scenarios
pub struct BenchmarkPresets;

impl BenchmarkPresets {
    /// Quick smoke test configuration
    pub fn smoke_test() -> BenchmarkConfig {
        BenchmarkConfig::default()
            .with_iterations(1, 3)
            .with_profiling(false)
    }
    
    /// Standard benchmark configuration
    pub fn standard() -> BenchmarkConfig {
        BenchmarkConfig::default()
    }
    
    /// Thorough benchmark with more iterations
    pub fn thorough() -> BenchmarkConfig {
        BenchmarkConfig::default()
            .with_iterations(5, 20)
            .with_screenshots(true)
    }
    
    /// Mobile device simulation
    pub fn mobile() -> BenchmarkConfig {
        BenchmarkConfig::default()
            .with_viewport(375, 667) // iPhone 8 size
            .with_network_throttle(NetworkThrottle::Fast3G)
            .with_cpu_throttle(4.0) // 4x slowdown
    }
    
    /// Low-end device simulation
    pub fn low_end() -> BenchmarkConfig {
        BenchmarkConfig::default()
            .with_network_throttle(NetworkThrottle::Slow3G)
            .with_cpu_throttle(6.0) // 6x slowdown
    }
}
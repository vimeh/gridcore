use std::collections::HashMap;

/// Tracks WASM execution and JS interop performance
pub struct WasmProfiler {
    call_counts: HashMap<String, u32>,
    call_durations: HashMap<String, Vec<f64>>,
    total_execution_time: f64,
    interop_call_count: u32,
}

impl WasmProfiler {
    pub fn new() -> Self {
        Self {
            call_counts: HashMap::new(),
            call_durations: HashMap::new(),
            total_execution_time: 0.0,
            interop_call_count: 0,
        }
    }
    
    /// Record a WASM function call
    pub fn record_call(&mut self, function_name: &str, duration: f64) {
        *self.call_counts.entry(function_name.to_string()).or_insert(0) += 1;
        
        self.call_durations
            .entry(function_name.to_string())
            .or_insert_with(Vec::new)
            .push(duration);
        
        self.total_execution_time += duration;
    }
    
    /// Record a JS interop call
    pub fn record_interop_call(&mut self) {
        self.interop_call_count += 1;
    }
    
    pub fn clear(&mut self) {
        self.call_counts.clear();
        self.call_durations.clear();
        self.total_execution_time = 0.0;
        self.interop_call_count = 0;
    }
    
    pub fn get_total_execution_time(&self) -> f64 {
        self.total_execution_time
    }
    
    pub fn get_interop_call_count(&self) -> u32 {
        self.interop_call_count
    }
    
    pub fn get_function_stats(&self, function_name: &str) -> Option<FunctionStats> {
        let count = self.call_counts.get(function_name)?;
        let durations = self.call_durations.get(function_name)?;
        
        if durations.is_empty() {
            return None;
        }
        
        let total_duration: f64 = durations.iter().sum();
        let avg_duration = total_duration / durations.len() as f64;
        
        let mut sorted = durations.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let p50_index = (sorted.len() - 1) / 2;
        let p95_index = ((sorted.len() - 1) as f64 * 0.95) as usize;
        let p99_index = ((sorted.len() - 1) as f64 * 0.99) as usize;
        
        Some(FunctionStats {
            name: function_name.to_string(),
            call_count: *count,
            total_duration,
            avg_duration,
            p50_duration: sorted[p50_index],
            p95_duration: sorted[p95_index],
            p99_duration: sorted[p99_index],
        })
    }
    
    pub fn get_top_functions(&self, limit: usize) -> Vec<FunctionStats> {
        let mut stats: Vec<FunctionStats> = self.call_counts
            .keys()
            .filter_map(|name| self.get_function_stats(name))
            .collect();
        
        // Sort by total duration descending
        stats.sort_by(|a, b| b.total_duration.partial_cmp(&a.total_duration).unwrap());
        
        stats.truncate(limit);
        stats
    }
}

#[derive(Debug, Clone)]
pub struct FunctionStats {
    pub name: String,
    pub call_count: u32,
    pub total_duration: f64,
    pub avg_duration: f64,
    pub p50_duration: f64,
    pub p95_duration: f64,
    pub p99_duration: f64,
}
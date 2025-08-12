use std::collections::HashMap;

/// Tracks interaction latency for user inputs
pub struct LatencyTracker {
    latencies: Vec<f64>,
    interaction_counts: HashMap<String, u32>,
    pending_interactions: HashMap<String, f64>,
}

impl LatencyTracker {
    pub fn new() -> Self {
        Self {
            latencies: Vec::with_capacity(1000),
            interaction_counts: HashMap::new(),
            pending_interactions: HashMap::new(),
        }
    }
    
    /// Start tracking an interaction
    pub fn start_interaction(&mut self, id: &str, event_type: &str) -> f64 {
        let start_time = Self::now();
        self.pending_interactions.insert(id.to_string(), start_time);
        
        // Track interaction type counts
        *self.interaction_counts.entry(event_type.to_string()).or_insert(0) += 1;
        
        start_time
    }
    
    /// Complete tracking an interaction
    pub fn end_interaction(&mut self, id: &str) -> Option<f64> {
        if let Some(start_time) = self.pending_interactions.remove(id) {
            let end_time = Self::now();
            let latency = end_time - start_time;
            self.latencies.push(latency);
            Some(latency)
        } else {
            None
        }
    }
    
    /// Record a completed interaction
    pub fn record_interaction(&mut self, event_type: &str, start_time: f64, end_time: f64) {
        let latency = end_time - start_time;
        self.latencies.push(latency);
        *self.interaction_counts.entry(event_type.to_string()).or_insert(0) += 1;
    }
    
    pub fn clear(&mut self) {
        self.latencies.clear();
        self.interaction_counts.clear();
        self.pending_interactions.clear();
    }
    
    pub fn get_latencies(&self) -> Vec<f64> {
        self.latencies.clone()
    }
    
    pub fn get_average_latency(&self) -> f64 {
        if self.latencies.is_empty() {
            return 0.0;
        }
        
        self.latencies.iter().sum::<f64>() / self.latencies.len() as f64
    }
    
    pub fn get_percentile_latency(&self, percentile: f64) -> f64 {
        if self.latencies.is_empty() {
            return 0.0;
        }
        
        let mut sorted = self.latencies.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let index = ((sorted.len() - 1) as f64 * percentile / 100.0) as usize;
        sorted[index]
    }
    
    pub fn get_interaction_counts(&self) -> &HashMap<String, u32> {
        &self.interaction_counts
    }
    
    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }
}
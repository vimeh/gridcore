use super::runner::{BenchmarkReport, BenchmarkSummary};
use super::{BenchmarkConfig, BenchmarkResult};
use std::collections::HashMap;

/// Collects and analyzes benchmark results
pub struct ResultsCollector {
    results: Vec<BenchmarkResult>,
}

impl Default for ResultsCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl ResultsCollector {
    pub fn new() -> Self {
        Self {
            results: Vec::new(),
        }
    }

    pub fn add_result(&mut self, result: BenchmarkResult) {
        self.results.push(result);
    }

    pub fn add_results(&mut self, results: Vec<BenchmarkResult>) {
        self.results.extend(results);
    }

    pub fn analyze(&mut self, results: Vec<BenchmarkResult>) -> BenchmarkReport {
        self.results = results;

        let summary = self.calculate_summary();
        let warnings = self.detect_warnings();
        let suggestions = self.generate_suggestions();

        BenchmarkReport {
            timestamp: Self::now(),
            config: BenchmarkConfig::default(), // Will be updated by runner
            results: self.results.clone(),
            summary,
            warnings,
            suggestions,
        }
    }

    fn calculate_summary(&self) -> BenchmarkSummary {
        let total_scenarios = self.get_unique_scenarios().len();
        let successful_runs = self.results.iter().filter(|r| r.success).count();
        let failed_runs = self.results.iter().filter(|r| !r.success).count();

        // Calculate FPS statistics
        let all_fps: Vec<f64> = self
            .results
            .iter()
            .map(|r| r.metrics.fps_avg)
            .filter(|&fps| fps > 0.0)
            .collect();

        let avg_fps = if !all_fps.is_empty() {
            all_fps.iter().sum::<f64>() / all_fps.len() as f64
        } else {
            0.0
        };

        let p95_fps = self.calculate_percentile(&all_fps, 95.0);

        // Calculate latency statistics
        let all_latencies: Vec<f64> = self
            .results
            .iter()
            .map(|r| r.metrics.input_latency_avg)
            .filter(|&lat| lat > 0.0)
            .collect();

        let avg_latency = if !all_latencies.is_empty() {
            all_latencies.iter().sum::<f64>() / all_latencies.len() as f64
        } else {
            0.0
        };

        let p95_latency = self.calculate_percentile(&all_latencies, 95.0);

        // Calculate memory statistics
        let total_memory_growth: f64 = self.results.iter().map(|r| r.metrics.memory_growth).sum();

        // Calculate total duration
        let total_duration: f64 = self.results.iter().map(|r| r.metrics.duration_ms).sum();

        BenchmarkSummary {
            total_scenarios,
            successful_runs,
            failed_runs,
            avg_fps,
            p95_fps,
            avg_latency,
            p95_latency,
            total_memory_growth,
            total_duration,
        }
    }

    fn detect_warnings(&self) -> Vec<String> {
        let mut warnings = Vec::new();

        // Check for low FPS
        for result in &self.results {
            if result.metrics.fps_avg > 0.0 && result.metrics.fps_avg < 30.0 {
                warnings.push(format!(
                    "Low FPS detected in '{}': {:.1} FPS (target: 60 FPS)",
                    result.scenario_name, result.metrics.fps_avg
                ));
            }
        }

        // Check for high latency
        for result in &self.results {
            if result.metrics.input_latency_p95 > 100.0 {
                warnings.push(format!(
                    "High input latency in '{}': {:.1}ms p95 (target: <100ms)",
                    result.scenario_name, result.metrics.input_latency_p95
                ));
            }
        }

        // Check for memory growth
        for result in &self.results {
            if result.metrics.memory_growth > 10.0 {
                warnings.push(format!(
                    "Significant memory growth in '{}': {:.1}MB",
                    result.scenario_name, result.metrics.memory_growth
                ));
            }
        }

        // Check for dropped frames
        for result in &self.results {
            if result.metrics.dropped_frames > 5 {
                warnings.push(format!(
                    "Dropped frames detected in '{}': {} frames",
                    result.scenario_name, result.metrics.dropped_frames
                ));
            }
        }

        warnings
    }

    fn generate_suggestions(&self) -> Vec<String> {
        let mut suggestions = Vec::new();

        // Analyze results and provide suggestions
        let summary = self.calculate_summary();

        if summary.avg_fps < 50.0 {
            suggestions.push(
                "Consider optimizing rendering performance - average FPS is below 50".to_string(),
            );
        }

        if summary.p95_latency > 150.0 {
            suggestions
                .push("Input latency is high - consider optimizing event handlers".to_string());
        }

        if summary.total_memory_growth > 50.0 {
            suggestions
                .push("Significant memory growth detected - check for memory leaks".to_string());
        }

        // Check for specific scenario issues
        let scenario_groups = self.group_by_scenario();
        for (scenario, results) in scenario_groups {
            let avg_fps: f64 = results
                .iter()
                .map(|r| r.metrics.fps_avg)
                .filter(|&fps| fps > 0.0)
                .sum::<f64>()
                / results.len().max(1) as f64;

            if avg_fps < 30.0 && avg_fps > 0.0 {
                suggestions.push(format!(
                    "Scenario '{}' needs optimization - average FPS: {:.1}",
                    scenario, avg_fps
                ));
            }
        }

        suggestions
    }

    fn get_unique_scenarios(&self) -> Vec<String> {
        let mut scenarios: Vec<String> = self
            .results
            .iter()
            .map(|r| r.scenario_name.clone())
            .collect();
        scenarios.sort();
        scenarios.dedup();
        scenarios
    }

    fn group_by_scenario(&self) -> HashMap<String, Vec<&BenchmarkResult>> {
        let mut groups: HashMap<String, Vec<&BenchmarkResult>> = HashMap::new();

        for result in &self.results {
            groups
                .entry(result.scenario_name.clone())
                .or_default()
                .push(result);
        }

        groups
    }

    fn calculate_percentile(&self, values: &[f64], percentile: f64) -> f64 {
        if values.is_empty() {
            return 0.0;
        }

        let mut sorted = values.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let index = ((sorted.len() - 1) as f64 * percentile / 100.0) as usize;
        sorted[index]
    }

    fn now() -> f64 {
        web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0)
    }

    pub fn export_json(&self) -> String {
        // Convert results to JSON
        serde_json::to_string_pretty(&self.results).unwrap_or_else(|_| "[]".to_string())
    }

    pub fn export_csv(&self) -> String {
        let mut csv = String::from("Scenario,Iteration,Success,FPS_Avg,FPS_P95,Latency_Avg,Latency_P95,Memory_Growth,Duration\n");

        for result in &self.results {
            csv.push_str(&format!(
                "{},{},{},{:.2},{:.2},{:.2},{:.2},{:.2},{:.2}\n",
                result.scenario_name,
                result.iteration,
                result.success,
                result.metrics.fps_avg,
                result.metrics.fps_p95,
                result.metrics.input_latency_avg,
                result.metrics.input_latency_p95,
                result.metrics.memory_growth,
                result.metrics.duration_ms
            ));
        }

        csv
    }
}

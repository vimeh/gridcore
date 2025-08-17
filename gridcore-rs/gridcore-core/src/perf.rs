//! Performance metrics for core operations

// Metric name constants following Prometheus naming conventions
pub const FORMULA_EVALUATIONS: &str = "gridcore_formula_evaluations_total";
pub const FORMULA_EVAL_TIME: &str = "gridcore_formula_eval_duration_seconds";
pub const FORMULA_PARSE_TIME: &str = "gridcore_formula_parse_duration_seconds";
pub const CELL_READS: &str = "gridcore_cell_reads_total";
pub const CELL_WRITES: &str = "gridcore_cell_writes_total";
pub const DEPENDENCY_UPDATES: &str = "gridcore_dependency_updates_total";
pub const UNDO_OPERATIONS: &str = "gridcore_undo_operations_total";
pub const REDO_OPERATIONS: &str = "gridcore_redo_operations_total";
pub const BATCH_OPERATIONS: &str = "gridcore_batch_operations_total";
pub const BATCH_SIZE: &str = "gridcore_batch_size";

/// Helper macro for timing operations
/// Usage: perf_time!(METRIC_NAME, { code block })
#[macro_export]
macro_rules! perf_time {
    ($metric:expr, $body:expr) => {{
        #[cfg(feature = "perf")]
        let _perf_start = std::time::Instant::now();
        let result = $body;
        #[cfg(feature = "perf")]
        {
            use metrics::histogram;
            histogram!($metric).record(_perf_start.elapsed().as_secs_f64());
        }
        result
    }};
}

/// Increment a counter by 1
#[macro_export]
macro_rules! perf_incr {
    ($metric:expr) => {
        #[cfg(feature = "perf")]
        {
            use metrics::counter;
            counter!($metric).increment(1);
        }
    };
    ($metric:expr, $n:expr) => {
        #[cfg(feature = "perf")]
        {
            use metrics::counter;
            counter!($metric).increment($n);
        }
    };
}

/// Record a gauge value
#[macro_export]
macro_rules! perf_gauge {
    ($metric:expr, $value:expr) => {
        #[cfg(feature = "perf")]
        {
            use metrics::gauge;
            gauge!($metric).set($value as f64);
        }
    };
}

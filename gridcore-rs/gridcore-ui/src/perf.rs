//! Performance metrics for UI operations

// Metric name constants following Prometheus naming conventions
pub const RENDER_FRAMES: &str = "gridcore_render_frames_total";
pub const RENDER_TIME: &str = "gridcore_render_duration_seconds";
pub const CELLS_RENDERED: &str = "gridcore_cells_rendered_total";
pub const CANVAS_OPERATIONS: &str = "gridcore_canvas_operations_total";
pub const RESIZE_EVENTS: &str = "gridcore_resize_events_total";
pub const SCROLL_EVENTS: &str = "gridcore_scroll_events_total";
pub const VIEWPORT_UPDATES: &str = "gridcore_viewport_updates_total";
pub const REACTIVE_UPDATES: &str = "gridcore_reactive_updates_total";

// Performance thresholds
pub const TARGET_FPS: f64 = 60.0;
pub const FRAME_TIME_MS: f64 = 16.67; // 1000ms / 60fps

// Re-export macros from core
#[cfg(feature = "perf")]
pub use gridcore_core::{perf_gauge, perf_incr, perf_time};

/// Initialize metrics system for UI
#[cfg(feature = "perf")]
pub fn init_metrics() -> Result<(), Box<dyn std::error::Error>> {
    use metrics::describe_counter;
    use metrics::describe_histogram;
    use metrics::Unit;

    // Register metric descriptions
    describe_counter!(RENDER_FRAMES, "Total number of frames rendered");
    describe_counter!(CELLS_RENDERED, "Total number of cells rendered");
    describe_counter!(CANVAS_OPERATIONS, "Total number of canvas draw operations");
    describe_counter!(RESIZE_EVENTS, "Total number of resize events");
    describe_counter!(SCROLL_EVENTS, "Total number of scroll events");
    describe_counter!(VIEWPORT_UPDATES, "Total number of viewport updates");
    describe_counter!(REACTIVE_UPDATES, "Total number of reactive state updates");

    describe_histogram!(
        RENDER_TIME,
        Unit::Seconds,
        "Time taken to render a frame"
    );

    // Initialize Prometheus exporter if feature is enabled
    #[cfg(feature = "perf-export")]
    init_prometheus_export()?;

    // Initialize tracing subscriber
    #[cfg(feature = "perf-export")]
    init_tracing()?;

    Ok(())
}

#[cfg(all(feature = "perf", feature = "perf-export"))]
fn init_prometheus_export() -> Result<(), Box<dyn std::error::Error>> {
    use metrics_exporter_prometheus::PrometheusBuilder;

    // Set up Prometheus exporter on port 9090
    PrometheusBuilder::new()
        .with_http_listener(([127, 0, 0, 1], 9090))
        .idle_timeout(
            metrics_util::MetricKindMask::COUNTER | metrics_util::MetricKindMask::HISTOGRAM,
            Some(std::time::Duration::from_secs(300)),
        )
        .install()?;

    web_sys::console::log_1(&"Prometheus metrics available at http://localhost:9090/metrics".into());

    Ok(())
}

#[cfg(all(feature = "perf", feature = "perf-export"))]
fn init_tracing() -> Result<(), Box<dyn std::error::Error>> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

    // Create a custom formatter for WASM console
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_ansi(false) // No ANSI colors in browser console
        .with_target(false)
        .with_level(true)
        .with_writer(|| ConsoleWriter);

    tracing_subscriber::registry()
        .with(fmt_layer)
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .try_init()
        .map_err(|e| format!("Failed to initialize tracing: {}", e))?;

    Ok(())
}

/// Custom writer that outputs to browser console
#[cfg(all(feature = "perf", feature = "perf-export"))]
struct ConsoleWriter;

#[cfg(all(feature = "perf", feature = "perf-export"))]
impl std::io::Write for ConsoleWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let msg = String::from_utf8_lossy(buf);
        web_sys::console::log_1(&msg.into());
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}
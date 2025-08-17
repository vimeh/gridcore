//! No-op metrics recorder for WASM environment
//!
//! This recorder satisfies the metrics crate's requirement for a global recorder
//! but doesn't actually do anything with the metrics. This prevents the
//! "unreachable code" panic in WASM when metrics macros are called.

use metrics::{Key, KeyName, Metadata, Recorder, SetRecorderError, SharedString, Unit};

/// A no-op metrics recorder that does nothing with metrics
pub struct NoOpRecorder;

impl NoOpRecorder {
    pub fn new() -> Self {
        Self
    }
}

impl Recorder for NoOpRecorder {
    fn describe_counter(&self, _key: KeyName, _unit: Option<Unit>, _description: SharedString) {
        // No-op
    }

    fn describe_gauge(&self, _key: KeyName, _unit: Option<Unit>, _description: SharedString) {
        // No-op
    }

    fn describe_histogram(&self, _key: KeyName, _unit: Option<Unit>, _description: SharedString) {
        // No-op
    }

    fn register_counter(&self, _key: &Key, _metadata: &Metadata<'_>) -> metrics::Counter {
        metrics::Counter::noop()
    }

    fn register_gauge(&self, _key: &Key, _metadata: &Metadata<'_>) -> metrics::Gauge {
        metrics::Gauge::noop()
    }

    fn register_histogram(&self, _key: &Key, _metadata: &Metadata<'_>) -> metrics::Histogram {
        metrics::Histogram::noop()
    }
}

/// Install the no-op recorder as the global metrics recorder
pub fn install() -> Result<(), SetRecorderError<NoOpRecorder>> {
    metrics::set_global_recorder(NoOpRecorder::new())
}

/// Install the no-op recorder as the global metrics recorder (static version)
pub fn install_static() -> Result<(), Box<dyn std::error::Error>> {
    // Use a static recorder that lives for the entire program
    static RECORDER: NoOpRecorder = NoOpRecorder;
    metrics::set_global_recorder(&RECORDER)
        .map_err(|e| format!("Failed to install no-op recorder: {:?}", e).into())
}

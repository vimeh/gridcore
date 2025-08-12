use crate::demo::performance::Metrics;
use leptos::prelude::*;

/// Performance overlay component that displays real-time metrics
#[component]
pub fn PerformanceOverlay(metrics: Signal<Metrics>, visible: Signal<bool>) -> impl IntoView {
    view! {
        <Show
            when=move || visible.get()
            fallback=|| ()
        >
            <div class="performance-overlay">
                <div class="metric">
                    <span class="metric-label">"FPS: "</span>
                    <span class="metric-value">{move || format!("{:.1}", metrics.get().fps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">"Render: "</span>
                    <span class="metric-value">{move || format!("{:.2}ms", metrics.get().render_time_ms)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">"Calc: "</span>
                    <span class="metric-value">{move || format!("{:.2}ms", metrics.get().calculation_time_ms)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">"Memory: "</span>
                    <span class="metric-value">{move || format!("{:.1}MB", metrics.get().memory_usage_mb)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">"Cells: "</span>
                    <span class="metric-value">{move || metrics.get().cell_count.to_string()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">"Formulas: "</span>
                    <span class="metric-value">{move || metrics.get().formula_count.to_string()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">"Ops/s: "</span>
                    <span class="metric-value">{move || format!("{:.1}", metrics.get().operations_per_second)}</span>
                </div>
            </div>
        </Show>
    }
}

/// Demo progress bar component
#[component]
pub fn DemoProgressBar(
    current_step: Signal<usize>,
    total_steps: Signal<usize>,
    scenario_name: Signal<String>,
    is_running: Signal<bool>,
) -> impl IntoView {
    let progress_percent = move || {
        let total = total_steps.get();
        if total > 0 {
            (current_step.get() as f32 / total as f32 * 100.0) as u32
        } else {
            0
        }
    };

    view! {
        <Show
            when=move || is_running.get()
            fallback=|| ()
        >
            <div class="demo-progress-bar">
                <div class="demo-info">
                    <span class="demo-scenario">{move || scenario_name.get()}</span>
                    <span class="demo-step">
                        {move || format!("Step {}/{}", current_step.get(), total_steps.get())}
                    </span>
                </div>
                <div class="progress-bar-container">
                    <div
                        class="progress-bar-fill"
                        style:width=move || format!("{}%", progress_percent())
                    ></div>
                </div>
            </div>
        </Show>
    }
}

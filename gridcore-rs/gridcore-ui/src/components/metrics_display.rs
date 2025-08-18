//! Real-time metrics display component

use crate::metrics_collector::MetricsSnapshot;
use leptos::prelude::*;
use wasm_bindgen::JsCast;

/// Component for displaying real-time performance metrics
#[component]
pub fn MetricsDisplay(
    /// Signal containing the current metrics snapshot
    metrics: Signal<MetricsSnapshot>,
    /// Signal controlling visibility
    visible: Signal<bool>,
) -> impl IntoView {
    view! {
        <Show
            when=move || visible.get()
            fallback=|| ()
        >
            <div class="metrics-overlay">
                <h3 class="metrics-title">"Performance Metrics"</h3>

                // Operations per second
                <div class="metrics-section">
                    <h4>"Operations/sec"</h4>
                    <div class="metric">
                        <span class="metric-label">"Formula Evaluations: "</span>
                        <span class="metric-value">{move || format!("{:.1}", metrics.get().formula_eval_rate)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Cell Reads: "</span>
                        <span class="metric-value">{move || format!("{:.1}", metrics.get().cell_read_rate)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Cell Writes: "</span>
                        <span class="metric-value">{move || format!("{:.1}", metrics.get().cell_write_rate)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Actions Dispatched: "</span>
                        <span class="metric-value">{move || format!("{:.1}", metrics.get().action_dispatch_rate)}</span>
                    </div>
                </div>

                // Counters
                <div class="metrics-section">
                    <h4>"Total Operations"</h4>
                    <div class="metric">
                        <span class="metric-label">"Formula Evaluations: "</span>
                        <span class="metric-value">{move || metrics.get().formula_evaluations.to_string()}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Cell Reads: "</span>
                        <span class="metric-value">{move || metrics.get().cell_reads.to_string()}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Cell Writes: "</span>
                        <span class="metric-value">{move || metrics.get().cell_writes.to_string()}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Cursor Moves: "</span>
                        <span class="metric-value">{move || metrics.get().cursor_moves.to_string()}</span>
                    </div>
                </div>

                // Timing metrics
                <div class="metrics-section">
                    <h4>"Response Times (ms)"</h4>
                    <Show
                        when=move || { metrics.get().formula_eval_time_p50 > 0.0 }
                        fallback=|| ()
                    >
                        <div class="metric">
                            <span class="metric-label">"Formula Eval (p50): "</span>
                            <span class="metric-value">{move || format!("{:.2}", metrics.get().formula_eval_time_p50)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">"Formula Eval (p95): "</span>
                            <span class="metric-value">{move || format!("{:.2}", metrics.get().formula_eval_time_p95)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">"Action Dispatch (p50): "</span>
                            <span class="metric-value">{move || format!("{:.2}", metrics.get().action_dispatch_time_p50)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">"Render Time: "</span>
                            <span class="metric-value">{move || format!("{:.2}", metrics.get().render_time_ms)}</span>
                        </div>
                    </Show>
                </div>

                // System metrics
                <div class="metrics-section">
                    <h4>"System"</h4>
                    <div class="metric">
                        <span class="metric-label">"Memory Usage: "</span>
                        <span class="metric-value">{move || format!("{:.1} MB", metrics.get().memory_usage_mb)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Cell Count: "</span>
                        <span class="metric-value">{move || metrics.get().cell_count.to_string()}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">"Formula Count: "</span>
                        <span class="metric-value">{move || metrics.get().formula_count.to_string()}</span>
                    </div>
                </div>

                // Sparklines for trending (placeholder for now)
                <div class="metrics-section">
                    <h4>"Trends"</h4>
                    <MetricsSparkline
                        label="Formula Eval Rate"
                        data=Signal::derive(move || vec![metrics.get().formula_eval_rate])
                    />
                    <MetricsSparkline
                        label="Cell Operations"
                        data=Signal::derive(move || vec![metrics.get().cell_read_rate + metrics.get().cell_write_rate])
                    />
                </div>
            </div>
        </Show>
    }
}

/// Simple sparkline component for showing metric trends
#[component]
fn MetricsSparkline(
    /// Label for the sparkline
    label: &'static str,
    /// Data points for the sparkline
    data: Signal<Vec<f64>>,
) -> impl IntoView {
    view! {
        <div class="sparkline-container">
            <span class="sparkline-label">{label}": "</span>
            <div class="sparkline">
                // For now, just show the current value
                // TODO: Implement actual sparkline visualization
                <span class="sparkline-value">{move || {
                    let values = data.get();
                    if let Some(last) = values.last() {
                        format!("{:.1}", last)
                    } else {
                        "0.0".to_string()
                    }
                }}</span>
            </div>
        </div>
    }
}

/// Component for toggling metrics display
#[component]
pub fn MetricsToggle(
    /// Signal controlling metrics visibility
    show_metrics: RwSignal<bool>,
) -> impl IntoView {
    // Use Effect to set button properties after mount to avoid any initial focus issues
    let button_ref = NodeRef::<leptos::html::Button>::new();
    
    Effect::new(move |_| {
        if let Some(button) = button_ref.get() {
            let element: &web_sys::HtmlElement = button.as_ref();
            // Ensure button cannot receive focus
            element.set_tab_index(-1);
        }
    });
    
    view! {
        <button
            node_ref=button_ref
            class="metrics-toggle-btn"
            tabindex="-1"  // Prevent button from stealing focus on initial render
            on:click=move |_| {
                show_metrics.set(!show_metrics.get());

                // Refocus the grid container after toggling metrics
                // This ensures keyboard navigation continues to work
                if let Some(window) = web_sys::window() {
                    if let Some(document) = window.document() {
                        // Find the grid-keyboard-handler element which has the tabindex
                        if let Ok(grid_elements) = document.query_selector_all(".grid-keyboard-handler") {
                            if grid_elements.length() > 0 {
                                if let Some(element) = grid_elements.get(0) {
                                    if let Ok(html_element) = element.dyn_into::<web_sys::HtmlElement>() {
                                        let _ = html_element.focus();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        >
            {move || if show_metrics.get() { "Hide Metrics" } else { "Show Metrics" }}
        </button>
    }
}

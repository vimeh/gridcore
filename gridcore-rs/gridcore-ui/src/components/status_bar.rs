use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::{CellMode, SpreadsheetMode, UIState, VisualMode};
use leptos::*;
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Clone, Debug)]
pub struct SelectionStats {
    pub count: usize,
    pub sum: Option<f64>,
    pub average: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

impl Default for SelectionStats {
    fn default() -> Self {
        Self {
            count: 0,
            sum: None,
            average: None,
            min: None,
            max: None,
        }
    }
}

#[component]
pub fn StatusBar(
    current_mode: ReadSignal<SpreadsheetMode>,
    selection_stats: ReadSignal<SelectionStats>,
    controller: Rc<RefCell<SpreadsheetController>>,
) -> impl IntoView {
    // Clone controller for closures
    let ctrl_for_display = controller.clone();

    // Create a reactive signal that updates when current_mode changes
    // This ensures the UI updates when mode changes
    let mode_display = move || {
        // Read current_mode to ensure reactivity
        let _mode = current_mode.get();

        let ctrl_borrow = ctrl_for_display.borrow();
        let state = ctrl_borrow.get_state();

        let (text, color, detail) = match state {
            UIState::Navigation { .. } => ("NAVIGATION", "#4caf50", "hjkl to move"),
            UIState::Editing {
                cell_mode,
                visual_type,
                ..
            } => {
                match cell_mode {
                    CellMode::Insert => ("INSERT", "#2196f3", "ESC to normal"),
                    CellMode::Normal => ("NORMAL", "#ff9800", "i/a to insert"),
                    CellMode::Visual => {
                        // Check visual type for line mode
                        match visual_type {
                            Some(VisualMode::Line) => ("VISUAL LINE", "#9c27b0", "hjkl to select"),
                            Some(VisualMode::Block) => {
                                ("VISUAL BLOCK", "#9c27b0", "hjkl to select")
                            }
                            _ => ("VISUAL", "#9c27b0", "hjkl to select"),
                        }
                    }
                }
            }
            UIState::Visual { .. } => ("VISUAL", "#9c27b0", "hjkl to select"),
            UIState::Command { .. } => ("COMMAND", "#f44336", "Enter to execute"),
            UIState::Resize { .. } => ("RESIZE", "#795548", ""),
            UIState::Insert { .. } => ("INSERT", "#2196f3", "ESC to normal"),
            UIState::Delete { .. } => ("DELETE", "#e91e63", ""),
            UIState::BulkOperation { .. } => ("BULK", "#607d8b", ""),
        };
        (text, color, detail)
    };

    // Format selection statistics
    let stats_display = move || {
        let stats = selection_stats.get();
        if stats.count > 1 {
            let mut parts = vec![format!("Count: {}", stats.count)];

            if let Some(sum) = stats.sum {
                parts.push(format!("Sum: {:.2}", sum));
            }
            if let Some(avg) = stats.average {
                parts.push(format!("Avg: {:.2}", avg));
            }
            if let Some(min) = stats.min {
                parts.push(format!("Min: {:.2}", min));
            }
            if let Some(max) = stats.max {
                parts.push(format!("Max: {:.2}", max));
            }

            parts.join(" | ")
        } else {
            String::new()
        }
    };

    view! {
        <div
            class="status-bar"
            style="display: flex; align-items: center; justify-content: space-between; height: 24px; padding: 0 12px; background: #f5f5f5; border-top: 1px solid #e0e0e0; font-size: 12px; font-family: monospace;"
        >
            // Left section: Selection statistics
            <div style="display: flex; align-items: center; gap: 16px;">
                {move || if !stats_display().is_empty() {
                    view! {
                        <span style="color: #666;">
                            {stats_display}
                        </span>
                    }.into_view()
                } else {
                    view! {
                        <span style="color: #999;">
                            "Ready"
                        </span>
                    }.into_view()
                }}
            </div>

            // Right section: Mode indicator - structure compatible with e2e tests
            {move || {
                let (mode_text, mode_color, mode_detail) = mode_display();
                leptos::logging::log!("Mode indicator update: text={}, detail={}", mode_text, mode_detail);
                leptos::logging::log!("Status bar: Rendering single mode indicator (duplicate removed for e2e test compatibility)");
                
                // Single mode indicator containing both mode text and detail
                // Tests can filter by text content within this container
                view! {
                    <>
                        <div 
                            class="mode-indicator" 
                            style="display: flex; align-items: center; gap: 8px;"
                        >
                            <span
                                class="mode-text"
                                style=format!(
                                    "padding: 2px 8px; background: {}; color: white; border-radius: 3px; font-weight: 600; font-size: 11px;",
                                    mode_color
                                )
                            >
                                {mode_text}
                            </span>
                            {if !mode_detail.is_empty() {
                                view! {
                                    <span class="mode-detail" style="color: #666; font-size: 11px;">
                                        {mode_detail}
                                    </span>
                                }.into_view()
                            } else {
                                view! { <span></span> }.into_view()
                            }}
                        </div>
                    </>
                }
            }}
        </div>
    }
}

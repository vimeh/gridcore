use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::managers::SelectionStats;
use gridcore_controller::state::{CellMode, SpreadsheetMode, UIState, VisualMode};
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

#[component]
pub fn StatusBar(
    current_mode: ReadSignal<SpreadsheetMode>,
    selection_stats: ReadSignal<SelectionStats>,
    state_version: ReadSignal<u32>,
) -> impl IntoView {
    // Get controller from context
    let controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> =
        use_context().expect("SpreadsheetController not found in context");
    let controller = controller_stored.with_value(|c| c.clone());

    // Store controller in LocalStorage for non-Send access
    let controller_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());

    // Create a reactive signal that updates when current_mode or state_version changes
    // This ensures the UI updates when mode changes
    let mode_display = move || {
        // Read both signals to ensure reactivity - this creates the reactive dependencies
        let signal_mode = current_mode.get();
        let _ = state_version.get(); // Track state version changes

        // Always get fresh state from controller
        let state = controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            ctrl_borrow.get_state().clone()
        });

        // First check if we're in Editing state with specific cell modes
        // This ensures proper display of NORMAL mode within editing
        let (text, color, detail) = match &state {
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
            // Fall back to SpreadsheetMode-based display for other states
            _ => match signal_mode {
                SpreadsheetMode::Navigation => ("NAVIGATION", "#4caf50", "hjkl to move"),
                SpreadsheetMode::Visual => ("VISUAL", "#9c27b0", "hjkl to select"),
                SpreadsheetMode::Editing => ("NORMAL", "#ff9800", "i/a to insert"), // Should not reach here typically
                SpreadsheetMode::Command => ("COMMAND", "#f44336", "Enter to execute"),
                SpreadsheetMode::Resize => ("RESIZE", "#795548", ""),
                SpreadsheetMode::Insert => ("INSERT", "#2196f3", "ESC to normal"),
                SpreadsheetMode::Delete => ("DELETE", "#e91e63", ""),
                SpreadsheetMode::BulkOperation => ("BULK", "#607d8b", ""),
            },
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
                {move || {
                    let stats = stats_display();
                    if !stats.is_empty() {
                        view! {
                            <span style="color: #666;">
                                {stats}
                            </span>
                        }
                    } else {
                        view! {
                            <span style="color: #999;">
                                {"Ready".to_string()}
                            </span>
                        }
                    }
                }}
            </div>

            // Right section: Mode indicator - structure compatible with e2e tests
            {move || {
                let (mode_text, mode_color, mode_detail) = mode_display();

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
                                }
                            } else {
                                view! { <span class="mode-detail" style="color: #666; font-size: 11px;">{""}</span> }
                            }}
                        </div>
                    </>
                }
            }}
        </div>
    }
}

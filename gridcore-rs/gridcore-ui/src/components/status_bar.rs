use gridcore_controller::state::SpreadsheetMode;
use leptos::*;

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
) -> impl IntoView {

    // Format mode display with color and detail text
    let mode_display = move || {
        let (text, color, detail) = match current_mode.get() {
            SpreadsheetMode::Navigation => ("NORMAL", "#4caf50", "hjkl to move"),
            SpreadsheetMode::Insert => ("INSERT", "#2196f3", "ESC to normal"),
            SpreadsheetMode::Editing => ("NORMAL", "#ff9800", "i/a to insert"),  // Normal mode within editing
            SpreadsheetMode::Visual => ("VISUAL", "#9c27b0", "hjkl to select"),
            SpreadsheetMode::Command => ("COMMAND", "#f44336", "Enter to execute"),
            SpreadsheetMode::Resize => ("RESIZE", "#795548", ""),
            SpreadsheetMode::Delete => ("DELETE", "#e91e63", ""),
            SpreadsheetMode::BulkOperation => ("BULK", "#607d8b", ""),
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

            // Right section: Mode indicator
            <div class="mode-indicator" style="display: flex; align-items: center; gap: 8px;">
                {move || {
                    let (mode_text, mode_color, mode_detail) = mode_display();
                    view! {
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
                    }
                }}
            </div>
        </div>
    }
}


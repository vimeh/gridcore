use gridcore_controller::state::SpreadsheetMode;
use gridcore_core::types::CellAddress;
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
    active_cell: ReadSignal<CellAddress>,
    selection_stats: ReadSignal<SelectionStats>,
) -> impl IntoView {
    // Format cell address (e.g., "A1")
    let cell_address = move || {
        let cell = active_cell.get();
        format!("{}{}", get_column_label(cell.col as usize), cell.row + 1)
    };
    
    // Format mode display with color
    let mode_display = move || {
        let (text, color) = match current_mode.get() {
            SpreadsheetMode::Navigation => ("NORMAL", "#4caf50"),
            SpreadsheetMode::Insert => ("INSERT", "#2196f3"),
            SpreadsheetMode::Editing => ("EDIT", "#ff9800"),
            SpreadsheetMode::Visual => ("VISUAL", "#9c27b0"),
            SpreadsheetMode::Command => ("COMMAND", "#f44336"),
            SpreadsheetMode::Resize => ("RESIZE", "#795548"),
            SpreadsheetMode::Delete => ("DELETE", "#e91e63"),
            SpreadsheetMode::BulkOperation => ("BULK", "#607d8b"),
        };
        (text, color)
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
            // Left section: Cell address
            <div style="display: flex; align-items: center; gap: 16px;">
                <span style="font-weight: 600;">
                    {cell_address}
                </span>
                
                // Selection statistics
                {move || if !stats_display().is_empty() {
                    view! {
                        <span style="color: #666;">
                            {stats_display}
                        </span>
                    }.into_view()
                } else {
                    view! { }.into_view()
                }}
            </div>
            
            // Right section: Mode indicator
            <div style="display: flex; align-items: center; gap: 8px;">
                {move || {
                    let (mode_text, mode_color) = mode_display();
                    view! {
                        <span 
                            style=format!(
                                "padding: 2px 8px; background: {}; color: white; border-radius: 3px; font-weight: 600; font-size: 11px;",
                                mode_color
                            )
                        >
                            {mode_text}
                        </span>
                    }
                }}
            </div>
        </div>
    }
}

// Helper function to convert column index to letter(s)
fn get_column_label(col: usize) -> String {
    let mut label = String::new();
    let mut n = col;
    
    loop {
        label.insert(0, ((n % 26) as u8 + b'A') as char);
        if n < 26 {
            break;
        }
        n = n / 26 - 1;
    }
    
    label
}
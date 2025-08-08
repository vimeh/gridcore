use crate::components::canvas_grid::CanvasGrid;
use leptos::*;

#[component]
pub fn App() -> impl IntoView {
    // Create reactive signals for UI state
    let (formula_value, set_formula_value) = create_signal(String::new());
    let (status_message, set_status_message) = create_signal(String::from("Ready"));
    let (active_sheet, set_active_sheet) = create_signal(0);

    view! {
        <div class="spreadsheet-app">
            <div class="top-toolbar">
                <div class="formula-bar">
                    <span style="padding: 0 8px; font-weight: bold;">"fx"</span>
                    <input
                        type="text"
                        placeholder="Enter formula or value"
                        value=move || formula_value.get()
                        on:input=move |ev| set_formula_value.set(event_target_value(&ev))
                        style="flex: 1; border: 1px solid #e0e0e0; padding: 4px; font-family: monospace;"
                    />
                </div>
            </div>

            <div class="main-content">
                <CanvasGrid />
            </div>

            <div class="bottom-toolbar">
                <div class="tab-bar" style="display: flex; align-items: center;">
                    <button
                        class:active=move || active_sheet.get() == 0
                        on:click=move |_| set_active_sheet.set(0)
                        style="padding: 4px 12px; margin-right: 4px; cursor: pointer;"
                    >
                        "Sheet1"
                    </button>
                    <button
                        style="padding: 4px 8px; cursor: pointer;"
                        title="Add new sheet"
                    >
                        "+"
                    </button>
                </div>
                <div class="status-bar" style="padding: 4px 8px;">
                    <span>{move || status_message.get()}</span>
                </div>
            </div>
        </div>
    }
}

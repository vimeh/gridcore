use leptos::*;
use gridcore_controller::controller::SpreadsheetController;

#[component]
pub fn StatusBar(
    message: ReadSignal<String>,
    controller: SpreadsheetController,
) -> impl IntoView {
    let (mode, set_mode) = create_signal(String::from("Normal"));
    
    // Update mode from controller state
    create_effect(move |_| {
        let state = controller.get_state();
        let mode_str = match state.spreadsheet_mode.as_str() {
            "navigation" => "Normal",
            "editing" => "Edit",
            "visual" => "Visual",
            _ => "Normal",
        };
        set_mode(mode_str.to_string());
    });
    
    view! {
        <div class="status-bar" style="display: flex; justify-content: space-between; padding: 4px 8px; border-top: 1px solid #e0e0e0; background: #f5f5f5;">
            <span>{message}</span>
            <span style="font-weight: bold;">{mode}</span>
        </div>
    }
}
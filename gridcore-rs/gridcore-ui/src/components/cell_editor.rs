use leptos::*;
use gridcore_core::types::CellAddress;
use gridcore_core::facade::SpreadsheetFacade;

#[component]
pub fn CellEditor(
    cell: ReadSignal<CellAddress>,
    facade: SpreadsheetFacade,
    on_commit: impl Fn(String) + 'static,
    on_cancel: impl Fn() + 'static,
) -> impl IntoView {
    let (value, set_value) = create_signal(String::new());
    
    // Initialize with current cell value
    create_effect(move |_| {
        let address = cell.get();
        if let Some(cell_data) = facade.get_cell(&address) {
            if let Some(computed_value) = cell_data.get_computed_value() {
                set_value(computed_value.to_string());
            }
        }
    });
    
    let on_keydown = move |ev: web_sys::KeyboardEvent| {
        match ev.key().as_str() {
            "Enter" => {
                ev.prevent_default();
                on_commit(value.get());
            }
            "Escape" => {
                ev.prevent_default();
                on_cancel();
            }
            _ => {}
        }
    };
    
    view! {
        <div 
            class="cell-editor"
            style="position: absolute; border: 2px solid #0066cc; background: white; z-index: 1000;"
        >
            <input
                type="text"
                prop:value=value
                on:input=move |ev| set_value(event_target_value(&ev))
                on:keydown=on_keydown
                autofocus=true
                style="width: 100%; border: none; outline: none; padding: 2px 4px;"
            />
        </div>
    }
}
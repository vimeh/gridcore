use leptos::*;
use web_sys::MouseEvent;

#[derive(Clone, Debug)]
pub struct Sheet {
    pub id: usize,
    pub name: String,
}

#[component]
pub fn TabBar(
    sheets: ReadSignal<Vec<Sheet>>,
    active_sheet: ReadSignal<usize>,
    set_active_sheet: WriteSignal<usize>,
) -> impl IntoView {
    let (show_context_menu, set_show_context_menu) = create_signal(false);
    let (context_menu_sheet, set_context_menu_sheet) = create_signal(0usize);
    let (context_menu_pos, set_context_menu_pos) = create_signal((0.0, 0.0));
    let (editing_sheet, set_editing_sheet) = create_signal(None::<usize>);
    let (edit_name, set_edit_name) = create_signal(String::new());
    
    // Add new sheet
    let add_sheet = move |_| {
        // This would normally dispatch an action to the controller
        // For now, just log
        leptos::logging::log!("Add new sheet");
    };
    
    // Handle right-click on tab
    let on_context_menu = move |ev: MouseEvent, sheet_id: usize| {
        ev.prevent_default();
        set_context_menu_sheet.set(sheet_id);
        set_context_menu_pos.set((ev.client_x() as f64, ev.client_y() as f64));
        set_show_context_menu.set(true);
    };
    
    // Start renaming
    let start_rename = move |sheet_id: usize| {
        let sheet_name = sheets.get()
            .iter()
            .find(|s| s.id == sheet_id)
            .map(|s| s.name.clone())
            .unwrap_or_default();
        set_edit_name.set(sheet_name);
        set_editing_sheet.set(Some(sheet_id));
        set_show_context_menu.set(false);
    };
    
    // Finish renaming
    let finish_rename = move |sheet_id: usize| {
        let new_name = edit_name.get();
        if !new_name.is_empty() {
            // This would normally dispatch an action to rename the sheet
            leptos::logging::log!("Rename sheet {} to {}", sheet_id, new_name);
        }
        set_editing_sheet.set(None);
    };
    
    // Delete sheet
    let delete_sheet = move |sheet_id: usize| {
        // This would normally dispatch an action to delete the sheet
        leptos::logging::log!("Delete sheet {}", sheet_id);
        set_show_context_menu.set(false);
    };
    
    // Duplicate sheet
    let duplicate_sheet = move |sheet_id: usize| {
        // This would normally dispatch an action to duplicate the sheet
        leptos::logging::log!("Duplicate sheet {}", sheet_id);
        set_show_context_menu.set(false);
    };
    
    // Close context menu when clicking elsewhere
    let close_context_menu = move |_| {
        set_show_context_menu.set(false);
    };
    
    view! {
        <div 
            class="tab-bar" 
            style="display: flex; align-items: center; height: 32px; padding: 0 8px; background: #f5f5f5; border-top: 1px solid #e0e0e0; position: relative;"
            on:click=close_context_menu
        >
            <div class="tab-scroll" style="display: flex; flex: 1; overflow-x: auto; overflow-y: hidden;">
                {move || sheets.get().into_iter().map(|sheet| {
                    let sheet_id = sheet.id;
                    let sheet_name = sheet.name.clone();
                    let is_active = move || active_sheet.get() == sheet_id;
                    let is_editing = move || editing_sheet.get() == Some(sheet_id);
                    
                    view! {
                        <div
                            class="tab"
                            on:click=move |_| set_active_sheet.set(sheet_id)
                            on:contextmenu=move |ev| on_context_menu(ev, sheet_id)
                            style=move || {
                                if is_active() {
                                    "padding: 4px 12px; background: white; border: 1px solid #e0e0e0; border-bottom: 1px solid white; border-top-left-radius: 4px; border-top-right-radius: 4px; cursor: pointer; margin-right: 2px; position: relative; top: 1px;"
                                } else {
                                    "padding: 4px 12px; background: #fafafa; border: 1px solid #e0e0e0; border-top-left-radius: 4px; border-top-right-radius: 4px; cursor: pointer; margin-right: 2px;"
                                }
                            }
                        >
                            {move || if is_editing() {
                                view! {
                                    <input
                                        type="text"
                                        value=edit_name
                                        on:input=move |ev| set_edit_name.set(event_target_value(&ev))
                                        on:blur=move |_| finish_rename(sheet_id)
                                        on:keydown=move |ev| {
                                            if ev.key() == "Enter" {
                                                finish_rename(sheet_id);
                                            } else if ev.key() == "Escape" {
                                                set_editing_sheet.set(None);
                                            }
                                        }
                                        style="border: none; outline: none; background: transparent; width: 80px;"
                                        autofocus
                                    />
                                }.into_view()
                            } else {
                                view! {
                                    <span on:dblclick=move |_| start_rename(sheet_id)>
                                        {sheet_name.clone()}
                                    </span>
                                }.into_view()
                            }}
                        </div>
                    }
                }).collect::<Vec<_>>()}
            </div>
            
            <button 
                on:click=add_sheet
                style="margin-left: 8px; padding: 2px 8px; cursor: pointer; background: transparent; border: 1px solid #e0e0e0; border-radius: 3px;"
                title="Add new sheet"
            >
                "+"
            </button>
            
            // Context menu
            {move || if show_context_menu.get() {
                let (x, y) = context_menu_pos.get();
                let menu_sheet = context_menu_sheet.get();
                view! {
                    <div
                        style=format!("position: fixed; left: {}px; top: {}px; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000; min-width: 150px;", x, y)
                        on:click=move |ev| ev.stop_propagation()
                    >
                        <div
                            on:click=move |_| start_rename(menu_sheet)
                            style="padding: 8px 12px; cursor: pointer; hover:background: #f5f5f5;"
                            onmouseover="this.style.background='#f5f5f5'"
                            onmouseout="this.style.background='white'"
                        >
                            "Rename"
                        </div>
                        <div
                            on:click=move |_| duplicate_sheet(menu_sheet)
                            style="padding: 8px 12px; cursor: pointer;"
                            onmouseover="this.style.background='#f5f5f5'"
                            onmouseout="this.style.background='white'"
                        >
                            "Duplicate"
                        </div>
                        <div style="border-top: 1px solid #e0e0e0; margin: 4px 0;"></div>
                        <div
                            on:click=move |_| delete_sheet(menu_sheet)
                            style="padding: 8px 12px; cursor: pointer; color: #d32f2f;"
                            onmouseover="this.style.background='#ffebee'"
                            onmouseout="this.style.background='white'"
                        >
                            "Delete"
                        </div>
                    </div>
                }.into_view()
            } else {
                view! { }.into_view()
            }}
        </div>
    }
}
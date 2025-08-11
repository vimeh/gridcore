use gridcore_controller::controller::SpreadsheetController;
use gridcore_controller::state::Action;
use leptos::either::Either;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;
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
    let (show_context_menu, set_show_context_menu) = signal(false);
    let (context_menu_sheet, set_context_menu_sheet) = signal(0usize);
    let (context_menu_pos, set_context_menu_pos) = signal((0.0, 0.0));
    let (editing_sheet, set_editing_sheet) = signal(None::<usize>);
    let (edit_name, set_edit_name) = signal(String::new());

    // Get controller from context
    let controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> =
        use_context().expect("SpreadsheetController not found in context");
    let controller = controller_stored.get_value();

    // Add new sheet
    let controller_for_add = controller.clone();
    let add_sheet = move |_| {
        let sheet_count = sheets.get().len();
        let new_name = format!("Sheet{}", sheet_count + 1);
        controller_for_add
            .borrow_mut()
            .dispatch_action(Action::AddSheet { name: new_name })
            .unwrap_or_else(|e| {
                leptos::logging::log!("Error adding sheet: {}", e);
            });
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
        let sheet_name = sheets
            .get()
            .iter()
            .find(|s| s.id == sheet_id)
            .map(|s| s.name.clone())
            .unwrap_or_default();
        set_edit_name.set(sheet_name);
        set_editing_sheet.set(Some(sheet_id));
        set_show_context_menu.set(false);
    };

    // Store sheets and edit name in signals that can be captured
    let sheets_for_rename = sheets;
    let edit_name_for_rename = edit_name;
    let set_editing_for_rename = set_editing_sheet;

    // Store sheets and context menu setter for delete
    let sheets_for_delete = sheets;
    let set_show_context_for_delete = set_show_context_menu;

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
                            on:click=move |_| {
                                let controller = controller_stored.get_value();
                                let sheet_name_for_click = sheets.get()
                                    .iter()
                                    .find(|s| s.id == sheet_id)
                                    .map(|s| s.name.clone())
                                    .unwrap_or_default();
                                controller.borrow_mut()
                                    .dispatch_action(Action::SetActiveSheet { name: sheet_name_for_click })
                                    .unwrap_or_else(|e| {
                                        leptos::logging::log!("Error switching sheet: {}", e);
                                    });
                                set_active_sheet.set(sheet_id);
                            }
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
                                Either::Left(view! {
                                    <input
                                        type="text"
                                        value=edit_name
                                        on:input=move |ev| set_edit_name.set(event_target_value(&ev))
                                        on:blur=move |_| {
                                            let controller = controller_stored.get_value();
                                            let new_name = edit_name_for_rename.get();
                                            if !new_name.is_empty() {
                                                let old_name = sheets_for_rename.get()
                                                    .iter()
                                                    .find(|s| s.id == sheet_id)
                                                    .map(|s| s.name.clone())
                                                    .unwrap_or_default();

                                                controller.borrow_mut()
                                                    .dispatch_action(Action::RenameSheet {
                                                        old_name,
                                                        new_name
                                                    })
                                                    .unwrap_or_else(|e| {
                                                        leptos::logging::log!("Error renaming sheet: {}", e);
                                                    });
                                            }
                                            set_editing_for_rename.set(None);
                                        }
                                        on:keydown=move |ev| {
                                            if ev.key() == "Enter" {
                                                let controller = controller_stored.get_value();
                                                let new_name = edit_name_for_rename.get();
                                                if !new_name.is_empty() {
                                                    let old_name = sheets_for_rename.get()
                                                        .iter()
                                                        .find(|s| s.id == sheet_id)
                                                        .map(|s| s.name.clone())
                                                        .unwrap_or_default();

                                                    controller.borrow_mut()
                                                        .dispatch_action(Action::RenameSheet {
                                                            old_name,
                                                            new_name
                                                        })
                                                        .unwrap_or_else(|e| {
                                                            leptos::logging::log!("Error renaming sheet: {}", e);
                                                        });
                                                }
                                                set_editing_for_rename.set(None);
                                            } else if ev.key() == "Escape" {
                                                set_editing_sheet.set(None);
                                            }
                                        }
                                        style="border: none; outline: none; background: transparent; width: 80px;"
                                        autofocus
                                    />
                                })
                            } else {
                                Either::Right(view! {
                                    <span on:dblclick=move |_| start_rename(sheet_id)>
                                        {sheet_name.clone()}
                                    </span>
                                })
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
            <Show when=move || show_context_menu.get()>
                {move || {
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
                                on:click=move |_| {
                                    let controller = controller_stored.get_value();
                                    let sheet_name = sheets_for_delete.get()
                                        .iter()
                                        .find(|s| s.id == menu_sheet)
                                        .map(|s| s.name.clone())
                                        .unwrap_or_default();

                                    controller.borrow_mut()
                                        .dispatch_action(Action::RemoveSheet { name: sheet_name })
                                        .unwrap_or_else(|e| {
                                            leptos::logging::log!("Error deleting sheet: {}", e);
                                        });
                                    set_show_context_for_delete.set(false);
                                }
                                style="padding: 8px 12px; cursor: pointer; color: #d32f2f;"
                                onmouseover="this.style.background='#ffebee'"
                                onmouseout="this.style.background='white'"
                            >
                                "Delete"
                            </div>
                        </div>
                    }
                }}
            </Show>
        </div>
    }
}

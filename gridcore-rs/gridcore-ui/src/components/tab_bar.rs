use leptos::*;

#[component]
pub fn TabBar(
    active_sheet: ReadSignal<usize>,
    on_sheet_change: impl Fn(usize) + 'static,
) -> impl IntoView {
    let sheets = vec!["Sheet1", "Sheet2", "Sheet3"];
    
    view! {
        <div class="tab-bar" style="display: flex; align-items: center; padding: 0 8px; background: #f5f5f5;">
            {sheets.into_iter().enumerate().map(|(idx, name)| {
                let is_active = move || active_sheet.get() == idx;
                view! {
                    <button
                        on:click=move |_| on_sheet_change(idx)
                        style=move || {
                            if is_active() {
                                "padding: 4px 12px; background: white; border: 1px solid #e0e0e0; border-bottom: none; cursor: pointer;"
                            } else {
                                "padding: 4px 12px; background: transparent; border: 1px solid transparent; cursor: pointer;"
                            }
                        }
                    >
                        {name}
                    </button>
                }
            }).collect::<Vec<_>>()}
            
            <button 
                style="margin-left: 8px; padding: 2px 8px; cursor: pointer;"
                title="Add new sheet"
            >
                "+"
            </button>
        </div>
    }
}
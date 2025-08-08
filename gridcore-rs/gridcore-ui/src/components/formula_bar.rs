use leptos::*;

#[component]
pub fn FormulaBar(
    value: ReadSignal<String>,
    on_change: impl Fn(String) + 'static,
) -> impl IntoView {
    view! {
        <div class="formula-bar" style="display: flex; align-items: center; padding: 4px; border-bottom: 1px solid #e0e0e0;">
            <span style="padding: 0 8px; font-weight: bold;">fx</span>
            <input
                type="text"
                prop:value=value
                on:input=move |ev| on_change(event_target_value(&ev))
                style="flex: 1; border: 1px solid #e0e0e0; padding: 4px; font-family: monospace;"
                placeholder="Enter formula or value"
            />
        </div>
    }
}
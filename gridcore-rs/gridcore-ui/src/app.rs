use leptos::*;

#[component]
pub fn App() -> impl IntoView {
    // For now, create a simple placeholder UI
    // The full implementation will require proper WASM bindings
    // and integration with the Rust controller

    view! {
        <div class="spreadsheet-app">
            <div class="top-toolbar">
                <div class="formula-bar">
                    <span>"fx"</span>
                    <input type="text" placeholder="Formula bar"/>
                </div>
            </div>

            <div class="main-content">
                <div style="padding: 20px;">
                    <h2>"GridCore Leptos UI"</h2>
                    <p>"Spreadsheet interface coming soon..."</p>
                    <canvas
                        width="800"
                        height="600"
                        style="border: 1px solid #ccc; background: white;"
                    />
                </div>
            </div>

            <div class="bottom-toolbar">
                <div class="tab-bar">
                    <button>"Sheet1"</button>
                    <button>"+"</button>
                </div>
                <div class="status-bar">
                    <span>"Ready"</span>
                </div>
            </div>
        </div>
    }
}

use crate::components::error_display::ErrorDisplay;
use crate::components::grid_container::GridContainer;
use crate::components::status_bar::StatusBar;
use crate::components::tab_bar::{Sheet, TabBar};
use crate::reactive::ReactiveState;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_core::types::CellAddress;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

#[cfg(feature = "demo")]
use crate::{DemoProgressBar, PerformanceOverlay};
#[cfg(feature = "demo")]
use gridcore_demo::demo::performance::Metrics;
#[cfg(feature = "demo")]
use gridcore_demo::DemoController;

#[component]
pub fn App() -> impl IntoView {
    // Initialize wasm-logger once for the entire application
    wasm_logger::init(wasm_logger::Config::default());

    // Set panic hook for better error messages
    #[cfg(feature = "debug")]
    console_error_panic_hook::set_once();

    // Create the SpreadsheetController
    let controller = Rc::new(RefCell::new(SpreadsheetController::new()));
    let controller_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());
    provide_context(controller_stored);

    // Demo feature state
    #[cfg(feature = "demo")]
    let demo_state = create_demo_state();

    // We'll initialize test data after ErrorDisplay is available
    let init_data = RwSignal::new(false);

    // Create reactive state that tracks controller changes
    let reactive_state = ReactiveState::new(controller.clone());
    provide_context(reactive_state.generation);
    provide_context(reactive_state.render_generation);

    // Create derived signals that automatically track state changes
    let active_cell = Signal::derive(move || {
        reactive_state.generation.get(); // Track changes
        controller_stored.with_value(|ctrl| ctrl.borrow().cursor())
    });

    let formula_bar_value = Signal::derive(move || {
        reactive_state.generation.get(); // Track changes
        controller_stored.with_value(|ctrl| ctrl.borrow().get_formula_bar_value().to_string())
    });

    // The reactive state already subscribes to events, no need for separate listener

    let _current_mode = Signal::derive(move || {
        reactive_state.generation.get(); // Track changes
        controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().to_spreadsheet_mode())
    });

    let sheets = Memo::new(move |_| {
        reactive_state.generation.get(); // Track changes
        controller_stored.with_value(|ctrl| {
            ctrl.borrow()
                .get_sheets()
                .into_iter()
                .map(|(name, id)| Sheet { id, name })
                .collect::<Vec<_>>()
        })
    });

    let active_sheet = Memo::new(move |_| {
        reactive_state.generation.get(); // Track changes
        0usize
    });

    // Handle formula bar Enter key
    let on_formula_submit = move |ev: web_sys::KeyboardEvent| {
        if ev.key() == "Enter" {
            ev.prevent_default();
            controller_stored.with_value(|ctrl| {
                ctrl.borrow_mut()
                    .dispatch_action(gridcore_controller::state::Action::SubmitFormulaBar)
                    .unwrap_or_else(|e| {
                        leptos::logging::log!("Error submitting formula bar: {}", e);
                    });
            });
        }
    };

    // Initialize test data with error handling after ErrorDisplay is mounted
    Effect::new(move |_| {
        if !init_data.get() {
            init_data.set(true);

            controller_stored.with_value(|ctrl| {
                {
                    let ctrl_borrow = ctrl.borrow();
                    let facade = ctrl_borrow.facade();

                    // Initialize test data with proper error handling
                    let test_data = vec![
                        (CellAddress::new(0, 0), "Hello"),  // A1
                        (CellAddress::new(1, 0), "World"),  // B1
                        (CellAddress::new(0, 1), "123"),    // A2
                        (CellAddress::new(1, 1), "123"),    // B2
                        (CellAddress::new(2, 1), "=A2+B2"), // C2
                    ];

                    for (address, value) in test_data {
                        if let Err(e) = facade.set_cell_value(&address, value) {
                            leptos::logging::log!("Failed to initialize cell: {}", e);
                        }
                    }
                }

                // Update formula bar to show initial cell value
                ctrl.borrow_mut().update_formula_bar_from_cursor();
            });
        }
    });

    view! {
        <div class="spreadsheet-app">
            <div class="top-toolbar">
                <div class="toolbar-row">
                    <label style="margin-left: 20px;">
                        <input
                            type="checkbox"
                            on:change=move |ev| {
                                let checked = event_target_checked(&ev);
                                crate::debug::set_debug_mode(checked);
                            }
                        />
                        " Debug Mode"
                    </label>

                    // Demo toolbar (only when demo feature is enabled)
                    {
                        #[cfg(feature = "demo")]
                        {
                            create_demo_toolbar(demo_state.clone(), controller_stored)
                        }
                        #[cfg(not(feature = "demo"))]
                        {
                            view! { <span></span> }
                        }
                    }
                </div>
                <div class="formula-bar">
                    <input
                        type="text"
                        class="cell-indicator"
                        value=move || {
                            let cell = active_cell.get();
                            let col = gridcore_core::types::CellAddress::column_number_to_label(cell.col);
                            let row = (cell.row + 1).to_string();
                            format!("{}{}", col, row)
                        }
                        readonly=true
                    />
                    <span class="formula-fx">"fx"</span>
                    <input
                        type="text"
                        class="formula-input"
                        placeholder="Enter formula or value"
                        value=move || formula_bar_value.get()
                        on:input=move |ev| {
                            let new_value = event_target_value(&ev);
                            controller.borrow_mut().dispatch_action(
                                gridcore_controller::state::Action::UpdateFormulaBar { value: new_value }
                            ).unwrap_or_else(|e| {
                                leptos::logging::log!("Error updating formula bar: {}", e);
                            });
                        }
                        on:keydown=on_formula_submit
                    />
                </div>
            </div>

            <div class="main-content">
                <GridContainer />
            </div>

            <div class="bottom-toolbar">
                <TabBar
                    sheets=sheets
                    active_sheet=active_sheet
                />
                <StatusBar />

                // Demo overlay components (only when demo feature is enabled)
                {
                    #[cfg(feature = "demo")]
                    {
                        create_demo_overlay(demo_state.clone())
                    }
                    #[cfg(not(feature = "demo"))]
                    {
                        view! { <span></span> }
                    }
                }
            </div>

            // Benchmark results overlay (only when demo feature is enabled)
            {
                #[cfg(feature = "demo")]
                {
                    create_benchmark_overlay(demo_state.clone())
                }
                #[cfg(not(feature = "demo"))]
                {
                    view! { <span></span> }
                }
            }

            // Add error display overlay
            <ErrorDisplay />
        </div>
    }
}

// Demo-specific state and UI functions
#[cfg(feature = "demo")]
#[derive(Clone)]
struct DemoState {
    demo_controller: StoredValue<Rc<RefCell<DemoController>>, LocalStorage>,
    demo_mode: RwSignal<bool>,
    demo_scenario: RwSignal<String>,
    demo_running: RwSignal<bool>,
    demo_metrics: RwSignal<Metrics>,
    demo_current_step: RwSignal<usize>,
    demo_total_steps: RwSignal<usize>,
    show_performance: RwSignal<bool>,
    benchmark_running: RwSignal<bool>,
    benchmark_results: RwSignal<String>,
    show_benchmark_results: RwSignal<bool>,
    demo_interval_handle:
        StoredValue<Option<leptos::leptos_dom::helpers::IntervalHandle>, LocalStorage>,
    fps_interval_handle:
        StoredValue<Option<leptos::leptos_dom::helpers::IntervalHandle>, LocalStorage>,
}

#[cfg(feature = "demo")]
fn create_demo_state() -> DemoState {
    DemoState {
        demo_controller: StoredValue::new_local(Rc::new(RefCell::new(DemoController::new()))),
        demo_mode: RwSignal::new(false),
        demo_scenario: RwSignal::new(String::from("Basic Operations")),
        demo_running: RwSignal::new(false),
        demo_metrics: RwSignal::new(Metrics::default()),
        demo_current_step: RwSignal::new(0usize),
        demo_total_steps: RwSignal::new(0usize),
        show_performance: RwSignal::new(false),
        benchmark_running: RwSignal::new(false),
        benchmark_results: RwSignal::new(String::new()),
        show_benchmark_results: RwSignal::new(false),
        demo_interval_handle: StoredValue::new_local(None),
        fps_interval_handle: StoredValue::new_local(None),
    }
}

#[cfg(feature = "demo")]
fn create_demo_toolbar(
    demo_state: DemoState,
    controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage>,
) -> impl IntoView {
    let demo_state_for_benchmark = demo_state.clone();
    let demo_state_for_benchmark_text = demo_state.clone();
    let demo_state_for_benchmark_disabled = demo_state.clone();

    view! {
        <>
            <label style="margin-left: 10px;">
                <input
                    type="checkbox"
                    prop:checked=move || demo_state.demo_mode.get()
                    on:change=move |ev| {
                        let checked = event_target_checked(&ev);
                        demo_state.demo_mode.set(checked);
                    }
                />
                " Demo Mode"
            </label>

            // Demo controls shown when demo mode is active
            <Show
                when=move || demo_state.demo_mode.get()
                fallback=|| view! { <span></span> }
            >
                {
                    let demo_state_inner = demo_state.clone();
                    let demo_state_toggle = demo_state.clone();
                    let demo_state_perf = demo_state.clone();

                    view! {
                        <div style="display: inline-block; margin-left: 20px;">
                            // Demo scenario selector and controls
                            <select
                                on:change=move |ev| {
                                    let value = event_target_value(&ev);
                                    demo_state_inner.demo_scenario.set(value);
                                }
                            >
                                <option value="Basic Operations">"Basic Operations"</option>
                                <option value="Formula Engine">"Formula Engine"</option>
                                <option value="Large Dataset">"Large Dataset"</option>
                                <option value="Financial Dashboard">"Financial Dashboard"</option>
                                <option value="Scientific Data">"Scientific Data"</option>
                                <option value="Fill Operations">"Fill Operations"</option>
                                <option value="Performance Stress Test">"Performance Stress Test"</option>
                                <option value="Error Handling">"Error Handling"</option>
                            </select>

                            // Start/Stop button
                            <button
                                style="margin-left: 10px;"
                                on:click=move |_| {
                                    handle_demo_toggle(demo_state_toggle.clone(), controller_stored);
                                }
                            >
                                {move || if demo_state.demo_running.get() { "Stop" } else { "Start" }}
                            </button>

                            // Performance toggle
                            <button
                                style="margin-left: 5px;"
                                on:click=move |_| {
                                    demo_state_perf.show_performance.set(!demo_state_perf.show_performance.get());
                                }
                            >
                                "Performance"
                            </button>
                        </div>
                    }
                }
            </Show>

            // Benchmark controls
            <div style="display: inline-block; margin-left: 20px; border-left: 1px solid #ccc; padding-left: 20px;">
                <button
                    style="margin-right: 10px;"
                    disabled=move || demo_state_for_benchmark_disabled.benchmark_running.get()
                    on:click={
                        move |_| {
                            run_quick_benchmark(demo_state_for_benchmark.clone(), controller_stored);
                        }
                    }
                >
                    {move || if demo_state_for_benchmark_text.benchmark_running.get() { "Running..." } else { "Quick Benchmark" }}
                </button>
            </div>
        </>
    }
}

#[cfg(feature = "demo")]
fn create_demo_overlay(demo_state: DemoState) -> impl IntoView {
    view! {
        <>
            <DemoProgressBar
                current_step=Signal::from(demo_state.demo_current_step)
                total_steps=Signal::from(demo_state.demo_total_steps)
                scenario_name=Signal::from(demo_state.demo_scenario)
                is_running=Signal::from(demo_state.demo_running)
            />
            <PerformanceOverlay
                metrics=Signal::from(demo_state.demo_metrics)
                visible=Signal::from(demo_state.show_performance)
            />
        </>
    }
}

#[cfg(feature = "demo")]
fn create_benchmark_overlay(demo_state: DemoState) -> impl IntoView {
    view! {
        <Show
            when=move || demo_state.show_benchmark_results.get()
            fallback=|| ()
        >
            <div
                style="position: fixed; top: 100px; right: 20px; width: 400px; max-height: 600px; \
                       background: white; border: 2px solid #333; border-radius: 8px; \
                       box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 20px; \
                       overflow-y: auto; z-index: 1000; font-family: monospace; font-size: 12px;"
            >
                <h3 style="margin-top: 0; font-size: 16px;">Benchmark Results</h3>
                <pre style="white-space: pre-wrap; margin: 0;">{move || demo_state.benchmark_results.get()}</pre>
                <button
                    style="margin-top: 15px; padding: 5px 10px;"
                    on:click=move |_| demo_state.show_benchmark_results.set(false)
                >
                    "Close"
                </button>
            </div>
        </Show>
    }
}

#[cfg(feature = "demo")]
fn handle_demo_toggle(
    demo_state: DemoState,
    controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage>,
) {
    let scenario = demo_state.demo_scenario.get();

    demo_state.demo_controller.with_value(|demo| {
        let mut demo = demo.borrow_mut();

        if demo_state.demo_running.get() {
            // Stop the demo
            demo.stop_demo();
            demo_state.demo_running.set(false);

            // Clear intervals
            demo_state.demo_interval_handle.update_value(|handle| {
                if let Some(h) = handle.take() {
                    h.clear();
                }
            });
            demo_state.fps_interval_handle.update_value(|handle| {
                if let Some(h) = handle.take() {
                    h.clear();
                }
            });
        } else {
            // Start the demo
            controller_stored.with_value(|ctrl| {
                match demo.start_demo(&scenario, ctrl.clone()) {
                    Ok(_) => {
                        demo_state.demo_running.set(true);
                        demo_state.demo_current_step.set(demo.get_current_step());
                        demo_state.demo_total_steps.set(demo.get_total_steps());
                        let metrics = demo.get_performance_metrics();
                        demo_state.demo_metrics.set(metrics);

                        // Set up demo runner interval
                        // Note: In a real implementation, you'd set up the intervals here
                    }
                    Err(e) => {
                        leptos::logging::log!("Failed to start demo: {}", e);
                    }
                }
            });
        }
    });
}

#[cfg(feature = "demo")]
fn run_quick_benchmark(
    demo_state: DemoState,
    controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage>,
) {
    demo_state.benchmark_running.set(true);
    demo_state.show_benchmark_results.set(false);

    demo_state.demo_controller.with_value(|demo| {
        controller_stored.with_value(|ctrl| {
            let mut demo = demo.borrow_mut();

            match demo.run_quick_benchmark(ctrl.clone()) {
                Ok(results) => {
                    demo_state.benchmark_results.set(results);
                    demo_state.show_benchmark_results.set(true);
                }
                Err(e) => {
                    demo_state
                        .benchmark_results
                        .set(format!("Benchmark failed: {}", e));
                    demo_state.show_benchmark_results.set(true);
                }
            }

            demo_state.benchmark_running.set(false);
        });
    });
}

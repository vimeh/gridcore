use crate::components::canvas_grid::CanvasGrid;
use crate::components::error_display::ErrorDisplay;
use crate::components::performance_overlay::{DemoProgressBar, PerformanceOverlay};
use crate::components::status_bar::StatusBar;
use crate::components::tab_bar::{Sheet, TabBar};
use crate::demo::performance::Metrics;
use crate::demo::DemoController;
use gridcore_controller::controller::SpreadsheetController;
use gridcore_core::types::CellAddress;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

#[component]
pub fn App() -> impl IntoView {
    // Initialize wasm-logger once for the entire application
    wasm_logger::init(wasm_logger::Config::default());

    // Set panic hook for better error messages
    #[cfg(feature = "debug")]
    console_error_panic_hook::set_once();

    // Create the SpreadsheetController
    let controller = Rc::new(RefCell::new(SpreadsheetController::new()));

    // Create the DemoController
    let demo_controller = Rc::new(RefCell::new(DemoController::new()));

    // We'll initialize test data after ErrorDisplay is available
    let init_data = RwSignal::new(false);

    let controller_stored = StoredValue::<_, LocalStorage>::new_local(controller.clone());
    provide_context(controller_stored);

    let demo_controller_stored = StoredValue::<_, LocalStorage>::new_local(demo_controller);

    // Demo mode state
    let (demo_mode, set_demo_mode) = signal(false);
    let (demo_scenario, set_demo_scenario) = signal(String::from("Basic Operations"));
    let (demo_running, set_demo_running) = signal(false);
    let (demo_metrics, set_demo_metrics) = signal(Metrics::default());
    let (demo_current_step, set_demo_current_step) = signal(0usize);
    let (demo_total_steps, set_demo_total_steps) = signal(0usize);
    let (show_performance, set_show_performance) = signal(false);

    // Benchmark state
    let (benchmark_running, set_benchmark_running) = signal(false);
    let (benchmark_results, set_benchmark_results) = signal(String::new());
    let (show_benchmark_results, set_show_benchmark_results) = signal(false);

    // Store the interval handles for the demo runner
    let demo_interval_handle =
        StoredValue::new_local(None::<leptos::leptos_dom::helpers::IntervalHandle>);
    let fps_interval_handle =
        StoredValue::new_local(None::<leptos::leptos_dom::helpers::IntervalHandle>);

    // Fine-grained reactive triggers for different state aspects
    // These notify memos when specific state changes occur
    let cursor_trigger = Trigger::new();
    let mode_trigger = Trigger::new();
    let formula_trigger = Trigger::new();
    let selection_trigger = Trigger::new();
    let sheets_trigger = Trigger::new();
    let error_trigger = Trigger::new();
    let render_trigger = Trigger::new(); // For components that need to force re-render

    // Create reactive memos that derive state directly from controller
    // No more duplicate signals - just reactive accessors
    let active_cell = Memo::new(move |_| {
        cursor_trigger.track(); // Track cursor changes only
        controller_stored.with_value(|ctrl| ctrl.borrow().cursor())
    });

    let formula_bar_value = Memo::new(move |_| {
        formula_trigger.track(); // Track formula bar changes only
        controller_stored.with_value(|ctrl| ctrl.borrow().get_formula_bar_value().to_string())
    });

    // Set up comprehensive controller event listener
    {
        let callback = Box::new(
            move |event: &gridcore_controller::controller::events::SpreadsheetEvent| {
                use gridcore_controller::controller::events::SpreadsheetEvent;

                leptos::logging::log!("Controller event received: {:?}", event);

                // Notify specific triggers based on event type for fine-grained reactivity
                match event {
                    SpreadsheetEvent::CursorMoved { .. } => {
                        cursor_trigger.notify();
                        // Also trigger render to update selection in visual mode
                        render_trigger.notify();
                    }
                    SpreadsheetEvent::StateChanged | SpreadsheetEvent::CommandExecuted { .. } => {
                        mode_trigger.notify();
                        // State changes may affect multiple things
                        cursor_trigger.notify();
                        selection_trigger.notify();
                        // Also notify error trigger as errors might have been removed
                        error_trigger.notify();
                        // Trigger render for visual selection changes
                        render_trigger.notify();
                    }
                    SpreadsheetEvent::FormulaBarUpdated { .. } => {
                        formula_trigger.notify();
                    }
                    SpreadsheetEvent::CellEditCompleted { .. }
                    | SpreadsheetEvent::EditCanceled { .. } => {
                        // Cell editing affects both formula bar and mode
                        formula_trigger.notify();
                        mode_trigger.notify();
                    }
                    SpreadsheetEvent::SheetAdded { .. }
                    | SpreadsheetEvent::SheetRemoved { .. }
                    | SpreadsheetEvent::SheetRenamed { .. }
                    | SpreadsheetEvent::SheetChanged { .. } => {
                        sheets_trigger.notify();
                    }
                    SpreadsheetEvent::ErrorOccurred { .. } => {
                        error_trigger.notify();
                    }
                }

                // Log specific events for debugging
                if let SpreadsheetEvent::CursorMoved { to, .. } = event {
                    leptos::logging::log!("CursorMoved event: {:?}", to);
                }

                if let SpreadsheetEvent::FormulaBarUpdated { value } = event {
                    leptos::logging::log!("Formula bar updated: {}", value);
                }

                if let SpreadsheetEvent::ErrorOccurred { message, severity } = event {
                    leptos::logging::log!(
                        "ErrorOccurred event received: {} ({:?})",
                        message,
                        severity
                    );
                }

                // ErrorDismissed event was removed in simplification
            },
        );
        controller.borrow_mut().subscribe_to_events(callback);
    }

    // Create reactive memo for current mode - derives directly from controller
    let current_mode = Memo::new(move |_| {
        mode_trigger.track(); // Track mode changes only
        controller_stored.with_value(|ctrl| ctrl.borrow().get_mode().to_spreadsheet_mode())
    });

    // Sheet management - reactive memos deriving from controller
    let sheets = Memo::new(move |_| {
        sheets_trigger.track(); // Track sheet changes only
        controller_stored.with_value(|ctrl| {
            ctrl.borrow()
                .get_sheets()
                .into_iter()
                .map(|(name, id)| Sheet { id, name })
                .collect::<Vec<_>>()
        })
    });

    let active_sheet = Memo::new(move |_| {
        sheets_trigger.track(); // Track sheet changes only
                                // For now, we'll use index 0 - this should be improved to track actual active sheet
        0usize
    });

    // Derive selection stats from controller state
    let selection_stats = Memo::new(move |_| {
        selection_trigger.track(); // Track selection changes only
        controller_stored.with_value(|ctrl| ctrl.borrow().get_current_selection_stats())
    });

    // Handle formula bar Enter key
    let on_formula_submit = move |ev: web_sys::KeyboardEvent| {
        if ev.key() == "Enter" {
            ev.prevent_default();

            // Submit formula bar through controller action
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
                            // Error will be displayed through controller events
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
                    <label style="margin-left: 10px;">
                        <input
                            type="checkbox"
                            prop:checked=move || demo_mode.get()
                            on:change=move |ev| {
                                let checked = event_target_checked(&ev);
                                set_demo_mode.set(checked);
                                leptos::logging::log!("Demo mode toggled: {}", checked);
                            }
                        />
                        " Demo Mode"
                    </label>
                    <Show
                        when=move || demo_mode.get()
                        fallback=|| view! { <span></span> }
                    >
                        <div style="display: inline-block; margin-left: 20px;">
                            <select
                                on:change=move |ev| {
                                    let value = event_target_value(&ev);
                                    set_demo_scenario.set(value);
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
                            <button
                                style="margin-left: 10px;"
                                on:click=move |_| {
                                    let scenario = demo_scenario.get();

                                    demo_controller_stored.with_value(|demo| {
                                        let mut demo = demo.borrow_mut();

                                        if demo_running.get() {
                                            // Stop the demo
                                            demo.stop_demo();
                                            set_demo_running.set(false);

                                            // Clear both intervals if running
                                            demo_interval_handle.update_value(|handle| {
                                                if let Some(h) = handle.take() {
                                                    h.clear();
                                                }
                                            });
                                            fps_interval_handle.update_value(|handle| {
                                                if let Some(h) = handle.take() {
                                                    h.clear();
                                                }
                                            });

                                            leptos::logging::log!("Demo stopped");
                                        } else {
                                            controller_stored.with_value(|ctrl| {
                                                match demo.start_demo(&scenario, ctrl.clone()) {
                                                    Ok(_) => {
                                                        set_demo_running.set(true);
                                                        set_demo_current_step.set(demo.get_current_step());
                                                        set_demo_total_steps.set(demo.get_total_steps());
                                                        let metrics = demo.get_performance_metrics();
                                                        set_demo_metrics.set(metrics);
                                                        leptos::logging::log!("Demo started: {}", scenario);

                                                        // Set up a separate interval for FPS tracking (60fps target)
                                                        let fps_interval = leptos::leptos_dom::helpers::set_interval_with_handle(
                                                            move || {
                                                                demo_controller_stored.with_value(|demo| {
                                                                    let mut demo = demo.borrow_mut();
                                                                    // Just update the metrics to record frames
                                                                    let metrics = demo.get_performance_metrics();
                                                                    set_demo_metrics.set(metrics);
                                                                });
                                                            },
                                                            std::time::Duration::from_millis(16), // ~60 FPS
                                                        ).ok();

                                                        // Store the FPS interval handle
                                                        fps_interval_handle.set_value(fps_interval);

                                                        // Set up interval for continuous execution
                                                        let interval_handle = leptos::leptos_dom::helpers::set_interval_with_handle(
                                                            move || {
                                                                demo_controller_stored.with_value(|demo| {
                                                                    controller_stored.with_value(|ctrl| {
                                                                        let mut demo = demo.borrow_mut();

                                                                        // Check if still running
                                                                        if demo.is_running() {
                                                                            demo.step_forward(ctrl.clone());

                                                                            // Update UI state
                                                                            set_demo_current_step.set(demo.get_current_step());
                                                                            set_demo_total_steps.set(demo.get_total_steps());

                                                                            // Check if demo completed
                                                                            if !demo.is_running() {
                                                                                set_demo_running.set(false);
                                                                                // Clear both intervals when done
                                                                                demo_interval_handle.update_value(|handle| {
                                                                                    if let Some(h) = handle.take() {
                                                                                        h.clear();
                                                                                    }
                                                                                });
                                                                                fps_interval_handle.update_value(|handle| {
                                                                                    if let Some(h) = handle.take() {
                                                                                        h.clear();
                                                                                    }
                                                                                });
                                                                            }
                                                                        }
                                                                    });
                                                                });
                                                            },
                                                            std::time::Duration::from_millis(100), // Run every 100ms by default
                                                        ).ok();

                                                        // Store the interval handle
                                                        demo_interval_handle.set_value(interval_handle);
                                                    }
                                                    Err(e) => {
                                                        leptos::logging::log!("Failed to start demo: {}", e);
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            >
                                {move || if demo_running.get() { "Stop" } else { "Start" }}
                            </button>
                            <button
                                style="margin-left: 5px;"
                                on:click=move |_| {
                                    demo_controller_stored.with_value(|demo| {
                                        let mut demo = demo.borrow_mut();
                                        controller_stored.with_value(|ctrl| {
                                            demo.step_forward(ctrl.clone());
                                            // Update step counters
                                            set_demo_current_step.set(demo.get_current_step());
                                            set_demo_total_steps.set(demo.get_total_steps());
                                            let metrics = demo.get_performance_metrics();
                                            set_demo_metrics.set(metrics);
                                        });
                                    });
                                }
                            >
                                "Step"
                            </button>
                            <button
                                style="margin-left: 5px;"
                                on:click=move |_| {
                                    set_show_performance.set(!show_performance.get());
                                }
                            >
                                "Performance"
                            </button>
                        </div>
                    </Show>

                    // Benchmark controls
                    <div style="display: inline-block; margin-left: 20px; border-left: 1px solid #ccc; padding-left: 20px;">
                        <button
                            style="margin-right: 10px;"
                            disabled=move || benchmark_running.get()
                            on:click=move |_| {
                                set_benchmark_running.set(true);
                                set_show_benchmark_results.set(false);

                                demo_controller_stored.with_value(|demo| {
                                    controller_stored.with_value(|ctrl| {
                                        let mut demo = demo.borrow_mut();

                                        // Run quick benchmark
                                        match demo.run_quick_benchmark(ctrl.clone()) {
                                            Ok(results) => {
                                                set_benchmark_results.set(results);
                                                set_show_benchmark_results.set(true);
                                                leptos::logging::log!("Quick benchmark completed");
                                            }
                                            Err(e) => {
                                                set_benchmark_results.set(format!("Benchmark failed: {}", e));
                                                set_show_benchmark_results.set(true);
                                                leptos::logging::error!("Benchmark error: {}", e);
                                            }
                                        }

                                        set_benchmark_running.set(false);
                                    });
                                });
                            }
                        >
                            {move || if benchmark_running.get() { "Running..." } else { "Quick Benchmark" }}
                        </button>

                        <button
                            style="margin-right: 10px;"
                            disabled=move || benchmark_running.get()
                            on:click=move |_| {
                                set_benchmark_running.set(true);
                                set_show_benchmark_results.set(false);

                                let results_setter = set_benchmark_results;
                                let show_setter = set_show_benchmark_results;
                                let running_setter = set_benchmark_running;

                                demo_controller_stored.with_value(|demo| {
                                    controller_stored.with_value(|ctrl| {
                                        let mut demo = demo.borrow_mut();

                                        // Run full benchmark suite
                                        demo.run_full_benchmark(ctrl.clone(), move |report| {
                                            // Format the report
                                            let mut result_text = format!(
                                                "=== Benchmark Report ===\n\
                                                Total Scenarios: {}\n\
                                                Successful: {}\n\
                                                Failed: {}\n\
                                                Total Duration: {:.1}ms\n\n\
                                                === Performance ===\n\
                                                Avg FPS: {:.1}\n\
                                                P95 FPS: {:.1}\n\
                                                Avg Latency: {:.1}ms\n\
                                                P95 Latency: {:.1}ms\n\
                                                Memory Growth: {:.2}MB\n",
                                                report.summary.total_scenarios,
                                                report.summary.successful_runs,
                                                report.summary.failed_runs,
                                                report.summary.total_duration,
                                                report.summary.avg_fps,
                                                report.summary.p95_fps,
                                                report.summary.avg_latency,
                                                report.summary.p95_latency,
                                                report.summary.total_memory_growth
                                            );

                                            // Add warnings if any
                                            if !report.warnings.is_empty() {
                                                result_text.push_str("\n=== Warnings ===\n");
                                                for warning in &report.warnings {
                                                    result_text.push_str(&format!("⚠️ {}\n", warning));
                                                }
                                            }

                                            // Add suggestions if any
                                            if !report.suggestions.is_empty() {
                                                result_text.push_str("\n=== Suggestions ===\n");
                                                for suggestion in &report.suggestions {
                                                    result_text.push_str(&format!("💡 {}\n", suggestion));
                                                }
                                            }

                                            results_setter.set(result_text);
                                            show_setter.set(true);
                                            running_setter.set(false);
                                        });
                                    });
                                });
                            }
                        >
                            "Full Benchmark Suite"
                        </button>

                        <Show
                            when=move || show_benchmark_results.get()
                            fallback=|| ()
                        >
                            <button
                                style="margin-right: 10px;"
                                on:click=move |_| {
                                    set_show_benchmark_results.set(false);
                                }
                            >
                                "Hide Results"
                            </button>
                        </Show>
                    </div>
                </div>
                <div class="formula-bar">
                    <input
                        type="text"
                        class="cell-indicator"
                        value=move || {
                            let cell = active_cell.get();
                            // Use core's column label implementation for consistency
                            let col = gridcore_core::types::CellAddress::column_number_to_label(cell.col);
                            let row = (cell.row + 1).to_string();
                            let result = format!("{}{}", col, row);
                            leptos::logging::log!("Cell indicator update: col={}, row={}, display={}", cell.col, cell.row, result);
                            result
                        }
                        readonly=true
                    />
                    <span class="formula-fx">"fx"</span>
                    <input
                        type="text"
                        class="formula-input"
                        placeholder="Enter formula or value"
                        value=move || {
                            let value = formula_bar_value.get();
                            leptos::logging::log!("Formula bar value update: {}", value);
                            value
                        }
                        on:input=move |ev| {
                            let new_value = event_target_value(&ev);
                            leptos::logging::log!("Formula bar input change: {}", new_value);
                            // Update controller's formula bar value
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
                <CanvasGrid
                    active_cell=active_cell
                    current_mode=current_mode
                    render_trigger=render_trigger
                    mode_trigger=mode_trigger
                />
            </div>

            <div class="bottom-toolbar">
                <TabBar
                    sheets=sheets
                    active_sheet=active_sheet
                />
                <StatusBar
                    _current_mode=current_mode
                    selection_stats=selection_stats
                    selection_trigger=selection_trigger
                />
                <DemoProgressBar
                    current_step=Signal::from(demo_current_step)
                    total_steps=Signal::from(demo_total_steps)
                    scenario_name=Signal::from(demo_scenario)
                    is_running=Signal::from(demo_running)
                />
                <PerformanceOverlay
                    metrics=Signal::from(demo_metrics)
                    visible=Signal::from(show_performance)
                />
            </div>

            // Benchmark results overlay
            <Show
                when=move || show_benchmark_results.get()
                fallback=|| ()
            >
                <div
                    style="position: fixed; top: 100px; right: 20px; width: 400px; max-height: 600px; \
                           background: white; border: 2px solid #333; border-radius: 8px; \
                           box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 20px; \
                           overflow-y: auto; z-index: 1000; font-family: monospace; font-size: 12px;"
                >
                    <h3 style="margin-top: 0; font-size: 16px;">Benchmark Results</h3>
                    <pre style="white-space: pre-wrap; margin: 0;">{move || benchmark_results.get()}</pre>
                    <button
                        style="margin-top: 15px; padding: 5px 10px;"
                        on:click=move |_| set_show_benchmark_results.set(false)
                    >
                        "Close"
                    </button>
                </div>
            </Show>

            // Add error display overlay
            <ErrorDisplay error_trigger=error_trigger />
        </div>
    }
}

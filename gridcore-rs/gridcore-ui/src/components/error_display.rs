use gridcore_controller::controller::SpreadsheetController;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ErrorSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ErrorMessage {
    pub message: String,
    pub severity: ErrorSeverity,
    pub id: usize,
}

#[derive(Clone)]
pub struct ErrorContext {
    pub add_error: Callback<(String, ErrorSeverity)>,
    pub clear_errors: Callback<()>,
}

#[component]
pub fn ErrorDisplay(error_trigger: Trigger) -> impl IntoView {
    // Get controller from context
    let controller_stored: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> =
        use_context().expect("SpreadsheetController not found in context");

    // Derive errors from controller's ErrorManager
    let errors = Memo::new(move |_| {
        // Track error trigger to update when errors change
        error_trigger.track();

        controller_stored.with_value(|ctrl| {
            let ctrl_borrow = ctrl.borrow();
            let active_errors = ctrl_borrow.get_active_errors();

            // Convert from controller's ErrorEntry to our ErrorMessage
            active_errors
                .into_iter()
                .map(|entry| {
                    let severity = match entry.severity {
                        gridcore_controller::controller::events::ErrorSeverity::Error => {
                            ErrorSeverity::Error
                        }
                        gridcore_controller::controller::events::ErrorSeverity::Warning => {
                            ErrorSeverity::Warning
                        }
                        gridcore_controller::controller::events::ErrorSeverity::Info => {
                            ErrorSeverity::Info
                        }
                    };

                    ErrorMessage {
                        message: entry.message,
                        severity,
                        id: entry.id,
                    }
                })
                .collect::<Vec<_>>()
        })
    });

    // Provide context for other components (if needed)
    provide_context(ErrorContext {
        add_error: Callback::new(move |(message, severity): (String, ErrorSeverity)| {
            controller_stored.with_value(|ctrl| {
                let mut ctrl_borrow = ctrl.borrow_mut();
                let sev = match severity {
                    ErrorSeverity::Error => {
                        gridcore_controller::controller::events::ErrorSeverity::Error
                    }
                    ErrorSeverity::Warning => {
                        gridcore_controller::controller::events::ErrorSeverity::Warning
                    }
                    ErrorSeverity::Info => {
                        gridcore_controller::controller::events::ErrorSeverity::Info
                    }
                };
                ctrl_borrow.add_error(message, sev);
            });
        }),
        clear_errors: Callback::new(move |_| {
            controller_stored.with_value(|ctrl| {
                let mut ctrl_borrow = ctrl.borrow_mut();
                ctrl_borrow.clear_errors();
            });
        }),
    });

    view! {
        <div class="error-display-container">
            <For
                each=move || errors.get()
                key=|error| error.id
                children=move |error| {
                    let error_id = error.id;
                    let severity_class = match error.severity {
                        ErrorSeverity::Error => "error-message error",
                        ErrorSeverity::Warning => "error-message warning",
                        ErrorSeverity::Info => "error-message info",
                    };

                    view! {
                        <div class=severity_class role="alert">
                            <span class="error-text">{error.message.clone()}</span>
                            <button
                                class="error-dismiss"
                                aria-label="Dismiss error"
                                tabindex="0"
                                on:click=move |_| {
                                    controller_stored.with_value(|ctrl| {
                                        let mut ctrl_borrow = ctrl.borrow_mut();
                                        ctrl_borrow.remove_error(error_id);
                                        // Trigger state update
                                        ctrl_borrow.dispatch_event(
                                            gridcore_controller::controller::events::SpreadsheetEvent::StateChanged
                                        );
                                    });
                                }
                            >
                                "×"
                            </button>
                        </div>
                    }
                }
            />
        </div>
    }
}

impl ErrorContext {
    pub fn show_error(&self, message: impl Into<String>) {
        self.add_error.run((message.into(), ErrorSeverity::Error));
    }

    pub fn show_warning(&self, message: impl Into<String>) {
        self.add_error.run((message.into(), ErrorSeverity::Warning));
    }

    pub fn show_info(&self, message: impl Into<String>) {
        self.add_error.run((message.into(), ErrorSeverity::Info));
    }
}

// Helper function to use ErrorContext from components
pub fn use_error_context() -> Option<ErrorContext> {
    use_context::<ErrorContext>()
}

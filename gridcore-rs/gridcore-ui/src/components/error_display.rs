use leptos::*;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;

#[derive(Clone, Debug, PartialEq)]
pub enum ErrorSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Clone, Debug)]
pub struct ErrorMessage {
    pub message: String,
    pub severity: ErrorSeverity,
    pub id: usize,
}

#[component]
pub fn ErrorDisplay() -> impl IntoView {
    let (errors, set_errors) = create_signal::<Vec<ErrorMessage>>(Vec::new());
    let error_counter = create_rw_signal(0usize);

    // Provide context for other components to add errors
    provide_context(ErrorContext {
        add_error: Callback::new(move |(message, severity): (String, ErrorSeverity)| {
            let id = error_counter.get();
            error_counter.set(id + 1);
            
            let error = ErrorMessage {
                message,
                severity: severity.clone(),
                id,
            };
            
            set_errors.update(|errs| errs.push(error.clone()));
            
            // Auto-dismiss after 5 seconds for info, 10 seconds for warnings
            let window = web_sys::window().expect("no global window exists");
            match severity {
                ErrorSeverity::Info => {
                    let closure = Closure::once(move || {
                        set_errors.update(|errs| errs.retain(|e| e.id != id));
                    });
                    window
                        .set_timeout_with_callback_and_timeout_and_arguments_0(
                            closure.as_ref().unchecked_ref(),
                            5000,
                        )
                        .expect("should register setTimeout");
                    closure.forget();
                }
                ErrorSeverity::Warning => {
                    let closure = Closure::once(move || {
                        set_errors.update(|errs| errs.retain(|e| e.id != id));
                    });
                    window
                        .set_timeout_with_callback_and_timeout_and_arguments_0(
                            closure.as_ref().unchecked_ref(),
                            10000,
                        )
                        .expect("should register setTimeout");
                    closure.forget();
                }
                ErrorSeverity::Error => {
                    // Errors stay until manually dismissed
                }
            }
        }),
        clear_errors: Callback::new(move |_| {
            set_errors.set(Vec::new());
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
                        <div class=severity_class>
                            <span class="error-text">{error.message.clone()}</span>
                            <button
                                class="error-dismiss"
                                on:click=move |_| {
                                    set_errors.update(|errs| errs.retain(|e| e.id != error_id));
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

#[derive(Clone)]
pub struct ErrorContext {
    pub add_error: Callback<(String, ErrorSeverity)>,
    pub clear_errors: Callback<()>,
}

impl ErrorContext {
    pub fn show_error(&self, message: impl Into<String>) {
        self.add_error.call((message.into(), ErrorSeverity::Error));
    }

    pub fn show_warning(&self, message: impl Into<String>) {
        self.add_error.call((message.into(), ErrorSeverity::Warning));
    }

    pub fn show_info(&self, message: impl Into<String>) {
        self.add_error.call((message.into(), ErrorSeverity::Info));
    }
}

// Helper function to use ErrorContext from components
pub fn use_error_context() -> Option<ErrorContext> {
    use_context::<ErrorContext>()
}
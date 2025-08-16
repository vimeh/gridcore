use gridcore_controller::controller::SpreadsheetController;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

/// Application-wide state that components can access through Leptos context API.
/// This eliminates prop drilling while maintaining a single source of truth.
#[derive(Clone, Copy)]
pub struct AppState {
    /// The spreadsheet controller wrapped in StoredValue for stable reference
    pub controller: StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage>,
    /// Signal that increments when controller state changes
    pub state_generation: RwSignal<u32>,
    /// Signal that increments when render is needed
    pub render_generation: RwSignal<u32>,
}

/// Get the app state from context.
/// Panics if AppState was not provided in a parent component.
pub fn use_app_state() -> AppState {
    use_context::<AppState>().expect("AppState not found in context. Did you forget to provide it?")
}

/// Get the controller from context.
/// This is a convenience function that extracts the controller from AppState.
pub fn use_controller() -> StoredValue<Rc<RefCell<SpreadsheetController>>, LocalStorage> {
    use_app_state().controller
}

/// Get the reactive state signals from context.
/// Returns (state_generation, render_generation) tuple.
pub fn use_reactive_signals() -> (RwSignal<u32>, RwSignal<u32>) {
    let state = use_app_state();
    (state.state_generation, state.render_generation)
}

/// Get just the state generation signal from context.
pub fn use_state_generation() -> RwSignal<u32> {
    use_app_state().state_generation
}

/// Get just the render generation signal from context.
pub fn use_render_generation() -> RwSignal<u32> {
    use_app_state().render_generation
}

use super::grid_canvas::GridCanvas;
use super::grid_event_handler::GridEventHandler;
use super::grid_keyboard_handler::GridKeyboardHandler;
use super::grid_state_provider::{GridStateProvider, use_grid_state};
use crate::components::cell_editor::CellEditor;
use crate::interaction::resize_handler::ResizeHandler;
use leptos::prelude::*;

#[component]
pub fn GridContainer() -> impl IntoView {
    let resize_handler = ResizeHandler::new();

    view! {
        <GridStateProvider>
            <GridContainerInner resize_handler=resize_handler />
        </GridStateProvider>
    }
}

#[component]
fn GridContainerInner(resize_handler: ResizeHandler) -> impl IntoView {
    let grid_state = use_grid_state();

    view! {
        <GridKeyboardHandler>
            <GridEventHandler resize_handler=resize_handler>
                <GridCanvas />
                <CellEditor
                    active_cell=grid_state.active_cell
                    editing_mode=grid_state.editing_mode
                    cell_position=grid_state.cell_position
                />
            </GridEventHandler>
        </GridKeyboardHandler>
    }
}

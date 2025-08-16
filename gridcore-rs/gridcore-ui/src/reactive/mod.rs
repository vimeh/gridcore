use gridcore_controller::controller::SpreadsheetController;
use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

/// Creates a reactive generation signal that increments whenever the controller state changes.
/// This allows Leptos components to efficiently track controller state changes without
/// duplicating the controller's functionality.
pub fn create_reactive_state(controller: Rc<RefCell<SpreadsheetController>>) -> RwSignal<u32> {
    let generation = RwSignal::new(0);

    // Subscribe to all controller events and increment generation
    let generation_for_callback = generation;
    controller.borrow_mut().subscribe_to_events(Box::new(
        move |_event: &gridcore_controller::controller::events::SpreadsheetEvent| {
            // Any state change increments the generation
            generation_for_callback.update(|g| *g += 1);
        },
    ));

    generation
}

/// Creates a more granular reactive state with separate signals for different aspects
pub struct ReactiveState {
    pub generation: RwSignal<u32>,
    pub render_generation: RwSignal<u32>,
}

impl ReactiveState {
    pub fn new(controller: Rc<RefCell<SpreadsheetController>>) -> Self {
        let generation = RwSignal::new(0);
        let render_generation = RwSignal::new(0);

        let gen_for_callback = generation;
        let render_for_callback = render_generation;

        controller.borrow_mut().subscribe_to_events(Box::new(
            move |event: &gridcore_controller::controller::events::SpreadsheetEvent| {
                use gridcore_controller::controller::events::SpreadsheetEvent;

                // Always update generation for any event
                gen_for_callback.update(|g| *g += 1);

                // Update render generation for visual changes
                match event {
                    SpreadsheetEvent::CursorMoved { .. }
                    | SpreadsheetEvent::StateChanged
                    | SpreadsheetEvent::CellEditCompleted { .. }
                    | SpreadsheetEvent::EditCanceled { .. } => {
                        render_for_callback.update(|g| *g += 1);
                    }
                    _ => {}
                }
            },
        ));

        ReactiveState {
            generation,
            render_generation,
        }
    }
}

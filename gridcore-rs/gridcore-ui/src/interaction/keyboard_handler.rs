use gridcore_controller::controller::{
    KeyboardEvent as ControllerKeyboardEvent, SpreadsheetController,
};
use web_sys::KeyboardEvent;

pub struct KeyboardHandler {
    controller: SpreadsheetController,
}

impl KeyboardHandler {
    pub fn new(controller: SpreadsheetController) -> Self {
        Self { controller }
    }

    pub fn handle_key_press(&mut self, event: KeyboardEvent) -> bool {
        let key = event.key();
        let ctrl = event.ctrl_key();
        let shift = event.shift_key();
        let alt = event.alt_key();

        // Convert to controller keyboard event
        let controller_event = ControllerKeyboardEvent {
            key: key.clone(),
            code: event.code(),
            ctrl,
            shift,
            alt,
            meta: event.meta_key(),
        };

        // Delegate to controller
        match self.controller.handle_keyboard_event(controller_event) {
            Ok(_) => {
                event.prevent_default();
                true
            }
            Err(_) => false,
        }
    }
}

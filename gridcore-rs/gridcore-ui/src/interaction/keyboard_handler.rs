use web_sys::KeyboardEvent;
use gridcore_controller::controller::SpreadsheetController;

pub struct KeyboardHandler {
    controller: SpreadsheetController,
}

impl KeyboardHandler {
    pub fn new(controller: SpreadsheetController) -> Self {
        Self { controller }
    }
    
    pub fn handle_key_press(&mut self, event: KeyboardEvent) -> bool {
        let key = event.key();
        
        // Delegate to controller
        match self.controller.handle_key_press(&key) {
            Ok(_) => {
                event.prevent_default();
                true
            }
            Err(_) => false
        }
    }
}
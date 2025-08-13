use crate::controller::{KeyboardEvent, MouseEvent, SpreadsheetEvent};
use crate::state::Action;
use gridcore_core::Result;

/// Event handling trait for SpreadsheetController
pub trait EventHandling {
    fn handle_keyboard_event(&mut self, event: KeyboardEvent) -> Result<()>;
    fn handle_mouse_event(&mut self, event: MouseEvent) -> Result<()>;
    fn dispatch_action(&mut self, action: Action) -> Result<()>;
    fn subscribe_to_events<F>(&mut self, listener: F)
    where
        F: Fn(SpreadsheetEvent) + 'static;
    fn emit_event(&self, event: SpreadsheetEvent);
}

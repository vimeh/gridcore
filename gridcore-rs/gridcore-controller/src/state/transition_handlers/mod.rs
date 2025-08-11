pub mod bulk;
pub mod command;
pub mod editing;
pub mod navigation;
pub mod resize;
pub mod structural;
pub mod universal;
pub mod visual;

use crate::state::{actions::Action, UIState};
use gridcore_core::Result;

/// Trait for handling state transitions
pub trait TransitionHandler: Send + Sync {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool;
    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState>;
}

/// Registry that manages all transition handlers
pub struct HandlerRegistry {
    handlers: Vec<Box<dyn TransitionHandler>>,
}

impl HandlerRegistry {
    pub fn new() -> Self {
        let handlers: Vec<Box<dyn TransitionHandler>> = vec![
            // Universal handler should be checked last as it handles fallback cases
            Box::new(navigation::NavigationHandler),
            Box::new(editing::EditingHandler),
            Box::new(visual::VisualHandler),
            Box::new(command::CommandHandler),
            Box::new(resize::ResizeHandler),
            Box::new(structural::StructuralHandler),
            Box::new(bulk::BulkHandler),
            Box::new(universal::UniversalHandler),
        ];

        Self { handlers }
    }

    pub fn find_handler(&self, state: &UIState, action: &Action) -> Option<&dyn TransitionHandler> {
        self.handlers
            .iter()
            .find(|handler| handler.can_handle(state, action))
            .map(|h| h.as_ref())
    }
}

impl Default for HandlerRegistry {
    fn default() -> Self {
        Self::new()
    }
}
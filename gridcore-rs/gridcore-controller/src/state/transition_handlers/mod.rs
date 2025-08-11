pub mod navigation;
pub mod editing;
pub mod visual;
pub mod command;
pub mod resize;
pub mod structural;
pub mod bulk;

use crate::state::{actions::Action, UIState};
use gridcore_core::Result;

/// Trait for handling state transitions
pub trait TransitionHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool;
    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState>;
}
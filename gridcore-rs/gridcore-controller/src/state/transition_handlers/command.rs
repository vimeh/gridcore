use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, UIState};
use gridcore_core::Result;

pub struct CommandHandler;

impl TransitionHandler for CommandHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        matches!(state, UIState::Command { .. })
            && matches!(
                action,
                Action::ExitCommandMode | Action::UpdateCommandValue { .. }
            )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::ExitCommandMode => {
                if let UIState::Command {
                    cursor, viewport, ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("CommandHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateCommandValue { value } => {
                if let UIState::Command {
                    cursor, viewport, ..
                } = state
                {
                    Ok(UIState::Command {
                        cursor: *cursor,
                        viewport: *viewport,
                        command_value: value.clone(),
                    })
                } else {
                    unreachable!("CommandHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("CommandHandler::handle called with unhandled action"),
        }
    }
}

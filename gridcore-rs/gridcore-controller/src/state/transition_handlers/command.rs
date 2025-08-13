use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, ModalData, ModalKind, UIState};
use gridcore_core::Result;

pub struct CommandHandler;

impl TransitionHandler for CommandHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        matches!(state, UIState::Modal { kind: ModalKind::Command, .. })
            && matches!(
                action,
                Action::ExitCommandMode | Action::UpdateCommandValue { .. }
            )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::ExitCommandMode => {
                if let UIState::Modal {
                    cursor, viewport, kind: ModalKind::Command, ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("CommandHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateCommandValue { value } => {
                if let UIState::Modal {
                    cursor, viewport, kind: ModalKind::Command, ..
                } = state
                {
                    Ok(UIState::Modal {
                        cursor: *cursor,
                        viewport: *viewport,
                        kind: ModalKind::Command,
                        data: ModalData::Command {
                            value: value.clone(),
                        },
                    })
                } else {
                    unreachable!("CommandHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("CommandHandler::handle called with unhandled action"),
        }
    }
}

use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, NavigationModal, UIState};
use gridcore_core::Result;

pub struct CommandHandler;

impl TransitionHandler for CommandHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        matches!(
            state,
            UIState::Navigation {
                modal: Some(NavigationModal::Command { .. }),
                ..
            }
        ) && matches!(
            action,
            Action::ExitCommandMode | Action::UpdateCommandValue { .. }
        )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::ExitCommandMode => {
                if let UIState::Navigation { core, .. } = state {
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                } else {
                    unreachable!("CommandHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateCommandValue { value } => {
                if let UIState::Navigation {
                    core, selection, ..
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Command {
                            value: value.clone(),
                        }),
                    })
                } else {
                    unreachable!("CommandHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("CommandHandler::handle called with unhandled action"),
        }
    }
}

use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, NavigationModal, UIState};
use gridcore_core::Result;

pub struct VisualHandler;

impl TransitionHandler for VisualHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        // Only handle when in Navigation with Visual modal
        matches!(
            state,
            UIState::Navigation {
                modal: Some(NavigationModal::Visual { .. }),
                ..
            }
        ) && matches!(
            action,
            Action::ExitSpreadsheetVisualMode
                | Action::UpdateSelection { .. }
                | Action::ChangeVisualMode { .. }
        )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::ExitSpreadsheetVisualMode => {
                if let UIState::Navigation { core, .. } = state {
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                } else {
                    unreachable!("VisualHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateSelection { selection } => {
                if let UIState::Navigation {
                    core,
                    modal: Some(NavigationModal::Visual { mode, anchor, .. }),
                    ..
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: None,
                        modal: Some(NavigationModal::Visual {
                            mode: *mode,
                            anchor: *anchor,
                            selection: selection.clone(),
                        }),
                    })
                } else {
                    unreachable!("VisualHandler::handle called with incompatible state/action")
                }
            }
            Action::ChangeVisualMode { new_mode } => {
                if let UIState::Navigation {
                    core,
                    modal:
                        Some(NavigationModal::Visual {
                            anchor, selection, ..
                        }),
                    ..
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: None,
                        modal: Some(NavigationModal::Visual {
                            mode: *new_mode,
                            anchor: *anchor,
                            selection: selection.clone(),
                        }),
                    })
                } else {
                    unreachable!("VisualHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("VisualHandler::handle called with unhandled action"),
        }
    }
}

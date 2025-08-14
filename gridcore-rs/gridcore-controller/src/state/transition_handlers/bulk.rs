use super::TransitionHandler;
use crate::state::{
    actions::Action, create_navigation_state, BulkOperationStatus, NavigationModal, UIState,
};
use gridcore_core::Result;

pub struct BulkHandler;

impl TransitionHandler for BulkHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        (matches!(state, UIState::Navigation { .. })
            && matches!(action, Action::StartBulkOperation { .. }))
            || (matches!(
                state,
                UIState::Navigation {
                    modal: Some(NavigationModal::BulkOperation { .. }),
                    ..
                }
            ) && matches!(
                action,
                Action::CompleteBulkOperation
                    | Action::CancelBulkOperation
                    | Action::GeneratePreview
                    | Action::ExecuteBulkOperation
            ))
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::StartBulkOperation {
                parsed_command,
                affected_cells,
            } => {
                if let UIState::Navigation {
                    core, selection, ..
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::BulkOperation {
                            command: parsed_command.clone(),
                            status: BulkOperationStatus::Preparing,
                        }),
                    })
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            Action::CompleteBulkOperation | Action::CancelBulkOperation => {
                if let UIState::Navigation { core, .. } = state {
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            Action::GeneratePreview => {
                if let UIState::Navigation {
                    core,
                    selection,
                    modal: Some(NavigationModal::BulkOperation { command, .. }),
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::BulkOperation {
                            command: command.clone(),
                            status: BulkOperationStatus::Previewing,
                        }),
                    })
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            Action::ExecuteBulkOperation => {
                if let UIState::Navigation {
                    core,
                    selection,
                    modal: Some(NavigationModal::BulkOperation { command, .. }),
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::BulkOperation {
                            command: command.clone(),
                            status: BulkOperationStatus::Executing,
                        }),
                    })
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("BulkHandler::handle called with unhandled action"),
        }
    }
}

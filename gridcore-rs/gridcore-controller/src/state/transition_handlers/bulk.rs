use super::TransitionHandler;
use crate::state::{
    actions::Action, create_navigation_state, BulkOperationStatus, ModalData, ModalKind, UIState,
};
use gridcore_core::Result;

pub struct BulkHandler;

impl TransitionHandler for BulkHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        (matches!(state, UIState::Navigation { .. })
            && matches!(action, Action::StartBulkOperation { .. }))
            || (matches!(
                state,
                UIState::Modal {
                    kind: ModalKind::BulkOperation,
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
                    cursor, viewport, ..
                } = state
                {
                    Ok(UIState::Modal {
                        cursor: *cursor,
                        viewport: *viewport,
                        kind: ModalKind::BulkOperation,
                        data: ModalData::BulkOperation {
                            parsed_command: parsed_command.clone(),
                            preview_available: false,
                            preview_visible: false,
                            affected_cells: affected_cells.unwrap_or(0),
                            status: BulkOperationStatus::Preparing,
                            error_message: None,
                        },
                    })
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            Action::CompleteBulkOperation | Action::CancelBulkOperation => {
                if let UIState::Modal {
                    cursor,
                    viewport,
                    kind: ModalKind::BulkOperation,
                    ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            Action::GeneratePreview => {
                if let UIState::Modal {
                    cursor,
                    viewport,
                    kind: ModalKind::BulkOperation,
                    data,
                } = state
                {
                    if let ModalData::BulkOperation {
                        parsed_command,
                        affected_cells,
                        error_message,
                        ..
                    } = data
                    {
                        Ok(UIState::Modal {
                            cursor: *cursor,
                            viewport: *viewport,
                            kind: ModalKind::BulkOperation,
                            data: ModalData::BulkOperation {
                                parsed_command: parsed_command.clone(),
                                preview_available: true,
                                preview_visible: false,
                                affected_cells: *affected_cells,
                                status: BulkOperationStatus::Previewing,
                                error_message: error_message.clone(),
                            },
                        })
                    } else {
                        unreachable!("BulkHandler: Modal data mismatch")
                    }
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            Action::ExecuteBulkOperation => {
                // For testing, execute completes immediately and returns to navigation
                // In a real implementation, this would update status and handle async execution
                if let UIState::Modal {
                    cursor,
                    viewport,
                    kind: ModalKind::BulkOperation,
                    ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("BulkHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("BulkHandler::handle called with unhandled action"),
        }
    }
}

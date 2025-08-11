use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, UIState};
use gridcore_core::Result;

pub struct StructuralHandler;

impl TransitionHandler for StructuralHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        (matches!(state, UIState::Navigation { .. })
            && matches!(
                action,
                Action::StartInsert { .. } | Action::StartDelete { .. }
            ))
            || (matches!(state, UIState::Insert { .. })
                && matches!(
                    action,
                    Action::UpdateInsertCount { .. } | Action::ConfirmInsert | Action::CancelInsert
                ))
            || (matches!(state, UIState::Delete { .. })
                && matches!(action, Action::ConfirmDelete | Action::CancelDelete))
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::StartInsert {
                insert_type,
                position,
                reference,
            } => {
                if let UIState::Navigation {
                    cursor, viewport, ..
                } = state
                {
                    Ok(UIState::Insert {
                        cursor: *cursor,
                        viewport: *viewport,
                        insert_type: *insert_type,
                        position: *position,
                        insert_position: *position,
                        reference: *reference,
                        count: 1,
                        target_index: *reference,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::UpdateInsertCount { count } => {
                if let UIState::Insert {
                    cursor,
                    viewport,
                    insert_type,
                    position,
                    insert_position,
                    reference,
                    target_index,
                    ..
                } = state
                {
                    Ok(UIState::Insert {
                        cursor: *cursor,
                        viewport: *viewport,
                        insert_type: *insert_type,
                        position: *position,
                        insert_position: *insert_position,
                        reference: *reference,
                        count: *count,
                        target_index: *target_index,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::ConfirmInsert | Action::CancelInsert => {
                if let UIState::Insert {
                    cursor, viewport, ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    Ok(state.clone())
                }
            }
            Action::StartDelete {
                targets,
                delete_type,
            } => {
                if let UIState::Navigation {
                    cursor, viewport, ..
                } = state
                {
                    Ok(UIState::Delete {
                        cursor: *cursor,
                        viewport: *viewport,
                        delete_type: *delete_type,
                        targets: targets.clone(),
                        selection: targets.clone(),
                        confirmation_pending: false,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::ConfirmDelete | Action::CancelDelete => {
                if let UIState::Delete {
                    cursor, viewport, ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    Ok(state.clone())
                }
            }
            _ => Ok(state.clone()),
        }
    }
}

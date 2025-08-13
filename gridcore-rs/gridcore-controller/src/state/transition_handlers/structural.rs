use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, ModalData, ModalKind, UIState};
use gridcore_core::Result;

pub struct StructuralHandler;

impl TransitionHandler for StructuralHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        (matches!(state, UIState::Navigation { .. })
            && matches!(
                action,
                Action::StartInsert { .. } | Action::StartDelete { .. }
            ))
            || (matches!(
                state,
                UIState::Modal {
                    kind: ModalKind::Insert,
                    ..
                }
            ) && matches!(
                action,
                Action::UpdateInsertCount { .. } | Action::ConfirmInsert | Action::CancelInsert
            ))
            || (matches!(
                state,
                UIState::Modal {
                    kind: ModalKind::Delete,
                    ..
                }
            ) && matches!(action, Action::ConfirmDelete | Action::CancelDelete))
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
                    Ok(UIState::Modal {
                        cursor: *cursor,
                        viewport: *viewport,
                        kind: ModalKind::Insert,
                        data: ModalData::Insert {
                            insert_type: *insert_type,
                            position: *position,
                            reference: *reference,
                            count: 1,
                            target_index: *reference,
                        },
                    })
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateInsertCount { count } => {
                if let UIState::Modal {
                    cursor,
                    viewport,
                    kind: ModalKind::Insert,
                    data,
                } = state
                {
                    if let ModalData::Insert {
                        insert_type,
                        position,
                        reference,
                        target_index,
                        ..
                    } = data
                    {
                        Ok(UIState::Modal {
                            cursor: *cursor,
                            viewport: *viewport,
                            kind: ModalKind::Insert,
                            data: ModalData::Insert {
                                insert_type: *insert_type,
                                position: *position,
                                reference: *reference,
                                count: *count,
                                target_index: *target_index,
                            },
                        })
                    } else {
                        unreachable!("StructuralHandler: Modal data mismatch")
                    }
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            Action::ConfirmInsert | Action::CancelInsert => {
                if let UIState::Modal {
                    cursor,
                    viewport,
                    kind: ModalKind::Insert,
                    ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
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
                    Ok(UIState::Modal {
                        cursor: *cursor,
                        viewport: *viewport,
                        kind: ModalKind::Delete,
                        data: ModalData::Delete {
                            delete_type: *delete_type,
                            targets: targets.clone(),
                            selection: targets.clone(),
                            confirmation_pending: false,
                        },
                    })
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            Action::ConfirmDelete | Action::CancelDelete => {
                if let UIState::Modal {
                    cursor,
                    viewport,
                    kind: ModalKind::Delete,
                    ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("StructuralHandler::handle called with unhandled action"),
        }
    }
}

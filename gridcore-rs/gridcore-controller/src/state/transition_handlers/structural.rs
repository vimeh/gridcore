use super::TransitionHandler;
use crate::state::{
    actions::Action, create_navigation_state, DeleteConfig, InsertConfig, NavigationModal, UIState,
};
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
                UIState::Navigation {
                    modal: Some(NavigationModal::Insert { .. }),
                    ..
                }
            ) && matches!(
                action,
                Action::UpdateInsertCount { .. } | Action::ConfirmInsert | Action::CancelInsert
            ))
            || (matches!(
                state,
                UIState::Navigation {
                    modal: Some(NavigationModal::Delete { .. }),
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
                    core, selection, ..
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Insert {
                            config: InsertConfig {
                                insert_type: *insert_type,
                                position: *position,
                                reference: *reference,
                                count: 1,
                                target_index: *reference,
                            },
                        }),
                    })
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateInsertCount { count } => {
                if let UIState::Navigation {
                    core,
                    selection,
                    modal: Some(NavigationModal::Insert { config }),
                } = state
                {
                    let mut new_config = config.clone();
                    new_config.count = *count;
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Insert { config: new_config }),
                    })
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            Action::ConfirmInsert | Action::CancelInsert => {
                if let UIState::Navigation { core, .. } = state {
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            Action::StartDelete {
                targets,
                delete_type,
            } => {
                if let UIState::Navigation {
                    core, selection, ..
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Delete {
                            config: DeleteConfig {
                                delete_type: *delete_type,
                                targets: targets.clone(),
                                selection: targets.clone(),
                                confirmation_pending: false,
                            },
                        }),
                    })
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            Action::ConfirmDelete | Action::CancelDelete => {
                if let UIState::Navigation { core, .. } = state {
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                } else {
                    unreachable!("StructuralHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("StructuralHandler::handle called with unhandled action"),
        }
    }
}

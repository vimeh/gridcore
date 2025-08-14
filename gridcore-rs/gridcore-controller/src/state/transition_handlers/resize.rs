use super::TransitionHandler;
use crate::state::{
    actions::Action, create_navigation_state, NavigationModal, ResizeMoveDirection, ResizeSizes,
    ResizeTarget, UIState,
};
use gridcore_core::Result;

pub struct ResizeHandler;

impl TransitionHandler for ResizeHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        (matches!(state, UIState::Navigation { .. })
            && matches!(action, Action::StartResize { .. }))
            || (matches!(
                state,
                UIState::Navigation {
                    modal: Some(NavigationModal::Resize { .. }),
                    ..
                }
            ) && matches!(
                action,
                Action::UpdateResize { .. }
                    | Action::MoveResizeTarget { .. }
                    | Action::AutoFitResize
                    | Action::ConfirmResize
                    | Action::CancelResize
            ))
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::StartResize {
                target,
                initial_position,
            } => {
                if let UIState::Navigation {
                    core, selection, ..
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Resize {
                            target: *target,
                            sizes: ResizeSizes {
                                resize_index: match target {
                                    ResizeTarget::Column { index } => *index,
                                    ResizeTarget::Row { index } => *index,
                                },
                                original_size: 100, // Default size, should be fetched from actual data
                                current_size: 100,
                                initial_position: *initial_position,
                                current_position: *initial_position,
                            },
                        }),
                    })
                } else {
                    unreachable!("ResizeHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateResize { delta } => {
                if let UIState::Navigation {
                    core,
                    selection,
                    modal: Some(NavigationModal::Resize { target, sizes }),
                } = state
                {
                    let new_size = (sizes.current_size as i32 + *delta as i32).max(20) as u32;
                    let new_position = sizes.current_position + delta;
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Resize {
                            target: *target,
                            sizes: ResizeSizes {
                                resize_index: sizes.resize_index,
                                original_size: sizes.original_size,
                                current_size: new_size,
                                initial_position: sizes.initial_position,
                                current_position: new_position,
                            },
                        }),
                    })
                } else {
                    unreachable!("ResizeHandler::handle called with incompatible state/action")
                }
            }
            Action::MoveResizeTarget { direction } => {
                if let UIState::Navigation {
                    core,
                    selection,
                    modal: Some(NavigationModal::Resize { target, sizes }),
                } = state
                {
                    let new_index = match direction {
                        ResizeMoveDirection::Previous => sizes.resize_index.saturating_sub(1),
                        ResizeMoveDirection::Next => sizes.resize_index.saturating_add(1),
                    };
                    let new_target = match target {
                        ResizeTarget::Column { .. } => ResizeTarget::Column { index: new_index },
                        ResizeTarget::Row { .. } => ResizeTarget::Row { index: new_index },
                    };
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Resize {
                            target: new_target,
                            sizes: ResizeSizes {
                                resize_index: new_index,
                                original_size: sizes.original_size,
                                current_size: sizes.current_size,
                                initial_position: sizes.initial_position,
                                current_position: sizes.current_position,
                            },
                        }),
                    })
                } else {
                    unreachable!("ResizeHandler::handle called with incompatible state/action")
                }
            }
            Action::AutoFitResize => {
                if let UIState::Navigation {
                    core,
                    selection,
                    modal: Some(NavigationModal::Resize { target, sizes }),
                } = state
                {
                    Ok(UIState::Navigation {
                        core: core.clone(),
                        selection: selection.clone(),
                        modal: Some(NavigationModal::Resize {
                            target: *target,
                            sizes: ResizeSizes {
                                resize_index: sizes.resize_index,
                                original_size: sizes.original_size,
                                current_size: 120, // Default auto-fit size
                                initial_position: sizes.initial_position,
                                current_position: sizes.current_position,
                            },
                        }),
                    })
                } else {
                    unreachable!("ResizeHandler::handle called with incompatible state/action")
                }
            }
            Action::ConfirmResize | Action::CancelResize => {
                if let UIState::Navigation { core, .. } = state {
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                } else {
                    unreachable!("ResizeHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("ResizeHandler::handle called with unhandled action"),
        }
    }
}

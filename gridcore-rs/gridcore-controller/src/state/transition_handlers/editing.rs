use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, EditMode, UIState, VisualSelection};
use gridcore_core::Result;

pub struct EditingHandler;

impl TransitionHandler for EditingHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        // Handle all actions when in UIState::Editing, regardless of cell_mode
        matches!(state, UIState::Editing { .. })
            && matches!(
                action,
                Action::ExitToNavigation
                    | Action::EnterVisualMode { .. }
                    | Action::EnterInsertMode { .. }
                    | Action::ExitInsertMode
                    | Action::ExitVisualMode
                    | Action::UpdateEditingValue { .. }
            )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::ExitToNavigation => {
                if let UIState::Editing { core, .. } = state {
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::EnterVisualMode {
                visual_type,
                anchor,
            } => {
                if let UIState::Editing {
                    core,
                    value,
                    cursor_pos,
                    insert_variant,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        core: core.clone(),
                        mode: EditMode::Visual,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_selection: Some(VisualSelection {
                            start: anchor.unwrap_or(*cursor_pos),
                            mode: *visual_type,
                        }),
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::EnterInsertMode { mode: insert_mode } => {
                if let UIState::Editing {
                    core,
                    value,
                    cursor_pos,
                    visual_selection,
                    mode: EditMode::Normal,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        core: core.clone(),
                        mode: EditMode::Insert,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_selection: visual_selection.clone(),
                        insert_variant: *insert_mode,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::ExitInsertMode => {
                if let UIState::Editing {
                    core,
                    value,
                    cursor_pos,
                    visual_selection,
                    mode: EditMode::Insert,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        core: core.clone(),
                        mode: EditMode::Normal,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_selection: visual_selection.clone(),
                        insert_variant: None,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::ExitVisualMode => {
                if let UIState::Editing {
                    core,
                    value,
                    cursor_pos,
                    insert_variant,
                    mode: EditMode::Visual,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        core: core.clone(),
                        mode: EditMode::Normal,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_selection: None,
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateEditingValue {
                value: new_value,
                cursor_position: new_cursor,
            } => {
                if let UIState::Editing {
                    core,
                    mode,
                    visual_selection,
                    insert_variant,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        core: core.clone(),
                        mode: *mode,
                        value: new_value.clone(),
                        cursor_pos: *new_cursor,
                        visual_selection: visual_selection.clone(),
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("EditingHandler::handle called with unhandled action"),
        }
    }
}

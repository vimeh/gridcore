use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, EditMode, UIState};
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
                if let UIState::Editing {
                    cursor, viewport, ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::EnterVisualMode {
                visual_type,
                anchor,
            } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    value,
                    cursor_pos,
                    insert_variant,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: EditMode::Visual,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_start: Some(anchor.unwrap_or(*cursor_pos)),
                        visual_type: Some(*visual_type),
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::EnterInsertMode { mode: insert_mode } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    value,
                    cursor_pos,
                    visual_start,
                    visual_type,
                    mode: EditMode::Normal,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: EditMode::Insert,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        insert_variant: *insert_mode,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::ExitInsertMode => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    value,
                    cursor_pos,
                    visual_start,
                    visual_type,
                    mode: EditMode::Insert,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: EditMode::Normal,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        insert_variant: None,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::ExitVisualMode => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    value,
                    cursor_pos,
                    insert_variant,
                    mode: EditMode::Visual,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: EditMode::Normal,
                        value: value.clone(),
                        cursor_pos: *cursor_pos,
                        visual_start: None,
                        visual_type: None,
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateEditingValue {
                value: new_value,
                cursor_position: new_cursor_position,
            } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    mode,
                    visual_start,
                    visual_type,
                    insert_variant,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: *mode,
                        value: new_value.clone(),
                        cursor_pos: *new_cursor_position,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateEditingCursor {
                cursor_position: new_cursor_position,
            } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    mode,
                    value,
                    visual_start,
                    visual_type,
                    insert_variant,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: *mode,
                        value: value.clone(),
                        cursor_pos: *new_cursor_position,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::InsertCharacterAtCursor { character } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    mode,
                    value,
                    cursor_pos,
                    visual_start,
                    visual_type,
                    insert_variant,
                } = state
                {
                    let mut new_value = value.clone();
                    new_value.insert(*cursor_pos, *character);
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: *mode,
                        value: new_value,
                        cursor_pos: cursor_pos + 1,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        insert_variant: *insert_variant,
                    })
                } else {
                    unreachable!("EditingHandler::handle called with incompatible state/action")
                }
            }
            Action::DeleteCharacterAtCursor { forward } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    mode,
                    value,
                    cursor_pos,
                    visual_start,
                    visual_type,
                    insert_variant,
                } = state
                {
                    let mut new_value = value.clone();
                    let new_cursor_pos = if *forward {
                        // Delete (forward)
                        if *cursor_pos < value.len() {
                            new_value.remove(*cursor_pos);
                            *cursor_pos
                        } else {
                            *cursor_pos
                        }
                    } else {
                        // Backspace (backward)
                        if *cursor_pos > 0 {
                            new_value.remove(cursor_pos - 1);
                            cursor_pos - 1
                        } else {
                            0
                        }
                    };

                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        mode: *mode,
                        value: new_value,
                        cursor_pos: new_cursor_pos,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        insert_variant: *insert_variant,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            _ => unreachable!("EditingHandler::handle called with unhandled action"),
        }
    }
}

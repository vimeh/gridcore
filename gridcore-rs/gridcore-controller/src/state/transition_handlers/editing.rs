use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, CellMode, UIState};
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
                    Ok(state.clone())
                }
            }
            Action::EnterVisualMode {
                visual_type,
                anchor,
            } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    edit_variant,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        cell_mode: CellMode::Visual,
                        editing_value: editing_value.clone(),
                        cursor_position: *cursor_position,
                        visual_start: Some(anchor.unwrap_or(*cursor_position)),
                        visual_type: Some(*visual_type),
                        edit_variant: *edit_variant,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::EnterInsertMode { mode } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    visual_start,
                    visual_type,
                    cell_mode: CellMode::Normal,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        cell_mode: CellMode::Insert,
                        editing_value: editing_value.clone(),
                        cursor_position: *cursor_position,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        edit_variant: *mode,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::ExitInsertMode => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    visual_start,
                    visual_type,
                    cell_mode: CellMode::Insert,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        cell_mode: CellMode::Normal,
                        editing_value: editing_value.clone(),
                        cursor_position: *cursor_position,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        edit_variant: None,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::ExitVisualMode => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    editing_value,
                    cursor_position,
                    edit_variant,
                    cell_mode: CellMode::Visual,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        cell_mode: CellMode::Normal,
                        editing_value: editing_value.clone(),
                        cursor_position: *cursor_position,
                        visual_start: None,
                        visual_type: None,
                        edit_variant: *edit_variant,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::UpdateEditingValue {
                value,
                cursor_position,
            } => {
                if let UIState::Editing {
                    cursor,
                    viewport,
                    cell_mode,
                    visual_start,
                    visual_type,
                    edit_variant,
                    ..
                } = state
                {
                    Ok(UIState::Editing {
                        cursor: *cursor,
                        viewport: *viewport,
                        cell_mode: *cell_mode,
                        editing_value: value.clone(),
                        cursor_position: *cursor_position,
                        visual_start: *visual_start,
                        visual_type: *visual_type,
                        edit_variant: *edit_variant,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            _ => Ok(state.clone()),
        }
    }
}

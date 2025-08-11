use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, CellMode, UIState};
use gridcore_core::Result;

pub struct UniversalHandler;

impl TransitionHandler for UniversalHandler {
    fn can_handle(&self, _state: &UIState, action: &Action) -> bool {
        matches!(
            action,
            Action::UpdateCursor { .. }
                | Action::UpdateViewport { .. }
                | Action::Escape
                | Action::Undo
                | Action::UndoLine
                | Action::Redo
        )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::UpdateCursor { cursor } => {
                let mut new_state = state.clone();
                match &mut new_state {
                    UIState::Navigation { cursor: c, .. }
                    | UIState::Visual { cursor: c, .. }
                    | UIState::Editing { cursor: c, .. }
                    | UIState::Command { cursor: c, .. }
                    | UIState::Resize { cursor: c, .. }
                    | UIState::Insert { cursor: c, .. }
                    | UIState::Delete { cursor: c, .. }
                    | UIState::BulkOperation { cursor: c, .. } => {
                        *c = *cursor;
                    }
                }
                Ok(new_state)
            }
            Action::UpdateViewport { viewport } => {
                let mut new_state = state.clone();
                match &mut new_state {
                    UIState::Navigation { viewport: v, .. }
                    | UIState::Visual { viewport: v, .. }
                    | UIState::Editing { viewport: v, .. }
                    | UIState::Command { viewport: v, .. }
                    | UIState::Resize { viewport: v, .. }
                    | UIState::Insert { viewport: v, .. }
                    | UIState::Delete { viewport: v, .. }
                    | UIState::BulkOperation { viewport: v, .. } => {
                        *v = *viewport;
                    }
                }
                Ok(new_state)
            }
            Action::Escape => handle_escape(state),
            Action::Undo | Action::UndoLine | Action::Redo => {
                // Undo/Redo logic should be handled at a higher level
                // The state machine just maintains the current state
                Ok(state.clone())
            }
            _ => Ok(state.clone()),
        }
    }
}

fn handle_escape(state: &UIState) -> Result<UIState> {
    match state {
        UIState::Editing {
            cursor,
            viewport,
            cell_mode,
            ..
        } => {
            match cell_mode {
                CellMode::Insert | CellMode::Visual => {
                    // Exit to normal mode within editing
                    let mut new_state = state.clone();
                    if let UIState::Editing {
                        cell_mode,
                        visual_type,
                        visual_start,
                        edit_variant,
                        ..
                    } = &mut new_state
                    {
                        *cell_mode = CellMode::Normal;
                        *visual_type = None;
                        *visual_start = None;
                        *edit_variant = None;
                    }
                    Ok(new_state)
                }
                CellMode::Normal => {
                    // Exit editing mode entirely
                    Ok(create_navigation_state(*cursor, *viewport, None))
                }
            }
        }
        UIState::Visual {
            cursor, viewport, ..
        }
        | UIState::Command {
            cursor, viewport, ..
        }
        | UIState::Resize {
            cursor, viewport, ..
        } => {
            // Exit to navigation
            Ok(create_navigation_state(*cursor, *viewport, None))
        }
        UIState::Navigation { .. } => {
            // Already in navigation, nothing to do
            Ok(state.clone())
        }
        _ => Ok(state.clone()),
    }
}

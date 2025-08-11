use super::TransitionHandler;
use crate::state::{
    actions::Action, create_command_state, create_editing_state, create_visual_state,
    InsertMode, SpreadsheetMode, SpreadsheetVisualMode, UIState,
};
use gridcore_core::Result;

pub struct NavigationHandler;

impl TransitionHandler for NavigationHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        matches!(
            (state.spreadsheet_mode(), action),
            (SpreadsheetMode::Navigation, Action::StartEditing { .. })
                | (SpreadsheetMode::Navigation, Action::EnterCommandMode)
                | (SpreadsheetMode::Navigation, Action::EnterSpreadsheetVisualMode { .. })
                | (SpreadsheetMode::Navigation, Action::UpdateCursor { .. })
                | (SpreadsheetMode::Navigation, Action::UpdateViewport { .. })
        )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::StartEditing {
                edit_mode,
                initial_value,
                cursor_position,
            } => {
                let cursor = state.cursor().unwrap_or_default();
                let viewport = *state.viewport();
                let mut new_state = create_editing_state(
                    cursor,
                    edit_mode.unwrap_or(InsertMode::I),
                    initial_value.clone().unwrap_or_default(),
                    viewport,
                );
                if let Some(pos) = cursor_position {
                    if let UIState::Editing {
                        cursor_position, ..
                    } = &mut new_state
                    {
                        *cursor_position = *pos;
                    }
                }
                Ok(new_state)
            }
            Action::EnterCommandMode => {
                let cursor = state.cursor().unwrap_or_default();
                let viewport = *state.viewport();
                Ok(create_command_state(cursor, viewport))
            }
            Action::EnterSpreadsheetVisualMode {
                visual_mode,
                selection,
            } => {
                let cursor = state.cursor().unwrap_or_default();
                let viewport = *state.viewport();
                Ok(create_visual_state(
                    cursor,
                    *visual_mode,
                    selection.clone(),
                    viewport,
                ))
            }
            Action::UpdateCursor { cursor } => {
                if let UIState::Navigation {
                    cursor: nav_cursor,
                    ..
                } = state.clone()
                {
                    Ok(UIState::Navigation {
                        cursor: *cursor,
                        ..nav_cursor
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::UpdateViewport { viewport } => {
                if let UIState::Navigation {
                    viewport: nav_viewport,
                    ..
                } = state.clone()
                {
                    Ok(UIState::Navigation {
                        viewport: *viewport,
                        ..nav_viewport
                    })
                } else {
                    Ok(state.clone())
                }
            }
            _ => Ok(state.clone()),
        }
    }
}
use super::TransitionHandler;
use crate::state::{
    actions::Action, create_command_state, create_editing_state, create_visual_state, EditMode,
    UIState,
};
use gridcore_core::Result;

pub struct NavigationHandler;

impl TransitionHandler for NavigationHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        matches!(state, UIState::Navigation { .. })
            && matches!(
                action,
                Action::StartEditing { .. }
                    | Action::EnterCommandMode
                    | Action::EnterSpreadsheetVisualMode { .. }
            )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::StartEditing {
                edit_mode,
                initial_value,
                cursor_position,
            } => {
                if let UIState::Navigation {
                    cursor, viewport, ..
                } = state
                {
                    let mode = if edit_mode.is_some() {
                        EditMode::Insert
                    } else {
                        EditMode::Normal
                    };
                    let mut new_state = create_editing_state(*cursor, *viewport, mode);

                    if let UIState::Editing {
                        value,
                        cursor_pos: pos,
                        insert_variant,
                        ..
                    } = &mut new_state
                    {
                        // Handle initial_value:
                        // - Some(value): Use the provided value (can be empty string for Enter key)
                        // - None: Keep empty string
                        if let Some(val) = initial_value {
                            *value = val.clone();
                        }
                        if let Some(cp) = cursor_position {
                            *pos = *cp;
                        }
                        *insert_variant = *edit_mode;
                    }

                    Ok(new_state)
                } else {
                    unreachable!("NavigationHandler::handle called with incompatible state/action")
                }
            }
            Action::EnterCommandMode => {
                if let UIState::Navigation {
                    cursor, viewport, ..
                } = state
                {
                    Ok(create_command_state(*cursor, *viewport))
                } else {
                    unreachable!("NavigationHandler::handle called with incompatible state/action")
                }
            }
            Action::EnterSpreadsheetVisualMode {
                visual_mode,
                selection,
            } => {
                if let UIState::Navigation {
                    cursor, viewport, ..
                } = state
                {
                    Ok(create_visual_state(
                        *cursor,
                        *viewport,
                        *visual_mode,
                        *cursor,
                        selection.clone(),
                    ))
                } else {
                    unreachable!("NavigationHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("NavigationHandler::handle called with unhandled action"),
        }
    }
}

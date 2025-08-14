use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, EditMode, UIState};
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
                    UIState::Navigation { core, .. } | UIState::Editing { core, .. } => {
                        core.cursor = *cursor;
                    }
                }
                Ok(new_state)
            }
            Action::UpdateViewport { viewport } => {
                let mut new_state = state.clone();
                match &mut new_state {
                    UIState::Navigation { core, .. } | UIState::Editing { core, .. } => {
                        core.viewport = *viewport;
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
        UIState::Editing { core, mode, .. } => {
            match mode {
                EditMode::Insert | EditMode::Visual => {
                    // Exit to normal mode within editing
                    let mut new_state = state.clone();
                    if let UIState::Editing {
                        mode,
                        visual_selection,
                        insert_variant,
                        ..
                    } = &mut new_state
                    {
                        *mode = EditMode::Normal;
                        *visual_selection = None;
                        *insert_variant = None;
                    }
                    Ok(new_state)
                }
                EditMode::Normal => {
                    // Exit editing mode entirely
                    Ok(create_navigation_state(core.cursor, core.viewport, None))
                }
            }
        }
        UIState::Navigation { core, modal, .. } => {
            if modal.is_some() {
                // Exit any modal state to navigation
                Ok(create_navigation_state(core.cursor, core.viewport, None))
            } else {
                // Already in navigation, nothing to do
                Ok(state.clone())
            }
        }
    }
}

use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, UIState};
use gridcore_core::Result;

pub struct VisualHandler;

impl TransitionHandler for VisualHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        // Only handle when in UIState::Visual (spreadsheet-level visual mode)
        matches!(state, UIState::Visual { .. })
            && matches!(
                action,
                Action::ExitSpreadsheetVisualMode
                    | Action::UpdateSelection { .. }
                    | Action::ChangeVisualMode { .. }
            )
    }

    fn handle(&self, state: &UIState, action: &Action) -> Result<UIState> {
        match action {
            Action::ExitSpreadsheetVisualMode => {
                if let UIState::Visual {
                    cursor, viewport, ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    Ok(state.clone())
                }
            }
            Action::UpdateSelection { selection } => {
                if let UIState::Visual {
                    cursor,
                    viewport,
                    anchor,
                    visual_mode,
                    ..
                } = state
                {
                    Ok(UIState::Visual {
                        cursor: *cursor,
                        viewport: *viewport,
                        selection: selection.clone(),
                        visual_mode: *visual_mode,
                        anchor: *anchor,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            Action::ChangeVisualMode { new_mode } => {
                if let UIState::Visual {
                    cursor,
                    viewport,
                    selection,
                    anchor,
                    ..
                } = state
                {
                    Ok(UIState::Visual {
                        cursor: *cursor,
                        viewport: *viewport,
                        selection: selection.clone(),
                        visual_mode: *new_mode,
                        anchor: *anchor,
                    })
                } else {
                    Ok(state.clone())
                }
            }
            _ => Ok(state.clone()),
        }
    }
}

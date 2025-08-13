use super::TransitionHandler;
use crate::state::{actions::Action, create_navigation_state, ModalData, ModalKind, UIState};
use gridcore_core::Result;

pub struct VisualHandler;

impl TransitionHandler for VisualHandler {
    fn can_handle(&self, state: &UIState, action: &Action) -> bool {
        // Only handle when in Modal::Visual (spreadsheet-level visual mode)
        matches!(state, UIState::Modal { kind: ModalKind::Visual, .. })
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
                if let UIState::Modal {
                    cursor, viewport, kind: ModalKind::Visual, ..
                } = state
                {
                    Ok(create_navigation_state(*cursor, *viewport, None))
                } else {
                    unreachable!("VisualHandler::handle called with incompatible state/action")
                }
            }
            Action::UpdateSelection { selection } => {
                if let UIState::Modal {
                    cursor,
                    viewport,
                    kind: ModalKind::Visual,
                    data,
                } = state
                {
                    if let ModalData::Visual { visual_mode, anchor, .. } = data {
                        Ok(UIState::Modal {
                            cursor: *cursor,
                            viewport: *viewport,
                            kind: ModalKind::Visual,
                            data: ModalData::Visual {
                                selection: selection.clone(),
                                visual_mode: *visual_mode,
                                anchor: *anchor,
                            },
                        })
                    } else {
                        unreachable!("VisualHandler: Modal data mismatch")
                    }
                } else {
                    unreachable!("VisualHandler::handle called with incompatible state/action")
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
                    unreachable!("VisualHandler::handle called with incompatible state/action")
                }
            }
            _ => unreachable!("VisualHandler::handle called with unhandled action"),
        }
    }
}

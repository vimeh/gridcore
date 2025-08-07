use crate::state::{Action, ResizeTarget, UIState};
use gridcore_core::Result;

/// Handles column and row resizing operations
pub struct ResizeBehavior {
    number_buffer: String,
}

/// Actions that can be performed during resize mode
#[derive(Debug, Clone)]
pub enum ResizeAction {
    Resize { delta: f64 },
    AutoFit,
    MoveTarget { direction: MoveDirection },
    Confirm,
    Cancel,
    None,
}

#[derive(Debug, Clone, Copy)]
pub enum MoveDirection {
    Previous,
    Next,
}

impl ResizeBehavior {
    pub fn new() -> Self {
        Self {
            number_buffer: String::new(),
        }
    }

    /// Process a key press in resize mode
    pub fn handle_key(&mut self, key: &str, state: &UIState) -> Result<Option<Action>> {
        // Accumulate number buffer for multipliers
        if key.len() == 1 && key.chars().next().unwrap().is_ascii_digit() {
            self.number_buffer.push_str(key);
            return Ok(None);
        }

        let multiplier = self.get_multiplier();
        self.clear_number_buffer();

        match key {
            // Increase size
            "+" | ">" => Ok(Some(Action::UpdateResize {
                delta: 5.0 * multiplier as f64,
            })),

            // Decrease size
            "-" | "<" => Ok(Some(Action::UpdateResize {
                delta: -5.0 * multiplier as f64,
            })),

            // Auto-fit to content
            "=" => Ok(Some(Action::AutoFitResize)),

            // Navigate columns/rows
            "h" | "ArrowLeft" => self.handle_navigation(state, MoveDirection::Previous, true),
            "l" | "ArrowRight" => self.handle_navigation(state, MoveDirection::Next, true),
            "k" | "ArrowUp" => self.handle_navigation(state, MoveDirection::Previous, false),
            "j" | "ArrowDown" => self.handle_navigation(state, MoveDirection::Next, false),

            // Confirm resize
            "Enter" | "\r" | "\n" => Ok(Some(Action::ConfirmResize)),

            // Cancel resize
            "Escape" => Ok(Some(Action::CancelResize)),

            _ => Ok(None),
        }
    }

    fn handle_navigation(
        &self,
        state: &UIState,
        direction: MoveDirection,
        is_horizontal: bool,
    ) -> Result<Option<Action>> {
        // Check if we're in resize mode and get the target
        if let UIState::Resize { target, .. } = state {
            let is_column_resize = matches!(target, ResizeTarget::Column { .. });

            // Only allow horizontal navigation for columns, vertical for rows
            if is_column_resize == is_horizontal {
                let new_direction = match direction {
                    MoveDirection::Previous => crate::state::ResizeMoveDirection::Previous,
                    MoveDirection::Next => crate::state::ResizeMoveDirection::Next,
                };

                return Ok(Some(Action::MoveResizeTarget {
                    direction: new_direction,
                }));
            }
        }

        Ok(None)
    }

    fn get_multiplier(&self) -> usize {
        self.number_buffer.parse().unwrap_or(1).max(1)
    }

    fn clear_number_buffer(&mut self) {
        self.number_buffer.clear();
    }

    /// Reset the behavior state
    pub fn reset(&mut self) {
        self.clear_number_buffer();
    }

    /// Get current resize info for display
    pub fn get_resize_info(&self, state: &UIState) -> Option<ResizeInfo> {
        if let UIState::Resize {
            target,
            current_size,
            original_size,
            ..
        } = state
        {
            Some(ResizeInfo {
                target: target.clone(),
                current_size: *current_size,
                original_size: *original_size,
                delta: (*current_size as i32 - *original_size as i32),
            })
        } else {
            None
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResizeInfo {
    pub target: ResizeTarget,
    pub current_size: u32,
    pub original_size: u32,
    pub delta: i32,
}

impl Default for ResizeBehavior {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::ViewportInfo;
    use gridcore_core::types::CellAddress;

    fn create_resize_state(target: ResizeTarget) -> UIState {
        UIState::Resize {
            target: target.clone(),
            resize_target: target,
            resize_index: match target {
                ResizeTarget::Column { index } => index,
                ResizeTarget::Row { index } => index,
            },
            initial_position: 100.0,
            current_position: 100.0,
            current_size: 100,
            original_size: 100,
            viewport: ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            },
            cursor: CellAddress::new(0, 0),
        }
    }

    #[test]
    fn test_resize_delta() {
        let mut behavior = ResizeBehavior::new();
        let state = create_resize_state(ResizeTarget::Column { index: 5 });

        // Increase size
        let action = behavior.handle_key("+", &state).unwrap();
        match action {
            Some(Action::UpdateResize { delta }) => assert_eq!(delta, 5.0),
            _ => panic!("Expected UpdateResize action"),
        }

        // Decrease size
        let action = behavior.handle_key("-", &state).unwrap();
        match action {
            Some(Action::UpdateResize { delta }) => assert_eq!(delta, -5.0),
            _ => panic!("Expected UpdateResize action"),
        }
    }

    #[test]
    fn test_number_multiplier() {
        let mut behavior = ResizeBehavior::new();
        let state = create_resize_state(ResizeTarget::Column { index: 5 });

        // Enter "10" as multiplier
        behavior.handle_key("1", &state).unwrap();
        behavior.handle_key("0", &state).unwrap();

        // Now resize with multiplier
        let action = behavior.handle_key("+", &state).unwrap();
        match action {
            Some(Action::UpdateResize { delta }) => assert_eq!(delta, 50.0),
            _ => panic!("Expected UpdateResize action with multiplier"),
        }
    }

    #[test]
    fn test_column_navigation() {
        let mut behavior = ResizeBehavior::new();
        let state = create_resize_state(ResizeTarget::Column { index: 5 });

        // Should allow horizontal navigation for columns
        let action = behavior.handle_key("h", &state).unwrap();
        assert!(matches!(action, Some(Action::MoveResizeTarget { .. })));

        // Should not allow vertical navigation for columns
        let action = behavior.handle_key("j", &state).unwrap();
        assert!(action.is_none());
    }

    #[test]
    fn test_row_navigation() {
        let mut behavior = ResizeBehavior::new();
        let state = create_resize_state(ResizeTarget::Row { index: 10 });

        // Should allow vertical navigation for rows
        let action = behavior.handle_key("k", &state).unwrap();
        assert!(matches!(action, Some(Action::MoveResizeTarget { .. })));

        // Should not allow horizontal navigation for rows
        let action = behavior.handle_key("l", &state).unwrap();
        assert!(action.is_none());
    }

    #[test]
    fn test_confirm_cancel() {
        let mut behavior = ResizeBehavior::new();
        let state = create_resize_state(ResizeTarget::Column { index: 5 });

        // Test confirm
        let action = behavior.handle_key("Enter", &state).unwrap();
        assert!(matches!(action, Some(Action::ConfirmResize)));

        // Test cancel
        let action = behavior.handle_key("Escape", &state).unwrap();
        assert!(matches!(action, Some(Action::CancelResize)));
    }

    #[test]
    fn test_auto_fit() {
        let mut behavior = ResizeBehavior::new();
        let state = create_resize_state(ResizeTarget::Column { index: 5 });

        let action = behavior.handle_key("=", &state).unwrap();
        assert!(matches!(action, Some(Action::AutoFitResize)));
    }
}

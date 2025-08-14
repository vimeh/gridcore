use crate::state::{Action, ResizeTarget, UIState};
use gridcore_core::Result;
use serde::{Deserialize, Serialize};

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
        if key.len() == 1 {
            if let Some(ch) = key.chars().next() {
                if ch.is_ascii_digit() {
                    self.number_buffer.push_str(key);
                    return Ok(None);
                }
            }
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
        if let UIState::Navigation {
            modal: Some(crate::state::NavigationModal::Resize { target, .. }),
            ..
        } = state
        {
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
        if let UIState::Navigation {
            modal: Some(crate::state::NavigationModal::Resize { target, sizes }),
            ..
        } = state
        {
            return Some(ResizeInfo {
                target: *target,
                current_size: sizes.current_size,
                original_size: sizes.original_size,
                delta: (sizes.current_size as i32 - sizes.original_size as i32),
            });
        }
        None
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

// Mouse-based resize operations

/// Type of resize operation (matches the old ResizeType from managers)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResizeType {
    None,
    Column,
    Row,
}

/// State of an ongoing resize operation
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct ResizeState {
    pub is_resizing: bool,
    pub resize_type: ResizeType,
    pub resize_index: usize,
    pub start_position: f64,
    pub start_size: f64,
    pub current_size: f64,
}

impl Default for ResizeState {
    fn default() -> Self {
        Self {
            is_resizing: false,
            resize_type: ResizeType::None,
            resize_index: 0,
            start_position: 0.0,
            start_size: 0.0,
            current_size: 0.0,
        }
    }
}

/// Check if a position is near a resize handle
pub fn check_resize_hover(
    x: f64,
    y: f64,
    is_column_header: bool,
    column_positions: &[(usize, f64)], // (index, x_position)
    row_positions: &[(usize, f64)],    // (index, y_position)
    resize_threshold: f64,
) -> Option<(ResizeType, usize)> {
    if is_column_header {
        // Check column edges
        for &(col_index, edge_x) in column_positions {
            if (x - edge_x).abs() < resize_threshold {
                return Some((ResizeType::Column, col_index));
            }
        }
    } else {
        // Check row edges
        for &(row_index, edge_y) in row_positions {
            if (y - edge_y).abs() < resize_threshold {
                return Some((ResizeType::Row, row_index));
            }
        }
    }
    None
}

/// Start a mouse-based resize operation
pub fn start_mouse_resize(
    resize_type: ResizeType,
    index: usize,
    start_position: f64,
    current_size: f64,
) -> ResizeState {
    ResizeState {
        is_resizing: true,
        resize_type,
        resize_index: index,
        start_position,
        start_size: current_size,
        current_size,
    }
}

/// Update resize based on mouse position
pub fn update_mouse_resize(
    state: &ResizeState,
    current_position: f64,
    min_size: f64,
    max_size: f64,
) -> Option<(ResizeType, usize, f64)> {
    if !state.is_resizing {
        return None;
    }

    let delta = current_position - state.start_position;
    let new_size = (state.start_size + delta).max(min_size).min(max_size);

    Some((state.resize_type, state.resize_index, new_size))
}

/// End the resize operation
pub fn end_mouse_resize(state: &ResizeState) -> Option<(ResizeType, usize, f64)> {
    if !state.is_resizing {
        return None;
    }

    Some((state.resize_type, state.resize_index, state.current_size))
}

/// Get cursor style for a given resize type
pub fn get_cursor_style(resize_type: Option<ResizeType>) -> &'static str {
    match resize_type {
        Some(ResizeType::Column) => "col-resize",
        Some(ResizeType::Row) => "row-resize",
        _ => "default",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::ViewportInfo;
    use gridcore_core::types::CellAddress;

    fn create_resize_state(target: ResizeTarget) -> UIState {
        UIState::Navigation {
            core: crate::state::CoreState {
                cursor: CellAddress::new(0, 0),
                viewport: ViewportInfo {
                    start_row: 0,
                    start_col: 0,
                    rows: 20,
                    cols: 10,
                },
            },
            selection: None,
            modal: Some(crate::state::NavigationModal::Resize {
                target,
                sizes: crate::state::ResizeSizes {
                    original_size: 100,
                    current_size: 100,
                    initial_position: 100.0,
                    current_position: 100.0,
                    resize_index: match target {
                        ResizeTarget::Column { index } => index,
                        ResizeTarget::Row { index } => index,
                    },
                },
            }),
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

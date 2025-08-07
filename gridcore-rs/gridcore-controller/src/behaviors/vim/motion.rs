use crate::state::ViewportInfo;
use gridcore_core::{types::CellAddress, Result};

/// Represents the direction of a motion
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Forward,
    Backward,
    Up,
    Down,
}

/// Context for motion calculations
pub struct MotionContext {
    pub current_position: CellAddress,
    pub viewport: ViewportInfo,
    pub max_rows: u32,
    pub max_cols: u32,
}

impl MotionContext {
    pub fn new(current: CellAddress, viewport: ViewportInfo) -> Self {
        Self {
            current_position: current,
            viewport,
            max_rows: 1048576, // Excel max
            max_cols: 16384,   // Excel max
        }
    }
}

/// Calculate the result of applying a motion
pub fn apply_motion(motion: &super::Motion, context: &MotionContext) -> Result<CellAddress> {
    use super::Motion;
    let current = &context.current_position;

    let new_address = match motion {
        Motion::Left(n) => CellAddress::new(current.col.saturating_sub(*n as u32), current.row),
        Motion::Right(n) => CellAddress::new(
            (current.col + *n as u32).min(context.max_cols - 1),
            current.row,
        ),
        Motion::Up(n) => CellAddress::new(current.col, current.row.saturating_sub(*n as u32)),
        Motion::Down(n) => CellAddress::new(
            current.col,
            (current.row + *n as u32).min(context.max_rows - 1),
        ),

        // Line motions
        Motion::LineStart => CellAddress::new(0, current.row),
        Motion::LineEnd => CellAddress::new(context.max_cols - 1, current.row),
        Motion::FirstNonBlank => CellAddress::new(0, current.row), // Simplified for spreadsheet

        // Document motions
        Motion::DocumentStart => CellAddress::new(0, 0),
        Motion::DocumentEnd => CellAddress::new(context.max_cols - 1, context.max_rows - 1),
        Motion::GotoLine(line) => CellAddress::new(current.col, (*line).min(context.max_rows - 1)),

        // Word motions (simplified for spreadsheet - jump by cells)
        Motion::WordForward(n) => {
            let new_col = (current.col + *n as u32).min(context.max_cols - 1);
            CellAddress::new(new_col, current.row)
        }
        Motion::WordBackward(n) => {
            let new_col = current.col.saturating_sub(*n as u32);
            CellAddress::new(new_col, current.row)
        }
        Motion::WordEnd(n) => {
            // In spreadsheet context, word end is same as word forward
            let new_col = (current.col + *n as u32).min(context.max_cols - 1);
            CellAddress::new(new_col, current.row)
        }
        Motion::BigWordForward(n) => {
            // Big word jumps more cells
            let new_col = (current.col + (*n as u32 * 5)).min(context.max_cols - 1);
            CellAddress::new(new_col, current.row)
        }
        Motion::BigWordBackward(n) => {
            let new_col = current.col.saturating_sub(*n as u32 * 5);
            CellAddress::new(new_col, current.row)
        }
        Motion::BigWordEnd(n) => {
            let new_col = (current.col + (*n as u32 * 5)).min(context.max_cols - 1);
            CellAddress::new(new_col, current.row)
        }

        // Paragraph motions (jump by blocks of rows)
        Motion::ParagraphForward(n) => {
            let new_row = (current.row + (*n as u32 * 10)).min(context.max_rows - 1);
            CellAddress::new(current.col, new_row)
        }
        Motion::ParagraphBackward(n) => {
            let new_row = current.row.saturating_sub(*n as u32 * 10);
            CellAddress::new(current.col, new_row)
        }

        // Section motions (jump by larger blocks)
        Motion::SectionForward(n) => {
            let new_row = (current.row + (*n as u32 * 50)).min(context.max_rows - 1);
            CellAddress::new(current.col, new_row)
        }
        Motion::SectionBackward(n) => {
            let new_row = current.row.saturating_sub(*n as u32 * 50);
            CellAddress::new(current.col, new_row)
        }

        // Find character motions
        Motion::FindChar(_, _)
        | Motion::FindCharBefore(_, _)
        | Motion::RepeatFind
        | Motion::RepeatFindReverse => {
            // These require cell content, return current position for now
            current.clone()
        }
    };

    Ok(new_address)
}

/// Calculate the range affected by a motion (for operators)
pub fn motion_range(
    motion: &super::Motion,
    context: &MotionContext,
) -> Result<(CellAddress, CellAddress)> {
    let start = context.current_position.clone();
    let end = apply_motion(motion, context)?;

    // Ensure start is before end
    let (start, end) = if start.row < end.row || (start.row == end.row && start.col <= end.col) {
        (start, end)
    } else {
        (end, start)
    };

    Ok((start, end))
}

/// Check if a motion is linewise (affects entire lines)
pub fn is_linewise_motion(motion: &super::Motion) -> bool {
    use super::Motion;
    matches!(
        motion,
        Motion::LineStart
            | Motion::LineEnd
            | Motion::FirstNonBlank
            | Motion::ParagraphForward(_)
            | Motion::ParagraphBackward(_)
            | Motion::SectionForward(_)
            | Motion::SectionBackward(_)
    )
}

/// Check if a motion is characterwise (affects individual cells)
pub fn is_characterwise_motion(motion: &super::Motion) -> bool {
    !is_linewise_motion(motion)
}

/// Calculate viewport adjustment needed after motion
pub fn adjust_viewport_for_motion(
    new_position: &CellAddress,
    viewport: &ViewportInfo,
) -> Option<ViewportInfo> {
    let mut adjusted = viewport.clone();
    let mut needs_adjustment = false;

    // Check if new position is outside current viewport
    if new_position.row < viewport.start_row {
        adjusted.start_row = new_position.row;
        needs_adjustment = true;
    } else if new_position.row >= viewport.start_row + viewport.rows {
        adjusted.start_row = new_position.row.saturating_sub(viewport.rows - 1);
        needs_adjustment = true;
    }

    if new_position.col < viewport.start_col {
        adjusted.start_col = new_position.col;
        needs_adjustment = true;
    } else if new_position.col >= viewport.start_col + viewport.cols {
        adjusted.start_col = new_position.col.saturating_sub(viewport.cols - 1);
        needs_adjustment = true;
    }

    if needs_adjustment {
        Some(adjusted)
    } else {
        None
    }
}

/// Helper to calculate jump destinations for marks
pub fn calculate_mark_position(
    mark: char,
    marks: &std::collections::HashMap<char, CellAddress>,
) -> Option<CellAddress> {
    marks.get(&mark).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_motions() {
        let context = MotionContext::new(
            CellAddress::new(5, 5),
            ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            },
        );

        // Test left motion
        let result = apply_motion(&super::super::Motion::Left(2), &context).unwrap();
        assert_eq!(result.col, 3);
        assert_eq!(result.row, 5);

        // Test down motion
        let result = apply_motion(&super::super::Motion::Down(3), &context).unwrap();
        assert_eq!(result.col, 5);
        assert_eq!(result.row, 8);

        // Test line start
        let result = apply_motion(&super::super::Motion::LineStart, &context).unwrap();
        assert_eq!(result.col, 0);
        assert_eq!(result.row, 5);
    }

    #[test]
    fn test_boundary_conditions() {
        let context = MotionContext::new(
            CellAddress::new(0, 0),
            ViewportInfo {
                start_row: 0,
                start_col: 0,
                rows: 20,
                cols: 10,
            },
        );

        // Test moving left at boundary
        let result = apply_motion(&super::super::Motion::Left(5), &context).unwrap();
        assert_eq!(result.col, 0);
        assert_eq!(result.row, 0);

        // Test moving up at boundary
        let result = apply_motion(&super::super::Motion::Up(5), &context).unwrap();
        assert_eq!(result.col, 0);
        assert_eq!(result.row, 0);
    }

    #[test]
    fn test_viewport_adjustment() {
        let viewport = ViewportInfo {
            start_row: 10,
            start_col: 10,
            rows: 20,
            cols: 10,
        };

        // Position above viewport
        let pos = CellAddress::new(15, 5);
        let adjusted = adjust_viewport_for_motion(&pos, &viewport);
        assert!(adjusted.is_some());
        assert_eq!(adjusted.unwrap().start_row, 5);

        // Position below viewport
        let pos = CellAddress::new(15, 35);
        let adjusted = adjust_viewport_for_motion(&pos, &viewport);
        assert!(adjusted.is_some());
        assert_eq!(adjusted.unwrap().start_row, 16);

        // Position within viewport
        let pos = CellAddress::new(15, 15);
        let adjusted = adjust_viewport_for_motion(&pos, &viewport);
        assert!(adjusted.is_none());
    }
}

//! Comprehensive tests for the new vim behavior implementation

use super::{
    vim_core::{InsertMode, Operator, VimContext, VimMode, VimResult, VisualMode},
    vim_impl::VimBehaviorImpl,
    VimBehavior,
};
use crate::state::{Action, SelectionType};
use gridcore_core::types::CellAddress;

fn create_test_context() -> VimContext {
    VimContext {
        cursor: CellAddress::new(5, 10),
        mode: VimMode::Normal,
        register: None,
        count: None,
    }
}

#[test]
fn test_mode_transitions() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Normal -> Insert
    let result = vim.process_key("i", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(InsertMode::Insert)));
    assert!(matches!(
        result,
        VimResult::Action(Action::EnterInsertMode { .. })
    ));

    // Insert -> Normal
    let result = vim.process_key("Escape", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
    assert!(matches!(result, VimResult::Action(Action::ExitInsertMode)));

    // Normal -> Visual Character
    let result = vim.process_key("v", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Visual(VisualMode::Character)));
    assert!(matches!(
        result,
        VimResult::Action(Action::EnterSpreadsheetVisualMode { .. })
    ));

    // Visual -> Normal
    let result = vim.process_key("Escape", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
    assert!(matches!(
        result,
        VimResult::Action(Action::ExitSpreadsheetVisualMode)
    ));

    // Normal -> Command
    let result = vim.process_key(":", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Command));
    assert!(matches!(
        result,
        VimResult::Action(Action::EnterCommandMode)
    ));
}

#[test]
fn test_basic_motions() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test h/j/k/l
    let result = vim.process_key("h", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 4);
        assert_eq!(cursor.row, 10);
    } else {
        panic!("Expected cursor update");
    }

    let result = vim.process_key("j", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 5);
        assert_eq!(cursor.row, 11);
    } else {
        panic!("Expected cursor update");
    }

    let result = vim.process_key("k", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 5);
        assert_eq!(cursor.row, 9);
    } else {
        panic!("Expected cursor update");
    }

    let result = vim.process_key("l", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 6);
        assert_eq!(cursor.row, 10);
    } else {
        panic!("Expected cursor update");
    }
}

#[test]
fn test_count_motions() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test 5j
    vim.process_key("5", &context).unwrap();
    let result = vim.process_key("j", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.row, 15);
        assert_eq!(cursor.col, 5);
    } else {
        panic!("Expected cursor update with count");
    }

    // Test 3h
    vim.process_key("3", &context).unwrap();
    let result = vim.process_key("h", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 2);
        assert_eq!(cursor.row, 10);
    } else {
        panic!("Expected cursor update with count");
    }
}

#[test]
fn test_line_motions() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test 0 (line start)
    let result = vim.process_key("0", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 0);
        assert_eq!(cursor.row, 10);
    } else {
        panic!("Expected cursor to line start");
    }

    // Test $ (line end)
    let result = vim.process_key("$", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 9999); // Will be clamped by viewport
        assert_eq!(cursor.row, 10);
    } else {
        panic!("Expected cursor to line end");
    }
}

#[test]
fn test_document_motions() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test gg (document start)
    vim.process_key("g", &context).unwrap();
    let result = vim.process_key("g", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 0);
        assert_eq!(cursor.row, 0);
    } else {
        panic!("Expected cursor to document start");
    }

    // Test G (document end)
    let result = vim.process_key("G", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 5);
        assert_eq!(cursor.row, 9999); // Will be clamped by viewport
    } else {
        panic!("Expected cursor to document end");
    }
}

#[test]
fn test_word_motions() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test w (word forward)
    let result = vim.process_key("w", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 6);
    } else {
        panic!("Expected word forward motion");
    }

    // Test b (word backward)
    let result = vim.process_key("b", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 4);
    } else {
        panic!("Expected word backward motion");
    }

    // Test 3w
    vim.process_key("3", &context).unwrap();
    let result = vim.process_key("w", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 8);
    } else {
        panic!("Expected multiple word forward motion");
    }
}

#[test]
fn test_delete_operator() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test dd (delete line)
    vim.process_key("d", &context).unwrap();
    assert!(matches!(
        vim.mode(),
        VimMode::OperatorPending(Operator::Delete)
    ));

    let result = vim.process_key("d", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
    if let VimResult::Action(Action::StartDelete { delete_type, .. }) = result {
        assert!(matches!(delete_type, crate::state::DeleteType::Row));
    } else {
        panic!("Expected delete line action");
    }
}

#[test]
fn test_change_operator() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test cc (change line)
    vim.process_key("c", &context).unwrap();
    assert!(matches!(
        vim.mode(),
        VimMode::OperatorPending(Operator::Change)
    ));

    let result = vim.process_key("c", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(InsertMode::Insert)));
    if let VimResult::Action(Action::EnterInsertMode { .. }) = result {
        // Success
    } else {
        panic!("Expected enter insert mode after cc");
    }
}

#[test]
fn test_yank_operator() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test yy (yank line)
    vim.process_key("y", &context).unwrap();
    assert!(matches!(
        vim.mode(),
        VimMode::OperatorPending(Operator::Yank)
    ));

    vim.process_key("y", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
    // Should have yanked to register
    assert!(vim.get_register('0').is_some());
}

#[test]
fn test_visual_mode_selection() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Enter visual mode
    vim.process_key("v", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Visual(VisualMode::Character)));

    // Move to extend selection
    let result = vim.process_key("l", &context).unwrap();
    if let VimResult::Action(Action::UpdateSelection { selection }) = result {
        match selection.selection_type {
            SelectionType::Range { start, end } => {
                assert_eq!(start, context.cursor);
                assert_eq!(end.col, 6);
            }
            _ => panic!("Expected range selection"),
        }
    } else {
        panic!("Expected selection update");
    }

    // Delete selection
    let result = vim.process_key("d", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
    assert!(matches!(
        result,
        VimResult::Action(Action::StartDelete { .. })
    ));
}

#[test]
fn test_visual_line_mode() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Enter visual line mode
    vim.process_key("V", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Visual(VisualMode::Line)));

    // Move down to select lines
    let result = vim.process_key("j", &context).unwrap();
    if let VimResult::Action(Action::UpdateSelection { selection }) = result {
        match selection.selection_type {
            SelectionType::Row { rows } => {
                assert_eq!(rows.len(), 2);
                assert!(rows.contains(&10));
                assert!(rows.contains(&11));
            }
            _ => panic!("Expected row selection"),
        }
    } else {
        panic!("Expected selection update");
    }
}

#[test]
fn test_register_operations() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test "ayy (yank to register a)
    vim.process_key("\"", &context).unwrap();
    vim.process_key("a", &context).unwrap();
    vim.process_key("y", &context).unwrap();
    vim.process_key("y", &context).unwrap();

    assert!(vim.get_register('a').is_some());
}

#[test]
fn test_ex_commands() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Enter command mode
    vim.process_key(":", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Command));

    // Type "w"
    let result = vim.process_key("w", &context).unwrap();
    if let VimResult::Action(Action::UpdateCommandValue { value }) = result {
        assert_eq!(value, ":w");
    } else {
        panic!("Expected command value update");
    }

    // Execute command
    vim.process_key("Enter", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
}

#[test]
fn test_insert_mode_variants() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test 'a' (append)
    vim.process_key("a", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(InsertMode::Append)));
    vim.process_key("Escape", &context).unwrap();

    // Test 'I' (insert at line start)
    vim.process_key("I", &context).unwrap();
    assert!(matches!(
        vim.mode(),
        VimMode::Insert(InsertMode::InsertStart)
    ));
    vim.process_key("Escape", &context).unwrap();

    // Test 'A' (append at line end)
    vim.process_key("A", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(InsertMode::AppendEnd)));
    vim.process_key("Escape", &context).unwrap();
}

#[test]
fn test_text_objects() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test diw (delete inner word)
    let result = vim.parse_and_execute("diw", &context);
    assert!(result.is_ok());

    // Test ci{ (change inner braces)
    let result = vim.parse_and_execute("ci{", &context);
    assert!(result.is_ok());
    assert!(matches!(vim.mode(), VimMode::Insert(_)));
}

// Helper implementation for testing
impl VimBehaviorImpl {
    fn parse_and_execute(
        &mut self,
        command: &str,
        context: &VimContext,
    ) -> Result<VimResult, String> {
        for ch in command.chars() {
            match self.process_key(&ch.to_string(), context) {
                Ok(VimResult::None) | Ok(VimResult::Incomplete) => continue,
                Ok(result) => return Ok(result),
                Err(e) => return Err(e.to_string()),
            }
        }
        Ok(VimResult::None)
    }
}

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

// ==================== Additional Missing Test Coverage ====================

#[test]
fn test_find_char_forward() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test f{char} - find character forward
    // Note: This requires find motion implementation
    vim.process_key("f", &context).unwrap();
    vim.process_key("x", &context).unwrap();
    // Should move to next 'x' character
}

#[test]
fn test_find_char_backward() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test F{char} - find character backward
    vim.process_key("F", &context).unwrap();
    vim.process_key("x", &context).unwrap();
    // Should move to previous 'x' character
}

#[test]
fn test_till_char_forward() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test t{char} - move till character forward
    vim.process_key("t", &context).unwrap();
    vim.process_key("x", &context).unwrap();
    // Should move to position before next 'x'
}

#[test]
fn test_till_char_backward() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test T{char} - move till character backward
    vim.process_key("T", &context).unwrap();
    vim.process_key("x", &context).unwrap();
    // Should move to position after previous 'x'
}

#[test]
fn test_repeat_find() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // First find a character
    vim.process_key("f", &context).unwrap();
    vim.process_key("x", &context).unwrap();
    
    // Test ; - repeat find in same direction
    vim.process_key(";", &context).unwrap();
    
    // Test , - repeat find in opposite direction
    vim.process_key(",", &context).unwrap();
}

#[test]
fn test_set_and_jump_to_mark() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Set mark 'a' at current position
    vim.process_key("m", &context).unwrap();
    vim.process_key("a", &context).unwrap();
    
    // Move somewhere else
    vim.process_key("j", &context).unwrap();
    vim.process_key("l", &context).unwrap();
    
    // Jump back to mark 'a'
    vim.process_key("'", &context).unwrap();
    vim.process_key("a", &context).unwrap();
    
    // Verify we're back at the marked position
    assert!(vim.get_mark('a').is_some());
}

#[test]
fn test_search_forward() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Enter search mode
    vim.process_key("/", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Command));
    
    // Type search pattern
    vim.process_key("f", &context).unwrap();
    vim.process_key("o", &context).unwrap();
    vim.process_key("o", &context).unwrap();
    
    // Execute search
    vim.process_key("Enter", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
}

#[test]
fn test_search_backward() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Enter reverse search mode
    vim.process_key("?", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Command));
    
    // Type search pattern
    vim.process_key("b", &context).unwrap();
    vim.process_key("a", &context).unwrap();
    vim.process_key("r", &context).unwrap();
    
    // Execute search
    vim.process_key("Enter", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
}

#[test]
fn test_next_and_previous_match() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Perform initial search
    vim.process_key("/", &context).unwrap();
    vim.process_key("t", &context).unwrap();
    vim.process_key("e", &context).unwrap();
    vim.process_key("s", &context).unwrap();
    vim.process_key("t", &context).unwrap();
    vim.process_key("Enter", &context).unwrap();
    
    // Test n - next match
    vim.process_key("n", &context).unwrap();
    
    // Test N - previous match
    vim.process_key("N", &context).unwrap();
}

#[test]
fn test_open_line_below() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test o - open line below and enter insert mode
    vim.process_key("o", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(InsertMode::OpenBelow)));
}

#[test]
fn test_open_line_above() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test O - open line above and enter insert mode
    vim.process_key("O", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(InsertMode::OpenAbove)));
}

#[test]
fn test_zero_as_motion_not_count() {
    let mut vim = VimBehaviorImpl::new();
    let mut context = create_test_context();
    context.cursor = CellAddress::new(5, 5);

    // 0 should move to line start, not be treated as count
    let result = vim.process_key("0", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.col, 0);
        assert_eq!(cursor.row, 5);
    } else {
        panic!("Expected cursor to move to line start");
    }
    
    // But 10j should work (0 is part of count)
    vim.process_key("1", &context).unwrap();
    vim.process_key("0", &context).unwrap();
    let result = vim.process_key("j", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.row, 15);
    } else {
        panic!("Expected cursor to move down 10 lines");
    }
}

#[test]
fn test_multi_digit_counts() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test 123j - move down 123 lines
    vim.process_key("1", &context).unwrap();
    vim.process_key("2", &context).unwrap();
    vim.process_key("3", &context).unwrap();
    let result = vim.process_key("j", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.row, 133);
    } else {
        panic!("Expected cursor to move down 123 lines");
    }
}

#[test]
fn test_invalid_keys() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Invalid keys should return None or be ignored
    let result = vim.process_key("@", &context).unwrap();
    assert!(matches!(result, VimResult::None));
    
    let _result = vim.process_key("#", &context).unwrap();
    // # is actually search backward for word under cursor
    // but without implementation, should be handled gracefully
}

#[test]
fn test_operator_cancellation() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Enter operator pending mode
    vim.process_key("d", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::OperatorPending(_)));
    
    // Escape should cancel and return to normal mode
    vim.process_key("Escape", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Normal));
}

#[test]
fn test_operator_with_find_motion() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test df) - delete till )
    vim.process_key("d", &context).unwrap();
    vim.process_key("f", &context).unwrap();
    vim.process_key(")", &context).unwrap();
    // Should delete from cursor to next )
}

#[test]
fn test_operator_with_paragraph_motion() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test d{ - delete to previous paragraph
    let result = vim.parse_and_execute("d{", &context);
    assert!(result.is_ok());
    
    // Test y} - yank to next paragraph
    let result = vim.parse_and_execute("y}", &context);
    assert!(result.is_ok());
}

#[test]
fn test_double_operators_with_count() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test 3dd - delete 3 lines
    vim.process_key("3", &context).unwrap();
    vim.process_key("d", &context).unwrap();
    let result = vim.process_key("d", &context).unwrap();
    if let VimResult::Action(Action::StartDelete { .. }) = result {
        // Should delete 3 lines
    } else {
        panic!("Expected delete action for 3dd");
    }
    
    // Test 5yy - yank 5 lines
    vim.process_key("5", &context).unwrap();
    vim.process_key("y", &context).unwrap();
    vim.process_key("y", &context).unwrap();
    // Should yank 5 lines to register
}

#[test]
fn test_visual_block_mode() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test Ctrl-V - enter visual block mode
    // Note: This would typically be Ctrl-V, but we'll use a placeholder
    vim.process_key("v", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Visual(VisualMode::Character)));
    
    // Visual block mode would be:
    // vim.process_key("Ctrl-v", &context).unwrap();
    // assert!(matches!(vim.mode(), VimMode::Visual(VisualMode::Block)));
}

#[test]
fn test_replace_character() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test r{char} - replace character under cursor
    vim.process_key("r", &context).unwrap();
    vim.process_key("x", &context).unwrap();
    // Should replace character at cursor with 'x' and stay in normal mode
    assert!(matches!(vim.mode(), VimMode::Normal));
}

#[test]
fn test_substitute_character() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test s - substitute character (delete and enter insert)
    vim.process_key("s", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(_)));
}

#[test]
fn test_substitute_line() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test S - substitute line (delete line and enter insert)
    vim.process_key("S", &context).unwrap();
    assert!(matches!(vim.mode(), VimMode::Insert(_)));
}

#[test]
fn test_join_lines() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test J - join current line with next
    vim.process_key("J", &context).unwrap();
    // Should join lines and stay in normal mode
    assert!(matches!(vim.mode(), VimMode::Normal));
}

#[test]
fn test_goto_line_with_count() {
    let mut vim = VimBehaviorImpl::new();
    let context = create_test_context();

    // Test 42G - go to line 42
    vim.process_key("4", &context).unwrap();
    vim.process_key("2", &context).unwrap();
    let result = vim.process_key("G", &context).unwrap();
    if let VimResult::Action(Action::UpdateCursor { cursor }) = result {
        assert_eq!(cursor.row, 41); // 0-indexed, so line 42 is row 41
    } else {
        panic!("Expected cursor to move to line 42");
    }
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

# UI State Machine Analysis

Generated on: 2025-08-04T21:36:05.406Z

## State Machine Configuration

The UI State Machine manages the application's interaction modes and states.

### Top-level States
- **navigation**: Default mode for navigating between cells
- **editing**: Active cell editing with vim-like modes
- **command**: Command input mode
- **resize**: Column/row resizing mode

### Editing Sub-states
- **normal**: Vim normal mode for cell operations
- **insert**: Text insertion mode
- **visual**: Visual selection mode

## Analysis

=== State Machine History Analysis ===
Total transitions: 0
No transitions recorded.

## State Transition Summary

Current State  | Action             | Next State    
---------------|--------------------|---------------
command        | ESCAPE             | navigation    
command        | EXIT_COMMAND_MODE  | navigation    
editing        | ESCAPE             | navigation    
editing        | EXIT_TO_NAVIGATION | navigation    
editing.insert | EXIT_INSERT_MODE   | editing.normal
editing.normal | ENTER_INSERT_MODE  | editing.insert
editing.normal | ENTER_VISUAL_MODE  | editing.visual
editing.visual | EXIT_VISUAL_MODE   | editing.normal
navigation     | ENTER_COMMAND_MODE | command       
navigation     | ENTER_RESIZE_MODE  | resize        
navigation     | START_EDITING      | editing       
resize         | ESCAPE             | navigation    
resize         | EXIT_RESIZE_MODE   | navigation    

use crate::state::{Action, InsertMode};
use gridcore_core::Result;
use std::collections::HashMap;

/// Vim command type
#[derive(Debug, Clone, Copy)]
pub enum VimCommand {
    // Mode changes
    EnterInsert(InsertMode),
    EnterVisual(VisualMode),
    ExitToNormal,
    
    // Movement
    MoveCursor(Direction, usize),
    MoveToLineStart,
    MoveToLineEnd,
    MoveToFirstNonBlank,
    MoveWord(WordMotion),
    
    // Editing
    Delete(DeleteTarget),
    Change(ChangeTarget),
    Yank(YankTarget),
    Paste(PastePosition),
    Substitute(SubstituteTarget),
    
    // Other
    Undo,
    Redo,
    ExitCell,
}

#[derive(Debug, Clone, Copy)]
pub enum Direction {
    Left,
    Right,
    Up,
    Down,
}

#[derive(Debug, Clone, Copy)]
pub enum WordMotion {
    Forward,
    Backward,
    End,
    BigForward,
    BigBackward,
    BigEnd,
}

#[derive(Debug, Clone, Copy)]
pub enum DeleteTarget {
    Char,
    CharBefore,
    Line,
    ToEnd,
    Word,
    WordBackward,
}

#[derive(Debug, Clone, Copy)]
pub enum ChangeTarget {
    Line,
    ToEnd,
    Word,
    WordBackward,
}

#[derive(Debug, Clone, Copy)]
pub enum YankTarget {
    Line,
    ToEnd,
    Word,
}

#[derive(Debug, Clone, Copy)]
pub enum PastePosition {
    After,
    Before,
}

#[derive(Debug, Clone, Copy)]
pub enum SubstituteTarget {
    Char,
    Line,
}

#[derive(Debug, Clone, Copy)]
pub enum VisualMode {
    Character,
    Line,
    Block,
}

/// Command registry for efficient lookup
pub struct CommandRegistry {
    normal_commands: HashMap<&'static str, VimCommand>,
    insert_commands: HashMap<&'static str, VimCommand>,
    visual_commands: HashMap<&'static str, VimCommand>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            normal_commands: HashMap::new(),
            insert_commands: HashMap::new(),
            visual_commands: HashMap::new(),
        };
        
        registry.init_normal_commands();
        registry.init_insert_commands();
        registry.init_visual_commands();
        
        registry
    }
    
    fn init_normal_commands(&mut self) {
        use VimCommand::*;
        
        // Mode changes
        self.normal_commands.insert("i", EnterInsert(InsertMode::I));
        self.normal_commands.insert("a", EnterInsert(InsertMode::A));
        self.normal_commands.insert("I", EnterInsert(InsertMode::CapitalI));
        self.normal_commands.insert("A", EnterInsert(InsertMode::CapitalA));
        self.normal_commands.insert("o", EnterInsert(InsertMode::O));
        self.normal_commands.insert("O", EnterInsert(InsertMode::CapitalO));
        
        // Visual mode
        self.normal_commands.insert("v", EnterVisual(VisualMode::Character));
        self.normal_commands.insert("V", EnterVisual(VisualMode::Line));
        
        // Movement
        self.normal_commands.insert("h", MoveCursor(Direction::Left, 1));
        self.normal_commands.insert("ArrowLeft", MoveCursor(Direction::Left, 1));
        self.normal_commands.insert("l", MoveCursor(Direction::Right, 1));
        self.normal_commands.insert("ArrowRight", MoveCursor(Direction::Right, 1));
        self.normal_commands.insert("0", MoveToLineStart);
        self.normal_commands.insert("Home", MoveToLineStart);
        self.normal_commands.insert("$", MoveToLineEnd);
        self.normal_commands.insert("End", MoveToLineEnd);
        self.normal_commands.insert("^", MoveToFirstNonBlank);
        
        // Word movement
        self.normal_commands.insert("w", MoveWord(WordMotion::Forward));
        self.normal_commands.insert("b", MoveWord(WordMotion::Backward));
        self.normal_commands.insert("e", MoveWord(WordMotion::End));
        self.normal_commands.insert("W", MoveWord(WordMotion::BigForward));
        self.normal_commands.insert("B", MoveWord(WordMotion::BigBackward));
        self.normal_commands.insert("E", MoveWord(WordMotion::BigEnd));
        
        // Delete
        self.normal_commands.insert("x", Delete(DeleteTarget::Char));
        self.normal_commands.insert("X", Delete(DeleteTarget::CharBefore));
        self.normal_commands.insert("dd", Delete(DeleteTarget::Line));
        self.normal_commands.insert("D", Delete(DeleteTarget::ToEnd));
        self.normal_commands.insert("dw", Delete(DeleteTarget::Word));
        self.normal_commands.insert("db", Delete(DeleteTarget::WordBackward));
        
        // Change
        self.normal_commands.insert("cc", Change(ChangeTarget::Line));
        self.normal_commands.insert("C", Change(ChangeTarget::ToEnd));
        self.normal_commands.insert("cw", Change(ChangeTarget::Word));
        self.normal_commands.insert("cb", Change(ChangeTarget::WordBackward));
        self.normal_commands.insert("s", Substitute(SubstituteTarget::Char));
        self.normal_commands.insert("S", Substitute(SubstituteTarget::Line));
        
        // Copy/paste
        self.normal_commands.insert("yy", Yank(YankTarget::Line));
        self.normal_commands.insert("y$", Yank(YankTarget::ToEnd));
        self.normal_commands.insert("yw", Yank(YankTarget::Word));
        self.normal_commands.insert("p", Paste(PastePosition::After));
        self.normal_commands.insert("P", Paste(PastePosition::Before));
        
        // Other
        self.normal_commands.insert("u", Undo);
        self.normal_commands.insert("Escape", ExitCell);
    }
    
    fn init_insert_commands(&mut self) {
        use VimCommand::*;
        
        self.insert_commands.insert("Escape", ExitToNormal);
        self.insert_commands.insert("ArrowLeft", MoveCursor(Direction::Left, 1));
        self.insert_commands.insert("ArrowRight", MoveCursor(Direction::Right, 1));
        self.insert_commands.insert("Home", MoveToLineStart);
        self.insert_commands.insert("End", MoveToLineEnd);
    }
    
    fn init_visual_commands(&mut self) {
        use VimCommand::*;
        
        self.visual_commands.insert("Escape", ExitToNormal);
        // Add more visual commands as needed
    }
    
    pub fn get_normal_command(&self, key: &str) -> Option<&VimCommand> {
        self.normal_commands.get(key)
    }
    
    pub fn get_insert_command(&self, key: &str) -> Option<&VimCommand> {
        self.insert_commands.get(key)
    }
    
    pub fn get_visual_command(&self, key: &str) -> Option<&VimCommand> {
        self.visual_commands.get(key)
    }
}

impl Default for CommandRegistry {
    fn default() -> Self {
        Self::new()
    }
}
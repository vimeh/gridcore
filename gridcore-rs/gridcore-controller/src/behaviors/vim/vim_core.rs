//! Unified Vim type system and core behavior trait
//! This module consolidates all vim-related types and behaviors into a single, cohesive system

use crate::state::{Action, InsertMode as StateInsertMode, VisualMode as StateVisualMode};
use gridcore_core::Result;

/// Represents the current Vim mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VimMode {
    Normal,
    Insert(InsertMode),
    Visual(VisualMode),
    Command,
    Replace,
    OperatorPending(Operator),
}

/// Insert mode variants
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InsertMode {
    Insert,      // i - insert before cursor
    Append,      // a - append after cursor
    InsertStart, // I - insert at line start
    AppendEnd,   // A - append at line end
    OpenBelow,   // o - open line below
    OpenAbove,   // O - open line above
                 // Replace,     // R - replace mode (not yet implemented in state)
}

/// Visual mode variants
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VisualMode {
    Character, // v - character-wise selection
    Line,      // V - line-wise selection
    Block,     // Ctrl-v - block selection
}

/// Movement direction
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Left,
    Right,
    Up,
    Down,
}

/// Represents a Vim motion (movement command)
#[derive(Debug, Clone, PartialEq)]
pub enum Motion {
    // Character motions
    Char(Direction, usize),

    // Word motions
    WordForward(usize),
    WordBackward(usize),
    WordEnd(usize),
    BigWordForward(usize),
    BigWordBackward(usize),
    BigWordEnd(usize),

    // Line motions
    LineStart,
    LineEnd,
    FirstNonBlank,

    // Document motions
    DocumentStart,
    DocumentEnd,
    GotoLine(u32),

    // Search motions
    FindChar(char, bool), // char, forward?
    FindCharBefore(char, bool),
    RepeatFind,
    RepeatFindReverse,
    SearchForward(String),
    SearchBackward(String),
    NextMatch,
    PreviousMatch,

    // Paragraph/section motions
    ParagraphForward(usize),
    ParagraphBackward(usize),
    SectionForward(usize),
    SectionBackward(usize),

    // Bracket motions
    MatchingBracket,
}

/// Represents a Vim operator
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Operator {
    Delete,
    Change,
    Yank,
    Indent,
    Outdent,
    Format,
    LowerCase,
    UpperCase,
    ToggleCase,
}

/// Represents a Vim text object
#[derive(Debug, Clone, PartialEq)]
pub enum TextObject {
    Word,
    BigWord,
    Sentence,
    Paragraph,
    Block(char, char), // opening, closing delimiters
    Quote(char),
    Tag,
    Line,
    InnerWord,
    InnerBigWord,
    InnerSentence,
    InnerParagraph,
    InnerBlock(char, char),
    InnerQuote(char),
    InnerTag,
}

/// Target for an operator
#[derive(Debug, Clone, PartialEq)]
pub enum OperatorTarget {
    Motion(Motion),
    TextObject(TextObject),
    CurrentLine, // For double operators like dd, yy, cc
}

/// A complete vim command
#[derive(Debug, Clone)]
pub struct VimCommand {
    pub count: Option<usize>,
    pub register: Option<char>,
    pub operator: Option<Operator>,
    pub target: Option<OperatorTarget>,
}

impl VimCommand {
    pub fn new() -> Self {
        Self {
            count: None,
            register: None,
            operator: None,
            target: None,
        }
    }

    pub fn with_operator(operator: Operator) -> Self {
        Self {
            count: None,
            register: None,
            operator: Some(operator),
            target: None,
        }
    }

    pub fn motion(motion: Motion) -> Self {
        Self {
            count: None,
            register: None,
            operator: None,
            target: Some(OperatorTarget::Motion(motion)),
        }
    }
}

impl Default for VimCommand {
    fn default() -> Self {
        Self::new()
    }
}

/// Ex command (colon commands)
#[derive(Debug, Clone)]
pub struct ExCommand {
    pub range: Option<CommandRange>,
    pub command: String,
    pub args: Vec<String>,
    pub flags: Vec<String>,
}

/// Range specification for ex commands
#[derive(Debug, Clone, PartialEq)]
pub enum CommandRange {
    Line(u32),
    CurrentLine,
    LastLine,
    AllLines,
    Range(Box<CommandRange>, Box<CommandRange>),
    RelativeForward(Box<CommandRange>, u32),
    RelativeBackward(Box<CommandRange>, u32),
}

/// Context for vim operations
#[derive(Debug, Clone)]
pub struct VimContext {
    pub cursor: gridcore_core::types::CellAddress,
    pub mode: VimMode,
    pub register: Option<char>,
    pub count: Option<usize>,
}

/// Result of processing a vim command
#[derive(Debug)]
pub enum VimResult {
    /// Action to be performed by the state machine
    Action(Action),
    /// Mode change without action
    ModeChange(VimMode),
    /// Command is incomplete, waiting for more input
    Incomplete,
    /// No operation
    None,
}

/// Core trait for vim behavior
pub trait VimBehavior {
    /// Get current vim mode
    fn mode(&self) -> VimMode;

    /// Process a key press
    fn process_key(&mut self, key: &str, context: &VimContext) -> Result<VimResult>;

    /// Handle a complete motion
    fn handle_motion(&mut self, motion: Motion, context: &VimContext) -> Result<VimResult>;

    /// Handle an operator with its target
    fn handle_operator(
        &mut self,
        operator: Operator,
        target: OperatorTarget,
        context: &VimContext,
    ) -> Result<VimResult>;

    /// Enter a different mode
    fn enter_mode(&mut self, mode: VimMode) -> Result<VimResult>;

    /// Get pending command (for display)
    fn pending_keys(&self) -> &str;

    /// Clear pending command buffer
    fn clear_pending(&mut self);

    /// Execute an ex command
    fn execute_ex_command(&mut self, command: ExCommand) -> Result<VimResult>;
}

// Conversion helpers for integration with existing state types
impl From<InsertMode> for StateInsertMode {
    fn from(mode: InsertMode) -> Self {
        match mode {
            InsertMode::Insert => StateInsertMode::I,
            InsertMode::Append => StateInsertMode::A,
            InsertMode::InsertStart => StateInsertMode::CapitalI,
            InsertMode::AppendEnd => StateInsertMode::CapitalA,
            InsertMode::OpenBelow => StateInsertMode::O,
            InsertMode::OpenAbove => StateInsertMode::CapitalO,
            // InsertMode::Replace => StateInsertMode::CapitalR, // Not yet in state
        }
    }
}

impl From<VisualMode> for StateVisualMode {
    fn from(mode: VisualMode) -> Self {
        match mode {
            VisualMode::Character => StateVisualMode::Character,
            VisualMode::Line => StateVisualMode::Line,
            VisualMode::Block => StateVisualMode::Block,
        }
    }
}

use gridcore_core::SpreadsheetError;

/// Represents a parsed Ex command
#[derive(Debug, Clone)]
pub struct ExCommand {
    pub range: Option<CommandRange>,
    pub command: String,
    pub args: Vec<String>,
    pub flags: Vec<String>,
}

/// Represents a range specification in Ex commands
#[derive(Debug, Clone)]
pub enum CommandRange {
    Line(u32),
    Lines(u32, u32),
    Current,
    All,
    Visual,
    Marks(char, char),
    Pattern(String, String),
}

/// Types of bulk commands that can be executed
#[derive(Debug, Clone, PartialEq)]
pub enum BulkCommandType {
    FindReplace {
        find_pattern: String,
        replace_with: String,
        options: FindReplaceOptions,
    },
    BulkSet {
        value: String,
        requires_selection: bool,
    },
    MathOperation {
        operation: MathOp,
        value: f64,
    },
    Fill {
        direction: FillDirection,
    },
    Transform {
        transformation: TransformType,
    },
    Format {
        format_type: FormatType,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct FindReplaceOptions {
    pub global: bool,
    pub case_sensitive: bool,
    pub scope: SearchScope,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SearchScope {
    Selection,
    Sheet,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MathOp {
    Add,
    Sub,
    Mul,
    Div,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FillDirection {
    Down,
    Up,
    Left,
    Right,
    Series,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TransformType {
    Upper,
    Lower,
    Trim,
    Clean,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FormatType {
    Currency,
    Percent,
    Date,
    Number,
}

/// Command category for organization
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CommandCategory {
    FileOperations,
    Navigation,
    SearchReplace,
    EditOperations,
    CopyMove,
    Formatting,
    Settings,
    Marks,
    Registers,
    Formula,
    Chart,
    Help,
    Bulk,
}

/// Result type for command operations
pub type CommandResult = Result<Option<crate::state::Action>, SpreadsheetError>;

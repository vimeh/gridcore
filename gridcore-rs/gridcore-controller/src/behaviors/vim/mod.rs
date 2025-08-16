// Vim behavior modules - new unified architecture
pub mod ex_parser;
pub mod vim_core;
pub mod vim_impl;
pub mod vim_parser;

#[cfg(test)]
mod tests;

// Re-export core types
pub use vim_core::{
    CommandRange, Direction, ExCommand, InsertMode, Motion, Operator, OperatorTarget, TextObject,
    VimBehavior, VimCommand, VimContext, VimMode, VimResult, VisualMode,
};

// Re-export the main implementation
pub use vim_impl::VimBehaviorImpl;

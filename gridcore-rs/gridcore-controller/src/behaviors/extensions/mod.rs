use crate::state::{Action, UIState};
use gridcore_core::Result;

pub mod reference_toggle;

pub use reference_toggle::ReferenceToggleExtension;

/// Trait for vim behavior extensions
pub trait VimExtension {
    /// Handle a key press, returning an action if the extension handles it
    fn handle_key_press(
        &mut self,
        key: &str,
        meta: &KeyMeta,
        state: &UIState,
    ) -> Result<Option<Action>>;

    /// Get the name of this extension
    fn name(&self) -> &str;

    /// Check if this extension is enabled
    fn is_enabled(&self) -> bool {
        true
    }
}

/// Metadata about a key press
#[derive(Debug, Clone)]
pub struct KeyMeta {
    pub key: String,
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
    pub meta: bool,
}

impl KeyMeta {
    pub fn new(key: &str) -> Self {
        Self {
            key: key.to_string(),
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
        }
    }

    pub fn with_ctrl(mut self) -> Self {
        self.ctrl = true;
        self
    }

    pub fn with_shift(mut self) -> Self {
        self.shift = true;
        self
    }

    pub fn with_alt(mut self) -> Self {
        self.alt = true;
        self
    }

    pub fn with_meta(mut self) -> Self {
        self.meta = true;
        self
    }
}

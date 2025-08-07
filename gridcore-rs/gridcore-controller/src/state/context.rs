use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Shared context for state machine operations
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StateContext {
    /// Custom properties that can be attached to the state
    pub properties: HashMap<String, String>,

    /// Optional undo/redo stack reference
    pub can_undo: bool,
    pub can_redo: bool,

    /// Optional clipboard content
    pub clipboard: Option<String>,

    /// Current file path if editing a saved file
    pub file_path: Option<String>,

    /// Whether the document has unsaved changes
    pub is_dirty: bool,
}

impl StateContext {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_property(mut self, key: String, value: String) -> Self {
        self.properties.insert(key, value);
        self
    }

    pub fn get_property(&self, key: &str) -> Option<&String> {
        self.properties.get(key)
    }

    pub fn set_property(&mut self, key: String, value: String) {
        self.properties.insert(key, value);
    }

    pub fn remove_property(&mut self, key: &str) -> Option<String> {
        self.properties.remove(key)
    }
}

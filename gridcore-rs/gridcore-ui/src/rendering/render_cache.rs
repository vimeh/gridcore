use std::collections::HashMap;

/// Cache for rendered elements to avoid re-rendering unchanged cells
pub struct RenderCache {
    cell_cache: HashMap<CellKey, CellRenderData>,
    dirty_cells: Vec<CellKey>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct CellKey {
    pub row: u32,
    pub col: u32,
}

#[derive(Debug, Clone)]
pub struct CellRenderData {
    pub content: String,
    pub style_hash: u64,
    pub last_rendered: u64,
}

impl RenderCache {
    pub fn new() -> Self {
        Self {
            cell_cache: HashMap::new(),
            dirty_cells: Vec::new(),
        }
    }
    
    /// Check if a cell needs re-rendering
    pub fn needs_render(&self, key: &CellKey, content: &str, style_hash: u64) -> bool {
        match self.cell_cache.get(key) {
            Some(data) => data.content != content || data.style_hash != style_hash,
            None => true,
        }
    }
    
    /// Mark a cell as rendered
    pub fn mark_rendered(&mut self, key: CellKey, content: String, style_hash: u64) {
        self.cell_cache.insert(key, CellRenderData {
            content,
            style_hash,
            last_rendered: js_sys::Date::now() as u64,
        });
    }
    
    /// Mark cells as dirty
    pub fn mark_dirty(&mut self, cells: Vec<CellKey>) {
        self.dirty_cells.extend(cells);
    }
    
    /// Clear dirty cells
    pub fn clear_dirty(&mut self) -> Vec<CellKey> {
        std::mem::take(&mut self.dirty_cells)
    }
    
    /// Clear the entire cache
    pub fn clear(&mut self) {
        self.cell_cache.clear();
        self.dirty_cells.clear();
    }
    
    /// Prune old entries to prevent memory bloat
    pub fn prune_old_entries(&mut self, max_age_ms: u64) {
        let now = js_sys::Date::now() as u64;
        self.cell_cache.retain(|_, data| {
            now - data.last_rendered < max_age_ms
        });
    }
}
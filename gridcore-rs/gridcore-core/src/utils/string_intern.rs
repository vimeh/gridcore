use rustc_hash::FxHashMap;
use std::sync::{Arc, RwLock};

/// A thread-safe string interning pool for frequently used strings
/// like cell addresses and sheet names
#[derive(Debug, Clone)]
pub struct StringInterner {
    pool: Arc<RwLock<FxHashMap<String, Arc<str>>>>,
}

impl StringInterner {
    /// Create a new string interner
    pub fn new() -> Self {
        StringInterner {
            pool: Arc::new(RwLock::new(FxHashMap::default())),
        }
    }

    /// Create a new string interner with pre-allocated capacity
    pub fn with_capacity(capacity: usize) -> Self {
        StringInterner {
            pool: Arc::new(RwLock::new(FxHashMap::with_capacity_and_hasher(
                capacity,
                Default::default(),
            ))),
        }
    }

    /// Intern a string, returning an Arc to the interned version
    pub fn intern(&self, s: &str) -> Arc<str> {
        // First try read lock for fast path
        {
            let pool = self
                .pool
                .read()
                .expect("String interner read lock poisoned");
            if let Some(interned) = pool.get(s) {
                return Arc::clone(interned);
            }
        }

        // Need to add it - get write lock
        let mut pool = self
            .pool
            .write()
            .expect("String interner write lock poisoned");

        // Check again in case another thread added it
        if let Some(interned) = pool.get(s) {
            return Arc::clone(interned);
        }

        // Add new interned string
        let interned: Arc<str> = Arc::from(s);
        pool.insert(s.to_string(), Arc::clone(&interned));
        interned
    }

    /// Get the number of interned strings
    pub fn len(&self) -> usize {
        self.pool
            .read()
            .expect("String interner read lock poisoned")
            .len()
    }

    /// Check if the interner is empty
    pub fn is_empty(&self) -> bool {
        self.pool
            .read()
            .expect("String interner read lock poisoned")
            .is_empty()
    }

    /// Clear all interned strings
    pub fn clear(&self) {
        self.pool
            .write()
            .expect("String interner write lock poisoned")
            .clear();
    }
}

impl Default for StringInterner {
    fn default() -> Self {
        Self::new()
    }
}

/// Global string interner for cell addresses
static CELL_ADDRESS_INTERNER: once_cell::sync::Lazy<StringInterner> =
    once_cell::sync::Lazy::new(|| StringInterner::with_capacity(10000));

/// Intern a cell address string
pub fn intern_cell_address(address: &str) -> Arc<str> {
    CELL_ADDRESS_INTERNER.intern(address)
}

/// Global string interner for sheet names
static SHEET_NAME_INTERNER: once_cell::sync::Lazy<StringInterner> =
    once_cell::sync::Lazy::new(|| StringInterner::with_capacity(100));

/// Intern a sheet name
pub fn intern_sheet_name(name: &str) -> Arc<str> {
    SHEET_NAME_INTERNER.intern(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_interning() {
        let interner = StringInterner::new();

        let s1 = interner.intern("A1");
        let s2 = interner.intern("A1");

        // Should return the same Arc
        assert!(Arc::ptr_eq(&s1, &s2));
        assert_eq!(interner.len(), 1);

        let s3 = interner.intern("B2");
        assert!(!Arc::ptr_eq(&s1, &s3));
        assert_eq!(interner.len(), 2);
    }

    #[test]
    fn test_global_interners() {
        let addr1 = intern_cell_address("C3");
        let addr2 = intern_cell_address("C3");
        assert!(Arc::ptr_eq(&addr1, &addr2));

        let sheet1 = intern_sheet_name("Sheet1");
        let sheet2 = intern_sheet_name("Sheet1");
        assert!(Arc::ptr_eq(&sheet1, &sheet2));
    }
}

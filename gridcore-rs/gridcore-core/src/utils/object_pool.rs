use std::sync::{Arc, Mutex};

/// A thread-safe object pool for reusing expensive allocations
pub struct ObjectPool<T> {
    pool: Arc<Mutex<Vec<T>>>,
    max_size: usize,
    init: Arc<dyn Fn() -> T + Send + Sync>,
    reset: Arc<dyn Fn(&mut T) + Send + Sync>,
}

impl<T> ObjectPool<T> {
    /// Create a new object pool
    pub fn new<I, R>(max_size: usize, init: I, reset: R) -> Self
    where
        I: Fn() -> T + Send + Sync + 'static,
        R: Fn(&mut T) + Send + Sync + 'static,
    {
        ObjectPool {
            pool: Arc::new(Mutex::new(Vec::with_capacity(max_size))),
            max_size,
            init: Arc::new(init),
            reset: Arc::new(reset),
        }
    }

    /// Get an object from the pool or create a new one
    pub fn get(&self) -> PooledObject<T> {
        let obj = {
            let mut pool = self.pool.lock().expect("Object pool lock poisoned");
            pool.pop()
        };

        let obj = obj.unwrap_or_else(|| (self.init)());

        PooledObject {
            object: Some(obj),
            pool: Arc::clone(&self.pool),
            max_size: self.max_size,
            reset: Arc::clone(&self.reset),
        }
    }

    /// Get the current size of the pool
    pub fn size(&self) -> usize {
        self.pool.lock().expect("Object pool lock poisoned").len()
    }
}

/// A pooled object that returns itself to the pool when dropped
pub struct PooledObject<T> {
    object: Option<T>,
    pool: Arc<Mutex<Vec<T>>>,
    max_size: usize,
    reset: Arc<dyn Fn(&mut T) + Send + Sync>,
}

impl<T> PooledObject<T> {
    /// Get a reference to the pooled object
    pub fn as_ref(&self) -> &T {
        self.object.as_ref().expect("Pooled object already taken")
    }

    /// Get a mutable reference to the pooled object
    pub fn as_mut(&mut self) -> &mut T {
        self.object.as_mut().expect("Pooled object already taken")
    }

    /// Take ownership of the pooled object, preventing it from returning to the pool
    pub fn take(mut self) -> T {
        self.object.take().expect("Pooled object already taken")
    }
}

impl<T> Drop for PooledObject<T> {
    fn drop(&mut self) {
        if let Some(mut obj) = self.object.take() {
            // Reset the object before returning to pool
            (self.reset)(&mut obj);

            // Return to pool if not full
            let mut pool = self.pool.lock().expect("Object pool lock poisoned");
            if pool.len() < self.max_size {
                pool.push(obj);
            }
        }
    }
}

impl<T> std::ops::Deref for PooledObject<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        self.as_ref()
    }
}

impl<T> std::ops::DerefMut for PooledObject<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.as_mut()
    }
}

/// Specialized pool for Vec<T> with capacity management
pub struct VecPool<T> {
    inner: ObjectPool<Vec<T>>,
}

impl<T> VecPool<T> {
    /// Create a new vector pool
    pub fn new(max_size: usize, initial_capacity: usize) -> Self {
        VecPool {
            inner: ObjectPool::new(
                max_size,
                move || Vec::with_capacity(initial_capacity),
                |v| v.clear(),
            ),
        }
    }

    /// Get a vector from the pool
    pub fn get(&self) -> PooledObject<Vec<T>> {
        self.inner.get()
    }

    /// Get the current pool size
    pub fn size(&self) -> usize {
        self.inner.size()
    }
}

/// Global pools for commonly used types
pub mod global {
    use super::*;
    use once_cell::sync::Lazy;

    /// Pool for temporary cell value vectors
    pub static CELL_VALUE_VEC_POOL: Lazy<VecPool<crate::types::CellValue>> =
        Lazy::new(|| VecPool::new(100, 100));

    /// Pool for temporary string vectors
    pub static STRING_VEC_POOL: Lazy<VecPool<String>> = Lazy::new(|| VecPool::new(50, 50));

    /// Pool for temporary cell address vectors
    pub static ADDRESS_VEC_POOL: Lazy<VecPool<crate::types::CellAddress>> =
        Lazy::new(|| VecPool::new(50, 100));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_object_pool() {
        let pool = ObjectPool::new(
            2,
            || vec![0u32; 10],
            |v| {
                v.clear();
                v.resize(10, 0);
            },
        );

        // Get object from pool
        let mut obj1 = pool.get();
        obj1[0] = 42;
        assert_eq!(obj1[0], 42);

        // Return happens on drop
        drop(obj1);

        // Should reuse the same object
        let obj2 = pool.get();
        assert_eq!(obj2[0], 0); // Should be reset
    }

    #[test]
    fn test_vec_pool() {
        let pool = VecPool::<i32>::new(2, 10);

        {
            let mut v1 = pool.get();
            v1.push(1);
            v1.push(2);
            assert_eq!(v1.len(), 2);
        } // v1 returned to pool

        {
            let v2 = pool.get();
            assert_eq!(v2.len(), 0); // Should be cleared
            assert!(v2.capacity() >= 10); // Should maintain capacity
        }
    }

    #[test]
    fn test_pool_max_size() {
        let pool = ObjectPool::new(2, || vec![0u32; 1], |v| v.clear());

        let obj1 = pool.get();
        let obj2 = pool.get();
        let obj3 = pool.get();

        drop(obj1);
        drop(obj2);
        drop(obj3);

        // Pool should only contain 2 objects (max_size)
        assert!(pool.size() <= 2);
    }
}
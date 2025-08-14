/// Shared utilities for behavior implementations

/// Manages a numeric buffer for accumulating digits (for counts/multipliers)
#[derive(Debug, Clone, Default)]
pub struct NumberBuffer {
    buffer: String,
}

impl NumberBuffer {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
        }
    }

    /// Push a digit to the buffer
    pub fn push_digit(&mut self, digit: char) -> bool {
        if digit.is_ascii_digit() {
            self.buffer.push(digit);
            true
        } else {
            false
        }
    }

    /// Try to push a key to the buffer (returns true if it was a digit)
    pub fn try_push_key(&mut self, key: &str) -> bool {
        if key.len() == 1 {
            if let Some(ch) = key.chars().next() {
                return self.push_digit(ch);
            }
        }
        false
    }

    /// Get the current value as a number (defaults to 1 if empty)
    pub fn get_multiplier(&self) -> usize {
        self.buffer.parse().unwrap_or(1).max(1)
    }

    /// Get the current value as an optional number
    pub fn get_value(&self) -> Option<usize> {
        if self.buffer.is_empty() {
            None
        } else {
            self.buffer.parse().ok()
        }
    }

    /// Clear the buffer
    pub fn clear(&mut self) {
        self.buffer.clear();
    }

    /// Check if the buffer is empty
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    /// Get the raw buffer string
    pub fn as_str(&self) -> &str {
        &self.buffer
    }
}

/// Direction for navigation operations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationDirection {
    Up,
    Down,
    Left,
    Right,
    Previous,
    Next,
}

impl NavigationDirection {
    /// Parse a key into a navigation direction
    pub fn from_key(key: &str) -> Option<Self> {
        match key {
            "h" | "ArrowLeft" => Some(Self::Left),
            "l" | "ArrowRight" => Some(Self::Right),
            "k" | "ArrowUp" => Some(Self::Up),
            "j" | "ArrowDown" => Some(Self::Down),
            _ => None,
        }
    }

    /// Check if this is a horizontal movement
    pub fn is_horizontal(&self) -> bool {
        matches!(self, Self::Left | Self::Right)
    }

    /// Check if this is a vertical movement
    pub fn is_vertical(&self) -> bool {
        matches!(self, Self::Up | Self::Down)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_number_buffer() {
        let mut buffer = NumberBuffer::new();

        assert!(buffer.is_empty());
        assert_eq!(buffer.get_multiplier(), 1);
        assert_eq!(buffer.get_value(), None);

        assert!(buffer.push_digit('5'));
        assert!(!buffer.push_digit('a'));
        assert_eq!(buffer.get_multiplier(), 5);
        assert_eq!(buffer.get_value(), Some(5));

        assert!(buffer.push_digit('0'));
        assert_eq!(buffer.get_multiplier(), 50);
        assert_eq!(buffer.get_value(), Some(50));

        buffer.clear();
        assert!(buffer.is_empty());
        assert_eq!(buffer.get_multiplier(), 1);
    }

    #[test]
    fn test_try_push_key() {
        let mut buffer = NumberBuffer::new();

        assert!(buffer.try_push_key("1"));
        assert!(buffer.try_push_key("2"));
        assert!(!buffer.try_push_key("a"));
        assert!(!buffer.try_push_key("Enter"));
        assert!(!buffer.try_push_key(""));

        assert_eq!(buffer.as_str(), "12");
    }

    #[test]
    fn test_navigation_direction() {
        assert_eq!(
            NavigationDirection::from_key("h"),
            Some(NavigationDirection::Left)
        );
        assert_eq!(
            NavigationDirection::from_key("ArrowLeft"),
            Some(NavigationDirection::Left)
        );
        assert_eq!(
            NavigationDirection::from_key("j"),
            Some(NavigationDirection::Down)
        );
        assert_eq!(
            NavigationDirection::from_key("ArrowDown"),
            Some(NavigationDirection::Down)
        );
        assert_eq!(NavigationDirection::from_key("Enter"), None);

        let dir = NavigationDirection::Left;
        assert!(dir.is_horizontal());
        assert!(!dir.is_vertical());

        let dir = NavigationDirection::Up;
        assert!(!dir.is_horizontal());
        assert!(dir.is_vertical());
    }
}

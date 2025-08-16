// Utility macros and functions for gridcore-demo

// Cross-platform logging macro
#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        #[cfg(feature = "web")]
        leptos::logging::log!($($arg)*);

        #[cfg(not(feature = "web"))]
        println!($($arg)*);
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        #[cfg(feature = "web")]
        leptos::logging::warn!($($arg)*);

        #[cfg(not(feature = "web"))]
        eprintln!("WARNING: {}", format!($($arg)*));
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        #[cfg(feature = "web")]
        leptos::logging::error!($($arg)*);

        #[cfg(not(feature = "web"))]
        eprintln!("ERROR: {}", format!($($arg)*));
    };
}

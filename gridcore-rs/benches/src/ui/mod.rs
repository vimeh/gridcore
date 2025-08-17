//! UI benchmarks module
//! These benchmarks require WASM context and should be run with wasm-pack test

pub mod interaction_bench;
pub mod render_bench;

#[cfg(not(target_arch = "wasm32"))]
pub fn run_all_benchmarks() {
    println!("UI benchmarks require WASM context.");
    println!("To run UI benchmarks, use:");
    println!("  wasm-pack test --headless --chrome gridcore-rs/benches");
}

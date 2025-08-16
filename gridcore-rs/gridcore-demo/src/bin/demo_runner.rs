// Standalone demo runner for gridcore-demo
// This allows running demos and benchmarks without the full UI

use clap::{Parser, Subcommand};
use gridcore_controller::controller::SpreadsheetController;
use gridcore_demo::{demo::scenarios, DemoController};
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Parser)]
#[command(name = "gridcore-demo")]
#[command(about = "GridCore Demo and Benchmark Runner", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List available demo scenarios
    List,

    /// Run a demo scenario
    Run {
        /// Name of the scenario to run
        scenario: String,

        /// Number of steps to execute (0 for all)
        #[arg(short, long, default_value = "0")]
        steps: usize,

        /// Enable performance monitoring
        #[arg(short, long)]
        perf: bool,
    },

    /// Run benchmarks
    Benchmark {
        /// Run quick benchmark only
        #[arg(short, long)]
        quick: bool,

        /// Output format (json, text, csv)
        #[arg(short, long, default_value = "text")]
        format: String,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::List => {
            println!("Available Demo Scenarios:");
            println!("-------------------------");
            for scenario in scenarios::get_available_scenarios() {
                println!("  - {}", scenario);
            }
            println!("\nAvailable Benchmarks:");
            println!("--------------------");
            for benchmark in DemoController::get_available_benchmarks() {
                println!("  - {}", benchmark);
            }
        }

        Commands::Run {
            scenario,
            steps,
            perf,
        } => {
            run_demo(&scenario, steps, perf);
        }

        Commands::Benchmark { quick, format } => {
            run_benchmark(quick, &format);
        }
    }
}

fn run_demo(scenario: &str, max_steps: usize, enable_perf: bool) {
    println!("Starting demo: {}", scenario);

    // Create controller and demo controller
    let controller = Rc::new(RefCell::new(SpreadsheetController::new()));
    let mut demo_controller = DemoController::new();

    // Start the demo
    match demo_controller.start_demo(scenario, controller.clone()) {
        Ok(_) => {
            println!("Demo started successfully");

            if enable_perf {
                println!("Performance monitoring enabled");
            }

            // Run demo steps
            let mut step_count = 0;
            while demo_controller.is_running() {
                if max_steps > 0 && step_count >= max_steps {
                    break;
                }

                demo_controller.step_forward(controller.clone());
                step_count += 1;

                if enable_perf && step_count % 10 == 0 {
                    let metrics = demo_controller.get_performance_metrics();
                    println!(
                        "Step {}: FPS={:.1}, Cells={}, Operations/s={:.1}",
                        step_count, metrics.fps, metrics.cell_count, metrics.operations_per_second
                    );
                }
            }

            println!("Demo completed after {} steps", step_count);

            if enable_perf {
                let final_metrics = demo_controller.get_performance_metrics();
                println!("\nFinal Performance Metrics:");
                println!("  Average FPS: {:.1}", final_metrics.fps);
                println!("  Total Cells: {}", final_metrics.cell_count);
                println!("  Memory Usage: {:.2} MB", final_metrics.memory_usage_mb);
                println!("  Operations/s: {:.1}", final_metrics.operations_per_second);
            }
        }
        Err(e) => {
            eprintln!("Failed to start demo: {}", e);
            std::process::exit(1);
        }
    }
}

fn run_benchmark(quick: bool, format: &str) {
    println!(
        "Running {} benchmark...",
        if quick { "quick" } else { "full" }
    );

    // Create controller and demo controller
    let controller = Rc::new(RefCell::new(SpreadsheetController::new()));
    let mut demo_controller = DemoController::new();

    if quick {
        match demo_controller.run_quick_benchmark(controller) {
            Ok(results) => {
                print_benchmark_results(&results, format);
            }
            Err(e) => {
                eprintln!("Benchmark failed: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        println!("Full benchmark suite not yet implemented in CLI mode");
        println!("Please use the web UI with --features demo for full benchmarks");
    }
}

fn print_benchmark_results(results: &str, format: &str) {
    match format {
        "json" => {
            // In a real implementation, we'd serialize to JSON
            println!("{}", results);
        }
        "csv" => {
            // In a real implementation, we'd format as CSV
            println!("CSV output not yet implemented");
            println!("{}", results);
        }
        _ => {
            // Text format (default)
            println!("\n{}", results);
        }
    }
}

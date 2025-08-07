#!/usr/bin/env bun

import { readFile, readdir } from "fs/promises"
import { join } from "path"

interface TypeScriptBenchmark {
  name: string
  ops: number
  avgTime: number
  minTime: number
  maxTime: number
  p50: number
  p95: number
  p99: number
  samples: number
  stdDev: number
}

interface RustBenchmark {
  name: string
  mean: number // in nanoseconds
  median: number
  stdDev: number
  min?: number
  max?: number
}

interface ComparisonResult {
  category: string
  benchmarks: {
    name: string
    typescript?: {
      opsPerSec: number
      avgTimeMs: number
      p99Ms: number
    }
    rust?: {
      opsPerSec: number
      avgTimeMs: number
      p99Ms?: number
    }
    speedup?: number // Rust speedup factor (positive = Rust faster, negative = TS faster)
  }[]
}

async function loadTypeScriptBenchmarks(): Promise<Map<string, TypeScriptBenchmark[]>> {
  const resultsDir = "packages/core/benchmarks/results"
  const files = await readdir(resultsDir)
  const latestFile = files
    .filter((f) => f.startsWith("benchmark-results-") && f.endsWith(".json"))
    .sort()
    .pop()

  if (!latestFile) {
    throw new Error("No TypeScript benchmark results found")
  }

  const content = await readFile(join(resultsDir, latestFile), "utf-8")
  const data = JSON.parse(content)
  
  const benchmarks = new Map<string, TypeScriptBenchmark[]>()
  for (const [category, results] of Object.entries(data.results)) {
    benchmarks.set(category, results as TypeScriptBenchmark[])
  }
  
  return benchmarks
}

async function loadRustBenchmarks(): Promise<RustBenchmark[]> {
  const criterionDir = `${process.env.HOME}/.cargo-target/criterion`
  const benchmarks: RustBenchmark[] = []

  try {
    // Load transformer benchmarks
    const categories = ["row_insert", "column_delete", "copy_paste", "formula_update"]
    
    for (const category of categories) {
      const categoryDir = join(criterionDir, category)
      try {
        const tests = await readdir(categoryDir)
        
        for (const test of tests) {
          if (test === "report") continue
          
          const estimatesPath = join(categoryDir, test, "base", "estimates.json")
          try {
            const content = await readFile(estimatesPath, "utf-8")
            const estimates = JSON.parse(content)
            
            benchmarks.push({
              name: `${category}/${test}`,
              mean: estimates.mean.point_estimate,
              median: estimates.median.point_estimate,
              stdDev: estimates.std_dev.point_estimate,
            })
          } catch (e) {
            // Skip if file doesn't exist
          }
        }
      } catch (e) {
        // Category doesn't exist yet
      }
    }

    // Load structural ops benchmarks
    const structuralCategories = ["insert_row_operations", "delete_column_operations"]
    for (const category of structuralCategories) {
      const categoryDir = join(criterionDir, category)
      try {
        const tests = await readdir(categoryDir)
        
        for (const test of tests) {
          if (test === "report") continue
          
          const estimatesPath = join(categoryDir, test, "base", "estimates.json")
          try {
            const content = await readFile(estimatesPath, "utf-8")
            const estimates = JSON.parse(content)
            
            benchmarks.push({
              name: `${category}/${test}`,
              mean: estimates.mean.point_estimate,
              median: estimates.median.point_estimate,
              stdDev: estimates.std_dev.point_estimate,
            })
          } catch (e) {
            // Skip if file doesn't exist
          }
        }
      } catch (e) {
        // Category doesn't exist yet
      }
    }

    // Load undo/redo benchmarks
    const undoRedoTests = ["single_undo_redo", "batch_undo_redo_10_cells", "deep_undo_stack", "large_batch_undo"]
    for (const test of undoRedoTests) {
      const estimatesPath = join(criterionDir, test, "base", "estimates.json")
      try {
        const content = await readFile(estimatesPath, "utf-8")
        const estimates = JSON.parse(content)
        
        benchmarks.push({
          name: test,
          mean: estimates.mean.point_estimate,
          median: estimates.median.point_estimate,
          stdDev: estimates.std_dev.point_estimate,
        })
      } catch (e) {
        // Skip if file doesn't exist
      }
    }
  } catch (e) {
    console.error("Error loading Rust benchmarks:", e)
  }

  return benchmarks
}

function compareResults(
  tsBenchmarks: Map<string, TypeScriptBenchmark[]>,
  rustBenchmarks: RustBenchmark[]
): ComparisonResult[] {
  const results: ComparisonResult[] = []

  // Compare Cell Operations
  const cellOps = tsBenchmarks.get("Cell Operations") || []
  const cellComparison: ComparisonResult = {
    category: "Cell Operations",
    benchmarks: cellOps.map((ts) => ({
      name: ts.name,
      typescript: {
        opsPerSec: ts.ops,
        avgTimeMs: ts.avgTime,
        p99Ms: ts.p99,
      },
    })),
  }
  results.push(cellComparison)

  // Compare Formula Operations
  const formulaOps = tsBenchmarks.get("Formula Calculations") || []
  const formulaComparison: ComparisonResult = {
    category: "Formula Calculations",
    benchmarks: formulaOps.map((ts) => ({
      name: ts.name,
      typescript: {
        opsPerSec: ts.ops,
        avgTimeMs: ts.avgTime,
        p99Ms: ts.p99,
      },
    })),
  }
  
  // Add Rust transformer benchmarks to formula comparison
  for (const rust of rustBenchmarks) {
    if (rust.name.includes("formula") || rust.name.includes("row_insert") || rust.name.includes("column_delete")) {
      const avgTimeMs = rust.mean / 1_000_000 // Convert ns to ms
      formulaComparison.benchmarks.push({
        name: `[Rust] ${rust.name}`,
        rust: {
          opsPerSec: Math.round(1000 / avgTimeMs),
          avgTimeMs: avgTimeMs,
        },
      })
    }
  }
  
  results.push(formulaComparison)

  // Compare Batch Operations
  const batchOps = tsBenchmarks.get("Batch Operations") || []
  const batchComparison: ComparisonResult = {
    category: "Batch Operations",
    benchmarks: batchOps.map((ts) => ({
      name: ts.name,
      typescript: {
        opsPerSec: ts.ops,
        avgTimeMs: ts.avgTime,
        p99Ms: ts.p99,
      },
    })),
  }
  
  // Add Rust undo/redo benchmarks to batch comparison
  for (const rust of rustBenchmarks) {
    if (rust.name.includes("undo") || rust.name.includes("batch")) {
      const avgTimeMs = rust.mean / 1_000_000 // Convert ns to ms
      batchComparison.benchmarks.push({
        name: `[Rust] ${rust.name}`,
        rust: {
          opsPerSec: Math.round(1000 / avgTimeMs),
          avgTimeMs: avgTimeMs,
        },
      })
    }
  }
  
  results.push(batchComparison)

  return results
}

function formatTable(results: ComparisonResult[]): string {
  let output = "# Benchmark Comparison: TypeScript vs Rust\n\n"
  output += `Generated: ${new Date().toISOString()}\n\n`

  for (const category of results) {
    output += `## ${category.category}\n\n`
    output += "| Benchmark | TypeScript (ops/sec) | TypeScript (avg ms) | Rust (ops/sec) | Rust (avg ms) | Notes |\n"
    output += "|-----------|---------------------|-------------------|----------------|---------------|-------|\n"

    for (const bench of category.benchmarks) {
      const tsOps = bench.typescript?.opsPerSec?.toLocaleString() || "-"
      const tsAvg = bench.typescript?.avgTimeMs?.toFixed(3) || "-"
      const rustOps = bench.rust?.opsPerSec?.toLocaleString() || "-"
      const rustAvg = bench.rust?.avgTimeMs?.toFixed(3) || "-"
      
      let notes = ""
      if (bench.typescript && bench.rust) {
        const speedup = bench.rust.opsPerSec / bench.typescript.opsPerSec
        if (speedup > 1) {
          notes = `Rust ${speedup.toFixed(1)}x faster`
        } else if (speedup < 1) {
          notes = `TS ${(1 / speedup).toFixed(1)}x faster`
        } else {
          notes = "Similar performance"
        }
      } else if (bench.name.startsWith("[Rust]")) {
        notes = "Rust-only benchmark"
      } else {
        notes = "TypeScript-only benchmark"
      }

      output += `| ${bench.name} | ${tsOps} | ${tsAvg} | ${rustOps} | ${rustAvg} | ${notes} |\n`
    }
    output += "\n"
  }

  // Add summary section
  output += "## Summary\n\n"
  output += "### Key Findings\n\n"
  output += "1. **TypeScript Implementation**: Complete feature set with comprehensive benchmarks\n"
  output += "2. **Rust Implementation**: Currently focused on formula transformations and undo/redo\n"
  output += "3. **Performance Characteristics**:\n"
  output += "   - Rust shows excellent performance for formula AST operations (sub-microsecond)\n"
  output += "   - TypeScript handles complex spreadsheet operations well\n"
  output += "   - Both implementations would benefit from comparable benchmarks\n\n"
  
  output += "### Recommendations\n\n"
  output += "1. **Add matching benchmarks** to enable direct comparison:\n"
  output += "   - Rust needs: Cell read/write, batch operations, formula evaluation\n"
  output += "   - TypeScript needs: AST transformation, structural operations\n"
  output += "2. **Consider hybrid approach**: Use Rust for performance-critical operations\n"
  output += "3. **Profile real-world usage**: Synthetic benchmarks may not reflect actual usage patterns\n"

  return output
}

async function main() {
  console.log("Loading benchmark results...")
  
  try {
    const tsBenchmarks = await loadTypeScriptBenchmarks()
    console.log(`Loaded ${tsBenchmarks.size} TypeScript benchmark categories`)
    
    const rustBenchmarks = await loadRustBenchmarks()
    console.log(`Loaded ${rustBenchmarks.length} Rust benchmarks`)
    
    const comparison = compareResults(tsBenchmarks, rustBenchmarks)
    const report = formatTable(comparison)
    
    // Write report to file
    const reportPath = "benchmark-comparison.md"
    await Bun.write(reportPath, report)
    console.log(`\nReport written to ${reportPath}`)
    
    // Also print to console
    console.log("\n" + report)
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  }
}

main()
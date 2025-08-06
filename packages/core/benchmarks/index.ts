import { BenchmarkRunner } from "./utils/benchmark-runner"
import { runCellOperationsBenchmarks } from "./suites/cell-operations.bench"
import { runFormulaCalculationBenchmarks } from "./suites/formula-calculation.bench"
import { runBatchOperationsBenchmarks } from "./suites/batch-operations.bench"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"

interface BenchmarkSuite {
  name: string
  run: () => Promise<any>
}

const BENCHMARK_SUITES: BenchmarkSuite[] = [
  { name: "Cell Operations", run: runCellOperationsBenchmarks },
  { name: "Formula Calculations", run: runFormulaCalculationBenchmarks },
  { name: "Batch Operations", run: runBatchOperationsBenchmarks },
]

async function runAllBenchmarks() {
  console.log("🚀 GridCore Performance Benchmarks")
  console.log("==================================\n")
  
  const startTime = Date.now()
  const allResults: Record<string, any> = {}
  
  // System info
  const systemInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    bunVersion: Bun.version,
    cpus: process.cpuUsage(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  }
  
  console.log("System Information:")
  console.log(`  Platform: ${systemInfo.platform} ${systemInfo.arch}`)
  console.log(`  Bun Version: ${systemInfo.bunVersion}`)
  console.log(`  Memory: ${(systemInfo.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`)
  console.log("")

  // Run each benchmark suite
  for (const suite of BENCHMARK_SUITES) {
    console.log(`\n📊 Running ${suite.name} benchmarks...`)
    console.log("─".repeat(50))
    
    try {
      const results = await suite.run()
      allResults[suite.name] = results
      
      // Print summary
      const runner = new BenchmarkRunner()
      runner.setResults(results)
      runner.printResults()
    } catch (error) {
      console.error(`❌ Error in ${suite.name}:`, error)
      allResults[suite.name] = { error: error.message }
    }
  }

  const totalTime = Date.now() - startTime
  console.log(`\n✅ All benchmarks completed in ${(totalTime / 1000).toFixed(2)}s`)

  // Save results to file
  const resultsDir = join(import.meta.dir, "results")
  mkdirSync(resultsDir, { recursive: true })
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `benchmark-results-${timestamp}.json`
  const filepath = join(resultsDir, filename)
  
  const output = {
    systemInfo,
    results: allResults,
    totalTime,
  }
  
  writeFileSync(filepath, JSON.stringify(output, null, 2))
  console.log(`\n📄 Results saved to: ${filepath}`)
  
  return output
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
GridCore Benchmark Suite

Usage:
  bun run benchmarks [options]

Options:
  --suite <name>    Run only a specific benchmark suite
  --list           List available benchmark suites
  --json           Output results in JSON format for CI
  --help, -h       Show this help message

Examples:
  bun run benchmarks
  bun run benchmarks --suite "Cell Operations"
  bun run benchmarks --json
  bun run benchmarks --list
`)
    process.exit(0)
  }
  
  if (args.includes("--list")) {
    console.log("Available benchmark suites:")
    BENCHMARK_SUITES.forEach(suite => {
      console.log(`  - ${suite.name}`)
    })
    process.exit(0)
  }
  
  const jsonOutput = args.includes("--json")
  
  const suiteIndex = args.indexOf("--suite")
  if (suiteIndex !== -1 && args[suiteIndex + 1]) {
    const suiteName = args[suiteIndex + 1]
    const suite = BENCHMARK_SUITES.find(s => s.name === suiteName)
    
    if (!suite) {
      console.error(`❌ Unknown suite: ${suiteName}`)
      console.log("Use --list to see available suites")
      process.exit(1)
    }
    
    if (!jsonOutput) {
      console.log(`Running ${suite.name} benchmarks...`)
    }
    const results = await suite.run()
    
    if (jsonOutput) {
      const output = {
        timestamp: new Date().toISOString(),
        suite: suite.name,
        results
      }
      writeFileSync("benchmark-results.json", JSON.stringify(output, null, 2))
    } else {
      const runner = new BenchmarkRunner()
      runner.setResults(results)
      runner.printResults()
    }
  } else {
    const output = await runAllBenchmarks()
    
    if (jsonOutput) {
      // Convert results to GitHub Action Benchmark format
      const benchmarks = []
      for (const [suiteName, suiteResults] of Object.entries(output.results)) {
        if (suiteResults && typeof suiteResults === 'object' && !suiteResults.error) {
          for (const [benchName, benchData] of Object.entries(suiteResults)) {
            if (benchData && typeof benchData === 'object' && 'opsPerSec' in benchData) {
              benchmarks.push({
                name: `${suiteName} - ${benchName}`,
                unit: "ops/sec",
                value: benchData.opsPerSec
              })
            }
          }
        }
      }
      
      const githubOutput = {
        name: "GridCore Benchmarks",
        tool: "customBiggerIsBetter",
        timestamp: output.systemInfo.timestamp,
        benchmarks
      }
      
      writeFileSync("benchmark-results.json", JSON.stringify(githubOutput, null, 2))
    }
  }
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error)
}

export { runAllBenchmarks }
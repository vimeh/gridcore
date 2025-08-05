import { Sheet } from "../../src/Sheet"
import { CellAddress } from "../../src/domain/models/CellAddress"
import { BenchmarkRunner } from "../utils/benchmark-runner"
import { MetricsCollector } from "../utils/metrics-collector"
import {
  generateRandomValue,
  generateSequentialAddresses,
} from "../utils/data-generators"
import { BENCHMARK_CONFIG } from "../config/benchmark.config"

// Helper to set cell value using string address
function setCellValue(sheet: Sheet, address: string, value: unknown) {
  const addr = CellAddress.fromString(address)
  if (addr.ok) {
    sheet.getFacade().setCellValue(addr.value, value)
  }
}

// Helper to delete cell using string address
function deleteCell(sheet: Sheet, address: string) {
  const addr = CellAddress.fromString(address)
  if (addr.ok) {
    sheet.getFacade().deleteCell(addr.value)
  }
}

export async function runBatchOperationsBenchmarks() {
  const runner = new BenchmarkRunner()

  await runner.suite("Batch Operations", async (bench) => {
    // Test different batch sizes
    for (const batchSize of BENCHMARK_CONFIG.batchSizes) {
      await bench(`Batch write (${batchSize} cells)`, () => {
        const sheet = new Sheet("bench")
        const facade = sheet.getFacade()
        const addresses = generateSequentialAddresses(batchSize)
        
        const batchId = facade.beginBatch()
        for (const addr of addresses) {
          facade.setCellValue(addr, generateRandomValue())
        }
        facade.commitBatch(batchId)
      })
    }

    // Batch vs non-batch comparison
    await bench("Non-batched writes (1000 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(1000)
      
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
    })

    await bench("Batched writes (1000 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(1000)
      
      const batchId = facade.beginBatch()
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
      facade.commitBatch(batchId)
    })

    // Batch with formulas
    await bench("Batch with formulas (500 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      
      const batchId = facade.beginBatch()
      
      // Add base values
      for (let i = 1; i <= 250; i++) {
        setCellValue(sheet, `A${i}`, i)
      }
      
      // Add formulas referencing the values
      for (let i = 1; i <= 250; i++) {
        setCellValue(sheet, `B${i}`, `=A${i}*2`)
      }
      
      facade.commitBatch(batchId)
    })

    // Batch rollback
    await bench("Batch rollback (1000 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(1000)
      
      // Pre-populate some data
      for (let i = 0; i < 100; i++) {
        facade.setCellValue(addresses[i], i)
      }

      return () => {
        const batchId = facade.beginBatch()
        for (const addr of addresses) {
          facade.setCellValue(addr, generateRandomValue())
        }
        facade.rollbackBatch(batchId)
      }
    })

    // Nested batches
    await bench("Nested batches (3 levels)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      
      const batch1 = facade.beginBatch()
      for (let i = 1; i <= 10; i++) {
        setCellValue(sheet, `A${i}`, i)
      }
      
      const batch2 = facade.beginBatch()
      for (let i = 1; i <= 10; i++) {
        setCellValue(sheet, `B${i}`, i * 2)
      }
      
      const batch3 = facade.beginBatch()
      for (let i = 1; i <= 10; i++) {
        setCellValue(sheet, `C${i}`, `=A${i}+B${i}`)
      }
      
      facade.commitBatch(batch3)
      facade.commitBatch(batch2)
      facade.commitBatch(batch1)
    })

    // Large batch with mixed operations
    await bench("Mixed batch operations (5000 ops)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      
      const batchId = facade.beginBatch()
      
      // Mix of creates, updates, and deletes
      for (let i = 1; i <= 5000; i++) {
        const op = i % 3
        const addr = `A${(i % 1000) + 1}`
        
        if (op === 0) {
          setCellValue(sheet, addr, i)
        } else if (op === 1) {
          setCellValue(sheet, addr, `Text${i}`)
        } else {
          deleteCell(sheet, addr)
        }
      }
      
      facade.commitBatch(batchId)
    })

    // Batch with dependency updates
    await bench("Batch with cascading updates", () => {
      const sheet = new Sheet("bench")
      
      // Set up initial dependency chain
      for (let i = 1; i <= 50; i++) {
        setCellValue(sheet, `A${i}`, i)
        setCellValue(sheet, `B${i}`, `=A${i}*2`)
        setCellValue(sheet, `C${i}`, `=B${i}+10`)
      }

      return () => {
        const facade = sheet.getFacade()
        const batchId = facade.beginBatch()
        
        // Update all A cells, triggering cascading updates
        for (let i = 1; i <= 50; i++) {
          setCellValue(sheet, `A${i}`, i * 10)
        }
        
        facade.commitBatch(batchId)
      }
    })

    // Memory impact of large batches - use reduced iterations since this is expensive
    const metrics = new MetricsCollector()
    metrics.start()
    
    await bench("Memory impact - large batch (10k cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(10000)
      
      const batchId = facade.beginBatch()
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
      facade.commitBatch(batchId)
      
      metrics.sample()
    }, BENCHMARK_CONFIG.memoryBenchmark)
    
    const memoryStats = metrics.stop()
    console.log("\nBatch Operations Memory Impact:")
    console.log(`  Heap Used Delta: ${MetricsCollector.formatBytes(memoryStats.memory.heapUsedDelta)}`)
    console.log(`  RSS Delta: ${MetricsCollector.formatBytes(memoryStats.memory.rssDelta)}`)
  })

  return runner.getResults()
}

// Run if called directly
if (import.meta.main) {
  const results = await runBatchOperationsBenchmarks()
  const runner = new BenchmarkRunner()
  runner.setResults(results)
  runner.printResults()
}
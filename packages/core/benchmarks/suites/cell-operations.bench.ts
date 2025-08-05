import { Sheet } from "../../src/Sheet"
import { CellAddress } from "../../src/domain/models/CellAddress"
import { BenchmarkRunner } from "../utils/benchmark-runner"
import { MetricsCollector } from "../utils/metrics-collector"
import {
  generateRandomValue,
  generateSequentialAddresses,
  generateRandomAddresses,
} from "../utils/data-generators"
import { BENCHMARK_CONFIG } from "../config/benchmark.config"

// Helper to set cell value using string address
function setCellValue(sheet: Sheet, address: string, value: unknown) {
  const addr = CellAddress.fromString(address)
  if (addr.ok) {
    sheet.getFacade().setCellValue(addr.value, value)
  }
}

// Helper to get cell value using string address
function getCellValue(sheet: Sheet, address: string) {
  const addr = CellAddress.fromString(address)
  if (addr.ok) {
    return sheet.getFacade().getCellValue(addr.value)
  }
  return null
}

// Helper to delete cell using string address
function deleteCell(sheet: Sheet, address: string) {
  const addr = CellAddress.fromString(address)
  if (addr.ok) {
    sheet.getFacade().deleteCell(addr.value)
  }
}

export async function runCellOperationsBenchmarks() {
  const runner = new BenchmarkRunner()
  const metrics = new MetricsCollector()

  await runner.suite("Cell Operations", async (bench) => {
    // Single cell write
    await bench("Single cell write", () => {
      const sheet = new Sheet("bench")
      setCellValue(sheet, "A1", 42)
    })

    // Single cell read (existing)
    await bench("Single cell read (existing)", () => {
      const sheet = new Sheet("bench")
      setCellValue(sheet, "A1", 42)
      return () => {
        getCellValue(sheet, "A1")
      }
    })

    // Single cell read (non-existing)
    await bench("Single cell read (non-existing)", () => {
      const sheet = new Sheet("bench")
      getCellValue(sheet, "Z999")
    })

    // Sequential writes - small
    await bench("Sequential writes (100 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(100)
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
    })

    // Sequential writes - medium
    await bench("Sequential writes (1000 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(1000)
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
    })

    // Random writes - small
    await bench("Random writes (100 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateRandomAddresses(100)
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
    })

    // Random writes - medium
    await bench("Random writes (1000 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateRandomAddresses(1000)
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
    })

    // Mixed read/write operations
    await bench("Mixed read/write (50/50)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(100)
      
      // Pre-populate some cells
      for (let i = 0; i < 50; i++) {
        facade.setCellValue(addresses[i], i)
      }

      return () => {
        for (let i = 0; i < 100; i++) {
          if (i % 2 === 0) {
            facade.getCellValue(addresses[i % addresses.length])
          } else {
            facade.setCellValue(addresses[i % addresses.length], i)
          }
        }
      }
    })

    // Cell updates (overwriting existing values)
    await bench("Cell updates (overwrite 100 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(100)
      
      // Pre-populate
      for (const addr of addresses) {
        facade.setCellValue(addr, 1)
      }

      return () => {
        for (const addr of addresses) {
          facade.setCellValue(addr, 2)
        }
      }
    })

    // Cell deletion
    await bench("Cell deletion (100 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(100)
      
      // Pre-populate
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }

      return () => {
        for (const addr of addresses) {
          facade.deleteCell(addr)
        }
      }
    })

    // Memory impact test
    metrics.start()
    await bench("Memory impact (10k cells)", async () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const addresses = generateSequentialAddresses(10000)
      
      for (const addr of addresses) {
        facade.setCellValue(addr, generateRandomValue())
      }
      
      metrics.sample()
    })
    const memoryStats = metrics.stop()

    console.log("\nMemory Impact:")
    console.log(`  Heap Used Delta: ${MetricsCollector.formatBytes(memoryStats.memory.heapUsedDelta)}`)
    console.log(`  RSS Delta: ${MetricsCollector.formatBytes(memoryStats.memory.rssDelta)}`)
    console.log(`  CPU Time: ${memoryStats.cpu.total.toFixed(2)}ms`)
  })

  return runner.getResults()
}

// Run if called directly
if (import.meta.main) {
  const results = await runCellOperationsBenchmarks()
  const runner = new BenchmarkRunner()
  runner.setResults(results)
  runner.printResults()
}
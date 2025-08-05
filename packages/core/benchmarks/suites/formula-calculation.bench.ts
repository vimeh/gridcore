import { Sheet } from "../../src/Sheet"
import { CellAddress } from "../../src/domain/models/CellAddress"
import { BenchmarkRunner } from "../utils/benchmark-runner"
import { MetricsCollector } from "../utils/metrics-collector"
import {
  generateFormulaChain,
  generateComplexFormulas,
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

export async function runFormulaCalculationBenchmarks() {
  const runner = new BenchmarkRunner()

  await runner.suite("Formula Calculations", async (bench) => {
    // Simple formula
    await bench("Simple formula (=A1+B1)", () => {
      const sheet = new Sheet("bench")
      setCellValue(sheet, "A1", 10)
      setCellValue(sheet, "B1", 20)
      setCellValue(sheet, "C1", "=A1+B1")
    })

    // Multiple operations formula
    await bench("Multiple operations (=A1*B1+C1-D1)", () => {
      const sheet = new Sheet("bench")
      setCellValue(sheet, "A1", 10)
      setCellValue(sheet, "B1", 20)
      setCellValue(sheet, "C1", 30)
      setCellValue(sheet, "D1", 40)
      setCellValue(sheet, "E1", "=A1*B1+C1-D1")
    })

    // SUM function - small range
    await bench("SUM function (10 cells)", () => {
      const sheet = new Sheet("bench")
      for (let i = 1; i <= 10; i++) {
        setCellValue(sheet, `A${i}`, i * 10)
      }
      setCellValue(sheet, "B1", "=SUM(A1:A10)")
    })

    // SUM function - large range
    await bench("SUM function (100 cells)", () => {
      const sheet = new Sheet("bench")
      for (let i = 1; i <= 100; i++) {
        setCellValue(sheet, `A${i}`, i)
      }
      setCellValue(sheet, "B1", "=SUM(A1:A100)")
    })

    // AVERAGE function
    await bench("AVERAGE function (50 cells)", () => {
      const sheet = new Sheet("bench")
      for (let i = 1; i <= 50; i++) {
        setCellValue(sheet, `A${i}`, Math.random() * 100)
      }
      setCellValue(sheet, "B1", "=AVERAGE(A1:A50)")
    })

    // Nested IF statements
    await bench("Nested IF statements", () => {
      const sheet = new Sheet("bench")
      setCellValue(sheet, "A1", 75)
      setCellValue(sheet, "B1", 50)
      setCellValue(sheet, "C1", 25)
      setCellValue(sheet, "D1", "=IF(A1>B1,IF(A1>C1,A1,C1),IF(B1>C1,B1,C1))")
    })

    // Formula chain - short
    await bench("Formula chain (10 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const chain = generateFormulaChain(10)
      for (const { address, value } of chain) {
        facade.setCellValue(address, value)
      }
    })

    // Formula chain - long (reduced samples for performance)
    await bench("Formula chain (100 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      const chain = generateFormulaChain(100)
      for (const { address, value } of chain) {
        facade.setCellValue(address, value)
      }
    }, {
      warmupIterations: 5,
      minSamples: 20,
      maxTime: 3000,
      minTime: 500
    })

    // Complex formulas
    await bench("Complex formulas (10 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      
      // Pre-populate data cells
      for (let i = 1; i <= 20; i++) {
        for (let j = 0; j < 5; j++) {
          const col = String.fromCharCode(65 + j) // A-E
          setCellValue(sheet, `${col}${i}`, Math.random() * 100)
        }
      }

      // Add complex formulas
      const formulas = generateComplexFormulas(10)
      for (const { address, value } of formulas) {
        facade.setCellValue(address, value)
      }
    })

    // Circular dependency detection
    await bench("Circular dependency detection", () => {
      const sheet = new Sheet("bench")
      setCellValue(sheet, "A1", "=B1")
      setCellValue(sheet, "B1", "=C1")
      setCellValue(sheet, "C1", "=A1") // Creates circular dependency
    })

    // Formula recalculation after dependency change
    await bench("Formula recalculation (dependency update)", () => {
      const sheet = new Sheet("bench")
      
      // Set up initial values and formulas
      setCellValue(sheet, "A1", 10)
      setCellValue(sheet, "B1", "=A1*2")
      setCellValue(sheet, "C1", "=B1+10")
      setCellValue(sheet, "D1", "=C1/2")

      return () => {
        // Update the base value, triggering recalculation
        setCellValue(sheet, "A1", 20)
      }
    })

    // Multiple formula dependencies
    await bench("Multiple dependencies (diamond pattern)", () => {
      const sheet = new Sheet("bench")
      
      // Create diamond dependency pattern
      //     A1
      //    /  \
      //   B1  C1
      //    \  /
      //     D1
      setCellValue(sheet, "A1", 100)
      setCellValue(sheet, "B1", "=A1*2")
      setCellValue(sheet, "C1", "=A1/2")
      setCellValue(sheet, "D1", "=B1+C1")
    })

    // Formula with mixed cell references
    await bench("Mixed cell references", () => {
      const sheet = new Sheet("bench")
      
      // Populate a grid
      for (let row = 1; row <= 5; row++) {
        for (let col = 0; col < 5; col++) {
          const colLetter = String.fromCharCode(65 + col)
          setCellValue(sheet, `${colLetter}${row}`, row * (col + 1))
        }
      }

      // Complex formula referencing multiple cells
      setCellValue(sheet, "F1", "=SUM(A1:A5)+AVERAGE(B1:B5)*COUNT(C1:E5)")
    })

    // String manipulation functions
    await bench("String functions (CONCAT, UPPER, LOWER)", () => {
      const sheet = new Sheet("bench")
      setCellValue(sheet, "A1", "hello")
      setCellValue(sheet, "B1", "world")
      setCellValue(sheet, "C1", "=CONCAT(UPPER(A1),LOWER(B1))")
    })

    // Large formula evaluation
    await bench("Large formula (many operations)", () => {
      const sheet = new Sheet("bench")
      
      // Set up data
      for (let i = 1; i <= 10; i++) {
        setCellValue(sheet, `A${i}`, i)
        setCellValue(sheet, `B${i}`, i * 2)
      }

      // Large formula
      setCellValue(sheet, "C1", 
        "=SUM(A1:A10)*2+AVERAGE(B1:B10)/COUNT(A1:A10)-MIN(A1:A5)+MAX(B6:B10)")
    })
  })

  return runner.getResults()
}

// Run if called directly
if (import.meta.main) {
  const results = await runFormulaCalculationBenchmarks()
  const runner = new BenchmarkRunner()
  runner.setResults(results)
  runner.printResults()
}
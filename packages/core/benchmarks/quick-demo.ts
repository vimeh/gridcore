import { BenchmarkRunner } from "./utils/benchmark-runner"
import { Sheet } from "../src/Sheet"
import { CellAddress } from "../src/domain/models/CellAddress"

async function runQuickDemo() {
  const runner = new BenchmarkRunner()
  
  // Quick benchmark options
  const quickOptions = {
    warmupIterations: 5,
    minSamples: 50,
    maxTime: 2000,
    minTime: 500,
  }
  
  await runner.suite("Quick Demo - Cell Operations", async (bench) => {
    await bench("Single cell write", () => {
      const sheet = new Sheet("bench")
      const addr = CellAddress.fromString("A1")
      if (addr.ok) {
        sheet.getFacade().setCellValue(addr.value, 42)
      }
    }, quickOptions)
    
    await bench("100 sequential writes", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      for (let i = 0; i < 100; i++) {
        const addr = CellAddress.create(i, 0)
        if (addr.ok) {
          facade.setCellValue(addr.value, i)
        }
      }
    }, quickOptions)
    
    await bench("Simple formula", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      
      const a1 = CellAddress.fromString("A1")
      const b1 = CellAddress.fromString("B1")
      const c1 = CellAddress.fromString("C1")
      
      if (a1.ok && b1.ok && c1.ok) {
        facade.setCellValue(a1.value, 10)
        facade.setCellValue(b1.value, 20)
        facade.setCellValue(c1.value, "=A1+B1")
      }
    }, quickOptions)
    
    await bench("Batch operations (100 cells)", () => {
      const sheet = new Sheet("bench")
      const facade = sheet.getFacade()
      
      const batchId = facade.beginBatch()
      for (let i = 0; i < 100; i++) {
        const addr = CellAddress.create(i, 0)
        if (addr.ok) {
          facade.setCellValue(addr.value, i * 2)
        }
      }
      facade.commitBatch(batchId)
    }, quickOptions)
  })
  
  runner.printResults()
  
  // Save results
  const results = runner.getResults()
  console.log("\n📊 Performance Summary:")
  results.forEach(r => {
    console.log(`  ${r.name}: ${r.ops.toLocaleString()} ops/sec (avg: ${r.avgTime.toFixed(3)}ms)`)
  })
}

runQuickDemo().catch(console.error)
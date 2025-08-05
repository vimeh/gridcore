export interface BenchmarkResult {
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

export interface BenchmarkOptions {
  warmupIterations?: number
  minSamples?: number
  maxTime?: number
  minTime?: number
}

export class BenchmarkRunner {
  private results: BenchmarkResult[] = []
  
  setResults(results: BenchmarkResult[]) {
    this.results = results
  }

  async bench(
    name: string,
    fn: () => void | Promise<void>,
    options: BenchmarkOptions = {}
  ): Promise<BenchmarkResult> {
    const {
      warmupIterations = 10,
      minSamples = 100,
      maxTime = 5000,
      minTime = 1000,
    } = options

    console.log(`Running benchmark: ${name}`)

    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await fn()
    }

    const samples: number[] = []
    const startTime = performance.now()
    let totalTime = 0

    // Run benchmark
    while (
      (samples.length < minSamples || totalTime < minTime) &&
      totalTime < maxTime
    ) {
      const iterStart = performance.now()
      await fn()
      const iterEnd = performance.now()
      const iterTime = iterEnd - iterStart
      samples.push(iterTime)
      totalTime = iterEnd - startTime
    }

    // Calculate statistics
    samples.sort((a, b) => a - b)
    const sum = samples.reduce((a, b) => a + b, 0)
    const avgTime = sum / samples.length
    const ops = 1000 / avgTime

    // Calculate standard deviation
    const squaredDiffs = samples.map((time) => Math.pow(time - avgTime, 2))
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / samples.length
    const stdDev = Math.sqrt(avgSquaredDiff)

    const result: BenchmarkResult = {
      name,
      ops: Math.round(ops),
      avgTime,
      minTime: samples[0],
      maxTime: samples[samples.length - 1],
      p50: samples[Math.floor(samples.length * 0.5)],
      p95: samples[Math.floor(samples.length * 0.95)],
      p99: samples[Math.floor(samples.length * 0.99)],
      samples: samples.length,
      stdDev,
    }

    this.results.push(result)
    return result
  }

  async suite(name: string, fn: (bench: typeof this.bench) => Promise<void>) {
    console.log(`\n=== Benchmark Suite: ${name} ===\n`)
    await fn(this.bench.bind(this))
  }

  printResults() {
    console.log("\n=== Benchmark Results ===\n")
    console.table(
      this.results.map((r) => ({
        Name: r.name,
        "Ops/sec": r.ops.toLocaleString(),
        "Avg (ms)": r.avgTime.toFixed(3),
        "Min (ms)": r.minTime.toFixed(3),
        "Max (ms)": r.maxTime.toFixed(3),
        "P50 (ms)": r.p50.toFixed(3),
        "P95 (ms)": r.p95.toFixed(3),
        "P99 (ms)": r.p99.toFixed(3),
        Samples: r.samples,
        "Std Dev": r.stdDev.toFixed(3),
      }))
    )
  }

  getResults(): BenchmarkResult[] {
    return [...this.results]
  }

  clear() {
    this.results = []
  }
}
export const BENCHMARK_CONFIG = {
  // Default benchmark options
  defaults: {
    warmupIterations: 10,
    minSamples: 100,
    maxTime: 5000, // 5 seconds max per benchmark
    minTime: 1000, // 1 second min per benchmark
  },

  // Test data sizes
  sizes: {
    small: {
      cells: 100,
      rows: 10,
      cols: 10,
    },
    medium: {
      cells: 10000,
      rows: 100,
      cols: 100,
    },
    large: {
      cells: 100000,
      rows: 1000,
      cols: 100,
    },
    xlarge: {
      cells: 1000000,
      rows: 10000,
      cols: 100,
    },
  },

  // Formula complexity levels
  formulaComplexity: {
    simple: ["=A1+B1", "=A1*2", "=A1-B1"],
    moderate: ["=SUM(A1:A10)", "=AVERAGE(B1:B20)", "=COUNT(C1:C30)"],
    complex: [
      "=IF(SUM(A1:A10)>100,AVERAGE(B1:B10),MIN(C1:C10))",
      "=SUM(A1:A100)*AVERAGE(B1:B100)/COUNT(C1:C100)",
    ],
  },

  // Batch sizes
  batchSizes: [10, 100, 1000, 10000],

  // Output settings
  output: {
    resultsDir: "./benchmarks/results",
    format: "json" as const,
    includeSystemInfo: true,
  },
}
import type { CellAddress } from "../domain/models/CellAddress";
import { err, ok, type Result } from "../shared/types/Result";
import type { StructuralChange } from "./ReferenceUpdater";
import type { OptimizedSparseGrid } from "./OptimizedSparseGrid";

/**
 * Edge case scenario types
 */
export type EdgeCaseType = 
  | "emptySheet"
  | "maxBounds"
  | "memoryLimit" 
  | "formulaComplexity"
  | "circularReference"
  | "largeOperation"
  | "sparseData"
  | "denseData";

/**
 * Edge case handling result
 */
export interface EdgeCaseResult {
  canProceed: boolean;
  warnings: string[];
  mitigations: string[];
  alternativeApproach?: string;
  estimatedRisk: "low" | "medium" | "high" | "critical";
}

/**
 * System limits and thresholds
 */
export interface SystemLimits {
  readonly maxRows: number;
  readonly maxColumns: number;
  readonly maxCells: number;
  readonly maxMemoryMB: number;
  readonly maxFormulaDepth: number;
  readonly maxOperationSize: number;
  readonly warningSizeThreshold: number;
  readonly criticalSizeThreshold: number;
}

/**
 * Handler for edge cases and extreme scenarios in structural operations
 */
export class EdgeCaseHandler {
  private readonly limits: SystemLimits = {
    maxRows: 1048576,           // Excel limit
    maxColumns: 16384,          // Excel limit (XFD)
    maxCells: 1000000,          // 1M cells total
    maxMemoryMB: 500,           // 500MB memory limit
    maxFormulaDepth: 50,        // Max formula reference depth
    maxOperationSize: 100000,   // Max rows/cols in single operation
    warningSizeThreshold: 1000, // Warn above 1k rows/cols
    criticalSizeThreshold: 10000, // Critical above 10k rows/cols
  };

  constructor(customLimits?: Partial<SystemLimits>) {
    if (customLimits) {
      this.limits = { ...this.limits, ...customLimits };
    }
  }

  /**
   * Analyze edge cases for a structural operation
   */
  analyzeEdgeCases(
    change: StructuralChange,
    grid: OptimizedSparseGrid,
    currentMemoryMB: number = 0
  ): EdgeCaseResult {
    const warnings: string[] = [];
    const mitigations: string[] = [];
    let canProceed = true;
    let estimatedRisk: "low" | "medium" | "high" | "critical" = "low";

    // Check each edge case scenario
    const scenarios = this.identifyScenarios(change, grid, currentMemoryMB);
    
    for (const scenario of scenarios) {
      const result = this.handleScenario(scenario, change, grid, currentMemoryMB);
      warnings.push(...result.warnings);
      mitigations.push(...result.mitigations);
      
      if (!result.canProceed) {
        canProceed = false;
      }
      
      // Take the highest risk level
      if (this.riskLevelToNumber(result.estimatedRisk) > this.riskLevelToNumber(estimatedRisk)) {
        estimatedRisk = result.estimatedRisk;
      }
    }

    return {
      canProceed,
      warnings: [...new Set(warnings)], // Remove duplicates
      mitigations: [...new Set(mitigations)],
      estimatedRisk,
      alternativeApproach: this.suggestAlternativeApproach(scenarios, change),
    };
  }

  /**
   * Handle empty sheet operations
   */
  handleEmptySheet(change: StructuralChange): Result<string, string> {
    if (change.count > this.limits.warningSizeThreshold) {
      return ok(`Empty sheet operation will be very fast, but creating ${change.count} empty rows/columns`);
    }
    return ok("Empty sheet operation - optimal performance expected");
  }

  /**
   * Handle operations at maximum bounds
   */
  handleMaxBounds(
    change: StructuralChange,
    grid: OptimizedSparseGrid
  ): Result<EdgeCaseResult, string> {
    const bounds = grid.getBounds();
    const isRowOperation = change.type === "insertRow" || change.type === "deleteRow";
    const currentMax = isRowOperation ? bounds.maxRow : bounds.maxCol;
    const limit = isRowOperation ? this.limits.maxRows : this.limits.maxColumns;
    
    if (change.type === "insertRow" || change.type === "insertColumn") {
      const newMax = currentMax + change.count;
      
      if (newMax > limit) {
        return ok({
          canProceed: false,
          warnings: [`Operation would exceed system limit of ${limit} ${isRowOperation ? 'rows' : 'columns'}`],
          mitigations: [
            `Reduce operation size to ${limit - currentMax}`,
            "Consider splitting into multiple smaller operations",
            "Archive or delete existing data first"
          ],
          estimatedRisk: "critical"
        });
      }
      
      if (newMax > limit * 0.9) {
        return ok({
          canProceed: true,
          warnings: [`Approaching system limit (${newMax}/${limit})`],
          mitigations: [
            "Monitor memory usage closely",
            "Consider data cleanup strategies"
          ],
          estimatedRisk: "high"
        });
      }
    }

    return ok({
      canProceed: true,
      warnings: [],
      mitigations: [],
      estimatedRisk: "low"
    });
  }

  /**
   * Handle memory-intensive operations
   */
  handleMemoryLimits(
    change: StructuralChange,
    grid: OptimizedSparseGrid,
    currentMemoryMB: number
  ): EdgeCaseResult {
    const memoryStats = grid.getMemoryStats();
    const estimatedGrowthMB = this.estimateMemoryGrowth(change, grid) / 1024 / 1024;
    const projectedMemoryMB = currentMemoryMB + estimatedGrowthMB;

    if (projectedMemoryMB > this.limits.maxMemoryMB) {
      return {
        canProceed: false,
        warnings: [`Operation would exceed memory limit (${projectedMemoryMB.toFixed(1)}MB > ${this.limits.maxMemoryMB}MB)`],
        mitigations: [
          "Clear unused cells before operation",
          "Use batch operations with memory cleanup",
          "Reduce operation size",
          "Implement data streaming approach"
        ],
        estimatedRisk: "critical"
      };
    }

    if (projectedMemoryMB > this.limits.maxMemoryMB * 0.8) {
      return {
        canProceed: true,
        warnings: [`High memory usage expected (${projectedMemoryMB.toFixed(1)}MB)`],
        mitigations: [
          "Monitor memory usage during operation",
          "Enable automatic cleanup",
          "Consider breaking into smaller operations"
        ],
        estimatedRisk: "high"
      };
    }

    return {
      canProceed: true,
      warnings: [],
      mitigations: [],
      estimatedRisk: "low"
    };
  }

  /**
   * Handle operations with complex formula dependencies
   */
  handleFormulaComplexity(
    change: StructuralChange,
    grid: OptimizedSparseGrid
  ): EdgeCaseResult {
    const cellsWithFormulas = this.countFormulaCells(grid);
    const complexityRisk = this.assessFormulaComplexity(grid, change);

    if (cellsWithFormulas > 50000) {
      return {
        canProceed: true,
        warnings: [`High formula density (${cellsWithFormulas} cells) may slow operation`],
        mitigations: [
          "Use batch mode for better performance",
          "Consider formula optimization",
          "Monitor for circular references"
        ],
        estimatedRisk: complexityRisk
      };
    }

    return {
      canProceed: true,
      warnings: [],
      mitigations: [],
      estimatedRisk: "low"
    };
  }

  /**
   * Handle extremely large operations
   */
  handleLargeOperations(change: StructuralChange): EdgeCaseResult {
    if (change.count > this.limits.maxOperationSize) {
      return {
        canProceed: false,
        warnings: [`Operation size (${change.count}) exceeds maximum (${this.limits.maxOperationSize})`],
        mitigations: [
          `Split into operations of ${this.limits.maxOperationSize} or less`,
          "Use progressive batch processing",
          "Implement streaming approach"
        ],
        estimatedRisk: "critical"
      };
    }

    if (change.count > this.limits.criticalSizeThreshold) {
      return {
        canProceed: true,
        warnings: [`Large operation (${change.count} rows/columns) - expect longer processing time`],
        mitigations: [
          "Use batch mode for optimization",
          "Show progress indicator to user",
          "Allow operation cancellation"
        ],
        estimatedRisk: "high"
      };
    }

    if (change.count > this.limits.warningSizeThreshold) {
      return {
        canProceed: true,
        warnings: [`Medium operation size (${change.count}) - monitor performance`],
        mitigations: [
          "Use performance monitoring",
          "Consider user confirmation"
        ],
        estimatedRisk: "medium"
      };
    }

    return {
      canProceed: true,
      warnings: [],
      mitigations: [],
      estimatedRisk: "low"
    };
  }

  /**
   * Get system limits
   */
  getSystemLimits(): SystemLimits {
    return { ...this.limits };
  }

  /**
   * Suggest recovery strategies for failed operations
   */
  suggestRecoveryStrategies(
    failedChange: StructuralChange,
    error: string
  ): string[] {
    const strategies: string[] = [];

    if (error.includes("memory")) {
      strategies.push(
        "Clear unused cells and try again",
        "Restart application to free memory",
        "Reduce operation size by 50%",
        "Use incremental operations instead"
      );
    }

    if (error.includes("limit") || error.includes("exceed")) {
      strategies.push(
        "Delete unnecessary rows/columns first",
        "Export and re-import data to compact storage",
        "Split operation into smaller chunks",
        "Use different approach (e.g., copy/paste instead of insert)"
      );
    }

    if (error.includes("formula") || error.includes("reference")) {
      strategies.push(
        "Fix circular references before operation",
        "Simplify complex formulas",
        "Use absolute references where possible",
        "Update formulas after operation instead of during"
      );
    }

    return strategies;
  }

  // Private helper methods

  private identifyScenarios(
    change: StructuralChange,
    grid: OptimizedSparseGrid,
    currentMemoryMB: number
  ): EdgeCaseType[] {
    const scenarios: EdgeCaseType[] = [];
    const bounds = grid.getBounds();
    const cellCount = grid.size();

    // Empty sheet
    if (cellCount === 0) {
      scenarios.push("emptySheet");
    }

    // Max bounds
    const isNearLimit = bounds.maxRow > this.limits.maxRows * 0.8 || 
                       bounds.maxCol > this.limits.maxColumns * 0.8;
    if (isNearLimit) {
      scenarios.push("maxBounds");
    }

    // Memory concerns
    if (currentMemoryMB > this.limits.maxMemoryMB * 0.6) {
      scenarios.push("memoryLimit");
    }

    // Large operation
    if (change.count > this.limits.warningSizeThreshold) {
      scenarios.push("largeOperation");
    }

    // Data density
    const density = cellCount / ((bounds.maxRow + 1) * (bounds.maxCol + 1));
    if (density < 0.01) {
      scenarios.push("sparseData");
    } else if (density > 0.5) {
      scenarios.push("denseData");
    }

    // Formula complexity
    if (this.hasComplexFormulas(grid)) {
      scenarios.push("formulaComplexity");
    }

    return scenarios;
  }

  private handleScenario(
    scenario: EdgeCaseType,
    change: StructuralChange,
    grid: OptimizedSparseGrid,
    currentMemoryMB: number
  ): EdgeCaseResult {
    switch (scenario) {
      case "emptySheet":
        return {
          canProceed: true,
          warnings: [],
          mitigations: ["Operation will be very fast on empty sheet"],
          estimatedRisk: "low"
        };

      case "maxBounds":
        const boundsResult = this.handleMaxBounds(change, grid);
        return boundsResult.ok ? boundsResult.value : {
          canProceed: false,
          warnings: [boundsResult.error],
          mitigations: [],
          estimatedRisk: "critical"
        };

      case "memoryLimit":
        return this.handleMemoryLimits(change, grid, currentMemoryMB);

      case "largeOperation":
        return this.handleLargeOperations(change);

      case "formulaComplexity":
        return this.handleFormulaComplexity(change, grid);

      case "sparseData":
        return {
          canProceed: true,
          warnings: [],
          mitigations: ["Sparse data detected - operation will be efficient"],
          estimatedRisk: "low"
        };

      case "denseData":
        return {
          canProceed: true,
          warnings: ["Dense data may slow operation"],
          mitigations: ["Use batch mode", "Monitor memory usage"],
          estimatedRisk: "medium"
        };

      default:
        return {
          canProceed: true,
          warnings: [],
          mitigations: [],
          estimatedRisk: "low"
        };
    }
  }

  private suggestAlternativeApproach(
    scenarios: EdgeCaseType[],
    change: StructuralChange
  ): string | undefined {
    if (scenarios.includes("memoryLimit")) {
      return "Consider using streaming operations or data pagination";
    }

    if (scenarios.includes("largeOperation")) {
      return "Split into multiple smaller operations with progress tracking";
    }

    if (scenarios.includes("formulaComplexity")) {
      return "Update formulas after structural changes instead of during";
    }

    if (scenarios.includes("maxBounds")) {
      return "Compress or archive existing data before expanding";
    }

    return undefined;
  }

  private estimateMemoryGrowth(change: StructuralChange, grid: OptimizedSparseGrid): number {
    // Rough estimation: each new row/column uses ~1KB
    const baseGrowth = change.count * 1024;
    
    // Factor in existing cell density
    const bounds = grid.getBounds();
    const density = grid.size() / Math.max(1, (bounds.maxRow + 1) * (bounds.maxCol + 1));
    
    return baseGrowth * (1 + density);
  }

  private countFormulaCells(grid: OptimizedSparseGrid): number {
    let count = 0;
    const allCells = grid.getAllCells();
    
    for (const [_, cell] of allCells.entries()) {
      if (cell.hasFormula()) {
        count++;
      }
    }
    
    return count;
  }

  private hasComplexFormulas(grid: OptimizedSparseGrid): boolean {
    // Simplified check - in reality would analyze formula AST
    const allCells = grid.getAllCells();
    
    for (const [_, cell] of allCells.entries()) {
      if (cell.hasFormula()) {
        const formula = cell.rawValue as string;
        // Check for complex patterns
        if (formula.length > 100 || 
            formula.includes("INDIRECT") || 
            formula.includes("OFFSET") ||
            (formula.match(/[A-Z]+\d+/g) || []).length > 10) {
          return true;
        }
      }
    }
    
    return false;
  }

  private assessFormulaComplexity(
    grid: OptimizedSparseGrid,
    change: StructuralChange
  ): "low" | "medium" | "high" | "critical" {
    const formulaCount = this.countFormulaCells(grid);
    const hasComplexFormulas = this.hasComplexFormulas(grid);
    
    if (formulaCount > 100000) return "critical";
    if (formulaCount > 50000 || hasComplexFormulas) return "high";
    if (formulaCount > 10000) return "medium";
    return "low";
  }

  private riskLevelToNumber(risk: "low" | "medium" | "high" | "critical"): number {
    switch (risk) {
      case "low": return 1;
      case "medium": return 2;
      case "high": return 3;
      case "critical": return 4;
    }
  }
}
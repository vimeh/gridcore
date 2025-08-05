import { CellAddress, type StructuralAnalysis } from "@gridcore/core";
import type {
  CellHighlight,
  HighlightType,
  StructuralOperation,
  StructuralOperationState,
  StructuralUIConfig,
  StructuralUIEvent,
  StructuralWarning,
} from "./types";
import { DEFAULT_STRUCTURAL_UI_CONFIG } from "./types";

/**
 * Manages UI feedback for structural operations including visual highlights,
 * progress indicators, warnings, and confirmation dialogs.
 */
export class StructuralOperationManager {
  private state: StructuralOperationState;
  private config: StructuralUIConfig;
  private listeners: Array<(event: StructuralUIEvent) => void> = [];
  private activeHighlights: Map<string, NodeJS.Timeout> = new Map();
  private currentOperation?: {
    operation: StructuralOperation;
    startTime: number;
    progressInterval?: NodeJS.Timeout;
  };

  constructor(config: Partial<StructuralUIConfig> = {}) {
    this.config = { ...DEFAULT_STRUCTURAL_UI_CONFIG, ...config };
    this.state = {
      isActive: false,
      progress: 0,
      highlights: [],
      warnings: [],
      showConfirmation: false,
      showProgress: false,
    };
  }

  /**
   * Subscribe to structural UI events
   */
  subscribe(listener: (event: StructuralUIEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Start a structural operation with UI feedback
   */
  startOperation(
    operation: StructuralOperation,
    analysis: StructuralAnalysis,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.state.isActive = true;
      this.state.operation = operation;
      this.state.warnings = this.convertAnalysisWarnings(analysis.warnings);

      this.currentOperation = {
        operation,
        startTime: Date.now(),
      };

      // Check if confirmation is needed
      if (this.needsConfirmation(operation, analysis)) {
        this.showConfirmationDialog(operation, analysis, resolve);
        return;
      }

      // No confirmation needed, proceed
      this.proceedWithOperation(operation, analysis);
      resolve(true);
    });
  }

  /**
   * Update progress of current operation
   */
  updateProgress(progress: number, affectedCells: CellAddress[] = []): void {
    if (!this.state.isActive || !this.currentOperation) {
      return;
    }

    this.state.progress = Math.min(100, Math.max(0, progress));

    this.emit({
      type: "structuralOperationProgress",
      operation: this.currentOperation.operation,
      progress: this.state.progress,
      affectedCells,
    });

    // Highlight currently affected cells
    if (affectedCells.length > 0) {
      this.highlightCells(affectedCells, "affected", 500);
    }
  }

  /**
   * Complete the current operation
   */
  completeOperation(
    affectedCells: CellAddress[],
    formulaUpdates: Map<CellAddress, string>,
  ): void {
    if (!this.currentOperation) {
      return;
    }

    const duration = Date.now() - this.currentOperation.startTime;

    // Clear progress interval
    if (this.currentOperation.progressInterval) {
      clearInterval(this.currentOperation.progressInterval);
    }

    this.emit({
      type: "structuralOperationCompleted",
      operation: this.currentOperation.operation,
      affectedCells,
      formulaUpdates,
      duration,
    });

    // Highlight affected cells
    this.highlightCells(
      affectedCells,
      "affected",
      this.config.highlightDuration,
    );

    // Show warnings if any
    if (this.state.warnings.length > 0) {
      this.emit({
        type: "structuralOperationWarning",
        operation: this.currentOperation.operation,
        warnings: this.state.warnings,
      });

      // Auto-hide warnings if configured
      if (this.config.autoHideWarnings) {
        setTimeout(() => {
          this.clearWarnings();
        }, this.config.warningTimeout);
      }
    }

    // Store warnings before reset if auto-hide is configured
    const warningsToPreserve = this.config.autoHideWarnings
      ? [...this.state.warnings]
      : [];

    this.resetState();

    // Restore warnings if auto-hide is configured (they'll be cleared by the timeout)
    if (warningsToPreserve.length > 0) {
      this.state.warnings = warningsToPreserve;
    }
  }

  /**
   * Fail the current operation
   */
  failOperation(error: string): void {
    if (!this.currentOperation) {
      return;
    }

    this.emit({
      type: "structuralOperationFailed",
      operation: this.currentOperation.operation,
      error,
    });

    this.resetState();
  }

  /**
   * Cancel the current operation
   */
  cancelOperation(): void {
    if (!this.currentOperation) {
      return;
    }

    this.emit({
      type: "structuralOperationCancelled",
      operation: this.currentOperation.operation,
    });

    this.resetState();
  }

  /**
   * Highlight specific cells
   */
  highlightCells(
    cells: CellAddress[],
    type: HighlightType,
    duration?: number,
  ): void {
    const highlights: CellHighlight[] = cells.map((address) => ({
      address,
      type,
    }));

    this.state.highlights = [...this.state.highlights, ...highlights];

    this.emit({
      type: "highlightCells",
      cells,
      highlightType: type,
      duration,
    });

    // Auto-clear highlights if duration is specified
    if (duration) {
      const timeoutId = setTimeout(() => {
        this.clearHighlights(type);
      }, duration);

      // Store timeout for cleanup
      this.activeHighlights.set(`${type}-${Date.now()}`, timeoutId);
    }
  }

  /**
   * Clear highlights of a specific type or all highlights
   */
  clearHighlights(type?: HighlightType): void {
    if (type) {
      this.state.highlights = this.state.highlights.filter(
        (h) => h.type !== type,
      );
    } else {
      this.state.highlights = [];
      // Clear all timeouts
      for (const timeout of this.activeHighlights.values()) {
        clearTimeout(timeout);
      }
      this.activeHighlights.clear();
    }

    this.emit({ type: "clearHighlights" });
  }

  /**
   * Clear all warnings
   */
  clearWarnings(): void {
    this.state.warnings = [];
  }

  /**
   * Get current state
   */
  getState(): Readonly<StructuralOperationState> {
    return { ...this.state };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StructuralUIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if confirmation is needed for an operation
   */
  private needsConfirmation(
    operation: StructuralOperation,
    analysis: StructuralAnalysis,
  ): boolean {
    // Always confirm deletions above threshold
    if (
      (operation.type === "deleteRow" || operation.type === "deleteColumn") &&
      operation.count >= this.config.confirmDeletionAbove
    ) {
      return true;
    }

    // Confirm if formulas will be affected and configured to do so
    if (
      this.config.confirmFormulaAffected &&
      analysis.warnings.some((w) => w.type === "formulaReference")
    ) {
      return true;
    }

    // Confirm if there are data loss warnings
    if (analysis.warnings.some((w) => w.type === "dataLoss")) {
      return true;
    }

    return false;
  }

  /**
   * Show confirmation dialog
   */
  private showConfirmationDialog(
    operation: StructuralOperation,
    analysis: StructuralAnalysis,
    resolve: (confirmed: boolean) => void,
  ): void {
    this.state.showConfirmation = true;

    this.emit({
      type: "structuralOperationConfirmationRequired",
      operation,
      warnings: this.convertAnalysisWarnings(analysis.warnings),
      onConfirm: () => {
        this.state.showConfirmation = false;
        this.proceedWithOperation(operation, analysis);
        resolve(true);
      },
      onCancel: () => {
        this.state.showConfirmation = false;
        this.cancelOperation();
        resolve(false);
      },
    });
  }

  /**
   * Proceed with operation (after confirmation or if no confirmation needed)
   */
  private proceedWithOperation(
    operation: StructuralOperation,
    analysis: StructuralAnalysis,
  ): void {
    // Estimate duration for progress indicator
    const estimatedDuration = this.estimateOperationDuration(operation);

    this.emit({
      type: "structuralOperationStarted",
      operation,
      estimatedDuration,
    });

    // Show progress indicator for large operations
    if (operation.count >= this.config.showProgressAbove) {
      this.state.showProgress = true;
      this.startProgressTracking();
    }

    // Highlight areas that will be affected
    this.highlightAffectedAreas(operation, analysis);
  }

  /**
   * Start progress tracking for large operations
   */
  private startProgressTracking(): void {
    if (!this.currentOperation) {
      return;
    }

    this.currentOperation.progressInterval = setInterval(() => {
      // Simulate progress - in real implementation this would be tied to actual operation progress
      const elapsed = Date.now() - this.currentOperation?.startTime;
      const estimatedTotal = this.estimateOperationDuration(
        this.currentOperation?.operation,
      );
      const progress = Math.min(95, (elapsed / estimatedTotal) * 100);

      this.updateProgress(progress);
    }, this.config.progressThrottleMs);
  }

  /**
   * Highlight areas that will be affected by the operation
   */
  private highlightAffectedAreas(
    operation: StructuralOperation,
    analysis: StructuralAnalysis,
  ): void {
    // Highlight affected cells
    if (analysis.affectedCells.length > 0) {
      this.highlightCells(analysis.affectedCells, "affected");
    }

    // Highlight areas that will be deleted
    if (operation.type === "deleteRow" || operation.type === "deleteColumn") {
      const deletedCells = this.getDeletedCells(operation);
      this.highlightCells(deletedCells, "deleted");
    }

    // Highlight areas where new cells will be inserted
    if (operation.type === "insertRow" || operation.type === "insertColumn") {
      const insertedCells = this.getInsertedCells(operation);
      this.highlightCells(insertedCells, "inserted");
    }

    // Highlight cells with formula warnings
    const warningCells = analysis.warnings.flatMap((w) => w.affectedCells);
    if (warningCells.length > 0) {
      this.highlightCells(warningCells, "warning");
    }
  }

  /**
   * Get cells that will be deleted
   */
  private getDeletedCells(operation: StructuralOperation): CellAddress[] {
    const cells: CellAddress[] = [];

    if (operation.type === "deleteRow") {
      for (
        let row = operation.index;
        row < operation.index + operation.count;
        row++
      ) {
        for (let col = 0; col < 20; col++) {
          // Assume max 20 columns for visualization
          const addressResult = CellAddress.create(row, col);
          if (addressResult.ok) {
            cells.push(addressResult.value);
          }
        }
      }
    } else if (operation.type === "deleteColumn") {
      for (
        let col = operation.index;
        col < operation.index + operation.count;
        col++
      ) {
        for (let row = 0; row < 50; row++) {
          // Assume max 50 rows for visualization
          const addressResult = CellAddress.create(row, col);
          if (addressResult.ok) {
            cells.push(addressResult.value);
          }
        }
      }
    }

    return cells;
  }

  /**
   * Get cells where new content will be inserted
   */
  private getInsertedCells(operation: StructuralOperation): CellAddress[] {
    const cells: CellAddress[] = [];

    if (operation.type === "insertRow") {
      for (
        let row = operation.index;
        row < operation.index + operation.count;
        row++
      ) {
        for (let col = 0; col < 20; col++) {
          // Assume max 20 columns for visualization
          const addressResult = CellAddress.create(row, col);
          if (addressResult.ok) {
            cells.push(addressResult.value);
          }
        }
      }
    } else if (operation.type === "insertColumn") {
      for (
        let col = operation.index;
        col < operation.index + operation.count;
        col++
      ) {
        for (let row = 0; row < 50; row++) {
          // Assume max 50 rows for visualization
          const addressResult = CellAddress.create(row, col);
          if (addressResult.ok) {
            cells.push(addressResult.value);
          }
        }
      }
    }

    return cells;
  }

  /**
   * Convert StructuralAnalysis warnings to UI warnings
   */
  private convertAnalysisWarnings(warnings: any[]): StructuralWarning[] {
    return warnings.map((warning) => ({
      type: warning.type,
      message: warning.message,
      affectedCells: warning.affectedCells,
      severity:
        warning.type === "dataLoss" ? ("error" as const) : ("warning" as const),
    }));
  }

  /**
   * Estimate operation duration based on operation size
   */
  private estimateOperationDuration(operation: StructuralOperation): number {
    // Simple estimation: 10ms per affected item + base overhead
    const baseMs = 100;
    const perItemMs = 10;
    return baseMs + operation.count * perItemMs;
  }

  /**
   * Reset manager state
   */
  private resetState(): void {
    // Clear any ongoing progress tracking
    if (this.currentOperation?.progressInterval) {
      clearInterval(this.currentOperation.progressInterval);
    }

    this.currentOperation = undefined;
    this.state = {
      isActive: false,
      progress: 0,
      highlights: [],
      warnings: [],
      showConfirmation: false,
      showProgress: false,
    };

    // Clear all highlights
    this.clearHighlights();
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: StructuralUIEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

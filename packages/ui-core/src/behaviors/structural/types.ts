import type { CellAddress } from "@gridcore/core";

/**
 * Enhanced events for structural operation UI feedback
 */
export type StructuralUIEvent =
  | {
      type: "structuralOperationStarted";
      operation: StructuralOperation;
      estimatedDuration?: number;
    }
  | {
      type: "structuralOperationProgress";
      operation: StructuralOperation;
      progress: number; // 0-100
      affectedCells: CellAddress[];
    }
  | {
      type: "structuralOperationCompleted";
      operation: StructuralOperation;
      affectedCells: CellAddress[];
      formulaUpdates: Map<CellAddress, string>;
      duration: number;
    }
  | {
      type: "structuralOperationWarning";
      operation: StructuralOperation;
      warnings: StructuralWarning[];
    }
  | {
      type: "structuralOperationConfirmationRequired";
      operation: StructuralOperation;
      warnings: StructuralWarning[];
      onConfirm: () => void;
      onCancel: () => void;
    }
  | {
      type: "structuralOperationFailed";
      operation: StructuralOperation;
      error: string;
    }
  | {
      type: "structuralOperationCancelled";
      operation: StructuralOperation;
    }
  | {
      type: "highlightCells";
      cells: CellAddress[];
      highlightType: HighlightType;
      duration?: number;
    }
  | {
      type: "clearHighlights";
    };

export interface StructuralOperation {
  type: "insertRow" | "insertColumn" | "deleteRow" | "deleteColumn";
  index: number;
  count: number;
  timestamp: number;
  id: string; // Unique identifier for tracking
}

export interface StructuralWarning {
  type: "formulaReference" | "dataLoss" | "outOfBounds";
  message: string;
  affectedCells: CellAddress[];
  severity: "info" | "warning" | "error";
}

export type HighlightType =
  | "affected" // Cells that will be moved/shifted
  | "deleted" // Cells that will be deleted
  | "inserted" // Area where new cells will be inserted
  | "warning" // Cells with formula warnings
  | "error"; // Cells with errors

export interface CellHighlight {
  address: CellAddress;
  type: HighlightType;
  message?: string;
}

export interface StructuralOperationState {
  isActive: boolean;
  operation?: StructuralOperation;
  progress: number;
  highlights: CellHighlight[];
  warnings: StructuralWarning[];
  showConfirmation: boolean;
  showProgress: boolean;
}

/**
 * Configuration for structural operation UI behavior
 */
export interface StructuralUIConfig {
  // Confirmation thresholds
  confirmDeletionAbove: number; // Number of cells/rows/columns
  confirmFormulaAffected: boolean; // Confirm if formulas will be affected

  // Progress indicators
  showProgressAbove: number; // Number of operations to show progress
  progressThrottleMs: number; // Throttle progress updates

  // Visual feedback
  highlightDuration: number; // How long to show highlights (ms)
  animateOperations: boolean; // Whether to animate structural changes

  // Warning display
  maxWarningsShown: number; // Maximum warnings to show at once
  autoHideWarnings: boolean; // Auto-hide warnings after operation
  warningTimeout: number; // How long to show warnings (ms)
}

export const DEFAULT_STRUCTURAL_UI_CONFIG: StructuralUIConfig = {
  confirmDeletionAbove: 5,
  confirmFormulaAffected: true,
  showProgressAbove: 100,
  progressThrottleMs: 100,
  highlightDuration: 2000,
  animateOperations: true,
  maxWarningsShown: 5,
  autoHideWarnings: true,
  warningTimeout: 5000,
};

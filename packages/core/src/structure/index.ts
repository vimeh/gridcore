/**
 * Structural operations system for gridcore.
 * 
 * This module provides comprehensive support for insert/delete row/column operations
 * with proper formula reference updates and data integrity.
 * 
 * Phase 6 enhancements include:
 * - Performance-optimized sparse grid with O(log n) operations
 * - Batch operation support for multiple structural changes
 * - Comprehensive performance monitoring and metrics
 * - Edge case handling for extreme scenarios and system limits
 * - Memory optimization for large operations
 */

export { ReferenceUpdater, type StructuralChange } from "./ReferenceUpdater";
export { SparseGrid } from "./SparseGrid";
export { 
  StructuralEngine, 
  type StructuralWarning, 
  type StructuralAnalysis 
} from "./StructuralEngine";
export {
  StructuralUndoManager,
  type StructuralSnapshot,
  type StructuralOperation,
  type StructuralTransaction
} from "./StructuralUndoManager";

// Phase 6: Performance-optimized components
export { OptimizedSparseGrid } from "./OptimizedSparseGrid";
export { 
  OptimizedStructuralEngine,
  type BatchStructuralOperation
} from "./OptimizedStructuralEngine";
export {
  PerformanceMonitor,
  PerformanceTimer,
  globalPerformanceMonitor,
  type PerformanceMetrics,
  type PerformanceThresholds,
  type PerformanceReport
} from "./PerformanceMonitor";
export {
  EdgeCaseHandler,
  type EdgeCaseType,
  type EdgeCaseResult,
  type SystemLimits
} from "./EdgeCaseHandler";
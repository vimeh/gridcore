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

export {
  EdgeCaseHandler,
  type EdgeCaseResult,
  type EdgeCaseType,
  type SystemLimits,
} from "./EdgeCaseHandler";
// Phase 6: Performance-optimized components
export { OptimizedSparseGrid } from "./OptimizedSparseGrid";
export {
  type BatchStructuralOperation,
  OptimizedStructuralEngine,
} from "./OptimizedStructuralEngine";
export {
  globalPerformanceMonitor,
  type PerformanceMetrics,
  PerformanceMonitor,
  type PerformanceReport,
  type PerformanceThresholds,
  PerformanceTimer,
} from "./PerformanceMonitor";
export { ReferenceUpdater, type StructuralChange } from "./ReferenceUpdater";
export { SparseGrid } from "./SparseGrid";
export {
  type StructuralAnalysis,
  StructuralEngine,
  type StructuralWarning,
} from "./StructuralEngine";
export {
  type StructuralOperation,
  type StructuralSnapshot,
  type StructuralTransaction,
  StructuralUndoManager,
} from "./StructuralUndoManager";

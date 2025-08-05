/**
 * Structural operations system for gridcore.
 * 
 * This module provides comprehensive support for insert/delete row/column operations
 * with proper formula reference updates and data integrity.
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
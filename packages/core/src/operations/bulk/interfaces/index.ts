// Core interfaces
export type {
  BulkOperation,
  UndoableBulkOperation,
  PreviewableBulkOperation,
  Selection,
  BulkOperationOptions,
  IBulkOperationFactory
} from "./BulkOperation";

// Preview interfaces
export type {
  OperationPreview,
  CellChange,
  OperationSummary,
  PreviewOptions
} from "./OperationPreview";

export { OperationPreviewBuilder } from "./OperationPreview";

// Result interfaces
export type {
  OperationResult,
  OperationMetadata,
  PerformanceMetrics,
  BatchOperationResult
} from "./OperationResult";

export { OperationResultBuilder } from "./OperationResult";
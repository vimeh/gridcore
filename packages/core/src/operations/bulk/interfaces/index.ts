// Core interfaces
export type {
  BulkOperation,
  BulkOperationOptions,
  IBulkOperationFactory,
  PreviewableBulkOperation,
  Selection,
  UndoableBulkOperation,
} from "./BulkOperation";

// Preview interfaces
export type {
  CellChange,
  OperationPreview,
  OperationSummary,
  PreviewOptions,
} from "./OperationPreview";

export { OperationPreviewBuilder } from "./OperationPreview";

// Result interfaces
export type {
  BatchOperationResult,
  OperationMetadata,
  OperationResult,
  PerformanceMetrics,
} from "./OperationResult";

export { OperationResultBuilder } from "./OperationResult";

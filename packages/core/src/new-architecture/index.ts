// Domain Models
export { CellAddress } from "../domain/models/CellAddress"
export { CellRange } from "../domain/models/CellRange"
export { Cell } from "../domain/models/Cell"
export { Formula } from "../domain/models/Formula"
export type { CellValue } from "../domain/models/CellValue"

// Domain Interfaces
export type { ICellRepository } from "../domain/interfaces/ICellRepository"
export type { IDependencyRepository } from "../domain/interfaces/IDependencyRepository"
export type { IEventService, DomainEvent, CellValueChangedEvent, CellCalculatedEvent, CellsDeletedEvent, BatchUpdateStartedEvent, BatchUpdateCompletedEvent } from "../domain/interfaces/IEventService"
export type { IFormulaParser, FormulaAST, FormulaToken } from "../domain/interfaces/IFormulaParser"
export type { IFormulaEvaluator, EvaluationContext, FormulaFunction } from "../domain/interfaces/IFormulaEvaluator"

// Infrastructure
export { InMemoryCellRepository } from "../infrastructure/repositories/InMemoryCellRepository"
export { InMemoryDependencyRepository } from "../infrastructure/repositories/InMemoryDependencyRepository"
export { EventStore } from "../infrastructure/stores/EventStore"
export { FormulaParser } from "../infrastructure/parsers/FormulaParser"
export { FormulaEvaluator } from "../infrastructure/evaluators/FormulaEvaluator"

// Application Services
export { FormulaService, type IFormulaService } from "../application/services/FormulaService"
export { CalculationService, type ICalculationService, type CalculationContext } from "../application/services/CalculationService"

// Application Facade
export { SpreadsheetFacade, type ISpreadsheetFacade } from "../application/SpreadsheetFacade"

// Adapters
export { SpreadsheetEngineAdapter } from "../adapters/SpreadsheetEngineAdapter"

// Shared Types
export type { Result } from "../shared/types/Result"
export { ok, err } from "../shared/types/Result"
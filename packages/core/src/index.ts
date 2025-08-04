// References System
export * from "./references";

// Domain Models

// Application Facade
export {
  type ISpreadsheetFacade,
  SpreadsheetFacade,
} from "./application/SpreadsheetFacade";
export {
  type CalculationContext,
  CalculationService,
  type ICalculationService,
} from "./application/services/CalculationService";
// Application Services
export {
  FormulaService,
  type IFormulaService,
} from "./application/services/FormulaService";
// Domain Interfaces
export type { ICellRepository } from "./domain/interfaces/ICellRepository";
export type { IDependencyRepository } from "./domain/interfaces/IDependencyRepository";
export type {
  BatchUpdateCompletedEvent,
  BatchUpdateStartedEvent,
  CellCalculatedEvent,
  CellsDeletedEvent,
  CellValueChangedEvent,
  DomainEvent,
  IEventService,
} from "./domain/interfaces/IEventService";
export type {
  EvaluationContext,
  FormulaFunction,
  IFormulaEvaluator,
} from "./domain/interfaces/IFormulaEvaluator";
export type {
  FormulaAST,
  FormulaToken,
  IFormulaParser,
} from "./domain/interfaces/IFormulaParser";
export { Cell } from "./domain/models/Cell";
export { CellAddress } from "./domain/models/CellAddress";
export { CellRange } from "./domain/models/CellRange";
export type { CellValue } from "./domain/models/CellValue";
export { Formula } from "./domain/models/Formula";
export { FormulaEvaluator } from "./infrastructure/evaluators/FormulaEvaluator";
export { FormulaParser } from "./infrastructure/parsers/FormulaParser";
// Infrastructure
export { InMemoryCellRepository } from "./infrastructure/repositories/InMemoryCellRepository";
export { InMemoryDependencyRepository } from "./infrastructure/repositories/InMemoryDependencyRepository";
export { EventStore } from "./infrastructure/stores/EventStore";
// High-level API
export { Sheet } from "./Sheet";
// Shared Types
export type { Result } from "./shared/types/Result";
export { err, ok } from "./shared/types/Result";
// Utility exports
export * from "./utils/cellAddress";
export { Workbook } from "./Workbook";

// Keep the GridCore class for backward compatibility
export class GridCore {
  private name: string = "GridCore Engine";

  constructor() {
    console.log(`${this.name} initialized`);
  }

  getVersion(): string {
    return "0.0.1";
  }
}

export default GridCore;

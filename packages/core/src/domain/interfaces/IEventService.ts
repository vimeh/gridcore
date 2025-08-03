import type { Cell } from "../models/Cell";
import type { CellAddress } from "../models/CellAddress";

export interface DomainEvent {
  type: string;
  timestamp: Date;
}

export interface CellValueChangedEvent extends DomainEvent {
  type: "CellValueChanged";
  address: CellAddress;
  oldValue: Cell | undefined;
  newValue: Cell;
}

export interface CellsDeletedEvent extends DomainEvent {
  type: "CellsDeleted";
  addresses: CellAddress[];
}

export interface FormulaEvaluatedEvent extends DomainEvent {
  type: "FormulaEvaluated";
  address: CellAddress;
  formula: string;
  result: unknown;
  error?: string;
}

export interface BatchUpdateStartedEvent extends DomainEvent {
  type: "BatchUpdateStarted";
  batchId: string;
}

export interface BatchUpdateCompletedEvent extends DomainEvent {
  type: "BatchUpdateCompleted";
  batchId: string;
  affectedCells: CellAddress[];
}

export interface CellCalculatedEvent extends DomainEvent {
  type: "CellCalculated";
  address: CellAddress;
  cell: Cell;
}

export type SpreadsheetEvent =
  | CellValueChangedEvent
  | CellsDeletedEvent
  | FormulaEvaluatedEvent
  | BatchUpdateStartedEvent
  | BatchUpdateCompletedEvent
  | CellCalculatedEvent;

export type EventHandler<T extends DomainEvent> = (
  event: T,
) => void | Promise<void>;

export interface IEventService {
  emit<T extends DomainEvent>(event: T): void;
  on<T extends DomainEvent>(
    eventType: T["type"],
    handler: EventHandler<T>,
  ): void;
  off<T extends DomainEvent>(
    eventType: T["type"],
    handler: EventHandler<T>,
  ): void;
  clear(): void;
}

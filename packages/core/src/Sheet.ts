import { SpreadsheetFacade } from "./application/SpreadsheetFacade";
import { CalculationService } from "./application/services/CalculationService";
import { FormulaService } from "./application/services/FormulaService";
import { FormulaEvaluator } from "./infrastructure/evaluators/FormulaEvaluator";
import { FormulaParser } from "./infrastructure/parsers/FormulaParser";
import { InMemoryCellRepository } from "./infrastructure/repositories/InMemoryCellRepository";
import { InMemoryDependencyRepository } from "./infrastructure/repositories/InMemoryDependencyRepository";
import { EventStore } from "./infrastructure/stores/EventStore";

let sheetIdCounter = 0;

export class Sheet {
  private facade: SpreadsheetFacade;
  private id: string;
  private name: string;
  private rows: number;
  private cols: number;

  constructor(name: string, rows = 2000, cols = 52) {
    this.id = `sheet-${++sheetIdCounter}-${Date.now()}`;
    this.name = name;
    this.rows = rows;
    this.cols = cols;

    // Initialize all dependencies
    const cellRepo = new InMemoryCellRepository();
    const depRepo = new InMemoryDependencyRepository();
    const eventService = new EventStore();
    const formulaParser = new FormulaParser();
    const formulaEvaluator = new FormulaEvaluator();
    const formulaService = new FormulaService(formulaParser, formulaEvaluator);
    const calcService = new CalculationService(
      cellRepo,
      depRepo,
      formulaService,
      eventService,
    );

    this.facade = new SpreadsheetFacade(
      cellRepo,
      depRepo,
      calcService,
      formulaService,
      eventService,
    );
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  setName(name: string): void {
    this.name = name;
  }

  getRows(): number {
    return this.rows;
  }

  getCols(): number {
    return this.cols;
  }

  getFacade(): SpreadsheetFacade {
    return this.facade;
  }
}

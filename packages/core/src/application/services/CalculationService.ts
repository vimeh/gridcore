import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import type { IDependencyRepository } from "../../domain/interfaces/IDependencyRepository";
import type { IEventService } from "../../domain/interfaces/IEventService";
import type { EvaluationContext } from "../../domain/interfaces/IFormulaEvaluator";
import { Cell } from "../../domain/models/Cell";
import type { CellAddress } from "../../domain/models/CellAddress";
import type { CellValue } from "../../domain/models/CellValue";
import { err, ok, type Result } from "../../shared/types/Result";
import type { IFormulaService } from "./FormulaService";

export interface ICalculationService {
  calculateCell(address: CellAddress): Result<Cell>;
  calculateRange(addresses: CellAddress[]): Result<Map<string, Cell>>;
  recalculateDependents(address: CellAddress): Result<Map<string, Cell>>;
  invalidateCache(address: CellAddress): void;
  clearCache(): void;
}

export interface CalculationContext extends EvaluationContext {
  // getCellValue is inherited from EvaluationContext
  getFunction(name: string): Result<(args: CellValue[]) => Result<CellValue>>;
}

export class CalculationService implements ICalculationService {
  private calculationCache = new Map<string, Cell>();
  private calculatingCells = new Set<string>();

  constructor(
    private readonly cellRepository: ICellRepository,
    private readonly dependencyRepository: IDependencyRepository,
    private readonly formulaService: IFormulaService,
    private readonly eventService: IEventService,
  ) {}

  calculateCell(address: CellAddress): Result<Cell> {
    const key = address.toString();

    // Check for circular dependency
    if (this.calculatingCells.has(key)) {
      return err(`Circular dependency detected at ${key}`);
    }

    // Check cache
    if (this.calculationCache.has(key)) {
      return ok(this.calculationCache.get(key)!);
    }

    // Get the cell
    const cell = this.cellRepository.get(address);
    if (!cell || !cell.hasFormula()) {
      // No formula, return as is
      const resultCell = cell || Cell.empty();

      // Cache the result
      this.calculationCache.set(key, resultCell);

      // Emit event
      this.eventService.emit({
        type: "CellCalculated",
        timestamp: new Date(),
        address,
        cell: resultCell,
      });

      return ok(resultCell);
    }

    // Mark as calculating
    this.calculatingCells.add(key);

    try {
      // Create evaluation context
      const context: CalculationContext = {
        getCellValue: (addr: CellAddress): CellValue => {
          // Recursively calculate dependencies
          const depResult = this.calculateCell(addr);
          if (!depResult.ok) {
            // If it's a circular dependency, throw to propagate the error
            if (depResult.error.includes("Circular dependency")) {
              throw new Error(depResult.error);
            }
            // Return null for other errors during dependency calculation
            return null;
          }
          return depResult.value.computedValue ?? null;
        },
        getRangeValues: (range): CellValue[] => {
          const values: CellValue[] = [];
          for (const addr of range) {
            const depResult = this.calculateCell(addr);
            if (depResult.ok) {
              values.push(depResult.value.computedValue ?? null);
            } else {
              values.push(null);
            }
          }
          return values;
        },
        getCell: (addr: CellAddress): Cell | undefined => {
          return this.cellRepository.get(addr);
        },
        formulaAddress: address,
        getFunction: (name: string) => {
          // For now, we don't support custom functions
          return err(`Unknown function: ${name}`);
        },
      };

      // Evaluate the formula
      const evalResult = this.formulaService.evaluateFormula(
        cell.formula!,
        context,
      );

      let newCell: Cell;
      if (!evalResult.ok) {
        // Check if it's a circular dependency error
        if (evalResult.error.includes("Circular dependency")) {
          this.calculatingCells.delete(key);
          return err(evalResult.error);
        }

        // Create cell with error
        newCell = Cell.createWithComputedValue(
          cell.rawValue,
          null,
          cell.formula,
          evalResult.error,
        );
      } else {
        // Create cell with computed value
        newCell = Cell.createWithComputedValue(
          cell.rawValue,
          evalResult.value,
          cell.formula,
        );
      }

      // Cache the result
      this.calculationCache.set(key, newCell);

      // Emit event
      this.eventService.emit({
        type: "CellCalculated",
        timestamp: new Date(),
        address,
        cell: newCell,
      });

      return ok(newCell);
    } finally {
      // Remove from calculating set
      this.calculatingCells.delete(key);
    }
  }

  calculateRange(addresses: CellAddress[]): Result<Map<string, Cell>> {
    const results = new Map<string, Cell>();

    for (const address of addresses) {
      const result = this.calculateCell(address);
      if (!result.ok) {
        return err(
          `Failed to calculate ${address.toString()}: ${result.error}`,
        );
      }

      // Check if the cell has an error
      if (result.value.hasError()) {
        return err(
          `Cell ${address.toString()} has error: ${result.value.error}`,
        );
      }

      results.set(address.toString(), result.value);
    }

    return ok(results);
  }

  recalculateDependents(address: CellAddress): Result<Map<string, Cell>> {
    // Get all cells that need to be recalculated
    const order = this.dependencyRepository.getTopologicalOrder([address]);

    const results = new Map<string, Cell>();

    // Calculate in topological order
    for (const addr of order) {
      const key = addr.toString();

      // Invalidate cache for this cell
      this.calculationCache.delete(key);

      // Calculate the cell
      const result = this.calculateCell(addr);
      if (!result.ok) {
        return err(`Failed to calculate ${key}: ${result.error}`);
      }

      results.set(key, result.value);
    }

    return ok(results);
  }

  invalidateCache(address: CellAddress): void {
    // Invalidate this cell and all its dependents
    const order = this.dependencyRepository.getTopologicalOrder([address]);
    for (const addr of order) {
      this.calculationCache.delete(addr.toString());
    }
  }

  clearCache(): void {
    this.calculationCache.clear();
  }
}

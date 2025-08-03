import { err, ok, type Result } from "../../shared/types/Result";
import type { CellAddress } from "./CellAddress";
import type { CellValue } from "./CellValue";
import { Formula } from "./Formula";

export class Cell {
  private constructor(
    public readonly rawValue: CellValue,
    public readonly computedValue: CellValue,
    public readonly formula?: Formula,
    public readonly error?: string,
  ) {}

  static create(value: unknown, address?: CellAddress): Result<Cell> {
    if (value === undefined || value === null) {
      return ok(new Cell(null, null));
    }

    if (typeof value === "string" && value.startsWith("=") && address) {
      const formulaResult = Formula.create(value, address);
      if (!formulaResult.ok) {
        return err(formulaResult.error);
      }
      return ok(new Cell(value, null, formulaResult.value));
    }

    const validatedValue = Cell.validateValue(value);
    if (!validatedValue.ok) {
      return err(validatedValue.error);
    }

    return ok(new Cell(validatedValue.value, validatedValue.value));
  }

  static createWithComputedValue(
    rawValue: CellValue,
    computedValue: CellValue,
    formula?: Formula,
    error?: string,
  ): Cell {
    return new Cell(rawValue, computedValue, formula, error);
  }

  static empty(): Cell {
    return new Cell(null, null);
  }

  hasFormula(): boolean {
    return this.formula !== undefined;
  }

  hasError(): boolean {
    return this.error !== undefined;
  }

  isEmpty(): boolean {
    return this.rawValue === null || this.rawValue === undefined;
  }

  get value(): CellValue {
    return this.hasError() ? this.error : this.computedValue;
  }

  get displayValue(): string {
    if (this.hasError()) {
      return `#ERROR: ${this.error}`;
    }
    if (this.computedValue === null || this.computedValue === undefined) {
      return "";
    }
    return String(this.computedValue);
  }

  equals(other: Cell): boolean {
    if (
      this.rawValue !== other.rawValue ||
      this.computedValue !== other.computedValue ||
      this.error !== other.error
    ) {
      return false;
    }

    if (this.formula === undefined && other.formula === undefined) {
      return true;
    }

    if (this.formula === undefined || other.formula === undefined) {
      return false;
    }

    return this.formula.equals(other.formula);
  }

  withComputedValue(computedValue: CellValue): Cell {
    return new Cell(this.rawValue, computedValue, this.formula, undefined);
  }

  withError(error: string): Cell {
    return new Cell(this.rawValue, this.computedValue, this.formula, error);
  }

  private static validateValue(value: unknown): Result<CellValue> {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      return ok(value);
    }
    return err(`Invalid cell value type: ${typeof value}`);
  }
}

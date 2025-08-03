import { err, ok, type Result } from "../../shared/types/Result";
import type { CellAddress } from "./CellAddress";

export class Formula {
  private constructor(
    public readonly expression: string,
    public readonly address: CellAddress,
  ) {}

  static create(expression: string, address: CellAddress): Result<Formula> {
    if (!expression) {
      return err("Formula expression cannot be empty");
    }

    if (!expression.startsWith("=")) {
      return err("Formula must start with =");
    }

    if (expression.length === 1) {
      return err("Formula must have content after =");
    }

    return ok(new Formula(expression, address));
  }

  get normalizedExpression(): string {
    return this.expression.substring(1);
  }

  toString(): string {
    return this.expression;
  }

  equals(other: Formula): boolean {
    return (
      this.expression === other.expression && this.address.equals(other.address)
    );
  }

  containsReference(address: CellAddress): boolean {
    const addressStr = address.toString();
    const regex = new RegExp(`\\b${addressStr}\\b`, "i");
    return regex.test(this.normalizedExpression);
  }

  containsRangeReference(range: string): boolean {
    const regex = new RegExp(`\\b${range}\\b`, "i");
    return regex.test(this.normalizedExpression);
  }
}

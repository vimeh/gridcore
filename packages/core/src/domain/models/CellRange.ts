import { err, ok, type Result } from "../../shared/types/Result";
import { CellAddress } from "./CellAddress";

export class CellRange {
  private constructor(
    public readonly start: CellAddress,
    public readonly end: CellAddress,
  ) {}

  static create(start: CellAddress, end: CellAddress): Result<CellRange> {
    if (start.row > end.row || start.col > end.col) {
      return err("Invalid range: start must be before or equal to end");
    }
    return ok(new CellRange(start, end));
  }

  static fromString(range: string): Result<CellRange> {
    const parts = range.split(":");
    if (parts.length !== 2) {
      return err(`Invalid range format: ${range}`);
    }

    const startResult = CellAddress.fromString(parts[0]);
    if (!startResult.ok) {
      return err(`Invalid start address: ${startResult.error}`);
    }

    const endResult = CellAddress.fromString(parts[1]);
    if (!endResult.ok) {
      return err(`Invalid end address: ${endResult.error}`);
    }

    return CellRange.create(startResult.value, endResult.value);
  }

  toString(): string {
    return `${this.start.toString()}:${this.end.toString()}`;
  }

  equals(other: CellRange): boolean {
    return this.start.equals(other.start) && this.end.equals(other.end);
  }

  contains(address: CellAddress): boolean {
    return (
      address.row >= this.start.row &&
      address.row <= this.end.row &&
      address.col >= this.start.col &&
      address.col <= this.end.col
    );
  }

  *cells(): Generator<CellAddress> {
    for (let row = this.start.row; row <= this.end.row; row++) {
      for (let col = this.start.col; col <= this.end.col; col++) {
        const cellResult = CellAddress.create(row, col);
        if (cellResult.ok) {
          yield cellResult.value;
        }
      }
    }
  }

  get rowCount(): number {
    return this.end.row - this.start.row + 1;
  }

  get colCount(): number {
    return this.end.col - this.start.col + 1;
  }

  get cellCount(): number {
    return this.rowCount * this.colCount;
  }

  intersects(other: CellRange): boolean {
    return !(
      this.end.row < other.start.row ||
      this.start.row > other.end.row ||
      this.end.col < other.start.col ||
      this.start.col > other.end.col
    );
  }

  intersection(other: CellRange): Result<CellRange> {
    if (!this.intersects(other)) {
      return err("Ranges do not intersect");
    }

    const startRow = Math.max(this.start.row, other.start.row);
    const startCol = Math.max(this.start.col, other.start.col);
    const endRow = Math.min(this.end.row, other.end.row);
    const endCol = Math.min(this.end.col, other.end.col);

    const startResult = CellAddress.create(startRow, startCol);
    if (!startResult.ok) return err(startResult.error);

    const endResult = CellAddress.create(endRow, endCol);
    if (!endResult.ok) return err(endResult.error);

    return CellRange.create(startResult.value, endResult.value);
  }
}

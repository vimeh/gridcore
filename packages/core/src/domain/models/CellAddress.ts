import { Result, ok, err } from '../../shared/types/Result'

export class CellAddress {
  private constructor(
    public readonly row: number,
    public readonly col: number
  ) {}

  static create(row: number, col: number): Result<CellAddress> {
    if (row < 0 || col < 0) {
      return err('Invalid cell address: row and column must be non-negative')
    }
    return ok(new CellAddress(row, col))
  }

  static fromString(address: string): Result<CellAddress> {
    const match = address.match(/^([A-Z]+)(\d+)$/i)
    if (!match) {
      return err(`Invalid cell address format: ${address}`)
    }

    const [, colLabel, rowLabel] = match
    const row = parseInt(rowLabel, 10) - 1
    const col = this.columnLabelToNumber(colLabel.toUpperCase())

    return CellAddress.create(row, col)
  }

  toString(): string {
    return `${this.getColumnLabel()}${this.row + 1}`
  }

  equals(other: CellAddress): boolean {
    return this.row === other.row && this.col === other.col
  }

  offset(rowOffset: number, colOffset: number): Result<CellAddress> {
    return CellAddress.create(this.row + rowOffset, this.col + colOffset)
  }

  private getColumnLabel(): string {
    let label = ''
    let n = this.col
    while (n >= 0) {
      label = String.fromCharCode((n % 26) + 65) + label
      n = Math.floor(n / 26) - 1
    }
    return label
  }

  private static columnLabelToNumber(label: string): number {
    let result = 0
    for (let i = 0; i < label.length; i++) {
      result = result * 26 + (label.charCodeAt(i) - 64)
    }
    return result - 1
  }
}
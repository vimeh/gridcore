import { CellAddress } from "../domain/models/CellAddress";
import { CellRange } from "../domain/models/CellRange";

export function columnLetterToNumber(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result;
}

export function numberToColumnLetter(num: number): string {
  let result = "";
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

export function parseCellAddress(reference: string): CellAddress | null {
  const match = reference.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const col = columnLetterToNumber(match[1]);
  const row = parseInt(match[2], 10);

  if (row < 1 || col < 1) return null;

  // Add reasonable limits
  if (row > 1048576 || col > 16384) return null; // Excel limits

  const result = CellAddress.create(row - 1, col - 1);
  return result.ok ? result.value : null;
}

export function cellAddressToString(address: CellAddress): string {
  return `${numberToColumnLetter(address.col + 1)}${address.row + 1}`;
}

export function parseCellRange(rangeStr: string): CellRange | null {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) return null;

  const addr1 = parseCellAddress(parts[0]);
  const addr2 = parseCellAddress(parts[1]);

  if (!addr1 || !addr2) return null;

  // Normalize range so start is always before end
  const startRow = Math.min(addr1.row, addr2.row);
  const startCol = Math.min(addr1.col, addr2.col);
  const endRow = Math.max(addr1.row, addr2.row);
  const endCol = Math.max(addr1.col, addr2.col);

  const startResult = CellAddress.create(startRow, startCol);
  const endResult = CellAddress.create(endRow, endCol);

  if (!startResult.ok || !endResult.ok) return null;

  const result = CellRange.create(startResult.value, endResult.value);
  return result.ok ? result.value : null;
}

export function isValidCellAddress(reference: string): boolean {
  return parseCellAddress(reference) !== null;
}

export function getCellsInRange(range: CellRange): CellAddress[] {
  const cells: CellAddress[] = [];

  for (let row = range.start.row; row <= range.end.row; row++) {
    for (let col = range.start.col; col <= range.end.col; col++) {
      const cellResult = CellAddress.create(row, col);
      if (cellResult.ok) {
        cells.push(cellResult.value);
      }
    }
  }

  return cells;
}

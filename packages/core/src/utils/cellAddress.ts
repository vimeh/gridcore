import { CellAddress, CellRange } from "../types";

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

  return { row: row - 1, col: col - 1 };
}

export function cellAddressToString(address: CellAddress): string {
  return `${numberToColumnLetter(address.col + 1)}${address.row + 1}`;
}

export function parseCellRange(rangeStr: string): CellRange | null {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) return null;

  const start = parseCellAddress(parts[0]);
  const end = parseCellAddress(parts[1]);

  if (!start || !end) return null;

  return {
    start: {
      row: Math.min(start.row, end.row),
      col: Math.min(start.col, end.col),
    },
    end: {
      row: Math.max(start.row, end.row),
      col: Math.max(start.col, end.col),
    },
  };
}

export function isValidCellAddress(reference: string): boolean {
  return parseCellAddress(reference) !== null;
}

export function getCellsInRange(range: CellRange): CellAddress[] {
  const cells: CellAddress[] = [];

  for (let row = range.start.row; row <= range.end.row; row++) {
    for (let col = range.start.col; col <= range.end.col; col++) {
      cells.push({ row, col });
    }
  }

  return cells;
}

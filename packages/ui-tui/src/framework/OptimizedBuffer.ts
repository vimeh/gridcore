export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Cell {
  char: string;
  fg?: RGBA;
  bg?: RGBA;
  bold?: boolean;
  underline?: boolean;
}

export class OptimizedBuffer {
  private buffer: Cell[][];
  private dirtyRegions: Set<string> = new Set();

  constructor(
    private width: number,
    private height: number,
  ) {
    this.buffer = Array(height)
      .fill(null)
      .map(() =>
        Array(width)
          .fill(null)
          .map(() => ({ char: " " })),
      );
  }

  setChar(x: number, y: number, char: string, fg?: RGBA, bg?: RGBA): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    const cell = this.buffer[y][x];
    cell.char = char;
    if (fg) cell.fg = fg;
    if (bg) cell.bg = bg;

    this.markDirty(x, y);
  }

  setText(x: number, y: number, text: string, fg?: RGBA, bg?: RGBA): void {
    for (let i = 0; i < text.length; i++) {
      this.setChar(x + i, y, text[i], fg, bg);
    }
  }

  drawBox(
    x: number,
    y: number,
    width: number,
    height: number,
    fg?: RGBA,
    bg?: RGBA,
  ): void {
    // Top and bottom borders
    for (let i = x; i < x + width; i++) {
      this.setChar(i, y, "─", fg, bg);
      this.setChar(i, y + height - 1, "─", fg, bg);
    }

    // Left and right borders
    for (let i = y; i < y + height; i++) {
      this.setChar(x, i, "│", fg, bg);
      this.setChar(x + width - 1, i, "│", fg, bg);
    }

    // Corners
    this.setChar(x, y, "┌", fg, bg);
    this.setChar(x + width - 1, y, "┐", fg, bg);
    this.setChar(x, y + height - 1, "└", fg, bg);
    this.setChar(x + width - 1, y + height - 1, "┘", fg, bg);
  }

  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    char: string,
    fg?: RGBA,
    bg?: RGBA,
  ): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.setChar(x + dx, y + dy, char, fg, bg);
      }
    }
  }

  clear(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x] = { char: " " };
      }
    }
    this.dirtyRegions.clear();
  }

  private markDirty(x: number, y: number): void {
    this.dirtyRegions.add(`${x},${y}`);
  }

  getDirtyRegions(): Set<string> {
    return this.dirtyRegions;
  }

  clearDirtyRegions(): void {
    this.dirtyRegions.clear();
  }

  getCell(x: number, y: number): Cell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.buffer[y][x];
  }

  resize(width: number, height: number): void {
    const newBuffer = Array(height)
      .fill(null)
      .map(() =>
        Array(width)
          .fill(null)
          .map(() => ({ char: " " })),
      );

    // Copy existing content
    for (let y = 0; y < Math.min(height, this.height); y++) {
      for (let x = 0; x < Math.min(width, this.width); x++) {
        newBuffer[y][x] = this.buffer[y][x];
      }
    }

    this.buffer = newBuffer;
    this.width = width;
    this.height = height;
  }
}

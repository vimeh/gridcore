import type { Viewport } from "../components/Viewport";
import type { GridTheme } from "./GridTheme";

export class HeaderRenderer {
  private rowHeaderCtx: CanvasRenderingContext2D;
  private colHeaderCtx: CanvasRenderingContext2D;
  private cornerCtx: CanvasRenderingContext2D;
  private devicePixelRatio: number;

  constructor(
    private rowHeaderCanvas: HTMLCanvasElement,
    private colHeaderCanvas: HTMLCanvasElement,
    private cornerCanvas: HTMLCanvasElement,
    private theme: GridTheme,
    private viewport: Viewport,
  ) {
    // Get contexts
    const rowCtx = rowHeaderCanvas.getContext("2d");
    const colCtx = colHeaderCanvas.getContext("2d");
    const cornerCtx = cornerCanvas.getContext("2d");

    if (!rowCtx || !colCtx || !cornerCtx) {
      throw new Error("Failed to get 2D context from header canvases");
    }

    this.rowHeaderCtx = rowCtx;
    this.colHeaderCtx = colCtx;
    this.cornerCtx = cornerCtx;
    this.devicePixelRatio = window.devicePixelRatio || 1;

    this.setupCanvases();
  }

  private setupCanvases(): void {
    // Setup each canvas for high DPI
    [
      {
        canvas: this.rowHeaderCanvas,
        ctx: this.rowHeaderCtx,
        name: "rowHeader",
      },
      {
        canvas: this.colHeaderCanvas,
        ctx: this.colHeaderCtx,
        name: "colHeader",
      },
      { canvas: this.cornerCanvas, ctx: this.cornerCtx, name: "corner" },
    ].forEach(({ canvas, ctx, name }) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn(
          `HeaderRenderer: ${name} canvas has zero dimensions`,
          rect,
        );
      }
      canvas.width = rect.width * this.devicePixelRatio;
      canvas.height = rect.height * this.devicePixelRatio;
      ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    });
  }

  resize(): void {
    this.setupCanvases();
  }

  /**
   * Converts a column number to Excel-style column name
   */
  private getColumnName(col: number): string {
    let num = col + 1;
    let result = "";

    while (num > 0) {
      const remainder = (num - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      num = Math.floor((num - 1) / 26);
    }

    return result;
  }

  renderCorner(): void {
    const ctx = this.cornerCtx;
    const canvas = this.cornerCanvas;
    const width = canvas.width / this.devicePixelRatio;
    const height = canvas.height / this.devicePixelRatio;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.theme.headerBackgroundColor;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = this.theme.gridLineColor;
    ctx.lineWidth = this.theme.gridLineWidth;
    ctx.beginPath();
    ctx.moveTo(width - 0.5, 0);
    ctx.lineTo(width - 0.5, height);
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  }

  renderColumnHeaders(scrollX: number): void {
    const ctx = this.colHeaderCtx;
    const width = this.colHeaderCanvas.width / this.devicePixelRatio;
    const height = this.theme.columnHeaderHeight;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = this.theme.headerBackgroundColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = this.theme.headerTextColor;
    ctx.font = `${this.theme.headerFontSize}px ${this.theme.headerFontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let x = 0;
    for (let col = 0; col < this.viewport.getTotalCols(); col++) {
      const colWidth = this.viewport.getColumnWidth(col);
      const colX = x - scrollX;

      if (colX + colWidth > 0 && colX < width) {
        const letter = this.getColumnName(col);
        ctx.fillText(letter, colX + colWidth / 2, height / 2);

        ctx.strokeStyle = this.theme.gridLineColor;
        ctx.lineWidth = this.theme.gridLineWidth;
        ctx.beginPath();
        ctx.moveTo(colX + colWidth - 0.5, 0);
        ctx.lineTo(colX + colWidth - 0.5, height);
        ctx.stroke();
      }

      x += colWidth;
      if (colX > width) break;
    }

    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  }

  renderRowHeaders(scrollY: number): void {
    const ctx = this.rowHeaderCtx;
    const width = this.theme.rowHeaderWidth;
    const height = this.rowHeaderCanvas.height / this.devicePixelRatio;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = this.theme.headerBackgroundColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = this.theme.headerTextColor;
    ctx.font = `${this.theme.headerFontSize}px ${this.theme.headerFontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let y = 0;
    for (let row = 0; row < this.viewport.getTotalRows(); row++) {
      const rowHeight = this.viewport.getRowHeight(row);
      const rowY = y - scrollY;

      if (rowY + rowHeight > 0 && rowY < height) {
        ctx.fillText(String(row + 1), width / 2, rowY + rowHeight / 2);

        ctx.strokeStyle = this.theme.gridLineColor;
        ctx.lineWidth = this.theme.gridLineWidth;
        ctx.beginPath();
        ctx.moveTo(0, rowY + rowHeight - 0.5);
        ctx.lineTo(width, rowY + rowHeight - 0.5);
        ctx.stroke();
      }

      y += rowHeight;
      if (rowY > height) break;
    }

    ctx.beginPath();
    ctx.moveTo(width - 0.5, 0);
    ctx.lineTo(width - 0.5, height);
    ctx.stroke();
  }
}

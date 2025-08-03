import type { OptimizedBuffer } from "./OptimizedBuffer";

export abstract class Renderable {
  protected children: Renderable[] = [];
  protected parent: Renderable | null = null;
  protected visible = true;
  protected x = 0;
  protected y = 0;
  protected width = 0;
  protected height = 0;
  protected zIndex = 0;

  constructor(protected name: string) {}

  protected abstract renderSelf(buffer: OptimizedBuffer): void;

  render(buffer: OptimizedBuffer): void {
    if (!this.visible) return;

    this.renderSelf(buffer);

    // Render children sorted by z-index
    const sortedChildren = [...this.children].sort(
      (a, b) => a.zIndex - b.zIndex,
    );
    for (const child of sortedChildren) {
      child.render(buffer);
    }
  }

  addChild(child: Renderable): void {
    this.children.push(child);
    child.parent = this;
  }

  removeChild(child: Renderable): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  setZIndex(zIndex: number): void {
    this.zIndex = zIndex;
  }

  getAbsolutePosition(): { x: number; y: number } {
    let x = this.x;
    let y = this.y;
    let current = this.parent;

    while (current) {
      x += current.x;
      y += current.y;
      current = current.parent;
    }

    return { x, y };
  }
}

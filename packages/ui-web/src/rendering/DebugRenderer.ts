export interface RenderStats {
  fps: number;
  frameTime: number;
  cellsRendered: number;
  lastRenderTime: number;
}

export class DebugRenderer {
  private enabled: boolean = false;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private currentFps: number = 0;
  private renderStats: RenderStats = {
    fps: 0,
    frameTime: 0,
    cellsRendered: 0,
    lastRenderTime: 0
  };
  
  // Track dirty regions
  private dirtyRegions: Array<{x: number, y: number, width: number, height: number, timestamp: number}> = [];
  private readonly DIRTY_REGION_LIFETIME = 500; // ms to show dirty regions

  constructor(private canvas: HTMLCanvasElement) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.dirtyRegions = [];
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  beginFrame(): void {
    if (!this.enabled) return;
    
    this.renderStats.lastRenderTime = performance.now();
  }

  endFrame(cellsRendered: number): void {
    if (!this.enabled) return;
    
    const now = performance.now();
    this.renderStats.frameTime = now - this.renderStats.lastRenderTime;
    this.renderStats.cellsRendered = cellsRendered;
    
    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.renderStats.fps = this.currentFps;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  addDirtyRegion(x: number, y: number, width: number, height: number): void {
    if (!this.enabled) return;
    
    this.dirtyRegions.push({
      x, y, width, height,
      timestamp: performance.now()
    });
  }

  render(ctx: CanvasRenderingContext2D, visibleBounds: {x: number, y: number, width: number, height: number}): void {
    if (!this.enabled) return;

    ctx.save();

    // Clean up old dirty regions
    const now = performance.now();
    this.dirtyRegions = this.dirtyRegions.filter(
      region => now - region.timestamp < this.DIRTY_REGION_LIFETIME
    );

    // Draw dirty regions with fading effect
    for (const region of this.dirtyRegions) {
      const age = now - region.timestamp;
      const opacity = Math.max(0, 1 - (age / this.DIRTY_REGION_LIFETIME));
      
      ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.3})`;
      ctx.fillRect(region.x, region.y, region.width, region.height);
      
      ctx.strokeStyle = `rgba(255, 0, 0, ${opacity * 0.8})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
    }

    // Draw visible bounds outline
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      visibleBounds.x,
      visibleBounds.y,
      visibleBounds.width,
      visibleBounds.height
    );
    ctx.setLineDash([]);

    // Draw FPS counter and stats
    const statsX = 10;
    const statsY = 30;
    const lineHeight = 18;
    
    // Background for stats
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(statsX - 5, statsY - 20, 200, 100);
    
    // Text
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(`FPS: ${this.renderStats.fps}`, statsX, statsY);
    ctx.fillText(`Frame Time: ${this.renderStats.frameTime.toFixed(2)}ms`, statsX, statsY + lineHeight);
    ctx.fillText(`Cells: ${this.renderStats.cellsRendered}`, statsX, statsY + lineHeight * 2);
    ctx.fillText(`Dirty Regions: ${this.dirtyRegions.length}`, statsX, statsY + lineHeight * 3);

    // Draw grid lines indicator in corner
    const indicatorSize = 50;
    const indicatorX = this.canvas.width - indicatorSize - 10;
    const indicatorY = 10;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(indicatorX - 5, indicatorY - 5, indicatorSize + 10, indicatorSize + 10);
    
    // Mini grid pattern
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    const gridSize = 10;
    for (let i = 0; i <= indicatorSize; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(indicatorX + i, indicatorY);
      ctx.lineTo(indicatorX + i, indicatorY + indicatorSize);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(indicatorX, indicatorY + i);
      ctx.lineTo(indicatorX + indicatorSize, indicatorY + i);
      ctx.stroke();
    }

    ctx.restore();
  }

  getRenderStats(): RenderStats {
    return { ...this.renderStats };
  }
}
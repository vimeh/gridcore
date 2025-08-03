// Test setup utility for happy-dom
import { Window } from "happy-dom";

export function setupTestEnvironment() {
  const window = new Window();
  const document = window.document;

  // Set up global test environment with proper types
  const globalAny = global as unknown as Record<string, unknown>;

  globalAny.window = window;
  globalAny.document = document;
  globalAny.HTMLCanvasElement =
    window.HTMLCanvasElement || class HTMLCanvasElement {};
  globalAny.devicePixelRatio = 1;
  globalAny.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(cb, 0)) as typeof requestAnimationFrame;
  globalAny.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as typeof cancelAnimationFrame;

  return { window, document };
}

export function mockCanvasContext() {
  const mockContext = {
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    closePath: () => {},
    measureText: () => ({ width: 50 }),
    arc: () => {},
    fill: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    setLineDash: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    clip: () => {},
  };

  return mockContext;
}

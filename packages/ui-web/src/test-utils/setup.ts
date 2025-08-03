// Test setup utility for happy-dom
import { Window } from "happy-dom";

export function setupTestEnvironment() {
  const window = new Window();
  const document = window.document;

  // Use 'any' type to bypass strict type checking in tests
  (global as any).window = window;
  (global as any).document = document;
  (global as any).HTMLCanvasElement =
    window.HTMLCanvasElement || class HTMLCanvasElement {};
  global.devicePixelRatio = 1;
  global.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(cb, 0)) as typeof requestAnimationFrame;
  global.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as typeof cancelAnimationFrame;

  return { window: window as any, document: document as any };
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

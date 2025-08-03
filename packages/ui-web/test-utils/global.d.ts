import type { Window as HappyDOMWindow } from "happy-dom";

declare global {
  var window: HappyDOMWindow & typeof globalThis;
  var document: Document;
  var devicePixelRatio: number;
  var requestAnimationFrame: typeof requestAnimationFrame;
  var cancelAnimationFrame: typeof cancelAnimationFrame;
}

export {};
declare global {
  var window: Window;
  var document: Document;
  var devicePixelRatio: number;
  var requestAnimationFrame: typeof requestAnimationFrame;
  var cancelAnimationFrame: typeof cancelAnimationFrame;
}

export {};
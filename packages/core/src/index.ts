export * from "./DependencyGraph";
export * from "./formula/ast";
export * from "./formula/evaluator";
export * from "./formula/parser";
export * from "./formula/tokenizer";
export * from "./Grid";
export * from "./SpreadsheetEngine";
export * from "./types";
export * from "./types/SpreadsheetState";
export * from "./utils/cellAddress";
export * from "./pivot";

export class GridCore {
  private name: string = "GridCore Engine";

  constructor() {
    console.log(`${this.name} initialized`);
  }

  getVersion(): string {
    return "0.0.1";
  }
}

export default GridCore;

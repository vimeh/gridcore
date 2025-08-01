export * from "./types";
export * from "./Grid";
export * from "./utils/cellAddress";
export * from "./DependencyGraph";
export * from "./formula/ast";
export * from "./formula/tokenizer";
export * from "./formula/parser";
export * from "./formula/evaluator";
export * from "./SpreadsheetEngine";

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

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
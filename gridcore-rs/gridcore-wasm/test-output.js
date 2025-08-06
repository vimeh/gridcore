import init, { WasmFormulaParser } from './pkg/gridcore_wasm.js';

await init();
const parser = new WasmFormulaParser();

console.log("Testing '42':");
console.log(JSON.stringify(parser.parse('42'), null, 2));

console.log("\nTesting 'A1':");
console.log(JSON.stringify(parser.parse('A1'), null, 2));

console.log("\nTesting '-42':");
console.log(JSON.stringify(parser.parse('-42'), null, 2));
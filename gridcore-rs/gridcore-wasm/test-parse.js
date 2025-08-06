import init, { parseFormula, WasmFormulaParser } from './pkg/gridcore_wasm.js';
await init();

const parser = new WasmFormulaParser();

// Test individual range
try {
  console.log('Testing A1:A10:');
  const result = parser.parse('A1:A10');
  console.log(JSON.stringify(result, null, 2));
} catch(e) {
  console.error('Error:', e.toString());
}

// Test function with range
try {
  console.log('\nTesting SUM(A1:A10):');
  const result = parser.parse('SUM(A1:A10)');
  console.log(JSON.stringify(result, null, 2));
} catch(e) {
  console.error('Error:', e.toString());
}
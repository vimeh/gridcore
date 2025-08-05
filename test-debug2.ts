// Test if the key matching is correct
const row = 0; // First test case
const col = 0;
const cellKey1 = "1,1";
console.log("First cell key should be:", cellKey1);

// Test with i=0
const testRow = Math.floor(0 / 1000) + 1;
const testCol = (0 % 1000) + 1;
console.log("For i=0: row =", testRow, "col =", testCol);
console.log("Key would be:", testRow + "," + testCol);

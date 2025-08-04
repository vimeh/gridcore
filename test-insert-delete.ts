// Basic test for insert/delete modes
// This is a simple functional test to verify our new state modes work

import { CellAddress } from "./packages/core/src/domain/models/CellAddress";
import { ReferenceAdjuster, ReferenceParser } from "./packages/core/src/references";
import { 
  createInsertState, 
  createDeleteState, 
  isInsertMode, 
  isDeleteMode,
  type UIState 
} from "./packages/ui-core/src/state/UIState";

function testInsertDeleteStates() {
  console.log("Testing Insert/Delete State Creation...");

  // Create test cursor and viewport
  const cursorResult = CellAddress.create(1, 2);
  if (!cursorResult.ok) {
    throw new Error("Failed to create cursor");
  }
  const cursor = cursorResult.value;
  
  const viewport = {
    startRow: 0,
    startCol: 0,
    rows: 20,
    cols: 10,
  };

  // Test insert state creation
  const insertState = createInsertState(cursor, viewport, "row", "before");
  console.log("✓ Insert state created:", {
    mode: insertState.spreadsheetMode,
    insertType: insertState.insertType,
    insertPosition: insertState.insertPosition,
    count: insertState.count,
    targetIndex: insertState.targetIndex,
  });

  // Test insert state type guard
  if (!isInsertMode(insertState)) {
    throw new Error("isInsertMode should return true for insert state");
  }
  console.log("✓ isInsertMode type guard works");

  if (isDeleteMode(insertState)) {
    throw new Error("isDeleteMode should return false for insert state");
  }
  console.log("✓ isDeleteMode correctly returns false for insert state");

  // Test delete state creation
  const deleteState = createDeleteState(cursor, viewport, "column", [1, 2, 3]);
  console.log("✓ Delete state created:", {
    mode: deleteState.spreadsheetMode,
    deleteType: deleteState.deleteType,
    selection: deleteState.selection,
    confirmationPending: deleteState.confirmationPending,
  });

  // Test delete state type guard
  if (!isDeleteMode(deleteState)) {
    throw new Error("isDeleteMode should return true for delete state");
  }
  console.log("✓ isDeleteMode type guard works");

  if (isInsertMode(deleteState)) {
    throw new Error("isInsertMode should return false for delete state");
  }
  console.log("✓ isInsertMode correctly returns false for delete state");

  console.log("All tests passed! ✅");

  // Test reference system availability
  console.log("\nTesting Reference System...");
  const parser = new ReferenceParser();
  const adjuster = new ReferenceAdjuster();
  
  console.log("✓ ReferenceParser instantiated");
  console.log("✓ ReferenceAdjuster instantiated");
  console.log("✅ Reference system is available!");
}

// Run the test
try {
  testInsertDeleteStates();
  console.log("\n🎉 Insert/Delete state functionality is working correctly!");
} catch (error) {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
}
#!/bin/bash

# Fix cell creation in SparseGrid files

echo "Fixing cell creation in SparseGrid files..."

# Import Cell class at the top
sed -i '' 's/import type { Cell }/import { Cell }/g' packages/core/src/structure/SparseGrid.ts
sed -i '' 's/import type { Cell }/import { Cell }/g' packages/core/src/structure/StructuralEngine.ts
sed -i '' 's/import type { Cell }/import { Cell }/g' packages/core/src/structure/StructuralUndoManager.ts

# Fix the cell creation pattern
for file in packages/core/src/structure/SparseGrid.ts packages/core/src/structure/StructuralEngine.ts packages/core/src/structure/StructuralUndoManager.ts; do
  echo "Processing $file..."
  
  # Replace inline cell object creation with proper Cell.create
  sed -i '' 's/const newAddress = { row: \(.*\), col: \(.*\) };/const newAddressResult = CellAddress.create(\1, \2); if (!newAddressResult.ok) continue; const newAddress = newAddressResult.value;/g' "$file"
  
  # Replace the cell copy pattern
  sed -i '' 's/updates\.set(newKey, { \.\.\.cell });/const cellCopy = Cell.create(cell.rawValue, newAddress); if (cellCopy.ok) { updates.set(newKey, cellCopy.value); }/g' "$file"
done

echo "Done!"
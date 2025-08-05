#!/bin/bash

# Script to update test files to use new API

echo "Updating test files to use new API..."

# Fix grid.getCell -> grid.get
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/grid\.getCell(/grid.get(/g' {} \;
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/\.getCell(/\.get(/g' {} \;

# Fix grid.setCell -> grid.set (with Cell.create)
# This is more complex as we need to handle Cell creation
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/grid\.setCell(/grid.set(/g' {} \;
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/\.setCell(/\.set(/g' {} \;

# Fix cellRepository.getCell -> cellRepository.get
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/cellRepository\.getCell(/cellRepository.get(/g' {} \;

# Fix cellRepository.setCell -> cellRepository.set
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/cellRepository\.setCell(/cellRepository.set(/g' {} \;

# Fix deleteCell -> delete
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/\.deleteCell(/\.delete(/g' {} \;

# Fix getCellRange -> getRange
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/\.getCellRange(/\.getRange(/g' {} \;

# Fix clearCell -> clear
find ./packages -name "*.test.ts" -type f -exec sed -i '' 's/\.clearCell(/\.clear(/g' {} \;

echo "Basic replacements done. Manual fixes may still be needed for Cell.create() usage."
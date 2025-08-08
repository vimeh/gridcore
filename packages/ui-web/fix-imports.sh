#!/bin/bash

# Fix imports in all TypeScript files

echo "Fixing imports in ui-web package..."

# Find all TypeScript files (excluding wasm directory and node_modules)
find src -type f -name "*.ts" -not -path "*/wasm/*" -not -path "*/node_modules/*" | while read file; do
  echo "Processing $file..."
  
  # Replace @gridcore/core imports
  sed -i '' 's|from "@gridcore/core"|from "../wasm"|g' "$file"
  sed -i '' 's|from '"'"'@gridcore/core'"'"'|from '"'"'../wasm'"'"'|g' "$file"
  
  # Replace @gridcore/ui-core imports
  sed -i '' 's|from "@gridcore/ui-core"|from "../wasm"|g' "$file"
  sed -i '' 's|from '"'"'@gridcore/ui-core'"'"'|from '"'"'../wasm'"'"'|g' "$file"
  
  # Fix relative paths based on file location
  if [[ $file == *"src/components/"* ]]; then
    sed -i '' 's|from "../wasm"|from "../wasm"|g' "$file"
  elif [[ $file == *"src/interaction/"* ]]; then
    sed -i '' 's|from "../wasm"|from "../wasm"|g' "$file"
  elif [[ $file == *"src/rendering/"* ]]; then
    sed -i '' 's|from "../wasm"|from "../wasm"|g' "$file"
  elif [[ $file == *"src/state/"* ]]; then
    sed -i '' 's|from "../wasm"|from "../wasm"|g' "$file"
  elif [[ $file == *"src/adapters/"* ]]; then
    sed -i '' 's|from "../wasm"|from "../wasm"|g' "$file"
  elif [[ $file == *"src/integration/"* ]]; then
    sed -i '' 's|from "../wasm"|from "../wasm"|g' "$file"
  elif [[ $file == *"src/structural/"* ]]; then
    sed -i '' 's|from "../wasm"|from "../wasm"|g' "$file"
  fi
done

echo "Import fixes complete!"
#!/bin/bash
# Get all directories in current directory
for dir in */; do
  # Remove trailing slash
  dir_name="${dir%/}"

  # Skip target and dist directories
  if [[ "$dir_name" == "target" ]] || [[ "$dir_name" == "dist" ]]; then
    continue
  fi

  echo "📦 $dir_name"
  # Run tokei for this directory
  tokei "$dir_name" --type Rust

  echo ""
done


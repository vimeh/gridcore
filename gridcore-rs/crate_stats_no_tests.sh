#!/bin/bash

# Get all directories in current directory
for dir in */; do
  # Remove trailing slash
  dir_name="${dir%/}"

  # Skip target, dist, and benches directories
  skip_dirs=("target" "dist" "benches")
  for skip in "${skip_dirs[@]}"; do
    if [[ "$dir_name" == "$skip" ]]; then
      continue 2
    fi
  done

  echo "📦 $dir_name"

  # Run tokei for this directory, excluding test files and directories
  tokei "$dir_name" --type Rust \
    --exclude "**/tests/**" \
    --exclude "**/test/**" \
    --exclude "**/*_test.rs" \
    --exclude "**/*_tests.rs" \
    --exclude "**/test_*.rs" \
    --exclude "**/tests.rs" \
    --exclude "**/test_utils/**" \
    --exclude "**/*_bench.rs" \
    --exclude "**/benches/**" \
    --compact

  echo ""
done

echo "TOTAL (All Directories, Excluding Tests)"
tokei . --type Rust \
  --exclude "**/tests/**" \
  --exclude "**/test/**" \
  --exclude "**/*_test.rs" \
  --exclude "**/*_tests.rs" \
  --exclude "**/test_*.rs" \
  --exclude "**/tests.rs" \
  --exclude "**/test_utils/**" \
  --exclude "**/*_bench.rs" \
  --exclude "**/benches/**" \
  --exclude "**/target/**" \
  --exclude "**/dist/**"

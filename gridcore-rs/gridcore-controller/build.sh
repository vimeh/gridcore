#!/bin/bash

# Build script for gridcore-controller WASM

set -e

echo "Building gridcore-controller WASM..."

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Clean previous builds
rm -rf pkg pkg-node

# Build for web target (ES6 modules)
echo "Building for web target..."
wasm-pack build --no-opt --target web --out-dir pkg --features wasm

# Build for Node.js target
echo "Building for Node.js target..."
wasm-pack build --no-opt --target nodejs --out-dir pkg-node --features wasm

# Check bundle size
echo ""
echo "Bundle sizes:"
echo "Web: $(wc -c < pkg/*_bg.wasm | awk '{print $1/1024 "KB"}')"
echo "Node: $(wc -c < pkg-node/*_bg.wasm | awk '{print $1/1024 "KB"}')"

echo ""
echo "Build complete!"
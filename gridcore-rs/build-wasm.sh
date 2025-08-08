#!/bin/bash

# Build script for complete WASM module (core + controller)

set -e

echo "🚀 Building complete GridCore WASM module..."

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf gridcore-wasm/pkg gridcore-wasm/pkg-node
rm -rf gridcore-controller/pkg gridcore-controller/pkg-node

# Build gridcore-wasm (includes core functionality)
echo "🔨 Building gridcore-wasm..."
cd gridcore-wasm
wasm-pack build --target web --out-dir pkg --no-opt
wasm-pack build --target nodejs --out-dir pkg-node --no-opt

# Check bundle size
WASM_SIZE=$(wc -c < pkg/*_bg.wasm | awk '{print $1/1024}')
echo "📊 Core WASM size: ${WASM_SIZE}KB"

cd ..

# Build gridcore-controller (UI controller)
echo "🔨 Building gridcore-controller..."
cd gridcore-controller
# Build with cargo first
cargo build --lib --release --target wasm32-unknown-unknown --features wasm
# Then use wasm-bindgen directly
wasm-bindgen target/wasm32-unknown-unknown/release/gridcore_controller.wasm --out-dir pkg --target web
wasm-bindgen target/wasm32-unknown-unknown/release/gridcore_controller.wasm --out-dir pkg-node --target nodejs

# Check bundle size
CONTROLLER_SIZE=$(wc -c < pkg/*_bg.wasm | awk '{print $1/1024}')
echo "📊 Controller WASM size: ${CONTROLLER_SIZE}KB"

cd ..

# Copy to UI packages
echo "📋 Copying WASM modules to UI packages..."

# Create dist directories if they don't exist
mkdir -p ../packages/ui-core/dist/wasm
mkdir -p ../packages/ui-web/public/wasm

# Copy gridcore-wasm
cp -r gridcore-wasm/pkg/* ../packages/ui-core/dist/wasm/ 2>/dev/null || true
cp gridcore-wasm/pkg/*_bg.wasm ../packages/ui-web/public/wasm/ 2>/dev/null || true

# Copy gridcore-controller
cp -r gridcore-controller/pkg/* ../packages/ui-core/dist/wasm/ 2>/dev/null || true
cp gridcore-controller/pkg/*_bg.wasm ../packages/ui-web/public/wasm/ 2>/dev/null || true

echo ""
echo "✅ Build complete!"
echo "📊 Total WASM size: $(echo "$WASM_SIZE + $CONTROLLER_SIZE" | bc)KB"
echo ""
echo "Next steps:"
echo "  1. cd ../packages/ui-core && bun install"
echo "  2. cd ../packages/ui-web && bun run dev"
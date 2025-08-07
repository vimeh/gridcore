#!/bin/bash
set -e

echo "🦀 Building Rust WASM module..."
cd gridcore-rs/gridcore-wasm
wasm-pack build --target web --out-dir pkg --no-opt

echo "📦 Copying WASM files to ui-web..."
mkdir -p ../../packages/ui-web/src/wasm
cp -r pkg/* ../../packages/ui-web/src/wasm/

echo "🔨 Building ui-core package..."
cd ../../packages/ui-core
bun install
bun run build

echo "🚀 Starting development server..."
cd ../ui-web
bun install
bun run dev
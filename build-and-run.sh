#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the root directory
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Function to handle errors
handle_error() {
    echo -e "${RED}❌ Error: $1${NC}"
    exit 1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."
command -v rustc >/dev/null 2>&1 || handle_error "Rust is not installed. Please install from https://rustup.rs/"
command -v wasm-pack >/dev/null 2>&1 || handle_error "wasm-pack is not installed. Run: cargo install wasm-pack"
command -v bun >/dev/null 2>&1 || handle_error "Bun is not installed. Please install from https://bun.sh/"

# Clean up potential lock file issues
echo "🧹 Cleaning lock files..."
cd "$ROOT_DIR"
rm -f bun.lock packages/*/bun.lock

echo "🦀 Building Rust WASM module..."
cd "$ROOT_DIR/gridcore-rs/gridcore-wasm"
wasm-pack build --target web --out-dir pkg --no-opt || handle_error "WASM build failed"

echo "📦 Copying WASM files to ui-web..."
mkdir -p "$ROOT_DIR/packages/ui-web/src/wasm"
cp -r pkg/* "$ROOT_DIR/packages/ui-web/src/wasm/" || handle_error "Failed to copy WASM files"

echo "🔨 Building ui-core package..."
cd "$ROOT_DIR/packages/ui-core"
bun install --force || handle_error "ui-core install failed"
bun run build || handle_error "ui-core build failed"

echo "🚀 Starting development server..."
cd "$ROOT_DIR/packages/ui-web"
bun install --force || handle_error "ui-web install failed"

echo -e "${GREEN}✅ Build complete! Starting dev server...${NC}"
echo -e "${YELLOW}📝 To test Rust core, visit: http://localhost:3000/?rust=true${NC}"
bun run dev
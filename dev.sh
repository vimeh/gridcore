#!/bin/bash

# Development helper script for GridCore Rust/WASM
# Usage: ./dev.sh [command]
#   Commands:
#     build-wasm    - Build only the WASM module
#     build-ui      - Build only the UI packages
#     build-all     - Build everything
#     clean         - Clean all build artifacts
#     test          - Run tests
#     dev           - Start dev server (assumes already built)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

build_wasm() {
    echo -e "${BLUE}🦀 Building Rust WASM module...${NC}"
    cd "$ROOT_DIR/gridcore-rs/gridcore-wasm"
    wasm-pack build --target web --out-dir pkg --no-opt
    
    echo -e "${BLUE}📦 Copying WASM files...${NC}"
    mkdir -p "$ROOT_DIR/packages/ui-web/src/wasm"
    cp -r pkg/* "$ROOT_DIR/packages/ui-web/src/wasm/"
    
    echo -e "${GREEN}✅ WASM build complete${NC}"
}

build_ui() {
    echo -e "${BLUE}🔨 Building UI packages...${NC}"
    
    cd "$ROOT_DIR/packages/ui-core"
    bun install --force
    bun run build
    
    cd "$ROOT_DIR/packages/ui-web"
    bun install --force
    
    echo -e "${GREEN}✅ UI build complete${NC}"
}

build_all() {
    build_wasm
    build_ui
}

clean_all() {
    echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
    
    # Clean Rust artifacts
    cd "$ROOT_DIR/gridcore-rs"
    cargo clean
    
    # Clean WASM package
    rm -rf "$ROOT_DIR/gridcore-rs/gridcore-wasm/pkg"
    rm -rf "$ROOT_DIR/packages/ui-web/src/wasm"
    
    # Clean node modules and lock files
    cd "$ROOT_DIR"
    rm -f bun.lock
    rm -rf node_modules
    rm -rf packages/*/node_modules
    rm -f packages/*/bun.lock
    rm -rf packages/*/dist
    
    echo -e "${GREEN}✅ Clean complete${NC}"
}

run_tests() {
    echo -e "${BLUE}🧪 Running tests...${NC}"
    
    # Rust tests
    cd "$ROOT_DIR/gridcore-rs"
    cargo test
    
    # TypeScript tests
    cd "$ROOT_DIR"
    bun test
    
    echo -e "${GREEN}✅ Tests complete${NC}"
}

start_dev() {
    echo -e "${BLUE}🚀 Starting dev server...${NC}"
    cd "$ROOT_DIR/packages/ui-web"
    
    echo -e "${YELLOW}📝 Rust core: http://localhost:3000/?rust=true${NC}"
    echo -e "${YELLOW}📝 Test page: http://localhost:3000/test-rust.html${NC}"
    echo -e "${YELLOW}📝 Normal UI: http://localhost:3000/${NC}"
    
    bun run dev
}

# Main command handler
case "${1:-build-all}" in
    build-wasm)
        build_wasm
        ;;
    build-ui)
        build_ui
        ;;
    build-all|build)
        build_all
        ;;
    clean)
        clean_all
        ;;
    test)
        run_tests
        ;;
    dev|start)
        start_dev
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Usage: $0 [build-wasm|build-ui|build-all|clean|test|dev]"
        exit 1
        ;;
esac
#!/bin/bash

# GridCore Static Build Script
# This script builds all components and creates a single deployable static directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== GridCore Static Build ===${NC}"

# Parse arguments
BUILD_FEATURES=""
if [[ "$1" == "--with-demo" ]]; then
    BUILD_FEATURES="--features demo"
    echo -e "${BLUE}Building with demo features enabled${NC}"
fi

# Clean previous build
echo -e "${YELLOW}Cleaning previous build...${NC}"
rm -rf dist
mkdir -p dist

# Build Rust/WASM UI components
echo -e "${YELLOW}Building GridCore UI (WASM)...${NC}"
cd gridcore-rs/gridcore-ui

# Build with optional features
if [ -n "$BUILD_FEATURES" ]; then
    trunk build --release $BUILD_FEATURES
else
    trunk build --release
fi

cd ../..

# Copy built files to root dist
echo -e "${YELLOW}Copying build artifacts...${NC}"
cp -r gridcore-rs/gridcore-ui/dist/* dist/

# List generated files
echo -e "${GREEN}=== Build Complete ===${NC}"
if [ -n "$BUILD_FEATURES" ]; then
    echo -e "${BLUE}Built with: $BUILD_FEATURES${NC}"
fi
echo "Static files generated in ./dist/"
echo ""
echo "Contents:"
ls -lah dist/

echo ""
echo -e "${GREEN}To serve the application:${NC}"
echo "  bun serve.js"
echo "  # or"
echo "  cd dist && python3 -m http.server 8080"
echo "  # or use any static file server"
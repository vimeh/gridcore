#!/bin/bash

# GridCore Static Build Script
# This script builds all components and creates a single deployable static directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== GridCore Static Build ===${NC}"

# Clean previous build
echo -e "${YELLOW}Cleaning previous build...${NC}"
rm -rf dist
mkdir -p dist

# Build Rust/WASM UI components
echo -e "${YELLOW}Building GridCore UI (WASM)...${NC}"
cd gridcore-rs/gridcore-ui
trunk build --release
cd ../..

# Copy built files to root dist
echo -e "${YELLOW}Copying build artifacts...${NC}"
cp -r gridcore-rs/gridcore-ui/dist/* dist/

# List generated files
echo -e "${GREEN}=== Build Complete ===${NC}"
echo "Static files generated in ./dist/"
echo ""
echo "Contents:"
ls -lah dist/

echo ""
echo -e "${GREEN}To serve the application:${NC}"
echo "  cd dist && python3 -m http.server 8080"
echo "  # or"
echo "  cd dist && bun --bun run serve"
echo "  # or use any static file server"
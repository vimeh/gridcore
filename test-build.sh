#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing quick build..."

# Just rebuild ui-core and restart server (assuming WASM is already built)
cd packages/ui-core
bun run build

cd ../ui-web

echo -e "${GREEN}✅ Build complete!${NC}"
echo -e "${YELLOW}📝 Visit: http://localhost:3000/?rust=true${NC}"
echo -e "${YELLOW}📝 Or test page: http://localhost:3000/test-rust.html${NC}"

# Server should already be running, just show the URLs
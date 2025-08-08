#!/bin/bash

# Migration script to use gridcore-core as the main WASM package
# This replaces the need for gridcore-wasm

set -e

echo "🔄 Migrating from gridcore-wasm to gridcore-core..."

# Update build script to build gridcore-core instead
echo "📝 Creating new build script..."
cat > build-core-wasm.sh << 'EOF'
#!/bin/bash

set -e

echo "🚀 Building GridCore WASM from core package..."

# Ensure wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf gridcore-core/pkg gridcore-core/pkg-node

# Build gridcore-core with WASM features
echo "🔨 Building gridcore-core WASM..."
cd gridcore-core
wasm-pack build --target web --out-dir pkg --no-opt -- --features wasm
wasm-pack build --target nodejs --out-dir pkg-node --no-opt -- --features wasm

# Check bundle size
WASM_SIZE=$(wc -c < pkg/*_bg.wasm | awk '{print $1/1024}')
echo "📊 Core WASM size: ${WASM_SIZE}KB"

cd ..

# Build gridcore-controller (still separate)
echo "🔨 Building gridcore-controller..."
cd gridcore-controller
wasm-pack build --target web --out-dir pkg --no-opt -- --features wasm
wasm-pack build --target nodejs --out-dir pkg-node --no-opt -- --features wasm

CONTROLLER_SIZE=$(wc -c < pkg/*_bg.wasm | awk '{print $1/1024}')
echo "📊 Controller WASM size: ${CONTROLLER_SIZE}KB"

cd ..

echo "✅ Build complete!"
echo "📊 Total WASM size: $(echo "$WASM_SIZE + $CONTROLLER_SIZE" | bc)KB"
EOF

chmod +x build-core-wasm.sh

echo "✅ Migration script created!"
echo ""
echo "Next steps:"
echo "1. Run ./build-core-wasm.sh to build the WASM packages"
echo "2. Update package.json dependencies:"
echo "   - Change 'gridcore-wasm' to 'gridcore-core' in dependencies"
echo "   - Point to '../../gridcore-rs/gridcore-core/pkg'"
echo "3. Update imports in TypeScript/JavaScript code:"
echo "   - Change 'import ... from \"gridcore-wasm\"' to 'import ... from \"gridcore-core\"'"
echo "4. Test the application to ensure everything works"
echo ""
echo "Note: The gridcore-wasm package can be removed after successful migration"
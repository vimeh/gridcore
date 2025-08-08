#!/bin/bash

# Script to optimize WASM build output
# Called as a Trunk post-build hook

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if this is a release build
# Trunk sets TRUNK_PROFILE environment variable
if [ "$TRUNK_PROFILE" != "release" ]; then
    echo -e "${BLUE}Debug build detected - skipping optimization${NC}"
    exit 0
fi

echo -e "${GREEN}=== WASM Build Optimization (Release) ===${NC}"

# Find the WASM file - Trunk sets TRUNK_STAGING_DIR
if [ -n "$TRUNK_STAGING_DIR" ]; then
    WASM_FILE=$(find "$TRUNK_STAGING_DIR" -name "*_bg.wasm" -type f | head -n 1)
else
    # Fallback to dist directory
    WASM_FILE=$(find dist -name "*_bg.wasm" -type f | head -n 1)
fi

if [ -z "$WASM_FILE" ]; then
    echo -e "${RED}Error: No WASM file found${NC}"
    exit 1
fi

echo "Processing: $WASM_FILE"

# Get original size
ORIGINAL_SIZE=$(stat -f%z "$WASM_FILE" 2>/dev/null || stat -c%s "$WASM_FILE" 2>/dev/null || echo "0")
ORIGINAL_SIZE_H=$(ls -lh "$WASM_FILE" | awk '{print $5}')
echo "Original size: $ORIGINAL_SIZE_H ($ORIGINAL_SIZE bytes)"

# Step 1: Run wasm-opt if available
if command -v wasm-opt > /dev/null 2>&1; then
    echo -e "${YELLOW}Running wasm-opt...${NC}"
    
    # Create temporary file
    TEMP_FILE="${WASM_FILE}.opt"
    
    # Run optimization
    if wasm-opt -Oz \
        --enable-bulk-memory \
        --enable-nontrapping-float-to-int \
        --enable-sign-ext \
        --enable-simd \
        "$WASM_FILE" -o "$TEMP_FILE" 2>/dev/null; then
        
        # Replace original if optimization succeeded
        mv "$TEMP_FILE" "$WASM_FILE"
        
        OPTIMIZED_SIZE=$(stat -f%z "$WASM_FILE" 2>/dev/null || stat -c%s "$WASM_FILE" 2>/dev/null || echo "0")
        OPTIMIZED_SIZE_H=$(ls -lh "$WASM_FILE" | awk '{print $5}')
        
        # Calculate savings
        if [ "$ORIGINAL_SIZE" -gt 0 ]; then
            SAVINGS=$((ORIGINAL_SIZE - OPTIMIZED_SIZE))
            PERCENT=$((SAVINGS * 100 / ORIGINAL_SIZE))
            echo -e "${GREEN}✓ Optimized: $OPTIMIZED_SIZE_H (saved ${PERCENT}%)${NC}"
        else
            echo -e "${GREEN}✓ Optimized: $OPTIMIZED_SIZE_H${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ wasm-opt optimization failed, keeping original${NC}"
        rm -f "$TEMP_FILE"
    fi
else
    echo -e "${YELLOW}⚠ wasm-opt not found. Install with:${NC}"
    echo "  cargo install wasm-opt --locked"
fi

# Step 2: Create gzipped version
if command -v gzip > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating compressed version...${NC}"
    
    # Create gzipped copy
    gzip -9 -k -f "$WASM_FILE"
    
    if [ -f "${WASM_FILE}.gz" ]; then
        COMPRESSED_SIZE=$(stat -f%z "${WASM_FILE}.gz" 2>/dev/null || stat -c%s "${WASM_FILE}.gz" 2>/dev/null || echo "0")
        COMPRESSED_SIZE_H=$(ls -lh "${WASM_FILE}.gz" | awk '{print $5}')
        
        # Calculate compression ratio
        CURRENT_SIZE=$(stat -f%z "$WASM_FILE" 2>/dev/null || stat -c%s "$WASM_FILE" 2>/dev/null || echo "0")
        if [ "$CURRENT_SIZE" -gt 0 ]; then
            COMPRESSION_RATIO=$((COMPRESSED_SIZE * 100 / CURRENT_SIZE))
            echo -e "${GREEN}✓ Compressed: $COMPRESSED_SIZE_H (${COMPRESSION_RATIO}% of optimized size)${NC}"
        else
            echo -e "${GREEN}✓ Compressed: $COMPRESSED_SIZE_H${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠ gzip not found${NC}"
fi

# Step 3: Create brotli version if available
if command -v brotli > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating brotli compressed version...${NC}"
    
    # Create brotli compressed copy
    brotli -9 -k -f "$WASM_FILE"
    
    if [ -f "${WASM_FILE}.br" ]; then
        BROTLI_SIZE=$(stat -f%z "${WASM_FILE}.br" 2>/dev/null || stat -c%s "${WASM_FILE}.br" 2>/dev/null || echo "0")
        BROTLI_SIZE_H=$(ls -lh "${WASM_FILE}.br" | awk '{print $5}')
        echo -e "${GREEN}✓ Brotli: $BROTLI_SIZE_H${NC}"
    fi
fi

echo -e "${GREEN}=== Optimization Complete ===${NC}"

# Summary
echo ""
echo "Summary:"
echo "  Original:    $ORIGINAL_SIZE_H"
if [ -n "$OPTIMIZED_SIZE_H" ]; then
    echo "  Optimized:   $OPTIMIZED_SIZE_H"
fi
if [ -n "$COMPRESSED_SIZE_H" ]; then
    echo "  Gzipped:     $COMPRESSED_SIZE_H"
fi
if [ -n "$BROTLI_SIZE_H" ]; then
    echo "  Brotli:      $BROTLI_SIZE_H"
fi
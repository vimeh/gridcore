#!/bin/bash

# Clone Audit Script for GridCore
# This script analyzes all .clone() calls in the Rust codebase and categorizes them

echo "=== GridCore Clone() Audit Report ==="
echo "Generated: $(date)"
echo ""

# Get the root directory (parent of scripts)
ROOT_DIR="$(dirname "$0")/.."

# Count total clones
TOTAL_CLONES=$(rg '\.clone\(\)' --type rust -c "$ROOT_DIR" | awk -F: '{sum+=$2} END {print sum}')
echo "Total .clone() calls: $TOTAL_CLONES"
echo ""

# Files with most clones
echo "=== Top 20 Files by Clone Count ==="
rg '\.clone\(\)' --type rust -c "$ROOT_DIR" | sort -t: -k2 -rn | head -20
echo ""

# Categorize clones by type
echo "=== Clone Categories ==="
echo ""

echo "1. Arc/Rc Clones (necessary for shared ownership):"
rg 'Arc::new.*\.clone\(\)|Arc.*\.clone\(\)|Rc.*\.clone\(\)' --type rust "$ROOT_DIR" | wc -l
echo ""

echo "2. String Clones:"
rg 'String.*\.clone\(\)|\.to_string\(\)\.clone\(\)|str.*\.clone\(\)' --type rust "$ROOT_DIR" | wc -l
echo ""

echo "3. Vec/Collection Clones:"
rg 'Vec.*\.clone\(\)|HashMap.*\.clone\(\)|HashSet.*\.clone\(\)|BTreeMap.*\.clone\(\)' --type rust "$ROOT_DIR" | wc -l
echo ""

echo "4. State/Struct Clones:"
rg 'state\.clone\(\)|self\.state\.clone\(\)' --type rust "$ROOT_DIR" | wc -l
echo ""

echo "5. Value/CellValue Clones:"
rg 'value\.clone\(\)|CellValue.*\.clone\(\)|cell.*\.clone\(\)' --type rust "$ROOT_DIR" | wc -l
echo ""

echo "=== Detailed Analysis by Module ==="
echo ""

for module in gridcore-core gridcore-controller gridcore-ui; do
    if [ -d "$ROOT_DIR/$module" ]; then
        echo "Module: $module"
        echo "  Total clones: $(rg '\.clone\(\)' --type rust -c "$ROOT_DIR/$module" | awk -F: '{sum+=$2} END {print sum}')"
        echo "  Files with clones: $(rg '\.clone\(\)' --type rust -l "$ROOT_DIR/$module" | wc -l)"
        echo ""
    fi
done

echo "=== Potential Optimization Opportunities ==="
echo ""

echo "Small types that could implement Copy:"
rg '#\[derive\(.*Clone.*\)\]' --type rust "$ROOT_DIR" | grep -v 'Copy' | head -10
echo ""

echo "String allocations that might use &str:"
rg 'String::from|\.to_string\(\)' --type rust "$ROOT_DIR" | wc -l
echo "occurrences found"
echo ""

echo "=== Clone Patterns in Key Files ==="
echo ""

# Analyze specific high-impact files
for file in \
    "gridcore-core/src/facade/spreadsheet_facade.rs" \
    "gridcore-controller/src/state/machine.rs" \
    "gridcore-core/src/domain/cell.rs" \
    "gridcore-ui/src/components/canvas_grid.rs"
do
    if [ -f "$ROOT_DIR/$file" ]; then
        echo "File: $file"
        echo "  Clone contexts:"
        rg '\.clone\(\)' -B1 -A1 "$ROOT_DIR/$file" | grep -E '^\d+[-:]' | head -5
        echo ""
    fi
done
#!/usr/bin/env python3
"""
Script to fix timezone issues across the codebase by replacing
toLocaleTimeString() calls with timeUtils.formatTime()
"""

import os
import re
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).parent / "client" / "src"

# Pattern to match toLocaleTimeString calls
PATTERNS = [
    # Pattern 1: new Date(xxx).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    (
        r'new Date\(([^)]+)\)\.toLocaleTimeString\(\[\],\s*\{\s*hour:\s*[\'"]2-digit[\'"]\s*,\s*minute:\s*[\'"]2-digit[\'"]\s*(?:,\s*hour12:\s*true)?\s*\}\)',
        r'timeUtils.formatTime(\1)'
    ),
    # Pattern 2: simpler version without hour12
    (
        r'new Date\(([^)]+)\)\.toLocaleTimeString\(\[\],\s*\{\s*hour:\s*[\'"]2-digit[\'"]\s*,\s*minute:\s*[\'"]2-digit[\'"]\s*\}\)',
        r'timeUtils.formatTime(\1)'
    ),
]

def should_process_file(filepath):
    """Check if file should be processed"""
    # Skip node_modules
    if 'node_modules' in str(filepath):
        return False

    # Only process .js, .jsx, .ts, .tsx files
    return filepath.suffix in ['.js', '.jsx', '.ts', '.tsx']

def needs_import(content):
    """Check if file already has timeUtils import"""
    return 'import timeUtils' not in content and 'timeUtils.' in content

def add_import(content, filepath):
    """Add timeUtils import to file"""
    # Calculate relative path to utils
    file_dir = filepath.parent
    src_dir = BASE_DIR

    # Count how many levels deep we are
    try:
        rel_path = file_dir.relative_to(src_dir)
        depth = len(rel_path.parts)
        import_path = '../' * depth + 'utils/timeUtils'
    except ValueError:
        # File is in src or above
        import_path = './utils/timeUtils'

    # Find the last import statement
    lines = content.split('\n')
    last_import_idx = 0

    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i

    # Insert after last import
    lines.insert(last_import_idx + 1, f'import timeUtils from "{import_path}";')

    return '\n'.join(lines)

def fix_file(filepath):
    """Fix timezone issues in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        changes_made = []

        # Apply all patterns
        for pattern, replacement in PATTERNS:
            matches = re.findall(pattern, content)
            if matches:
                content = re.sub(pattern, replacement, content)
                changes_made.append(f"Replaced {len(matches)} occurrences of pattern")

        # If changes were made, add import if needed
        if content != original_content:
            if needs_import(content):
                content = add_import(content, filepath)
                changes_made.append("Added timeUtils import")

            # Write back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

            return True, changes_made

        return False, []

    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False, []

def main():
    """Main function"""
    print("=" * 80)
    print("Timezone Fix Script")
    print("=" * 80)
    print()

    if not BASE_DIR.exists():
        print(f"Error: Directory not found: {BASE_DIR}")
        return

    # Find all files
    all_files = []
    for root, dirs, files in os.walk(BASE_DIR):
        # Skip node_modules
        if 'node_modules' in root:
            continue

        for file in files:
            filepath = Path(root) / file
            if should_process_file(filepath):
                all_files.append(filepath)

    print(f"Found {len(all_files)} files to check")
    print()

    # Process files
    fixed_count = 0
    for filepath in all_files:
        was_fixed, changes = fix_file(filepath)
        if was_fixed:
            fixed_count += 1
            rel_path = filepath.relative_to(BASE_DIR.parent)
            print(f"[FIXED] {rel_path}")
            for change in changes:
                print(f"  - {change}")

    print()
    print("=" * 80)
    print(f"Summary: Fixed {fixed_count} files")
    print("=" * 80)

if __name__ == '__main__':
    main()

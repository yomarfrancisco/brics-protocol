#!/usr/bin/env python3
import sys
import re
import yaml
from pathlib import Path

def patch_workflow_file(filepath):
    """Patch a workflow file to add submodule safety to all checkout actions."""
    print(f"Patching {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all checkout actions and add safety parameters
    # Pattern: - uses: actions/checkout@v4
    # We need to add with: block after each one
    
    lines = content.split('\n')
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        
        # Check if this is a checkout action
        if re.match(r'^\s*-\s*uses:\s*actions/checkout@v4\s*$', line):
            # Check if next line already has 'with:'
            if i + 1 < len(lines) and 'with:' in lines[i + 1]:
                # Already has with block, skip
                i += 1
                continue
            
            # Add with block
            indent = len(line) - len(line.lstrip())
            indent_str = ' ' * (indent + 2)
            new_lines.extend([
                f"{indent_str}with:",
                f"{indent_str}  fetch-depth: 0",
                f"{indent_str}  submodules: false",
                f"{indent_str}  persist-credentials: false"
            ])
        
        i += 1
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    
    print(f"  ✓ Patched checkout actions")

def main():
    workflow_dir = Path('.github/workflows')
    
    for yml_file in workflow_dir.glob('*.yml'):
        if yml_file.is_file():
            patch_workflow_file(yml_file)

if __name__ == '__main__':
    main()


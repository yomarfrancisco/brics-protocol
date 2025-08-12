#!/usr/bin/env python3
"""
Freeze Python dependencies for pricing service.
"""

import json
import subprocess
import sys
from pathlib import Path

def freeze_deps():
    """Generate frozen dependencies list."""
    print("📦 Freezing Python dependencies...")
    
    try:
        # Get current working directory
        cwd = Path(__file__).parent.parent
        requirements_file = cwd / "requirements.txt"
        
        if not requirements_file.exists():
            print("❌ requirements.txt not found")
            sys.exit(1)
        
        # Read requirements.txt
        with open(requirements_file, 'r') as f:
            requirements = f.read().strip().split('\n')
        
        # Generate frozen output
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'freeze'],
            capture_output=True,
            text=True,
            cwd=cwd
        )
        
        if result.returncode != 0:
            print(f"❌ pip freeze failed: {result.stderr}")
            sys.exit(1)
        
        frozen_deps = result.stdout.strip().split('\n')
        
        # Filter to only include our requirements
        req_names = set()
        for req in requirements:
            if req and not req.startswith('#'):
                name = req.split('==')[0].split('>=')[0].split('<=')[0].split('~=')[0]
                req_names.add(name.lower())
        
        filtered_deps = []
        for dep in frozen_deps:
            if dep and not dep.startswith('#'):
                name = dep.split('==')[0].lower()
                if name in req_names:
                    filtered_deps.append(dep)
        
        # Write output
        output_file = cwd / "sbom-python.txt"
        with open(output_file, 'w') as f:
            f.write(f"# Python dependencies for {cwd.name}\n")
            f.write(f"# Generated: {subprocess.run(['date'], capture_output=True, text=True).stdout.strip()}\n\n")
            for dep in sorted(filtered_deps):
                f.write(f"{dep}\n")
        
        print(f"✅ Generated {output_file} with {len(filtered_deps)} dependencies")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    freeze_deps()

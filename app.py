"""
Root entry point for ACET Adaptive Study System.
Compatible with Render, Railway, PythonAnywhere, and local execution.
"""

import os
import sys

# Ensure root directory and src/ are in Python path
root_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(root_dir, "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from server import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("=" * 50)
    print("  ACET Adaptive Study System")
    print(f"  Starting server on 0.0.0.0:{port}")
    print("=" * 50, flush=True)
    app.run(host="0.0.0.0", port=port, debug=False)

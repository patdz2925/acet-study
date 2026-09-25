"""Vercel serverless entry point. Vercel calls the `app` variable."""
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root not in sys.path:
    sys.path.insert(0, root)
src = os.path.join(root, "src")
if src not in sys.path:
    sys.path.insert(0, src)

from server import app  # noqa: E402  (Vercel handler)

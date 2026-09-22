"""
WSGI entry point for production servers (Gunicorn, uWSGI, PythonAnywhere).
"""

import os
import sys

root_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(root_dir, "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from server import app

# Expose 'app' and 'application' (standard for WSGI servers)
application = app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

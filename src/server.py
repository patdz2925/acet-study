"""
Flask server for ACET Adaptive Study System.
Serves the API and static files for the local web interface.
"""

import sys
import os
import sqlite3

# Ensure project root and src/ are in Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "src"))

from flask import Flask, request, jsonify, send_from_directory
from database import init_db, get_metadata, set_metadata, get_question_sources, DB_PATH
import study_logic
import json

app = Flask(__name__, static_folder=None, static_url_path=None)

# Initialize database on startup
init_db()

# Serve static files (Flask's built-in static handler is disabled, so we use a custom route)
@app.route("/static/<path:filename>")
def serve_static(filename):
    static_dir = os.path.join(project_root, "static")
    if not os.path.exists(os.path.join(static_dir, filename)):
        return "File not found", 404
    return send_from_directory(static_dir, filename)


# ── API ROUTES ────────────────────────────────────────────────────────

@app.route("/api/init", methods=["GET"])
def api_init():
    """Initialize database and return status."""
    init_db()
    demo = get_metadata("is_demo") or "unknown"
    imported = get_metadata("imported_count") or "0"
    sources = get_question_sources()

    # Check if database is empty
    conn = sqlite3.connect(DB_PATH)
    count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    conn.close()

    return jsonify({
        "status": "ok",
        "is_demo": demo == "true",
        "imported_count": int(imported),
        "question_sources": sources,
        "db_empty": count == 0,
        "question_count": count
    })


@app.route("/api/concepts", methods=["GET"])
def api_concepts():
    """Return all concepts and their priority stats."""
    from database import get_all_concepts, get_concept_stats
    concepts = get_all_concepts()
    stats = get_concept_stats()
    return jsonify({"concepts": concepts, "stats": stats})


@app.route("/api/study/recommend", methods=["GET"])
def api_study_recommend():
    """Get the next concept to study."""
    result = study_logic.get_study_recommendation()
    if result is None:
        return jsonify({"status": "no_concepts", "message": "No concepts found. Import mistakes first."})
    return jsonify({
        "status": "ok",
        "concept": result["concept"],
        "explanation": result["explanation"],
        "mistakes": result["mistakes"],
        "practice_questions": result["practice_questions"]
    })


@app.route("/api/study/concept/<concept_id>", methods=["GET"])
def api_study_concept(concept_id):
    """Get study data for a specific concept."""
    result = study_logic.study_concept(concept_id)
    if result is None:
        return jsonify({"status": "error", "message": f"Concept '{concept_id}' not found."})
    return jsonify({
        "status": "ok",
        "concept": result["concept"],
        "explanation": result["explanation"],
        "mistakes": result["mistakes"],
        "practice_questions": result["practice_questions"]
    })


@app.route("/api/check", methods=["POST"])
def api_check():
    """Check an answer."""
    data = request.get_json()
    question_id = data.get("question_id")
    chosen_answer = data.get("answer")
    if not question_id or not chosen_answer:
        return jsonify({"status": "error", "message": "Missing question_id or answer."})
    result = study_logic.check_answer(question_id, chosen_answer)
    return jsonify(result)


@app.route("/api/record", methods=["POST"])
def api_record():
    """Record study session results."""
    data = request.get_json()
    concept_id = data.get("concept_id")
    results = data.get("results", [])
    if not concept_id or not results:
        return jsonify({"status": "error", "message": "Missing concept_id or results."})
    summary = study_logic.record_results(concept_id, results)
    return jsonify({"status": "ok", "summary": summary})


@app.route("/api/mistakes", methods=["GET"])
def api_mistakes():
    """Return all mistake records."""
    from database import get_mistakes
    mistakes = get_mistakes()
    return jsonify({"mistakes": mistakes})


@app.route("/api/import", methods=["POST"])
def api_import():
    """Import mistakes data from JSON."""
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided."})
    result = study_logic.import_mistakes_data(data)
    return jsonify(result)


@app.route("/api/import-curated", methods=["POST"])
def api_import_curated():
    """Import curated practice questions."""
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided."})
    result = study_logic.import_curated_data(data)
    return jsonify(result)


@app.route("/api/booklet", methods=["GET"])
def api_booklet():
    """Return all original ACET booklet questions."""
    from database import get_booklet_questions
    questions = get_booklet_questions()
    return jsonify({"questions": questions, "count": len(questions)})


@app.route("/api/question-sources", methods=["GET"])
def api_question_sources():
    """Return question source counts."""
    from database import get_question_sources
    sources = get_question_sources()
    return jsonify(sources)


@app.route("/api/load-demo", methods=["POST"])
def api_load_demo():
    """Load demo data from data/mistakes.json."""
    demo_path = os.path.join(project_root, "data", "mistakes.json")
    if not os.path.exists(demo_path):
        return jsonify({"success": False, "error": "Demo data file not found."}), 404

    try:
        with open(demo_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        result = study_logic.import_mistakes_data(data)
        if not result.get("success"):
            return jsonify(result), 400
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/check-empty", methods=["GET"])
def api_check_empty():
    """Check if database has any questions."""
    from database import get_db
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    conn.close()
    return jsonify({"empty": count == 0, "question_count": count})


# ── FALLBACK: serve index.html for all other routes ──────────────────

@app.route("/")
def index():
    return send_from_directory(os.path.join(project_root, "static"), "index.html")


# ── START SERVER ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    print("=" * 50)
    print("  ACET Adaptive Study System")
    print(f"  Binding to 0.0.0.0:{port}")
    print("=" * 50, flush=True)
    init_db()
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)

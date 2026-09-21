"""
SQLite database layer for ACET Study System.
Handles schema creation and all data operations.
"""

import sqlite3
import json
import os
from datetime import datetime, date

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "database.db")


def get_db():
    """Get a database connection. Creates the database file if it doesn't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create all tables if they don't exist. Safe to call multiple times."""
    conn = get_db()
    c = conn.cursor()

    # Questions table — stores all questions from all sources
    c.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            section TEXT,
            concept TEXT,
            question_text TEXT NOT NULL,
            choices TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            difficulty TEXT DEFAULT 'medium',
            verified INTEGER DEFAULT 1,
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )
    """)

    # Concepts table
    c.execute("""
        CREATE TABLE IF NOT EXISTS concepts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            explanation_path TEXT DEFAULT ''
        )
    """)

    # Mistakes table — records of original booklet mistakes
    c.execute("""
        CREATE TABLE IF NOT EXISTS mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_question_id TEXT NOT NULL,
            concept TEXT NOT NULL,
            your_answer TEXT,
            correct_answer TEXT NOT NULL,
            recorded_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (original_question_id) REFERENCES questions(id)
        )
    """)

    # Study sessions table
    c.execute("""
        CREATE TABLE IF NOT EXISTS study_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            concept TEXT NOT NULL,
            study_date TEXT DEFAULT (datetime('now','localtime')),
            questions_answered INTEGER DEFAULT 0,
            correct INTEGER DEFAULT 0,
            incorrect INTEGER DEFAULT 0
        )
    """)

    # Metadata table — tracks import status and demo flag
    c.execute("""
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    conn.commit()
    conn.close()


def add_questions(questions):
    """Insert a list of question dicts into the database. Skips duplicates by id."""
    conn = get_db()
    c = conn.cursor()
    count = 0
    for q in questions:
        try:
            c.execute("""
                INSERT OR IGNORE INTO questions (id, source, section, concept, question_text, choices, correct_answer, difficulty, verified, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                q["id"], q["source"], q.get("section", ""), q.get("concept", ""),
                q["question_text"],
                json.dumps(q["choices"]) if isinstance(q["choices"], list) else q["choices"],
                q["correct_answer"],
                q.get("difficulty", "medium"), q.get("verified", 1), q.get("notes", "")
            ))
            count += 1
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    conn.close()
    return count


def add_mistakes(mistakes):
    """Insert mistake records from the mistakes.json file."""
    conn = get_db()
    c = conn.cursor()
    count = 0
    for m in mistakes:
        # Store the original question if not already in the database
        original_id = m["original_id"]
        c.execute("SELECT id FROM questions WHERE id = ?", (original_id,))
        if not c.fetchone():
            c.execute("""
                INSERT OR IGNORE INTO questions (id, source, section, concept, question_text, choices, correct_answer, verified, notes)
                VALUES (?, 'booklet', ?, ?, ?, ?, ?, 1, '')
            """, (
                original_id, m.get("section", ""), m.get("concept", ""),
                m["question_text"],
                json.dumps(m["choices"]) if isinstance(m["choices"], list) else m["choices"],
                m["correct_answer"]
            ))

        # Record the mistake
        c.execute("""
            INSERT INTO mistakes (original_question_id, concept, your_answer, correct_answer)
            VALUES (?, ?, ?, ?)
        """, (original_id, m["concept"], m["your_answer"], m["correct_answer"]))
        count += 1
    conn.commit()
    conn.close()
    return count


def add_concepts(concepts):
    """Insert concept definitions."""
    conn = get_db()
    c = conn.cursor()
    for concept in concepts:
        c.execute("""
            INSERT OR REPLACE INTO concepts (id, name, explanation_path)
            VALUES (?, ?, ?)
        """, (concept["id"], concept["name"], concept.get("explanation_path", "")))
    conn.commit()
    conn.close()


def get_all_concepts():
    """Return all concepts from the database."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM concepts ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_mistakes():
    """Return all mistake records with associated question details."""
    conn = get_db()
    rows = conn.execute("""
        SELECT m.*, q.question_text, q.choices, q.correct_answer as orig_correct, q.section
        FROM mistakes m
        LEFT JOIN questions q ON m.original_question_id = q.id
        ORDER BY m.recorded_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_concept_stats():
    """
    Calculate priority for each concept based on mistakes and practice performance.
    Returns list of dicts with concept stats sorted by priority (highest first).
    """
    conn = get_db()
    rows = conn.execute("""
        SELECT
            c.id as concept_id,
            c.name as concept_name,
            COUNT(DISTINCT m.id) as total_mistakes,
            COALESCE(SUM(CASE WHEN ss.correct IS NOT NULL THEN ss.correct ELSE 0 END), 0) as correct_answers,
            COALESCE(SUM(CASE WHEN ss.incorrect IS NOT NULL THEN ss.incorrect ELSE 0 END), 0) as incorrect_answers,
            MAX(ss.study_date) as last_reviewed
        FROM concepts c
        LEFT JOIN mistakes m ON c.id = m.concept
        LEFT JOIN study_sessions ss ON c.id = ss.concept
        GROUP BY c.id, c.name
        ORDER BY total_mistakes DESC, last_reviewed ASC
    """).fetchall()
    conn.close()

    stats = []
    for r in rows:
        total_mistakes = r["total_mistakes"] or 0
        correct = r["correct_answers"] or 0
        incorrect = r["incorrect_answers"] or 0
        total_practice = correct + incorrect

        # Calculate priority: more mistakes = higher priority
        # If practiced, reduce priority by half of correct answers
        priority = total_mistakes - (correct * 0.3)

        accuracy = (correct / total_practice) if total_practice > 0 else None

        stats.append({
            "concept_id": r["concept_id"],
            "concept_name": r["concept_name"],
            "total_mistakes": total_mistakes,
            "correct_answers": correct,
            "incorrect_answers": incorrect,
            "total_practice": total_practice,
            "accuracy": accuracy,
            "last_reviewed": r["last_reviewed"],
            "priority": round(priority, 2)
        })

    # Sort by priority descending
    stats.sort(key=lambda x: x["priority"], reverse=True)
    return stats


def get_concept_by_id(concept_id):
    """Return a single concept by ID."""
    conn = get_db()
    row = conn.execute("SELECT * FROM concepts WHERE id = ?", (concept_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_explanation(concept_id):
    """Read the explanation text file for a concept."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(project_root, "templates", f"{concept_id}.txt")
    if os.path.exists(template_path):
        with open(template_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return None


def get_question_by_id(question_id):
    """Get a single question by ID."""
    conn = get_db()
    row = conn.execute("SELECT * FROM questions WHERE id = ?", (question_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_booklet_questions():
    """Return all original ACET booklet questions."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM questions WHERE source = 'booklet' ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def record_study_session(concept, answered, correct, incorrect):
    """Record a study session result."""
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO study_sessions (concept, questions_answered, correct, incorrect)
        VALUES (?, ?, ?, ?)
    """, (concept, answered, correct, incorrect))
    conn.commit()
    conn.close()


def get_metadata(key):
    """Get a metadata value."""
    conn = get_db()
    row = conn.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else None


def set_metadata(key, value):
    """Set a metadata value."""
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()


def get_question_sources():
    """Return count of questions by source type."""
    conn = get_db()
    rows = conn.execute("SELECT source, COUNT(*) as count FROM questions GROUP BY source").fetchall()
    conn.close()
    return {r["source"]: r["count"] for r in rows}

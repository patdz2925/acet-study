"""
Study logic for ACET adaptive study system.
Handles concept priority, study recommendations, and result tracking.
"""

import json
import sys
import os

# Ensure src/ is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import (
    get_concept_stats, get_concept_by_id, get_explanation,
    record_study_session, get_all_concepts, get_question_by_id,
    add_questions, add_mistakes, add_concepts, get_metadata, set_metadata,
    get_mistakes
)
from question_engine import generate_questions


def get_next_concept():
    """
    Determine which concept the user should study next.
    Returns the concept dict with the highest priority (most urgent).
    """
    stats = get_concept_stats()
    if not stats:
        return None

    # Filter out concepts where the user has demonstrated mastery
    # (3+ practice attempts and 80%+ accuracy)
    ready = []
    for s in stats:
        if s["total_practice"] >= 3 and s["accuracy"] is not None and s["accuracy"] >= 0.80:
            ready.append(s)

    # If all concepts are ready, return the one with the lowest accuracy
    if len(ready) == len(stats) and stats:
        stats.sort(key=lambda x: x["accuracy"] if x["accuracy"] is not None else 0)
        return {"concept_id": stats[0]["concept_id"], "concept_name": stats[0]["concept_name"]}

    # Otherwise, return the highest-priority unready concept
    if stats:
        return {"concept_id": stats[0]["concept_id"], "concept_name": stats[0]["concept_name"]}

    return None


def study_concept(concept_id):
    """
    Prepare a study session for a given concept.
    Returns: concept info, explanation, original mistake questions, and 3 practice questions.
    """
    concept = get_concept_by_id(concept_id)
    if not concept:
        return None

    explanation = get_explanation(concept_id)

    # Get unique original mistake questions for this concept
    mistakes = []
    seen_ids = set()
    all_mistakes = get_mistakes()
    for m in all_mistakes:
        if m["concept"] == concept_id and m["original_question_id"] not in seen_ids:
            seen_ids.add(m["original_question_id"])
            choices_raw = m.get("choices", "[]")
            try:
                choices = json.loads(choices_raw) if isinstance(choices_raw, str) else choices_raw
            except (json.JSONDecodeError, TypeError):
                choices = []
            mistakes.append({
                "original_id": m["original_question_id"],
                "question_text": m.get("question_text", ""),
                "choices": choices,
                "correct_answer": m["correct_answer"],
                "your_answer": m["your_answer"],
                "section": m.get("section", "")
            })

    # Generate exactly 3 practice questions
    practice_questions = generate_questions(concept_id, count=3)

    # Store generated questions in database so they can be looked up by ID
    if practice_questions:
        add_questions(practice_questions)
        # Re-fetch from database to get stored versions
        stored_questions = []
        for q in practice_questions:
            stored = get_question_by_id(q["id"])
            if stored:
                stored_questions.append(stored)
        practice_questions = stored_questions
    else:
        # No templates for this concept — use original ACET booklet questions as practice
        # Pull ALL booklet questions for this concept (not just the ones the user got wrong)
        practice_questions = []
        from database import get_db
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM questions WHERE source = 'booklet' AND concept = ? ORDER BY id",
            (concept_id,)
        ).fetchall()
        conn.close()
        all_booklet = [dict(r) for r in rows]

        if not all_booklet:
            # Fallback: use the mistake questions directly
            for m in mistakes[:3]:
                q = {
                    "id": f"BOOKLET-{m['original_id']}",
                    "source": "booklet",
                    "verified": 1,
                    "section": m.get("section", ""),
                    "concept": concept_id,
                    "question_text": m["question_text"],
                    "choices": m["choices"],
                    "correct_answer": m["correct_answer"],
                }
                add_questions([q])
                stored = get_question_by_id(q["id"])
                if stored:
                    practice_questions.append(stored)
        else:
            # Use booklet questions, prioritizing ones the user got wrong
            mistake_ids = {m["original_id"] for m in mistakes}
            # Sort: mistakes first, then others
            sorted_booklet = sorted(all_booklet, key=lambda q: q["id"] not in [f"BOOKLET-{mid}" for mid in mistake_ids])
            practice_questions = sorted_booklet[:3]

    return {
        "concept": concept,
        "explanation": explanation,
        "mistakes": mistakes,
        "practice_questions": practice_questions,
        "stats": None
    }


def check_answer(question_id, chosen_answer):
    """
    Check if the chosen answer is correct.
    Returns dict with correctness and feedback.
    """
    question = get_question_by_id(question_id)
    if not question:
        return {"correct": False, "error": f"Question {question_id} not found."}

    correct = str(chosen_answer).strip().upper() == str(question["correct_answer"]).strip().upper()
    return {
        "correct": correct,
        "question_id": question["id"],
        "question_text": question["question_text"],
        "chosen_answer": chosen_answer,
        "correct_answer": question["correct_answer"],
        "choices": json.loads(question["choices"]) if isinstance(question["choices"], str) else question["choices"],
        "source": question["source"],
        "concept": question["concept"]
    }


def record_results(concept_id, results):
    """
    Record study session results.
    results: list of dicts with keys: question_id, correct (bool), concept
    """
    correct_count = sum(1 for r in results if r["correct"])
    incorrect_count = len(results) - correct_count

    record_study_session(concept_id, len(results), correct_count, incorrect_count)

    now_str = datetime_now()
    return {
        "concept_id": concept_id,
        "concept": concept_id,
        "study_date": now_str,
        "questions_answered": len(results),
        "total": len(results),
        "correct": correct_count,
        "incorrect": incorrect_count,
        "accuracy": round(correct_count / len(results), 2) if results else 0
    }



def get_study_recommendation():
    """
    Get a study recommendation: which concept to study next.
    Returns full study data or None if no concepts exist.
    """
    next_concept = get_next_concept()
    if not next_concept:
        return None

    return study_concept(next_concept["concept_id"])


def get_mock_questions():
    """
    Return every unique ORIGINAL booklet question for a full mock run.
    Excludes BOOKLET- practice copies and template/curated questions,
    so each ACET question appears exactly once, in booklet order.
    """
    from database import get_db
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM questions WHERE source = 'booklet' AND id NOT LIKE 'BOOKLET-%' ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def grade_mock(answers):
    """
    Grade a full mock submission in one call and record per-concept sessions.
    answers: dict of {question_id: chosen_letter}
    Returns totals, per-section breakdown, and per-question results.
    """
    from database import get_db, record_study_session
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM questions WHERE source = 'booklet' AND id NOT LIKE 'BOOKLET-%'"
    ).fetchall()
    conn.close()
    questions = {r["id"]: dict(r) for r in rows}

    per_question = []
    section_stats = {}
    concept_stats = {}
    total_correct = 0
    total = 0
    for qid, q in questions.items():
        if qid not in answers:
            continue
        chosen = str(answers[qid]).strip().upper()
        correct_ans = str(q["correct_answer"]).strip().upper()
        # Support "A. ..." style correct answers
        if len(correct_ans) > 1 and correct_ans[0].isalpha() and correct_ans[1] == ".":
            correct_ans = correct_ans[0]
        is_correct = chosen == correct_ans
        total += 1
        if is_correct:
            total_correct += 1
        per_question.append({
            "question_id": qid,
            "concept": q["concept"],
            "section": q.get("section", ""),
            "correct": is_correct,
            "chosen_answer": chosen,
            "correct_answer": q["correct_answer"],
        })
        for key, bucket in (("section", section_stats), ("concept", concept_stats)):
            name = q.get(key, "") or "Unknown"
            b = bucket.setdefault(name, {"answered": 0, "correct": 0})
            b["answered"] += 1
            if is_correct:
                b["correct"] += 1

    # Record one study session per concept so mastery/priority update
    for concept_id, b in concept_stats.items():
        record_study_session(
            concept_id, b["answered"], b["correct"], b["answered"] - b["correct"]
        )

    return {
        "total": total,
        "correct": total_correct,
        "incorrect": total - total_correct,
        "accuracy": round(total_correct / total, 2) if total else 0,
        "sections": section_stats,
        "per_question": per_question,
    }


def import_mistakes_data(data):
    """
    Import mistakes from JSON data.
    Validates structure before inserting.
    Returns dict with success status and count.
    """
    if not isinstance(data, dict):
        return {"success": False, "error": "Data must be a JSON object."}

    if "demo" in data and data["demo"] is True:
        set_metadata("is_demo", "true")
    else:
        set_metadata("is_demo", "false")

    mistakes = data.get("mistakes", [])
    if not isinstance(mistakes, list):
        return {"success": False, "error": "'mistakes' must be a list."}

    # Validate each mistake
    validated = []
    errors = []
    for i, m in enumerate(mistakes):
        required = ["original_id", "section", "question_text", "choices", "correct_answer", "concept", "your_answer"]
        missing = [f for f in required if f not in m]
        if missing:
            errors.append(f"Entry {i}: missing fields {missing}")
            continue
        if not isinstance(m["choices"], list) or len(m["choices"]) < 2:
            errors.append(f"Entry {i}: 'choices' must be a list with at least 2 items.")
            continue
        # Check if correct_answer is one of the choices
        # Support both "A. 20%" and "20%" formats
        choice_values = []
        for c in m["choices"]:
            c_str = str(c).strip()
            # If choice starts with a letter followed by ". ", extract the letter
            if len(c_str) > 1 and c_str[0].isalpha() and c_str[1] == ".":
                choice_values.append(c_str[0].strip().upper())
            else:
                choice_values.append(c_str)
        if m["correct_answer"].strip().upper() not in choice_values:
            errors.append(f"Entry {i}: 'correct_answer' '{m['correct_answer']}' not found in choices.")
            continue
        validated.append(m)

    if errors and not validated:
        return {"success": False, "error": "No valid mistakes to import.", "details": errors[:5]}

    if not validated:
        return {"success": False, "error": "No valid mistakes to import."}

    # Add concepts from mistakes
    concepts_set = set()
    for m in validated:
        concepts_set.add(m["concept"])
    concepts = [{"id": c, "name": c.replace("_", " ").title()} for c in concepts_set]
    add_concepts(concepts)

    # Add mistakes and questions
    add_mistakes(validated)

    set_metadata("last_import", datetime_now())
    set_metadata("imported_count", str(len(validated)))

    return {"success": True, "imported": len(validated), "concepts": len(concepts_set)}


def import_curated_data(data):
    """Import curated practice questions."""
    if not isinstance(data, dict):
        return {"success": False, "error": "Data must be a JSON object."}

    questions = data.get("questions", [])
    if not isinstance(questions, list):
        return {"success": False, "error": "'questions' must be a list."}

    validated = []
    for q in questions:
        required = ["id", "question_text", "choices", "correct_answer", "concept"]
        missing = [f for f in required if f not in q]
        if missing:
            continue
        if not isinstance(q["choices"], list) or len(q["choices"]) < 2:
            continue
        choice_letters = [str(c)[0].strip().upper() for c in q["choices"]]
        if q["correct_answer"].strip().upper() not in choice_letters:
            continue
        validated.append(q)

    for q in validated:
        q["source"] = "curated"
        q["verified"] = 1

    count = add_questions(validated)
    return {"success": True, "imported": count}


def datetime_now():
    """Get current datetime string."""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

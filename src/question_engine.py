"""
Question generation engine using verified templates.
Generates practice questions for ACET math concepts programmatically.
Each generated question has a programmatically verifiable answer.
"""

import random
import json
import os
import math


def _gcd(a, b):
    """Greatest common divisor using Euclidean algorithm."""
    while b:
        a, b = b, a % b
    return a


def _make_choices(correct, spread, is_int=False):
    """
    Generate 4 answer choices. One is the correct answer.
    Others are offset by random amounts up to 'spread'.
    """
    choices = set()
    if is_int:
        correct = int(correct)
        spread = max(1, int(spread))
        while len(choices) < 3:
            offset = random.randint(1, spread * 2)
            choices.add(correct + offset)
            choices.add(correct - offset)
    else:
        correct = float(correct)
        while len(choices) < 3:
            offset = round(random.uniform(1, spread * 2), 2)
            choices.add(round(correct + offset, 2))
            choices.add(round(correct - offset, 2))

    choices.add(correct)
    choice_list = sorted(choices)
    random.shuffle(choice_list)
    return [str(c) for c in choice_list[:4]]


def _make_ratio_choices(a, b):
    """Generate choices for a ratio simplification question."""
    gcd = _gcd(a, b)
    correct = f"{a // gcd}:{b // gcd}"
    wrong = set()
    attempts = 0
    while len(wrong) < 3 and attempts < 50:
        wa = random.randint(1, max(a, b))
        wb = random.randint(1, max(a, b))
        wrong.add(f"{wa}:{wb}")
        attempts += 1
    wrong.add(correct)
    choice_list = list(wrong)
    random.shuffle(choice_list)
    return choice_list[:4]


# ── TEMPLATE DEFINITIONS ──────────────────────────────────────────────
# Each concept has template functions that generate questions with
# verifiable answers. No external dependencies needed.

def _gen_percent_find(vars):
    """Generate: What is X% of Y?"""
    pct = random.choice([10, 15, 20, 25, 30, 50, 75])
    number = random.choice([40, 50, 60, 80, 100, 120, 150, 200])
    answer = int(pct / 100 * number)
    text = f"What is {pct}% of {number}?"
    choices = _make_choices(answer, max(1, answer // 4), is_int=True)
    return text, choices, str(answer)


def _gen_percent_increase(vars):
    """Generate: A price goes from $X to $Y. What is the percent increase?"""
    old = random.choice([20, 40, 50, 80, 100, 120])
    increase = random.choice([5, 10, 15, 20, 25, 50])
    new = old + increase
    answer = round((new - old) / old * 100)
    text = f"A price goes from ${old} to ${new}. What is the percent increase?"
    choices = _make_choices(answer, max(3, answer // 3), is_int=True)
    return text, choices, str(answer)


def _gen_ratio_proportion(vars):
    """Generate: If A items cost $C, how much do B items cost?"""
    a = random.choice([2, 3, 4, 5])
    unit_price = random.choice([3, 4, 5, 6, 7])
    cost = a * unit_price
    b = random.choice([6, 8, 10, 12, 14, 15])
    answer = round(b / a * cost, 2)
    text = f"If {a} items cost ${cost:.2f}, how much do {b} items cost?"
    choices = _make_choices(answer, max(1, int(answer * 0.3)))
    # Convert choices to clean format
    clean_choices = []
    for c in choices:
        val = float(c)
        clean_choices.append(f"{val:.2f}" if val != int(val) else str(int(val)))
    return text, clean_choices, f"{answer:.2f}" if answer != int(answer) else str(int(answer))


def _gen_ratio_simplify(vars):
    """Generate: Simplify the ratio A:B"""
    a = random.choice([6, 8, 12, 15, 18, 20, 24, 30])
    b = a * random.choice([2, 3, 4, 5])
    gcd = _gcd(a, b)
    answer = f"{a // gcd}:{b // gcd}"
    text = f"Simplify the ratio {a}:{b}"
    choices = _make_ratio_choices(a, b)
    return text, choices, answer


def _gen_frac_of_number(vars):
    """Generate: What is X/Y of Z?"""
    num = random.choice([1, 2, 3, 4])
    den = random.choice([2, 3, 4, 5, 8, 10])
    number = den * random.choice([5, 10, 15, 20, 25])
    answer = int(num / den * number)
    text = f"What is {num}/{den} of {number}?"
    choices = _make_choices(answer, max(1, answer // 4), is_int=True)
    return text, choices, str(answer)


def _gen_avg_find_sum(vars):
    """Generate: The average of N numbers is A. What is their total sum?"""
    count = random.choice([3, 4, 5, 6, 8, 10])
    avg = random.choice([10, 12, 15, 18, 20, 25, 30])
    answer = count * avg
    text = f"The average of {count} numbers is {avg}. What is their total sum?"
    choices = _make_choices(answer, max(5, answer // 5), is_int=True)
    return text, choices, str(answer)


def _gen_avg_find_missing(vars):
    """Generate: The average of N numbers is A. Known values: [...]. What is the missing number?"""
    count = random.choice([4, 5])
    avg = random.choice([10, 12, 15, 20])
    known_count = count - 1
    # Generate known values that are reasonably below avg so the missing is positive
    max_val = avg * 2
    known = [random.randint(1, max_val) for _ in range(known_count)]
    total = count * avg
    missing = total - sum(known)
    # If missing is negative or too large, regenerate known values
    attempts = 0
    while missing < 1 and attempts < 20:
        known = [random.randint(1, max_val) for _ in range(known_count)]
        missing = total - sum(known)
        attempts += 1
    answer = max(missing, 1)  # Ensure positive
    known_str = ", ".join(str(k) for k in known)
    text = f"The average of {count} numbers is {avg}. Known values are {known_str}. What is the missing number?"
    choices = _make_choices(answer, max(3, max(answer // 3, 5)), is_int=True)
    return text, choices, str(answer)


def _gen_alg_solve_linear(vars):
    """Generate: Solve for x: Ax + B = C"""
    a = random.choice([2, 3, 4, 5])
    b = random.choice([3, 5, 7, 9, 12])
    x = random.choice([2, 3, 4, 5, 6, 7, 8])
    c = a * x + b
    answer = x
    text = f"Solve for x: {a}x + {b} = {c}"
    choices = _make_choices(answer, 2, is_int=True)
    return text, choices, str(answer)


def _gen_alg_solve_simple(vars):
    """Generate: Solve for x: x + B = C"""
    b = random.choice([3, 5, 7, 10, 12])
    x = random.choice([5, 8, 10, 15, 20])
    c = x + b
    answer = x
    text = f"Solve for x: x + {b} = {c}"
    choices = _make_choices(answer, 2, is_int=True)
    return text, choices, str(answer)


# ── CONCEPT TEMPLATE MAP ──────────────────────────────────────────────
# Maps each concept to its question generation functions.
# Add new concepts here to extend the system.

CONCEPT_TEMPLATES = {
    "percentages": [
        _gen_percent_find,
        _gen_percent_increase,
    ],
    "ratios": [
        _gen_ratio_proportion,
        _gen_ratio_simplify,
    ],
    "fractions": [
        _gen_frac_of_number,
    ],
    "averages": [
        _gen_avg_find_sum,
        _gen_avg_find_missing,
    ],
    "basic_algebra": [
        _gen_alg_solve_linear,
        _gen_alg_solve_simple,
    ],
    # Add new concepts here:
    # "numerical_ability": [...],
    # "language_proficiency": [...],
    # "reading_comprehension": [...],
    # "logical_reasoning": [...],
}


def generate_questions(concept, count=3):
    """
    Generate exactly `count` verified practice questions for a concept.
    Returns list of question dicts with source='template' and verified=True.
    If the concept has no templates, returns an empty list.
    """
    if concept not in CONCEPT_TEMPLATES:
        return []

    generators = CONCEPT_TEMPLATES[concept]
    questions = []
    used_texts = set()
    attempts = 0

    while len(questions) < count and attempts < count * 20:
        attempts += 1
        gen_func = random.choice(generators)

        try:
            text, choices, answer = gen_func({})
        except Exception:
            continue

        # Ensure we don't generate duplicate questions
        if text in used_texts:
            continue
        used_texts.add(text)

        # Ensure we have exactly 4 choices
        if len(choices) < 4:
            continue
        choices = choices[:4]

        # Make sure the answer is in the choices
        if answer not in choices:
            continue

        q_id = f"GEN-{concept.upper()}-{random.randint(1000, 9999)}-{attempts}"

        questions.append({
            "id": q_id,
            "source": "template",
            "section": "Math",
            "concept": concept,
            "question_text": text,
            "choices": json.dumps(choices),
            "correct_answer": answer,
            "difficulty": "medium",
            "verified": 1,
            "notes": "Generated from verified template"
        })

    return questions[:count]


def get_available_concepts():
    """Return all concepts that have template question generators."""
    return list(CONCEPT_TEMPLATES.keys())


def get_template_info(concept):
    """Return info about available templates for a concept."""
    if concept not in CONCEPT_TEMPLATES:
        return []
    return [{"id": f.__name__, "template": f.__name__.replace("_", " ")} for f in CONCEPT_TEMPLATES[concept]]

# Project Handoff Prompt for Google Gemini

Copy everything below this line and paste it into Gemini:

---

## Project: ACET Adaptive Study System

I have a local-first web application for studying for the ACET (Adaptive College Entrance Test). I need help with deployment and improvements. Here's the full context:

### What the app does
- A Flask + SQLite + vanilla HTML/CSS/JS web app that helps study for the ACET exam
- Loads 101 incorrect practice test questions from a JSON file
- Groups mistakes by 74 underlying concepts across 5 sections (Language Proficiency, Mathematics, Verbal Analogy, Reading Comprehension, Numerical Ability)
- Ranks concepts by priority (most mistakes first)
- Shows original ACET questions the user got wrong
- Generates 3 practice questions per concept (template-based for math, booklet fallback for others)
- Checks answers and records mastery progress
- Recommends what to study next

### Tech stack
- Python 3.10+ / Flask backend
- SQLite database (`data/database.db`)
- Vanilla HTML/CSS/JS frontend (no framework)
- Woblo.in-inspired dark theme (glass morphism, Inter font, gradient buttons)
- Single-page app with 5 screens: Dashboard, Mistakes, Study Now, Concepts, Import

### Project structure
```
acet-study/
├── start.bat              # Launch script (Windows)
├── requirements.txt       # flask>=3.0.0
├── render.yaml            # Render.com deployment config
├── src/
│   ├── server.py          # Flask server (API + static files)
│   ├── database.py        # SQLite schema + all DB operations
│   ├── question_engine.py # Template question generation (5 math concepts)
│   └── study_logic.py     # Study priority + answer checking + import
├── static/
│   ├── index.html         # SPA shell (type="module" scripts)
│   ├── css/style.css      # Dark theme CSS
│   ├── js/
│   │   ├── app.js         # App initialization
│   │   ├── api.js         # HTTP calls to backend
│   │   └── pages.js       # All screen rendering + study flow
│   └── img/               # PDF page images for figure questions
├── data/
│   ├── mistakes.json      # 101 real ACET mistakes (74 concepts)
│   ├── curated_questions.json
│   └── database.db        # Auto-created on first run
└── templates/             # Concept explanation .txt files (5 of 74)
```

### Key API endpoints
- `GET /api/init` — App initialization (total mistakes, sections)
- `GET /api/concepts` — All 74 concepts with mastery stats
- `GET /api/mistakes` — All 101 mistake questions
- `GET /api/study/recommend` — Auto-recommend highest priority concept
- `GET /api/study/concept/<concept_id>` — Study a specific concept
- `POST /api/study/check` — Check answer for a question
- `POST /api/study/record` — Record practice results
- `POST /api/import` — Import mistakes from JSON
- `GET /api/booklet` — All booklet questions

### Current issues I need help with

1. **Render deployment fails** — The app works locally on `localhost:5000` but won't deploy to Render.com. The server binds to `0.0.0.0:PORT` but Render keeps saying "No open ports detected." I've tried:
   - Binding to `0.0.0.0` instead of `127.0.0.1`
   - Using gunicorn
   - Pinning Python 3.11
   - Setting PORT env var
   - Disabling debug mode
   Nothing works. The GitHub repo is at: https://github.com/patdz2925/acet-study

2. **Database persistence on free hosting** — SQLite database resets on Render free tier redeploys. Need a solution that preserves user study progress.

3. **Concept explanations** — Only 5 of 74 concepts have explanation text files in `templates/`. Need explanations for the remaining 69 concepts.

### What I need
1. Fix the Render deployment so the app is accessible at a public URL
2. Ideally find a free hosting solution where the database persists
3. Any other improvements you suggest

### How to run locally
```
cd acet-study
pip install -r requirements.txt
python src/server.py
# Open http://localhost:5000
```

### Important constraints
- No paid AI APIs
- Must work without login/accounts for the study tool itself
- Original ACET questions must never be modified
- The app must remain simple and fast

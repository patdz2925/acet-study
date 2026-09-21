# ACET Adaptive Study System

A local-first study tool built from your ACET Practice Test Booklet mistakes. No internet required. No accounts. No payments.

## Quick Start (Local)

1. Install Python 3.10+ if you haven't already
2. Double-click `start.bat`
3. Open **http://localhost:5000** in your browser
4. Start studying!

## Deploy to the Web (Free)

### Option 1: Render (Recommended)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) and sign up (free)
3. Click **New → Web Service**
4. Connect your GitHub repo
5. Render auto-detects the `render.yaml` config — just click **Deploy**
6. Your app will be live at `https://your-app-name.onrender.com`

### Option 2: Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and sign up (free)
3. Click **New Project → Deploy from GitHub**
4. Select your repo
5. Railway auto-detects Python — click **Deploy**
6. Your app will be live at `https://your-app-name.up.railway.app`

> **Note:** Free hosting tiers reset the database on redeploy. Your study progress is preserved between sessions but lost if the service redeploys. For permanent progress, use the local version.

## What This Is

Built from real ACET Practice Test mistakes. The system:

- Identifies your weakest concepts from practice test errors
- Teaches the concept behind each mistake
- Generates practice questions to test your understanding
- Tracks mastery over time
- Recommends what to study next

## Data Sources

- **`[Original ACET]`** — Verbatim questions from the ACET Practice Test Booklet (immutable)
- **`[Practice - Verified]`** — Programmatically generated with verified answers
- **`[Practice - Curated]`** — Manually entered with confirmed answers
- **`[Practice - AI Draft]`** — Optional; requires local AI (Ollama); must be verified before use

## Project Structure

```
acet-study/
├── start.bat              ← Launch script (Windows)
├── requirements.txt       ← Python dependencies
├── render.yaml            ← Render.com deployment config
├── src/
│   ├── server.py          ← Flask server (API + static files)
│   ├── database.py        ← SQLite schema + all DB operations
│   ├── question_engine.py ← Template question generation (math)
│   └── study_logic.py     ← Study priority + answer checking
├── static/
│   ├── index.html         ← SPA shell
│   ├── css/style.css      ← Woblo-inspired dark theme
│   ├── js/
│   │   ├── app.js         ← App initialization
│   │   ├── api.js         ← HTTP calls to backend
│   │   └── pages.js       ← All screen rendering + study flow
│   └── img/               ← PDF page images for figure questions
├── data/
│   ├── mistakes.json      ← Your ACET mistakes (replace with yours)
│   └── database.db        ← Auto-created on first run (gitignored)
└── templates/             ← Concept explanation files (.txt)
```

## Adding Your Real Data

Replace `data/mistakes.json` with your own file in this format:

```json
{
  "demo": false,
  "mistakes": [
    {
      "original_id": "P1-Q7",
      "section": "Math",
      "question_text": "Verbatim from your ACET booklet",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "C",
      "concept": "ratios",
      "your_answer": "A",
      "date_recorded": "2026-09-21"
    }
  ]
}
```

## Tech Stack

- **Backend:** Python 3.10+ / Flask
- **Database:** SQLite (local file)
- **Frontend:** Vanilla HTML/CSS/JS (no framework)
- **Design:** Woblo-inspired dark theme with glass morphism

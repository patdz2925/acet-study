# ACET Adaptive Study System

A local-first study tool built from your ACET Practice Test Booklet mistakes. No internet required. No accounts. No payments.

---

## Quick Start (Local)

### Method 1: Desktop Shortcut (Easiest)
1. Double-click `create_desktop_shortcut.bat` once.
2. A shortcut named **"ACET Study System"** will appear on your Windows Desktop.
3. Double-clicking it automatically launches the server and opens your browser directly to `http://localhost:5000`!

### Method 2: Standard Launch
1. Double-click `start.bat`.
2. Your default web browser will automatically open to **http://localhost:5000**.
3. Start studying!

*(Optional: If you want to launch the local server silently in the background without keeping a command prompt window open, double-click `launch_silent.vbs`)*.

---

## Deploy to the Web (Free & Accessible Everywhere)

Once deployed to the web, you can study from your phone, tablet, or laptop anytime without needing your computer running or opening `.bat` files.

### Option 1: Render.com (Recommended)

Render provides free cloud hosting. We provide root entry points (`app.py`, `wsgi.py`, `Procfile`, and `render.yaml`) configured for Gunicorn.

**Method A: Deploy as a Blueprint (Automatic configuration)**
1. Push your updated repository to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Select your `acet-study` repository.
5. Render will read `render.yaml` and set up the build and start commands automatically.
6. Click **Apply**. Your app will be live at `https://your-app-name.onrender.com`.

**Method B: Deploy as a Web Service (Manual)**
1. Push your repository to GitHub.
2. In Render dashboard, click **New +** → **Web Service**.
3. Select your repository.
4. Fill in these exact settings:
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - *(Optional)* Add Environment Variable: `PYTHON_VERSION` = `3.11.0`
5. Click **Create Web Service**.

> **Why Render previously showed "No open ports detected":**
> Render defaults manual web services to looking for `app.py` in the root and binding to `0.0.0.0:$PORT`. With the new `app.py`, `wsgi.py`, `Procfile`, and updated Gunicorn bind flags, Render detects the open port immediately without timeout errors.

---

### Option 2: PythonAnywhere (100% Free with Permanent Persistent SQLite)

If you want a free web host where the SQLite database **never resets** upon redeployment:

1. Sign up for a free account at [pythonanywhere.com](https://www.pythonanywhere.com) (gives you `yourusername.pythonanywhere.com`).
2. Go to the **Consoles** tab and open a **Bash** console.
3. Clone your repository:
   ```bash
   git clone https://github.com/your-username/acet-study.git
   cd acet-study
   pip install --user -r requirements.txt
   ```
4. Go to the **Web** tab in PythonAnywhere dashboard:
   - Click **Add a new web app** → choose **Manual configuration** → **Python 3.10** (or 3.11).
   - Under **Code**:
     - **Source code**: `/home/yourusername/acet-study`
     - **Working directory**: `/home/yourusername/acet-study`
   - Under **WSGI configuration file**, click the link to edit it. Replace the entire content with:
     ```python
     import sys
     import os

     project_home = '/home/yourusername/acet-study'
     if project_home not in sys.path:
         sys.path.insert(0, project_home)
     src_dir = os.path.join(project_home, 'src')
     if src_dir not in sys.path:
         sys.path.insert(0, src_dir)

     from server import app as application
     ```
   - Save the WSGI file.
5. Click the green **Reload yourusername.pythonanywhere.com** button.
6. Done! Your app is live with **permanent SQLite storage**.

---

## How Study Progress & Persistence Works

- **Auto-Seeding on Launch**: On any clean deployment (like Render or fresh git clones), the database automatically seeds all 101 booklet questions and 74 concepts from `data/mistakes.json`. The app is never blank.
- **Client-Side Persistence (Local-First)**: Every study session and practice attempt is saved in your browser's local storage (`localStorage`).
- **Auto-Recovery**: If Render spins down or resets its temporary database, the frontend detects the reset on page load and automatically syncs your local study history back to the server!
- **One-Click Backup & Restore**:
  - In the **Import Data** tab under **Study Progress & Backup**, you can click **Export Backup (JSON)** to download your complete study history.
  - On any new device or phone, click **Restore Backup (JSON)** to restore your progress instantly.

---

## What This System Does

Built from real ACET Practice Test mistakes:
- Identifies your weakest concepts from practice test errors (most mistakes ranked first).
- Teaches the concept behind each mistake with 74 comprehensive explanation guides across all 5 sections.
- Generates 3 practice questions per concept (verified template-based for math, booklet fallback for others).
- Tracks mastery and accuracy over time.
- Recommends what concept to study next based on your priority score.

---

## Project Structure

```
acet-study/
├── app.py                     ← Root application entry point (Render / Railway)
├── wsgi.py                    ← Root WSGI entry point (Gunicorn / PythonAnywhere)
├── Procfile                   ← Gunicorn start command declaration
├── start.bat                  ← Windows quick-launcher (auto-opens browser)
├── create_desktop_shortcut.bat← Creates a 1-click Windows Desktop shortcut
├── launch_silent.vbs          ← Runs local server invisibly in background
├── requirements.txt           ← Dependencies (flask, gunicorn)
├── render.yaml                ← Render.com deployment config
├── src/
│   ├── server.py              ← Flask server (API, auto-seed, health, sync)
│   ├── database.py            ← SQLite schema + queries
│   ├── question_engine.py     ← Template question generation
│   └── study_logic.py         ← Study priority, recommendation, scoring
├── static/
│   ├── index.html             ← Single-page application shell
│   ├── css/style.css          ← Dark glass morphism theme
│   └── js/
│       ├── app.js             ← App initialization
│       ├── api.js             ← Backend HTTP client
│       └── pages.js           ← Screen rendering, local-first sync & backup
├── data/
│   ├── mistakes.json          ← 101 ACET mistakes across 74 concepts
│   ├── curated_questions.json ← Additional practice questions
│   └── database.db            ← Auto-seeded SQLite database
└── templates/                 ← 74 concept explanation files (.txt)
```

---

## Tech Stack

- **Backend:** Python 3.10+ / Flask / Gunicorn
- **Database:** SQLite (local-first with browser localStorage sync)
- **Frontend:** Vanilla HTML/CSS/JS (no framework, zero build step)
- **Design:** Woblo-inspired dark theme with glass morphism

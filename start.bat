@echo off
cd /d "%~dp0"

echo ===================================================
echo   ACET Adaptive Study System
echo   Launching local server and opening browser...
echo ===================================================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

REM Fast check: only install dependencies if flask is missing
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo First-time setup: installing dependencies...
    pip install -r requirements.txt
)

REM Open browser in 1.5 seconds once server starts
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5000"

REM Run the app server
python app.py

if errorlevel 1 (
    echo.
    echo Server stopped with error.
    pause
)

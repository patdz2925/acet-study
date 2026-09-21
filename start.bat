@echo off
cd /d "%~dp0"

echo === ACET Study System ===
echo Starting local server...
echo Open http://localhost:5000 in your browser.
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.10+ from python.org
    pause
    exit /b 1
)

REM Install dependencies if needed
pip install -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo WARNING: Could not install all dependencies. Trying anyway...
)

REM Start the Flask server
python src\server.py

if errorlevel 1 (
    echo.
    echo ERROR: Server failed to start. Check the error messages above.
)

pause

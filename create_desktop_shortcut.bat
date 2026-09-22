@echo off
setlocal
cd /d "%~dp0"

echo Creating Desktop Shortcut for ACET Study System...
echo.

REM Shortcut targets wscript.exe running launch_silent.vbs (no black console window)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [System.Environment]::GetFolderPath('Desktop'); $sc = $ws.CreateShortcut($desktop + '\ACET Study System.lnk'); $sc.TargetPath = 'wscript.exe'; $sc.Arguments = '\"%~dp0launch_silent.vbs\"'; $sc.WorkingDirectory = '%~dp0'; $sc.Description = 'Launch ACET Adaptive Study System'; $sc.IconLocation = 'wscript.exe,0'; $sc.Save()"

if exist "%USERPROFILE%\Desktop\ACET Study System.lnk" (
    echo.
    echo SUCCESS: Desktop shortcut 'ACET Study System' created!
    echo Double-click it anytime - no console window, browser opens automatically.
) else (
    echo.
    echo Could not place shortcut automatically.
    echo Right-click launch_silent.vbs, use Send to, Desktop shortcut.
)

timeout /t 3 >nul

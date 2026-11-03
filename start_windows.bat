@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (set "PY=py -3") else (set "PY=python")
if not exist ".venv\Scripts\python.exe" (
  %PY% -m venv .venv || goto :error
)
call .venv\Scripts\activate.bat
if not exist ".venv\.frame_installed" (
  python -m pip install -r requirements.txt || goto :error
  echo ready> ".venv\.frame_installed"
)
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:8000'"
python server.py
pause
exit /b 0
:error
echo Error: Python 3.11+, FFmpeg, and Deno are required. Check README.md.
pause
exit /b 1


@echo off
title StudyFlow Launcher
cd /d "%~dp0"

echo Starting StudyFlow...

start "StudyFlow Backend" cmd /k "cd /d ""%~dp0"" && .venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

start "StudyFlow Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev -- --host 127.0.0.1"

timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo StudyFlow started. Keep both server windows open.
exit /b 0

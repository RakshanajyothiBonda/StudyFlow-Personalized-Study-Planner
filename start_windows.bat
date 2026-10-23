@echo off
setlocal
title StudyFlow - Personalized Study Planner
cd /d "%~dp0"

echo.
echo  ==========================================
echo     StudyFlow - Personalized Study Planner
echo  ==========================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python was not found. Install Python 3.10+ and enable "Add Python to PATH".
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Install Node.js 20+ and reopen this script.
  pause
  exit /b 1
)

echo [1/4] Preparing Python environment...
if not exist "backend\.venv\Scripts\python.exe" (
  python -m venv backend\.venv
  if errorlevel 1 goto error
)
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
"backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto error

echo [2/4] Installing frontend packages...
cd frontend
if not exist "node_modules" (
  call npm install
  if errorlevel 1 goto error
) else (
  call npm install
  if errorlevel 1 goto error
)
cd ..

echo [3/4] Starting API server...
start "StudyFlow API" cmd /k "cd /d ""%~dp0backend"" && .venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

echo Waiting for API startup...
timeout /t 3 /nobreak >nul

echo [4/4] Starting web app...
start "StudyFlow Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev -- --host 127.0.0.1"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"
echo.
echo StudyFlow is starting. Keep both server windows open.
echo If the page does not open, visit http://localhost:5173
echo.
pause
exit /b 0

:error
echo.
echo Setup failed. Read the error above, check Python/Node installation, and try again.
pause
exit /b 1

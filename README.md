# StudyFlow — Personalized Study Planner

A polished, local-first study planner built with **React + Vite**, **FastAPI**, and **SQLite**.
It includes task planning, subjects, revision tracking, focus sessions, quizzes, progress analytics, and an adaptive study suggestion engine.

## Requirements
- Windows 10/11
- Python 3.10+ (Python 3.11 or 3.12 recommended)
- Node.js 20+ (includes npm)

## Run on Windows
1. Extract the ZIP file.
2. Open the extracted `Personalized_Study_Planner` folder.
3. Double-click **`start_windows.bat`**.
4. The script installs the Python and frontend packages if needed, starts the API and frontend, then opens the app in your browser.

If Windows blocks the script, open PowerShell in this folder and run:
```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start_windows.bat
```

The app uses a local SQLite database (`backend/study_planner.db`) and does not need an account or external API key.

## Manual run
Terminal 1:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```
Terminal 2:
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Features
- Dashboard with today's study plan, completion stats, weekly activity, and subject progress
- Create, complete, and delete study tasks
- Subjects with exam dates and confidence levels
- Quiz scores and performance history
- Adaptive recommendations: subjects with lower confidence or quiz performance receive more suggested study time
- Focus timer with session logging
- Data persists locally in SQLite

## Troubleshooting
- If `python` is not recognized, install Python and enable **Add Python to PATH**.
- If `npm` is not recognized, install Node.js LTS, then reopen the terminal.
- Keep both terminal windows open while using the app.
- To reset sample data, stop the server and delete `backend/study_planner.db`; the app recreates it on next launch.

This is a learning/portfolio project. The adaptive scheduler is a transparent rule-based recommendation engine, not a medical or guaranteed exam-performance prediction.

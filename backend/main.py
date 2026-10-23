from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime, timedelta
import sqlite3, os, random

DB_PATH = os.path.join(os.path.dirname(__file__), "study_planner.db")
app = FastAPI(title="StudyFlow API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    with connect() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#7868e6',
            exam_date TEXT,
            confidence INTEGER NOT NULL DEFAULT 3,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject_id INTEGER,
            due_date TEXT NOT NULL,
            duration INTEGER NOT NULL DEFAULT 30,
            priority TEXT NOT NULL DEFAULT 'Medium',
            completed INTEGER NOT NULL DEFAULT 0,
            task_type TEXT NOT NULL DEFAULT 'Study',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS quiz_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            taken_on TEXT NOT NULL DEFAULT CURRENT_DATE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS focus_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER,
            minutes INTEGER NOT NULL,
            completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
        );
        """)
        count = c.execute("SELECT COUNT(*) FROM subjects").fetchone()[0]
        if count == 0:
            today = date.today()
            subjects = [
                ("Python Programming", "#7868e6", (today + timedelta(days=18)).isoformat(), 3),
                ("Database Management", "#f49b65", (today + timedelta(days=24)).isoformat(), 2),
                ("Web Technologies", "#42b8a5", (today + timedelta(days=30)).isoformat(), 4),
                ("Computer Networks", "#e879a9", (today + timedelta(days=35)).isoformat(), 2),
            ]
            c.executemany("INSERT INTO subjects(name,color,exam_date,confidence) VALUES(?,?,?,?)", subjects)
            ids = [r[0] for r in c.execute("SELECT id FROM subjects ORDER BY id").fetchall()]
            samples = [
                ("Revise Python functions", ids[0], today.isoformat(), 35, "High", 0, "Revision"),
                ("Practice SQL joins", ids[1], today.isoformat(), 40, "High", 0, "Practice"),
                ("Review React component basics", ids[2], today.isoformat(), 30, "Medium", 1, "Study"),
                ("Make flashcards for OSI layers", ids[3], (today + timedelta(days=1)).isoformat(), 25, "Medium", 0, "Revision"),
                ("Solve Python list exercises", ids[0], (today + timedelta(days=1)).isoformat(), 45, "Medium", 0, "Practice"),
                ("Take a SQL mini quiz", ids[1], (today + timedelta(days=2)).isoformat(), 20, "High", 0, "Quiz"),
            ]
            c.executemany("INSERT INTO tasks(title,subject_id,due_date,duration,priority,completed,task_type) VALUES(?,?,?,?,?,?,?)", samples)
            for sid, scores in zip(ids, [[7,8,6],[5,6,6],[8,9],[4,5,6]]):
                c.executemany("INSERT INTO quiz_scores(subject_id,score,total,taken_on) VALUES(?,?,10,?)",
                              [(sid, s, (today-timedelta(days=len(scores)-i)).isoformat()) for i,s in enumerate(scores)])
init_db()

class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = "#7868e6"
    exam_date: Optional[str] = None
    confidence: int = Field(default=3, ge=1, le=5)

class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    subject_id: Optional[int] = None
    due_date: str
    duration: int = Field(default=30, ge=5, le=300)
    priority: str = "Medium"
    task_type: str = "Study"

class QuizIn(BaseModel):
    subject_id: int
    score: int = Field(ge=0)
    total: int = Field(ge=1)

class FocusIn(BaseModel):
    subject_id: Optional[int] = None
    minutes: int = Field(ge=1, le=240)

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "StudyFlow"}

@app.get("/api/subjects")
def get_subjects():
    with connect() as c:
        rows = c.execute("""
        SELECT s.*,
          (SELECT COUNT(*) FROM tasks t WHERE t.subject_id=s.id) AS task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.subject_id=s.id AND t.completed=1) AS completed_count,
          (SELECT ROUND(AVG(score * 100.0 / total),0) FROM quiz_scores q WHERE q.subject_id=s.id) AS quiz_average
        FROM subjects s ORDER BY s.id
        """).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/subjects")
def add_subject(item: SubjectIn):
    with connect() as c:
        try:
            cur = c.execute("INSERT INTO subjects(name,color,exam_date,confidence) VALUES(?,?,?,?)",
                            (item.name.strip(), item.color, item.exam_date, item.confidence))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "A subject with this name already exists.")
        return dict(c.execute("SELECT * FROM subjects WHERE id=?", (cur.lastrowid,)).fetchone())

@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: int):
    with connect() as c:
        cur = c.execute("DELETE FROM subjects WHERE id=?", (subject_id,))
        if cur.rowcount == 0: raise HTTPException(404, "Subject not found")
    return {"ok": True}

@app.get("/api/tasks")
def get_tasks():
    with connect() as c:
        rows = c.execute("""SELECT t.*, s.name AS subject_name, s.color AS subject_color
                            FROM tasks t LEFT JOIN subjects s ON s.id=t.subject_id
                            ORDER BY t.completed ASC, t.due_date ASC, t.id DESC""").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/tasks")
def add_task(item: TaskIn):
    try: date.fromisoformat(item.due_date)
    except ValueError: raise HTTPException(400, "Due date must use YYYY-MM-DD format.")
    with connect() as c:
        if item.subject_id is not None and not c.execute("SELECT id FROM subjects WHERE id=?", (item.subject_id,)).fetchone():
            raise HTTPException(404, "Subject not found")
        cur = c.execute("""INSERT INTO tasks(title,subject_id,due_date,duration,priority,task_type)
                           VALUES(?,?,?,?,?,?)""",
                        (item.title.strip(), item.subject_id, item.due_date, item.duration, item.priority, item.task_type))
        row = c.execute("""SELECT t.*, s.name AS subject_name, s.color AS subject_color
                           FROM tasks t LEFT JOIN subjects s ON s.id=t.subject_id WHERE t.id=?""",
                        (cur.lastrowid,)).fetchone()
        return dict(row)

@app.patch("/api/tasks/{task_id}/toggle")
def toggle_task(task_id: int):
    with connect() as c:
        row = c.execute("SELECT completed FROM tasks WHERE id=?", (task_id,)).fetchone()
        if not row: raise HTTPException(404, "Task not found")
        new_value = 0 if row["completed"] else 1
        c.execute("UPDATE tasks SET completed=? WHERE id=?", (new_value, task_id))
        return {"id": task_id, "completed": new_value}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    with connect() as c:
        cur = c.execute("DELETE FROM tasks WHERE id=?", (task_id,))
        if cur.rowcount == 0: raise HTTPException(404, "Task not found")
    return {"ok": True}

@app.post("/api/quizzes")
def add_quiz(item: QuizIn):
    if item.score > item.total: raise HTTPException(400, "Score cannot exceed total.")
    with connect() as c:
        if not c.execute("SELECT id FROM subjects WHERE id=?", (item.subject_id,)).fetchone():
            raise HTTPException(404, "Subject not found")
        c.execute("INSERT INTO quiz_scores(subject_id,score,total) VALUES(?,?,?)",
                  (item.subject_id, item.score, item.total))
    return {"ok": True}

@app.post("/api/focus")
def add_focus(item: FocusIn):
    with connect() as c:
        c.execute("INSERT INTO focus_sessions(subject_id,minutes) VALUES(?,?)", (item.subject_id, item.minutes))
    return {"ok": True}

@app.get("/api/analytics")
def analytics():
    today = date.today()
    week_start = (today - timedelta(days=6)).isoformat()
    with connect() as c:
        total = c.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        completed = c.execute("SELECT COUNT(*) FROM tasks WHERE completed=1").fetchone()[0]
        today_tasks = c.execute("SELECT COUNT(*) FROM tasks WHERE due_date=? AND completed=0", (today.isoformat(),)).fetchone()[0]
        focus = c.execute("SELECT COALESCE(SUM(minutes),0) FROM focus_sessions WHERE date(completed_at)>=?", (week_start,)).fetchone()[0]
        daily = c.execute("""SELECT due_date AS day, SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) AS done,
                             COUNT(*) AS planned FROM tasks WHERE due_date>=? GROUP BY due_date ORDER BY due_date""",
                          (week_start,)).fetchall()
        scores = c.execute("""SELECT q.id,q.score,q.total,q.taken_on,s.name AS subject_name,s.color AS subject_color
                              FROM quiz_scores q LEFT JOIN subjects s ON s.id=q.subject_id ORDER BY q.id DESC LIMIT 8""").fetchall()
        subject_stats = c.execute("""SELECT s.id,s.name,s.color,s.confidence,s.exam_date,
           COUNT(t.id) AS total_tasks,
           SUM(CASE WHEN t.completed=1 THEN 1 ELSE 0 END) AS done_tasks,
           (SELECT ROUND(AVG(score*100.0/total),0) FROM quiz_scores q WHERE q.subject_id=s.id) AS quiz_average
           FROM subjects s LEFT JOIN tasks t ON t.subject_id=s.id GROUP BY s.id ORDER BY s.id""").fetchall()
        all_scores = c.execute("SELECT score,total FROM quiz_scores").fetchall()
    avg_score = round(sum(r["score"] * 100 / r["total"] for r in all_scores)/len(all_scores)) if all_scores else 0
    return {
        "total_tasks": total, "completed_tasks": completed,
        "completion_rate": round(completed*100/total) if total else 0,
        "today_pending": today_tasks, "focus_minutes_week": focus,
        "weekly_activity": [dict(r) for r in daily],
        "recent_quizzes": [dict(r) for r in scores],
        "subject_stats": [dict(r) for r in subject_stats],
        "average_quiz_score": avg_score
    }

@app.get("/api/recommendations")
def recommendations():
    with connect() as c:
        subjects = c.execute("""SELECT s.*,
           (SELECT AVG(score*100.0/total) FROM quiz_scores q WHERE q.subject_id=s.id) AS quiz_average,
           (SELECT COUNT(*) FROM tasks t WHERE t.subject_id=s.id AND t.completed=0) AS pending
           FROM subjects s""").fetchall()
    recs = []
    today = date.today()
    for s in subjects:
        avg = s["quiz_average"]
        confidence = s["confidence"]
        days_left = None
        if s["exam_date"]:
            try: days_left = (date.fromisoformat(s["exam_date"]) - today).days
            except ValueError: pass
        weak = avg is not None and avg < 70
        low_conf = confidence <= 2
        urgent = days_left is not None and 0 <= days_left <= 10
        if weak or low_conf or urgent:
            reasons = []
            if weak: reasons.append(f"quiz average is {round(avg)}%")
            if low_conf: reasons.append("confidence level is low")
            if urgent: reasons.append(f"exam is in {days_left} day(s)")
            minutes = 45 if urgent or weak else 30
            recs.append({"subject_id": s["id"], "subject": s["name"], "color": s["color"],
                         "minutes": minutes, "reason": ", ".join(reasons),
                         "priority": "High" if urgent or weak else "Medium"})
    if not recs:
        for s in subjects[:3]:
            recs.append({"subject_id": s["id"], "subject": s["name"], "color": s["color"],
                         "minutes": 25, "reason": "Keep your learning streak going",
                         "priority": "Low"})
    return sorted(recs, key=lambda x: ({"High":0,"Medium":1,"Low":2}[x["priority"]], -x["minutes"]))

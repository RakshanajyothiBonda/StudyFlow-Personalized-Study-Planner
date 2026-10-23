import React, { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, CalendarDays, BookOpen, ChartNoAxesCombined, Settings, Plus,
  Search, Bell, ChevronDown, Clock3, Flame, Check, Circle, MoreHorizontal,
  ArrowUpRight, Sparkles, Brain, Target, Play, Pause, RotateCcw, X, Trash2,
  GraduationCap, CalendarCheck, TrendingUp, CircleHelp, Menu, RefreshCw
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar
} from 'recharts'

const API = 'http://localhost:8000/api'
const todayISO = () => new Date().toISOString().slice(0,10)
const fmtDate = (value) => {
  if (!value) return 'No exam date'
  const d = new Date(value + 'T00:00:00')
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
}
const weekday = () => new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})
async function request(path, options={}) {
  const response = await fetch(`${API}${path}`, {
    headers: {'Content-Type':'application/json', ...(options.headers||{})}, ...options
  })
  if (!response.ok) {
    let message = 'Something went wrong'
    try { const data = await response.json(); message = data.detail || message } catch {}
    throw new Error(message)
  }
  if (response.status === 204) return null
  return response.json()
}

function App() {
  const [page,setPage] = useState('Overview')
  const [subjects,setSubjects] = useState([])
  const [tasks,setTasks] = useState([])
  const [analytics,setAnalytics] = useState(null)
  const [recommendations,setRecommendations] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [modal,setModal] = useState('')
  const [search,setSearch] = useState('')
  const [toast,setToast] = useState('')
  const [mobileNav,setMobileNav] = useState(false)
  const [taskFilter,setTaskFilter] = useState('All')
  const [focusSeconds,setFocusSeconds] = useState(25*60)
  const [focusRunning,setFocusRunning] = useState(false)
  const [focusSubject,setFocusSubject] = useState('')
  const [taskForm,setTaskForm] = useState({title:'',subject_id:'',due_date:todayISO(),duration:30,priority:'Medium',task_type:'Study'})
  const [subjectForm,setSubjectForm] = useState({name:'',color:'#7868e6',exam_date:'',confidence:3})
  const [quizForm,setQuizForm] = useState({subject_id:'',score:7,total:10})

  async function loadAll() {
    try {
      setError('')
      const [s,t,a,r] = await Promise.all([
        request('/subjects'), request('/tasks'), request('/analytics'), request('/recommendations')
      ])
      setSubjects(s); setTasks(t); setAnalytics(a); setRecommendations(r)
      setFocusSubject(prev => prev || (s[0] ? String(s[0].id) : ''))
    } catch (e) { setError(`${e.message}. Make sure the backend window is running.`) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (!focusRunning) return
    const id = setInterval(() => setFocusSeconds(s => {
      if (s <= 1) { setFocusRunning(false); setToast('Focus session complete — great work!'); return 0 }
      return s-1
    }),1000)
    return () => clearInterval(id)
  },[focusRunning])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''),3000)
    return () => clearTimeout(id)
  },[toast])

  const completed = tasks.filter(t=>t.completed).length
  const pending = tasks.filter(t=>!t.completed)
  const todayTasks = tasks.filter(t=>t.due_date===todayISO())
  const visibleTasks = tasks.filter(t => {
    const matchesSearch = `${t.title} ${t.subject_name||''}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = taskFilter==='All' || (taskFilter==='Completed' ? !!t.completed : !t.completed)
    return matchesSearch && matchesFilter
  })
  const greeting = new Date().getHours()<12?'Good morning':new Date().getHours()<18?'Good afternoon':'Good evening'
  const weekData = useMemo(() => {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const map = new Map((analytics?.weekly_activity||[]).map(d=>[d.day,d]))
    return Array.from({length:7},(_,i)=>{
      const dt = new Date(); dt.setDate(dt.getDate()-6+i)
      const key = dt.toISOString().slice(0,10)
      const row = map.get(key)
      return {day:days[dt.getDay()], completed:row?.done||0, planned:row?.planned||0}
    })
  },[analytics])

  async function doAction(action, success) {
    try { await action(); await loadAll(); setToast(success); return true }
    catch(e) { setToast(e.message); return false }
  }
  async function toggleTask(id) {
    await doAction(()=>request(`/tasks/${id}/toggle`,{method:'PATCH'}),'Task updated')
  }
  async function deleteTask(id) {
    if (!confirm('Delete this study task?')) return
    await doAction(()=>request(`/tasks/${id}`,{method:'DELETE'}),'Task deleted')
  }
  async function saveTask(e) {
    e.preventDefault()
    const payload = {...taskForm, subject_id:taskForm.subject_id?Number(taskForm.subject_id):null, duration:Number(taskForm.duration)}
    const ok = await doAction(()=>request('/tasks',{method:'POST',body:JSON.stringify(payload)}),'Study task added')
    if (ok) { setModal(''); setTaskForm({title:'',subject_id:subjects[0]?.id?String(subjects[0].id):'',due_date:todayISO(),duration:30,priority:'Medium',task_type:'Study'}) }
  }
  async function saveSubject(e) {
    e.preventDefault()
    const ok = await doAction(()=>request('/subjects',{method:'POST',body:JSON.stringify({...subjectForm,confidence:Number(subjectForm.confidence),exam_date:subjectForm.exam_date||null})}),'Subject added')
    if (ok) { setModal(''); setSubjectForm({name:'',color:'#7868e6',exam_date:'',confidence:3}) }
  }
  async function saveQuiz(e) {
    e.preventDefault()
    const ok = await doAction(()=>request('/quizzes',{method:'POST',body:JSON.stringify({...quizForm,subject_id:Number(quizForm.subject_id),score:Number(quizForm.score),total:Number(quizForm.total)})}),'Quiz score saved')
    if (ok) setModal('')
  }
  async function addRecommendedTask(rec) {
    const ok = await doAction(()=>request('/tasks',{method:'POST',body:JSON.stringify({
      title:`Focused revision: ${rec.subject}`,subject_id:rec.subject_id,due_date:todayISO(),
      duration:rec.minutes,priority:rec.priority==='Low'?'Medium':rec.priority,task_type:'Revision'
    })}),`Added ${rec.subject} to today's plan`)
    if(ok) setPage('Tasks')
  }
  async function finishFocus() {
    setFocusRunning(false)
    const minutes = Math.max(1,Math.round((25*60-focusSeconds)/60))
    await doAction(()=>request('/focus',{method:'POST',body:JSON.stringify({subject_id:focusSubject?Number(focusSubject):null,minutes})}),`Logged ${minutes} focus minutes`)
    setFocusSeconds(25*60)
  }

  const nav = [
    {label:'Overview',icon:LayoutDashboard},
    {label:'My schedule',icon:CalendarDays},
    {label:'Subjects',icon:BookOpen},
    {label:'Progress',icon:ChartNoAxesCombined},
  ]
  const activeNav = (label) => { setPage(label); setMobileNav(false) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'mobile-open':''}`}>
      <div className="brand"><div className="brand-mark"><GraduationCap size={23}/></div><span>study<span className="brand-accent">flow</span><small>YOUR LEARNING SPACE</small></span><button className="icon-btn close-mobile" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">
        {nav.map(item=><button key={item.label} className={`nav-item ${page===item.label?'active':''}`} onClick={()=>activeNav(item.label)}><item.icon size={18}/><span>{item.label}</span>{item.label==='My schedule'&&<span className="nav-count">{pending.length}</span>}</button>)}
      </nav>
      <div className="sidebar-divider"/>
      <div className="workspace-label">YOUR TOOLS</div>
      <button className={`nav-item ${page==='Focus room'?'active':''}`} onClick={()=>activeNav('Focus room')}><Target size={18}/><span>Focus room</span></button>
      <button className={`nav-item ${page==='Smart coach'?'active':''}`} onClick={()=>activeNav('Smart coach')}><Sparkles size={18}/><span>Smart study coach</span><span className="new-pill">NEW</span></button>
      <div className="sidebar-bottom">
        <div className="streak-card"><div className="streak-icon"><Flame size={20}/></div><div><strong>Build your streak</strong><p>Small steps, big progress.</p></div><ArrowUpRight size={15}/></div>
        <div className="profile"><div className="avatar">J</div><div className="profile-copy"><strong>Jyothi</strong><span>Student workspace</span></div><MoreHorizontal size={18} className="muted"/></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button>
        <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
        <div className="top-actions"><div className="searchbox"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your study plan..." aria-label="Search"/></div><button className="icon-btn notification" title="Notifications" onClick={()=>setPage('Smart coach')}><Bell size={18}/><i/></button><div className="top-avatar">J</div></div>
      </header>

      {error&&<div className="error-banner"><CircleHelp size={18}/><span>{error}</span><button onClick={loadAll}><RefreshCw size={15}/> Retry</button></div>}
      {loading?<div className="loading-state"><div className="loader"/><h3>Preparing your learning space</h3><p>Loading your subjects and study plan...</p></div>:<>
      {page==='Overview'&&<div className="page-content">
        <section className="welcome-row"><div><div className="eyebrow">{weekday().toUpperCase()} <span className="eyebrow-dot"/> YOUR PERSONAL STUDY SPACE</div><h1>{greeting}, Jyothi <span className="wave">✦</span></h1><p className="subheading">A little progress each day adds up to big results.</p></div><button className="primary-btn" onClick={()=>{setTaskForm(f=>({...f,subject_id:f.subject_id||String(subjects[0]?.id||''),due_date:todayISO()}));setModal('task')}}><Plus size={17}/> Add study task</button></section>
        <section className="hero-card"><div className="hero-copy"><div className="hero-tag"><Sparkles size={14}/> YOUR WEEK, YOUR PACE</div><h2>Make today<br/>count.</h2><p>You've got this. Focus on one thing at a time and let the progress follow.</p><button className="hero-btn" onClick={()=>setPage('My schedule')}>View my schedule <ArrowUpRight size={16}/></button><div className="hero-foot"><span><span className="hero-dot"/> Personalized for you</span><span>✧ One step at a time</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-sun"/><div className="art-card art-card-one"><div className="mini-icon purple"><BookOpen size={16}/></div><div><b>Stay curious</b><small>Learn something new</small></div><Check size={15} className="check-green"/></div><div className="art-card art-card-two"><div className="mini-icon peach"><Target size={16}/></div><div><b>Keep your focus</b><small>25 min deep work</small></div></div><div className="art-book"><BookOpen size={61} strokeWidth={1.2}/></div><div className="art-spark spark-a">✦</div><div className="art-spark spark-b">✧</div><div className="art-leaf">〰</div></div></section>

        <section className="stat-grid">
          <StatCard icon={<CalendarCheck size={18}/>} tone="violet" label="Tasks completed" value={`${completed}/${tasks.length}`} foot={`${analytics?.completion_rate||0}% overall completion`} progress={analytics?.completion_rate||0}/>
          <StatCard icon={<Clock3 size={18}/>} tone="mint" label="Focus this week" value={`${Math.floor((analytics?.focus_minutes_week||0)/60)}h ${(analytics?.focus_minutes_week||0)%60}m`} foot="Logged focus time" />
          <StatCard icon={<Target size={18}/>} tone="peach" label="Up next today" value={todayTasks.filter(t=>!t.completed).length} foot="Tasks on today's plan" />
          <StatCard icon={<TrendingUp size={18}/>} tone="blue" label="Quiz average" value={`${analytics?.average_quiz_score||0}%`} foot="Across recorded quizzes" />
        </section>

        <section className="dashboard-grid">
          <div className="panel activity-panel"><div className="panel-head"><div><h3>Your learning rhythm</h3><p>Keep showing up — it makes a difference.</p></div><span className="select-chip">Last 7 days <ChevronDown size={14}/></span></div><div className="chart-legend"><span><i className="legend-purple"/> Completed</span><span><i className="legend-light"/> Planned</span></div><div className="activity-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekData} margin={{top:10,right:4,left:-22,bottom:0}}><defs><linearGradient id="doneGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8173e8" stopOpacity={.22}/><stop offset="100%" stopColor="#8173e8" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#eeeef5"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#9695a8',fontSize:11}} dy={9}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'#9695a8',fontSize:11}}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid #eeeef5',fontSize:12}}/><Area type="monotone" dataKey="planned" stroke="#d8d4fa" strokeWidth={2} fill="#f1efff" name="Planned"/><Area type="monotone" dataKey="completed" stroke="#8173e8" strokeWidth={2.5} fill="url(#doneGradient)" name="Completed"/></AreaChart></ResponsiveContainer></div></div>
          <div className="panel focus-panel"><div className="panel-head"><div><h3>Focus corner</h3><p>A little quiet time goes a long way.</p></div><div className="focus-head-icon"><Target size={18}/></div></div><div className="timer-wrap"><div className="timer-ring"><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="76" className="timer-track"/><circle cx="90" cy="90" r="76" className="timer-progress" strokeDasharray={`${(focusSeconds/(25*60))*477.5} 477.5`}/></svg><div className="timer-center"><strong>{String(Math.floor(focusSeconds/60)).padStart(2,'0')}:{String(focusSeconds%60).padStart(2,'0')}</strong><span>FOCUS SESSION</span></div></div></div><div className="focus-controls"><button className="timer-main-btn" onClick={()=>{if(focusSeconds===0)setFocusSeconds(25*60);setFocusRunning(!focusRunning)}}>{focusRunning?<Pause size={16}/>:<Play size={16} fill="currentColor"/>}{focusRunning?'Pause focus':focusSeconds===0?'Start again':'Start focusing'}</button><button className="timer-reset" title="Reset timer" onClick={()=>{setFocusRunning(false);setFocusSeconds(25*60)}}><RotateCcw size={16}/></button></div><div className="focus-note"><span className="tiny-spark">✦</span> Try one task, then take a small break.</div></div>
        </section>

        <section className="bottom-grid"><div className="panel tasks-panel"><div className="panel-head"><div><h3>Today's study plan</h3><p>{todayTasks.filter(t=>t.completed).length} of {todayTasks.length} tasks completed today</p></div><button className="text-link" onClick={()=>setPage('My schedule')}>View all <ArrowUpRight size={14}/></button></div><div className="task-list">{todayTasks.length===0?<EmptyState title="A fresh page" text="Add a task to make a plan for today." action={()=>setModal('task')}/>:todayTasks.slice(0,4).map(task=><TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask}/>)}</div><button className="add-task-line" onClick={()=>{setTaskForm(f=>({...f,due_date:todayISO(),subject_id:f.subject_id||String(subjects[0]?.id||'')}));setModal('task')}}><Plus size={16}/> Add another task</button></div>
          <div className="panel coach-panel"><div className="coach-heading"><div className="coach-spark"><Sparkles size={18}/></div><div><h3>Your smart study coach</h3><p>Small suggestions, tailored to you.</p></div></div><div className="coach-highlight"><div className="coach-badge"><Brain size={16}/></div><div><strong>A plan that adapts with you</strong><p>We look at your quiz scores, confidence, and exam dates to help you decide what to study next.</p></div></div><div className="recommendation-list">{recommendations.slice(0,2).map(rec=><div className="recommendation" key={rec.subject_id}><span className="rec-dot" style={{background:rec.color}}/><div className="rec-main"><strong>{rec.subject}</strong><small>{rec.reason}</small></div><button className="rec-add" onClick={()=>addRecommendedTask(rec)} title="Add revision task"><Plus size={16}/></button></div>)}</div><button className="coach-link" onClick={()=>setPage('Smart coach')}>See my recommendations <ArrowUpRight size={15}/></button></div></section>
      </div>}

      {page==='My schedule'&&<div className="page-content inner-page"><PageHeading eyebrow="YOUR PLAN" title="My schedule" subtitle="Turn your study goals into small, doable steps." action={<button className="primary-btn" onClick={()=>setModal('task')}><Plus size={17}/> Add study task</button>}/><div className="schedule-summary"><div><span className="summary-icon"><CalendarDays size={19}/></span><div><strong>{pending.length} tasks to go</strong><p>You've already completed {completed} tasks. Keep going!</p></div></div><div className="filter-pills">{['All','Pending','Completed'].map(f=><button key={f} onClick={()=>setTaskFilter(f)} className={taskFilter===f?'selected':''}>{f}</button>)}</div></div><div className="panel full-panel"><div className="panel-head"><div><h3>All study tasks</h3><p>Search and manage your learning plan.</p></div><span className="count-pill">{visibleTasks.length} tasks</span></div><div className="task-list large-task-list">{visibleTasks.map(task=><TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask}/>)}</div>{visibleTasks.length===0&&<EmptyState title="Nothing here yet" text="Add a study task or try a different filter." action={()=>setModal('task')}/>}</div></div>}

      {page==='Subjects'&&<div className="page-content inner-page"><PageHeading eyebrow="YOUR LEARNING LIBRARY" title="My subjects" subtitle="Know your subjects, track your confidence, and stay ready for exam day." action={<button className="primary-btn" onClick={()=>setModal('subject')}><Plus size={17}/> Add subject</button>}/><div className="subject-grid">{subjects.map(s=><div className="subject-card" key={s.id}><div className="subject-card-top"><div className="subject-symbol" style={{background:s.color+'1a',color:s.color}}><BookOpen size={21}/></div><button className="icon-btn subtle-btn" title="Delete subject" onClick={async()=>{if(confirm(`Delete ${s.name}? Its tasks will remain without a subject.`)){await doAction(()=>request(`/subjects/${s.id}`,{method:'DELETE'}),'Subject deleted')}}}><Trash2 size={16}/></button></div><h3>{s.name}</h3><p className="exam-line"><CalendarDays size={14}/> Exam {s.exam_date?fmtDate(s.exam_date):'not scheduled'}</p><div className="subject-metrics"><div><span>Confidence</span><strong>{s.confidence}/5</strong></div><div><span>Quiz average</span><strong>{s.quiz_average==null?'—':`${s.quiz_average}%`}</strong></div></div><div className="confidence-track"><span style={{width:`${s.confidence*20}%`,background:s.color}}/></div><div className="subject-card-foot"><span>{s.completed_count||0} of {s.task_count||0} tasks done</span><button onClick={()=>{setQuizForm({subject_id:String(s.id),score:7,total:10});setModal('quiz')}}>Log quiz score <ArrowUpRight size={13}/></button></div></div>)}<button className="add-subject-card" onClick={()=>setModal('subject')}><span><Plus size={22}/></span><strong>Add a subject</strong><small>Make space for a new learning goal</small></button></div><div className="tip-banner"><div className="tip-icon"><Sparkles size={18}/></div><div><strong>Little tip: be honest with your confidence level</strong><p>Your study coach uses it alongside quiz results to recommend where extra revision may help.</p></div></div></div>}

      {page==='Progress'&&<div className="page-content inner-page"><PageHeading eyebrow="YOUR GROWTH" title="Progress & insights" subtitle="Every practice session is a step forward. Here's how you're doing." action={<button className="outline-btn" onClick={()=>setModal('quiz')}><Plus size={16}/> Log quiz result</button>}/><div className="progress-kpis"><StatCard icon={<Check size={18}/>} tone="violet" label="Completion rate" value={`${analytics?.completion_rate||0}%`} foot={`${completed} tasks completed`}/><StatCard icon={<Brain size={18}/>} tone="mint" label="Average quiz score" value={`${analytics?.average_quiz_score||0}%`} foot="Across all recorded quizzes"/><StatCard icon={<Clock3 size={18}/>} tone="peach" label="Focus minutes" value={analytics?.focus_minutes_week||0} foot="This week"/></div><div className="dashboard-grid progress-charts"><div className="panel activity-panel"><div className="panel-head"><div><h3>Study consistency</h3><p>Planned versus completed tasks by day.</p></div></div><div className="activity-chart taller"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekData} margin={{top:10,right:5,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#eeeef5"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#9695a8',fontSize:11}} dy={9}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'#9695a8',fontSize:11}}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid #eeeef5',fontSize:12}}/><Bar dataKey="planned" fill="#dedafb" radius={[5,5,0,0]} name="Planned"/><Bar dataKey="completed" fill="#8173e8" radius={[5,5,0,0]} name="Completed"/></BarChart></ResponsiveContainer></div></div><div className="panel"><div className="panel-head"><div><h3>Subject confidence</h3><p>How ready do you feel?</p></div></div><div className="confidence-list">{subjects.map(s=><div className="confidence-item" key={s.id}><div className="confidence-label"><span><i style={{background:s.color}}/>{s.name}</span><strong>{s.confidence}/5</strong></div><div className="confidence-track"><span style={{width:`${s.confidence*20}%`,background:s.color}}/></div></div>)}</div></div></div><div className="panel full-panel quiz-history"><div className="panel-head"><div><h3>Recent quiz results</h3><p>Use your scores to decide what to revisit.</p></div><button className="text-link" onClick={()=>setModal('quiz')}>Add result <Plus size={14}/></button></div>{(analytics?.recent_quizzes||[]).length===0?<EmptyState title="Your progress starts here" text="Log a quiz score after a practice session." action={()=>setModal('quiz')}/>:<div className="quiz-table"><div className="quiz-table-head"><span>SUBJECT</span><span>DATE</span><span>SCORE</span><span>RESULT</span></div>{analytics.recent_quizzes.map(q=><div className="quiz-table-row" key={q.id}><span><i style={{background:q.subject_color||'#8173e8'}}/>{q.subject_name||'General'}</span><span>{fmtDate(q.taken_on)}</span><span>{q.score}/{q.total}</span><span><b className={q.score/q.total>=.7?'score-good':'score-needs'}>{Math.round(q.score/q.total*100)}%</b></span></div>)}</div>}</div></div>}

      {page==='Focus room'&&<div className="page-content inner-page focus-page"><PageHeading eyebrow="MAKE SOME SPACE" title="Focus room" subtitle="One thing at a time. You don't have to do it all at once."/><div className="focus-room-card"><div className="focus-room-copy"><div className="hero-tag"><Sparkles size={14}/> POMODORO SESSION</div><h2>Give your mind<br/>one thing to do.</h2><p>Choose a subject, set aside a little time, and let the rest wait.</p><label className="field-label">What are you focusing on?</label><select className="field" value={focusSubject} onChange={e=>setFocusSubject(e.target.value)}><option value="">General focus</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="focus-presets"><button onClick={()=>{setFocusRunning(false);setFocusSeconds(15*60)}}>15 min</button><button className="chosen" onClick={()=>{setFocusRunning(false);setFocusSeconds(25*60)}}>25 min</button><button onClick={()=>{setFocusRunning(false);setFocusSeconds(45*60)}}>45 min</button></div><button className="primary-btn" onClick={()=>{if(focusSeconds===0)setFocusSeconds(25*60);setFocusRunning(!focusRunning)}}>{focusRunning?<Pause size={17}/>:<Play size={17} fill="currentColor"/>}{focusRunning?'Pause session':'Start focus session'}</button><button className="outline-btn save-focus" onClick={finishFocus}><Check size={16}/> Finish & log session</button></div><div className="focus-room-clock"><div className="timer-ring big-ring"><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="76" className="timer-track"/><circle cx="90" cy="90" r="76" className="timer-progress" strokeDasharray={`${(focusSeconds/(45*60))*477.5} 477.5`}/></svg><div className="timer-center"><strong>{String(Math.floor(focusSeconds/60)).padStart(2,'0')}:{String(focusSeconds%60).padStart(2,'0')}</strong><span>YOU'VE GOT THIS</span></div></div><div className="focus-quote">“The secret of getting ahead is getting started.”<small>— Mark Twain (attributed)</small></div></div></div></div>}

      {page==='Smart coach'&&<div className="page-content inner-page"><PageHeading eyebrow="A LITTLE GUIDANCE" title="Your smart study coach" subtitle="Practical suggestions based on your confidence, quiz scores, and exam dates."/><div className="coach-intro"><div className="coach-spark large"><Sparkles size={24}/></div><div><h2>Your next best step</h2><p>This transparent recommendation engine gives extra attention to subjects with lower quiz averages, lower confidence, or an approaching exam.</p></div></div><div className="recommendation-cards">{recommendations.map(rec=><div className="recommendation-card" key={rec.subject_id}><div className="rec-card-top"><div className="subject-symbol" style={{background:rec.color+'1a',color:rec.color}}><Brain size={21}/></div><span className={`priority-pill ${rec.priority.toLowerCase()}`}>{rec.priority} priority</span></div><h3>{rec.subject}</h3><p>{rec.reason}</p><div className="rec-duration"><Clock3 size={16}/><strong>{rec.minutes} minutes</strong><span>suggested revision</span></div><button className="primary-btn" onClick={()=>addRecommendedTask(rec)}><Plus size={16}/> Add to today's plan</button></div>)}{recommendations.length===0&&<div className="panel"><p>Add subjects and quiz results to receive tailored study suggestions.</p></div>}</div><div className="tip-banner"><div className="tip-icon"><Brain size={18}/></div><div><strong>How the coach adapts</strong><p>Quiz average below 70%, confidence of 1–2 out of 5, or an exam within 10 days can trigger a higher-priority revision suggestion. This is a transparent rule-based feature you can explain in your project demo.</p></div></div></div>}
      </>}
    </main>

    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('')}}><div className="modal-card"><div className="modal-head"><div><span className="modal-kicker">STUDYFLOW WORKSPACE</span><h2>{modal==='task'?'Add a study task':modal==='subject'?'Add a subject':'Record a quiz result'}</h2></div><button className="icon-btn" onClick={()=>setModal('')}><X size={19}/></button></div>
      {modal==='task'&&<form onSubmit={saveTask} className="modal-form"><label>Task name<input required maxLength="160" autoFocus value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="e.g. Revise SQL joins"/></label><div className="form-two"><label>Subject<select value={taskForm.subject_id} onChange={e=>setTaskForm({...taskForm,subject_id:e.target.value})}><option value="">General study</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Task type<select value={taskForm.task_type} onChange={e=>setTaskForm({...taskForm,task_type:e.target.value})}>{['Study','Revision','Practice','Quiz','Assignment'].map(t=><option key={t}>{t}</option>)}</select></label></div><div className="form-two"><label>Due date<input type="date" required value={taskForm.due_date} onChange={e=>setTaskForm({...taskForm,due_date:e.target.value})}/></label><label>Duration (minutes)<input type="number" min="5" max="300" required value={taskForm.duration} onChange={e=>setTaskForm({...taskForm,duration:e.target.value})}/></label></div><label>Priority<select value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}>{['Low','Medium','High'].map(t=><option key={t}>{t}</option>)}</select></label><div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setModal('')}>Cancel</button><button className="primary-btn" type="submit"><Plus size={16}/> Add task</button></div></form>}
      {modal==='subject'&&<form onSubmit={saveSubject} className="modal-form"><label>Subject name<input required maxLength="80" autoFocus value={subjectForm.name} onChange={e=>setSubjectForm({...subjectForm,name:e.target.value})} placeholder="e.g. Operating Systems"/></label><div className="form-two"><label>Exam date<input type="date" value={subjectForm.exam_date} onChange={e=>setSubjectForm({...subjectForm,exam_date:e.target.value})}/></label><label>Confidence level<select value={subjectForm.confidence} onChange={e=>setSubjectForm({...subjectForm,confidence:e.target.value})}>{[1,2,3,4,5].map(n=><option value={n} key={n}>{n} — {['Need lots of help','Not confident yet','Getting there','Feeling good','Very confident'][n-1]}</option>)}</select></label></div><label>Choose a color<div className="color-picker">{['#7868e6','#f49b65','#42b8a5','#e879a9','#4f91e8','#d5a83c'].map(c=><button type="button" key={c} className={subjectForm.color===c?'selected-color':''} style={{background:c}} onClick={()=>setSubjectForm({...subjectForm,color:c})}/>)}</div></label><div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setModal('')}>Cancel</button><button className="primary-btn" type="submit"><Plus size={16}/> Add subject</button></div></form>}
      {modal==='quiz'&&<form onSubmit={saveQuiz} className="modal-form"><label>Subject<select required value={quizForm.subject_id} onChange={e=>setQuizForm({...quizForm,subject_id:e.target.value})}><option value="">Choose a subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="form-two"><label>Score<input type="number" min="0" required value={quizForm.score} onChange={e=>setQuizForm({...quizForm,score:e.target.value})}/></label><label>Total questions/marks<input type="number" min="1" required value={quizForm.total} onChange={e=>setQuizForm({...quizForm,total:e.target.value})}/></label></div><p className="form-hint">Example: score 8 out of 10. Your coach will use this result in future recommendations.</p><div className="modal-actions"><button type="button" className="outline-btn" onClick={()=>setModal('')}>Cancel</button><button className="primary-btn" type="submit"><Check size={16}/> Save result</button></div></form>}
    </div></div>}
    {toast&&<div className="toast"><span><Check size={16}/></span>{toast}<button onClick={()=>setToast('')}><X size={14}/></button></div>}
  </div>
}

function StatCard({icon,tone,label,value,foot,progress}) {
  return <div className="stat-card"><div className="stat-top"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-more"><MoreHorizontal size={17}/></span></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><div className="stat-foot">{progress!==undefined?<div className="mini-progress"><span style={{width:`${progress}%`}}/></div>:<span className="foot-dot"/>}<span>{foot}</span></div></div>
}
function TaskRow({task,onToggle,onDelete}) {
  return <div className={`task-row ${task.completed?'is-complete':''}`}><button className={`task-check ${task.completed?'checked':''}`} onClick={()=>onToggle(task.id)} aria-label={task.completed?'Mark incomplete':'Mark complete'}>{task.completed?<Check size={14}/>:<span/>}</button><div className="task-main"><strong>{task.title}</strong><div className="task-meta">{task.subject_name&&<span className="task-subject"><i style={{background:task.subject_color||'#8173e8'}}/>{task.subject_name}</span>}<span><Clock3 size={12}/>{task.duration} min</span><span className={`priority-dot ${task.priority.toLowerCase()}`}>{task.priority}</span></div></div><span className="task-due">{task.due_date===todayISO()?'Today':fmtDate(task.due_date)}</span><button className="task-delete" title="Delete task" onClick={()=>onDelete(task.id)}><Trash2 size={15}/></button></div>
}
function PageHeading({eyebrow,title,subtitle,action}) {
  return <section className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="subheading">{subtitle}</p></div>{action&&<div>{action}</div>}</section>
}
function EmptyState({title,text,action}) {
  return <div className="empty-state"><div className="empty-icon"><BookOpen size={22}/></div><strong>{title}</strong><p>{text}</p>{action&&<button className="text-link" onClick={action}><Plus size={14}/> Add one</button>}</div>
}
export default App

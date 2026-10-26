import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, BarChart3, Bell, BookOpen, Building, Camera, Check, CheckCircle2, ChevronRight, CircleHelp, CloudOff, Download, FileCheck2, FileSpreadsheet, FileText, Filter, History, LayoutDashboard, Lock, LockKeyhole, LogOut, Menu, MessageSquare, Pencil, Play, Plus, Printer, RefreshCw, ScanFace, Search, ShieldAlert, ShieldCheck, Sparkles, TrendingUp, Unlock, Upload, UserRound, Users, Wifi, WifiOff, X, Zap } from 'lucide-react'
import * as api from './api'
import { demoClasses, demoRoster, demoSessions, demoStudent, demoTeacher, type AttendanceEntry, type AuditItem, type ClassItem, type Notification, type Report, type ReviewItem, type Session, type StudentAttendance, type User } from './types'
import './styles.css'

type Section = 'overview' | 'sessions' | 'attendance' | 'analysis' | 'notifications' | 'controller-classes' | 'controller-students'
type ConnectionState = 'connecting' | 'connected' | 'closed' | 'error'

const formatDate = (value?: string, withTime = false) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(value)) : '—'
const formatPct = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${Math.round(value)}%`
const statusCopy: Record<string, string> = { present: 'Present', absent: 'Absent', pending: 'Needs review' }

function App() {
  const [user, setUser] = useState<User | null>(api.currentUser())
  const [isLocal, setIsLocal] = useState(api.isLocalMode())
  const [section, setSection] = useState<Section>('overview')
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [notice, setNotice] = useState<string>('')
  const [menuOpen, setMenuOpen] = useState(false)
  const socketClose = useRef<() => void>(() => undefined)
  const socketGeneration = useRef(0)

  const connect = useCallback(async () => {
    if (!user) return () => undefined
    const generation = ++socketGeneration.current
    setConnection('connecting')
    try {
      const ticket = await api.wsTicket()
      if (generation !== socketGeneration.current) return () => undefined
      socketClose.current()
      const close = api.openRealtime(ticket, event => {
        if (generation !== socketGeneration.current) return
        if (event.type === 'notification.created') setNotice('New notification received.')
        window.dispatchEvent(new CustomEvent('rollcall:refresh', { detail: event }))
      }, state => {
        if (generation !== socketGeneration.current) return
        setConnection(state)
        if (state === 'connected') window.dispatchEvent(new CustomEvent('rollcall:refresh', { detail: { type: 'realtime.connected' } }))
      })
      socketClose.current = close
      return close
    } catch { if (generation === socketGeneration.current) setConnection('error'); return () => undefined }
  }, [user])

  useEffect(() => { connect().then(() => undefined); return () => { socketGeneration.current += 1; socketClose.current(); socketClose.current = () => undefined } }, [connect])
  useEffect(() => { if (!user || (connection !== 'closed' && connection !== 'error')) return; const retry = window.setTimeout(() => { connect().then(() => undefined) }, 4000); return () => window.clearTimeout(retry) }, [connection, user, connect])
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(''), 5000); return () => window.clearTimeout(t) }, [notice])

  const handleSignOut = () => { api.signOut(); setUser(null); setIsLocal(false) }
  if (!user) return <Login onLogin={(next, local) => { setUser(next); setIsLocal(local) }} />

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-block"><div className="brand-mark" aria-hidden="true"><span>R</span></div><div><strong>rollcall</strong><small>Campus attendance</small></div></div>
      <div className="workspace-pill"><span className="workspace-dot" /> {api.roleLabel(user.role)}</div>
      <nav aria-label="Primary navigation" className="main-nav">
        {user.role === 'controller' ? <>
          <NavButton active={section === 'controller-classes' || section === 'overview'} icon={<Building size={18} />} label="Classes & Rooms" onClick={() => { setSection('controller-classes'); setMenuOpen(false) }} />
          <NavButton active={section === 'controller-students'} icon={<Users size={18} />} label="Student Roster" onClick={() => { setSection('controller-students'); setMenuOpen(false) }} />
        </> : <>
          <NavButton active={section === 'overview'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => { setSection('overview'); setMenuOpen(false) }} />
          {user.role === 'teacher' ? <>
            <NavButton active={section === 'sessions'} icon={<Zap size={18} />} label="Live sessions" onClick={() => { setSection('sessions'); setMenuOpen(false) }} badge="2" />
            <NavButton active={section === 'attendance'} icon={<History size={18} />} label="Session history" onClick={() => { setSection('attendance'); setMenuOpen(false) }} />
            <NavButton active={section === 'analysis'} icon={<TrendingUp size={18} />} label="Attendance Analytics" onClick={() => { setSection('analysis'); setMenuOpen(false) }} />
          </> : <NavButton active={section === 'attendance'} icon={<CheckCircle2 size={18} />} label="My attendance" onClick={() => { setSection('attendance'); setMenuOpen(false) }} />}
        </>}
        <NavButton active={section === 'notifications'} icon={<Bell size={18} />} label="Notifications" onClick={() => { setSection('notifications'); setMenuOpen(false) }} />
      </nav>
      <div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={16} /><span><b>Private by design</b><br />Biometric templates encrypted. Captures are not retained.</span></div><button className="sidebar-signout" onClick={handleSignOut}><LogOut size={17} /> Sign out</button></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><div className="breadcrumb"><span>Rollcall</span><ChevronRight size={15} /><strong>{section === 'controller-classes' ? 'Classes & Rooms' : section === 'controller-students' ? 'Student Roster' : section === 'overview' ? 'Overview' : section === 'sessions' ? 'Live sessions' : section === 'analysis' ? 'Attendance Analytics & Audits' : section === 'attendance' ? (user.role === 'teacher' ? 'Session history' : 'My attendance') : 'Notifications'}</strong></div><div className="topbar-actions"><ConnectionBadge state={connection} onRetry={() => connect()} /><button className="avatar-button" aria-label={`Signed in as ${user.name}`}><span className="avatar">{initials(user.name)}</span><span className="avatar-name">{user.name}</span></button></div></header>
      <div className="page-wrap">
        {isLocal && <div className="demo-banner"><CloudOff size={17} /><span><strong>Demo mode</strong> — API unavailable, showing local seeded data. Nothing here is sent or stored.</span><button onClick={() => window.location.reload()}><RefreshCw size={14} /> Retry API</button></div>}
        {notice && <div className="toast" role="status"><CheckCircle2 size={17} /> {notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={16} /></button></div>}
        {user.role === 'controller' && (section === 'overview' || section === 'controller-classes') && <ControllerClassesView />}
        {user.role === 'controller' && section === 'controller-students' && <ControllerStudentsView />}
        {user.role !== 'controller' && section === 'overview' && <Overview user={user} onNavigate={setSection} />}
        {section === 'sessions' && user.role === 'teacher' && <TeacherSessions />}
        {section === 'attendance' && user.role !== 'controller' && (user.role === 'teacher' ? <TeacherHistory /> : <StudentAttendanceView />)}
        {section === 'analysis' && user.role === 'teacher' && <TeacherAnalysisView />}
        {section === 'notifications' && <NotificationsView />}
      </div>
    </main>
  </div>
}

function Login({ onLogin }: { onLogin: (user: User, local: boolean) => void }) {
  const [email, setEmail] = useState('teacher@demo.edu'); const [password, setPassword] = useState('teach123'); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(''); try { const result = await api.login(email, password); onLogin(result.user, result.local) } catch { setError('That sign-in did not work. Try one of the demo accounts below.') } finally { setLoading(false) } }
  return <div className="login-page"><div className="login-panel"><div className="brand-block login-brand"><div className="brand-mark"><span>R</span></div><div><strong>rollcall</strong><small>Campus attendance</small></div></div><div className="login-copy"><p className="eyebrow">Campus tool · secure demo</p><h1>Make every class count.</h1><p>Simple attendance workflows for lecturers and students, with a clear audit trail behind every decision.</p></div><form onSubmit={submit} className="login-form"><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <div className="inline-error"><AlertCircle size={16} /> {error}</div>}<button className="primary-button full" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button></form><div className="demo-logins"><span>Quick demo access</span><button onClick={() => { setEmail('controller@demo.edu'); setPassword('control123') }}><ShieldCheck size={14} /> Controller</button><button onClick={() => { setEmail('teacher@demo.edu'); setPassword('teach123') }}><Users size={14} /> Lecturer</button><button onClick={() => { setEmail('student1@demo.edu'); setPassword('student123') }}><UserRound size={14} /> Student</button></div><p className="login-foot"><LockKeyhole size={14} /> Prototype environment · seeded accounts only</p></div><div className="login-aside"><div className="aside-orbit orbit-one" /><div className="aside-orbit orbit-two" /><div className="login-quote"><Sparkles size={20} /><p>“Attendance should be a signal for support, not a source of friction.”</p><small>Built for thoughtful campus teams</small></div><div className="login-points"><div><Check size={15} /> Role-aware workspaces</div><div><Check size={15} /> Explicit review before finalizing</div><div><Check size={15} /> Continuous sweep 9-rule verification</div></div></div></div>
}

function Overview({ user, onNavigate }: { user: User; onNavigate: (s: Section) => void }) {
  return user.role === 'teacher' ? <TeacherOverview user={user} onNavigate={onNavigate} /> : <StudentOverview user={user} onNavigate={onNavigate} />
}
function TeacherOverview({ user, onNavigate }: { user: User; onNavigate: (s: Section) => void }) {
  const [classes, setClasses] = useState<ClassItem[]>([]); const [sessions, setSessions] = useState<Session[]>([]); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const [c, s] = await Promise.all([api.getClasses(), api.getSessions()]); setClasses(c); setSessions(s) } finally { setLoading(false) } }, [])
  useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load])
  const open = sessions.filter(s => s.status === 'open').length
  const displayClasses = classes.length ? classes : api.isLocalMode() ? demoClasses : []
  const displaySessions = sessions.length ? sessions : api.isLocalMode() ? demoSessions : []
  const finalized = sessions.filter(s => s.status === 'finalized').length
  const enrolled = displayClasses.reduce((total, item) => total + (item.student_count || 0), 0)
  return <><PageIntro eyebrow={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())} title={`Good morning, ${user.name.split(' ')[0]}.`} description="Keep your classes moving. Start a timed session, monitor live check-ins, and inspect flagged attempts." action={<button className="primary-button" onClick={() => onNavigate('sessions')}><Play size={16} /> Start a session</button>} /><div className="metric-grid"><Metric icon={<BookOpen />} label="Active classes" value={loading ? '—' : String(displayClasses.length)} detail="This term" tone="teal" /><Metric icon={<Zap />} label="Open sessions" value={String(open)} detail="Needs your attention" tone="amber" /><Metric icon={<CheckCircle2 />} label="Finalized sessions" value={String(finalized)} detail="Recorded sessions" tone="violet" /><Metric icon={<MessageSquare />} label="Enrolled students" value={String(enrolled)} detail="Across listed classes" tone="blue" /></div><div className="section-heading"><div><p className="eyebrow">Your teaching space</p><h2>Classes at a glance</h2></div><button className="text-button" onClick={() => onNavigate('attendance')}>View session history <ArrowRight size={15} /></button></div><div className="class-grid">{displayClasses.map(item => <ClassCard key={item.id} item={item} onStart={() => onNavigate('sessions')} />)}</div><div className="dashboard-lower"><div className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">Recent activity</p><h3>Session history</h3></div><button className="icon-button" onClick={() => onNavigate('attendance')} aria-label="View all sessions"><ArrowRight size={17} /></button></div>{displaySessions.slice(0, 3).map(s => <SessionRow session={s} key={s.id} />)}</div><div className="panel callout-panel"><div className="callout-icon"><CircleHelp size={20} /></div><div><p className="eyebrow">Continuous sweep pipeline</p><h3>Review before you finalize</h3><p>Flagged submissions are routed to your review queue with key-frame filmstrips. You stay in control, and every action is audited.</p><button className="text-button" onClick={() => onNavigate('sessions')}>See the workflow <ArrowRight size={15} /></button></div></div></div></>
}
function StudentOverview({ user, onNavigate }: { user: User; onNavigate: (s: Section) => void }) {
  const [attendance, setAttendance] = useState<StudentAttendance | null>(null); const [notes, setNotes] = useState<Notification[]>([])
  const load = useCallback(async () => { try { const [a, n] = await Promise.all([api.studentAttendance(), api.notifications()]); setAttendance(a); setNotes(n) } catch { /* keep the seeded empty state */ } }, [])
  useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load])
  const summary = attendance?.summary || { present: 0, absent: 0, pending: 0, total_finalized: 0, percentage: null }
  return <><PageIntro eyebrow={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())} title={`Hi, ${user.name.split(' ')[0]}.`} description="Here’s the latest view of your attendance and class updates." action={<button className="secondary-button" onClick={() => onNavigate('notifications')}><Bell size={16} /> {notes.filter(n => !n.read).length} new update</button>} /><div className="student-hero"><div className="attendance-ring" style={{ '--percent': `${summary.percentage ?? 0}%` } as React.CSSProperties}><div><strong>{formatPct(summary.percentage)}</strong><span>attendance</span></div></div><div className="student-hero-copy"><p className="eyebrow">Your term snapshot</p><h2>Showing up adds up.</h2><p>You’ve been present for <strong>{summary.present} of {summary.total_finalized} sessions</strong>. Keep an eye on the class details below for the full picture.</p><button className="text-button" onClick={() => onNavigate('attendance')}>View attendance details <ArrowRight size={15} /></button></div></div><div className="metric-grid student-metrics"><Metric icon={<CheckCircle2 />} label="Present" value={String(summary.present)} detail="Sessions attended" tone="teal" /><Metric icon={<X />} label="Absent" value={String(summary.absent)} detail="Sessions missed" tone="coral" /><Metric icon={<BookOpen />} label="Total sessions" value={String(summary.total_finalized)} detail="This term" tone="violet" /></div><div className="section-heading"><div><p className="eyebrow">Latest record</p><h2>Recent attendance</h2></div><button className="text-button" onClick={() => onNavigate('attendance')}>See all <ArrowRight size={15} /></button></div><div className="panel table-panel"><AttendanceTable entries={(attendance?.entries || []).slice(0, 4).map(e => ({ student_id: e.session_id, student_name: e.class_name || 'Class session', status: e.status, changed_at: e.created_at, updated_at: e.updated_at }))} studentView /></div></>
}

function TeacherSessions() {
  const [classes, setClasses] = useState<ClassItem[]>([]); const [sessions, setSessions] = useState<Session[]>([]); const [active, setActive] = useState<Session | null>(null); const [loading, setLoading] = useState(true)
  const [duration, setDuration] = useState(10); const [customDuration, setCustomDuration] = useState('20'); const [isCustom, setIsCustom] = useState(false)
  const displayClasses = classes.length ? classes : api.isLocalMode() ? demoClasses : []
  const load = useCallback(async () => { setLoading(true); try { setClasses(await api.getClasses()); setSessions(await api.getSessions()) } finally { setLoading(false) } }, [])
  useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load])
  async function start(classId: string) {
    const finalDuration = isCustom ? Math.min(60, Math.max(1, parseInt(customDuration, 10) || 10)) : duration
    const created = await api.startSession(classId, finalDuration)
    setActive({ ...created, class_name: classes.find(c => c.id === classId)?.name || created.class_name })
    setSessions(prev => [created, ...prev])
  }
  return <><PageIntro eyebrow="Lecturer workspace" title="Live sessions" description="Launch timed attendance sessions with continuous sweep verification, monitor live counts, and review flagged attempts." action={<button className="secondary-button" onClick={load}><RefreshCw size={16} /> Refresh</button>} /><div className="workflow-strip"><WorkflowStep number="01" title="Duration" body="Set time limit" active={!active} /><ArrowRight size={17} /><WorkflowStep number="02" title="Sweep" body="Students capture" active={!!active} /><ArrowRight size={17} /><WorkflowStep number="03" title="Review & Finalize" body="Inspect flagged items" active={false} /></div>{active ? <SessionWorkspace session={active} onClose={() => setActive(null)} onFinished={() => { setActive(null); load() }} /> : <div className="session-start-grid"><div className="panel start-panel"><div className="panel-heading"><div><p className="eyebrow">Choose a class & duration</p><h2>Start attendance session</h2></div><div className="session-live-dot">Ready</div></div><p className="muted">Select attendance window length. Server clock strictly enforces the deadline.</p><div className="duration-selector"><span className="muted" style={{ fontWeight: 700, marginRight: 4 }}>Duration:</span>{[5, 10, 15].map(mins => <button key={mins} type="button" className={`duration-chip ${!isCustom && duration === mins ? 'selected' : ''}`} onClick={() => { setDuration(mins); setIsCustom(false) }}>{mins} min</button>)}<button type="button" className={`duration-chip ${isCustom ? 'selected' : ''}`} onClick={() => setIsCustom(true)}>Custom</button>{isCustom && <input type="number" min="1" max="60" value={customDuration} onChange={e => setCustomDuration(e.target.value)} className="duration-custom-input" placeholder="min" />}</div><div className="class-list">{!displayClasses.length && <p className="muted">No classes are available for this account.</p>}{displayClasses.map(c => <div className="class-list-row" key={c.id}><div className="class-avatar">{c.code?.slice(0, 2) || 'CL'}</div><div className="class-list-copy"><strong>{c.name}</strong><span>{c.code} · {c.schedule || 'Schedule flexible'} · {c.student_count || 0} students</span></div><button className="primary-button small" onClick={() => start(c.id)}><Play size={14} /> Start</button></div>)}</div></div><div className="panel info-panel"><div className="soft-icon teal"><ShieldCheck size={21} /></div><p className="eyebrow">9-Rule Continuous Sweep Pipeline</p><h3>Continuous 180° Sweep Verification</h3><p>Students capture a single smooth sweep from front-camera selfie across neighbors towards the lecturer stage. The backend verifies blur, monotonic gyroscope heading, selfie match, neighbor presence, and lecturer visibility (IPD ≥ 30px).</p><div className="disclosure"><LockKeyhole size={15} /><span>Zero-knowledge storage: ephemeral raw frames purged immediately. Only filmstrip key frames for FLAGGED attempts retained for review.</span></div></div></div>}</>
}

function SessionWorkspace({ session, onClose, onFinished }: { session: Session; onClose: () => void; onFinished: () => void }) {
  const [detail, setDetail] = useState<Session>(session)
  const [roster, setRoster] = useState<AttendanceEntry[]>(session.attendance || [])
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [finalized, setFinalized] = useState(session.status === 'finalized')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const [refModalOpen, setRefModalOpen] = useState(false)
  const [refPhoto, setRefPhoto] = useState<string | null>(null)
  const [savingRef, setSavingRef] = useState(false)

  const load = useCallback(async () => {
    try {
      const [currentRoster, reviewQueue, auditList] = await Promise.all([
        api.getRoster(session.id),
        api.getReviewQueue(session.id),
        api.audit(session.id),
      ])
      setDetail(currentRoster)
      setRoster(currentRoster.attendance || [])
      setReviewItems(reviewQueue)
      setAuditItems(auditList)
      setFinalized(currentRoster.status === 'finalized')
    } catch {
      // keep offline state visible
    }
  }, [session.id])

  useEffect(() => {
    load()
    const fn = () => load()
    window.addEventListener('rollcall:refresh', fn)
    return () => window.removeEventListener('rollcall:refresh', fn)
  }, [load])

  useEffect(() => {
    if (!detail.ends_at || finalized) return
    let activeTimer = true
    const checkTimer = () => {
      const endsAt = new Date(detail.ends_at!).getTime()
      const now = Date.now()
      const diff = Math.floor((endsAt - now) / 1000)
      if (activeTimer) setRemainingSec(diff)
    }
    checkTimer()
    const interval = window.setInterval(checkTimer, 1000)
    return () => { activeTimer = false; window.clearInterval(interval) }
  }, [detail.ends_at, finalized])

  const isClosed = (remainingSec !== null && remainingSec <= 0) || detail.status === 'closed' || finalized

  async function update(studentId: string, status: AttendanceEntry['status'], note?: string) {
    setRoster(prev => prev.map(row => row.student_id === studentId ? { ...row, status, note } : row))
    try {
      await api.patchAttendance(session.id, studentId, status, note)
      load()
    } catch {
      setError('Could not save that edit. Please retry.')
    }
  }

  async function handleReview(item: ReviewItem, decision: 'verified' | 'rejected') {
    setBusy(true)
    setError('')
    try {
      const note = reviewNotes[item.id] || (decision === 'verified' ? 'Lecturer accepted from review queue' : 'Lecturer rejected attempt')
      await api.submitReviewDecision(session.id, item.attempt_id ?? item.id, decision, note)
      await load()
    } catch {
      setError('Could not submit review decision. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  async function finalizeSession() {
    if (!window.confirm('Finalize this session? Remaining pending students will be marked absent and records will be published.')) return
    setBusy(true)
    try {
      await api.finalize(session.id)
      setRoster(prev => prev.map(r => r.status === 'pending' ? { ...r, status: 'absent' } : r))
      setFinalized(true)
      await load()
    } catch {
      setError('Could not finalize the session. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  const presentCount = roster.filter(r => r.status === 'present').length
  const pendingCount = roster.filter(r => r.status === 'pending').length
  const absentCount = roster.filter(r => r.status === 'absent').length
  const totalStudents = roster.length

  const countdownText = remainingSec === null
    ? '—'
    : remainingSec <= 0
      ? 'Window Closed'
      : `${Math.floor(remainingSec / 60).toString().padStart(2, '0')}:${((remainingSec % 60 + 60) % 60).toString().padStart(2, '0')}`

  return (
    <div className="workspace">
      <div className="workspace-header">
        <div>
          <button className="back-button" onClick={onClose}>← All sessions</button>
          <p className="eyebrow">Session · {formatDate(detail.started_at, true)}</p>
          <h2>{detail.class_name || 'Class attendance'}</h2>
          <span className="session-id">{detail.id}</span>
        </div>
        <div className="workspace-actions">
          <button
            className="secondary-button"
            onClick={() => { setRefModalOpen(true); setRefPhoto(detail.room_photo?.startsWith('data:') ? detail.room_photo : null) }}
            title="Establish or update classroom reference photo for this session"
          >
            <Camera size={15} /> {detail.room_photo ? 'Update Classroom Ref' : 'Establish Classroom Ref'}
          </button>
          <button className="secondary-button excel-btn" onClick={() => window.open(api.getExcelExportUrl(detail.id), '_blank')} title="Download colored analysis spreadsheet">
            <FileSpreadsheet size={15} /> Export Excel (.xlsx)
          </button>
          <span className={`countdown-tag ${isClosed ? 'expired' : ''}`}>
            {isClosed ? 'Window Closed' : `Window: ${countdownText}`}
          </span>
          <span className={`status-chip ${finalized ? 'status-present' : isClosed ? 'status-absent' : 'status-pending'}`}>
            <span className="chip-dot" /> {finalized ? 'Finalized' : isClosed ? 'Closed' : 'Open'}
          </span>
          {!finalized && (
            <button className="primary-button" onClick={finalizeSession} disabled={busy}>
              <FileCheck2 size={16} /> Finalize session
            </button>
          )}
        </div>
      </div>

      {error && <div className="inline-error"><AlertCircle size={16} /> {error}</div>}

      <div className="headline-stat-bar">
        <div className="headline-stat">
          <strong>{presentCount}</strong>
          <span>Present (Verified)</span>
        </div>
        <div className="headline-stat">
          <strong style={{ color: '#c77c13' }}>{reviewItems.length}</strong>
          <span>Needs Review (Flagged)</span>
        </div>
        <div className="headline-stat">
          <strong style={{ color: '#b44d45' }}>{absentCount}</strong>
          <span>Absent</span>
        </div>
        <div className="headline-stat">
          <strong>{totalStudents}</strong>
          <span>Total Enrolled</span>
        </div>
      </div>

      <div className="workspace-grid">
        <div className="panel review-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Lecturer Review Queue</p>
              <h3>Flagged Attempts ({reviewItems.length})</h3>
            </div>
            <span className="safe-tag"><ShieldCheck size={14} /> Filmstrip Key Frames</span>
          </div>
          <p className="muted">Attempts flagged due to low optical resolution at distance or neighbor presence. Inspect filmstrip and accept or reject.</p>

          {reviewItems.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 />}
              title="Review queue empty"
              body="No submissions currently require manual review. Verified attempts are already recorded as present."
            />
          ) : (
            reviewItems.map(item => (
              <div className="review-card flagged" key={item.id}>
                <div className="review-card-header">
                  <div>
                    <strong>{item.student_name}</strong>
                    <div className="muted">{item.student_email || item.student_id}</div>
                  </div>
                  <span className="status-chip status-pending">Flagged</span>
                </div>

                <div className="reason-tags">
                  {item.reason_codes.map((rc, idx) => (
                    <span className="reason-tag" key={idx}>
                      {rc.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                {item.filmstrip_urls.length > 0 && (
                  <div className="filmstrip-strip">
                    {item.filmstrip_urls.map((url, fIdx) => (
                      <img
                        key={fIdx}
                        src={url}
                        alt={`Key frame ${fIdx + 1}`}
                        className="filmstrip-thumb"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="review-actions">
                  <input
                    type="text"
                    placeholder="Decision note (optional)"
                    className="review-note-input"
                    value={reviewNotes[item.id] || ''}
                    onChange={e => setReviewNotes({ ...reviewNotes, [item.id]: e.target.value })}
                    disabled={busy || finalized}
                  />
                  <button
                    className="primary-button small"
                    disabled={busy || finalized}
                    onClick={() => handleReview(item, 'verified')}
                  >
                    <Check size={13} /> Accept
                  </button>
                  <button
                    className="secondary-button small"
                    style={{ color: '#b44d45' }}
                    disabled={busy || finalized}
                    onClick={() => handleReview(item, 'rejected')}
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="panel roster-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Manual Roll-Call Roster</p>
              <h3>{roster.length} Students</h3>
            </div>
            <span className="muted">{pendingCount} pending</span>
          </div>
          <p className="muted">Lecturer manual override route. Tap Present, Absent, or Note to manually adjust any student.</p>
          <AttendanceTable entries={roster} onUpdate={update} disabled={finalized} />
        </div>
      </div>

      <div className="workspace-lower">
        <AuditLog items={auditItems} />
        <div className="panel guidance-panel">
          <div className="soft-icon teal"><CheckCircle2 size={20} /></div>
          <h3>Session Verification Policies</h3>
          <ul>
            <li>Submissions allowed only while session window is open (+5s server grace).</li>
            <li>All verified sweeps are automatically marked Present.</li>
            <li>Lecturer check flags at distance (IPD &lt; 30px) for visual confirmation.</li>
            <li>Finalizing marks remaining pending students absent and locks the session.</li>
          </ul>
        </div>
      </div>

      {refModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>Establish Session Classroom Reference</h3>
              <button onClick={() => setRefModalOpen(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 16px' }}>
              Establish the reference classroom panorama for <strong>{detail.class_name}</strong>. Student check-in panoramas will be verified against this stage and room context.
            </p>

            {refPhoto ? (
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <img src={refPhoto} alt="Session Reference" style={{ width: '100%', borderRadius: 8, maxHeight: 240, objectFit: 'cover' }} />
                <button
                  type="button"
                  className="secondary-button small"
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                  onClick={() => setRefPhoto(null)}
                >
                  Retake
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <label className="upload-dropzone" style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 8,
                  padding: 24,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--surface-subtle)',
                }}>
                  <Camera size={28} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>Click to select reference image</p>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>JPEG or PNG panorama photo of the lecture hall</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = () => setRefPhoto(reader.result as string)
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="secondary-button" onClick={() => setRefModalOpen(false)}>Cancel</button>
              <button
                className="primary-button"
                disabled={!refPhoto || savingRef}
                onClick={async () => {
                  if (!refPhoto) return
                  setSavingRef(true)
                  try {
                    await api.setSessionReference(session.id, { photo_base64: refPhoto })
                    setRefModalOpen(false)
                    setDetail(prev => ({ ...prev, room_photo: refPhoto }))
                    load()
                  } catch {
                    alert('Could not set session reference. Please try again.')
                  } finally {
                    setSavingRef(false)
                  }
                }}
              >
                {savingRef ? 'Saving...' : 'Establish Reference'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeacherHistory() { const [sessions, setSessions] = useState<Session[]>([]); const [selected, setSelected] = useState<Session | null>(null); const load = useCallback(() => { api.getSessions().then(setSessions).catch(() => undefined) }, []); const displaySessions = sessions.length ? sessions : api.isLocalMode() ? demoSessions : []; useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load]); return <><PageIntro eyebrow="Lecturer workspace" title="Session history" description="A clear, auditable record of every class session." action={<button className="secondary-button" onClick={() => api.getSessions().then(setSessions)}><RefreshCw size={16} /> Refresh</button>} /><div className="panel table-panel history-table"><div className="table-toolbar"><div><p className="eyebrow">All sessions</p><h3>{displaySessions.length} recorded sessions</h3></div><span className="muted">CSV and print exports available per session</span></div><div className="history-list">{displaySessions.map(s => <div className="history-row" key={s.id}><div className="history-date"><strong>{new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(new Date(s.started_at))}</strong><span>{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(s.started_at))}</span></div><div className="history-copy"><strong>{s.class_name || 'Class session'}</strong><span>{formatDate(s.started_at, true)} · {s.id}</span></div><span className={`status-chip ${s.status === 'open' ? 'status-pending' : 'status-present'}`}>{s.status === 'open' ? 'Open' : 'Finalized'}</span><button className="icon-button" aria-label={`Open ${s.class_name || 'session'}`} onClick={() => setSelected(s)}><ChevronRight size={17} /></button></div>)}</div></div>{selected && <ReportDrawer session={selected} onClose={() => setSelected(null)} />}</> }

function StudentAttendanceView() { const [attendance, setAttendance] = useState<StudentAttendance | null>(null); const load = useCallback(() => { api.studentAttendance().then(setAttendance).catch(() => undefined) }, []); useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load]); const summary = attendance?.summary || { present: 0, absent: 0, pending: 0, total_finalized: 0, percentage: null }; return <><PageIntro eyebrow="Student view" title="My attendance" description="Your personal record, available only to you." action={<button className="secondary-button" onClick={() => api.studentAttendance().then(setAttendance)}><RefreshCw size={16} /> Refresh</button>} /><div className="metric-grid student-metrics"><Metric icon={<CheckCircle2 />} label="Present" value={String(summary.present)} detail="Sessions attended" tone="teal" /><Metric icon={<X />} label="Absent" value={String(summary.absent)} detail="Sessions missed" tone="coral" /><Metric icon={<Zap />} label="Attendance rate" value={formatPct(summary.percentage)} detail="Across all sessions" tone="violet" /></div><div className="panel table-panel"><div className="table-toolbar"><div><p className="eyebrow">Personal record</p><h3>Attendance by date</h3></div><div className="private-label"><LockKeyhole size={14} /> Private to you</div></div><AttendanceTable entries={(attendance?.entries || []).map(e => ({ student_id: e.session_id, student_name: e.class_name || 'Class session', status: e.status, changed_at: e.created_at, updated_at: e.updated_at }))} studentView /></div></> }

function NotificationsView() { const [items, setItems] = useState<Notification[]>([]); const load = useCallback(() => { api.notifications().then(setItems).catch(() => undefined) }, []); useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load]); async function read(note: Notification) { await api.markRead(note.id); setItems(prev => prev.map(n => n.id === note.id ? { ...n, read: true } : n)) } return <><PageIntro eyebrow="Student-safe updates" title="Notifications" description="Private in-app updates from your attendance workspace. No email, SMS, or push messages are sent." /><div className="panel notifications-panel"><div className="panel-heading"><div><p className="eyebrow">Your feed</p><h3>{items.filter(n => !n.read).length} unread updates</h3></div><div className="private-label"><LockKeyhole size={14} /> Private</div></div>{(items.length ? items : []).map(n => <button className={`notification-row ${n.read ? '' : 'unread'}`} key={n.id} onClick={() => read(n)}><div className="notification-icon"><Bell size={17} /></div><div><strong>{n.title}</strong><p>{n.body}</p><span>{formatDate(n.created_at, true)} {n.read ? '· Read' : '· Click to mark read'}</span></div>{!n.read && <span className="unread-dot" />}</button>)}{!items.length && <EmptyState icon={<Bell />} title="You’re all caught up" body="New private updates will appear here." />}</div></> }

function AttendanceTable({ entries, onUpdate, disabled, studentView = false }: { entries: AttendanceEntry[]; onUpdate?: (id: string, status: AttendanceEntry['status'], note?: string) => void; disabled?: boolean; studentView?: boolean }) { return <div className="attendance-table"><div className="attendance-table-head"><span>{studentView ? 'Class / date' : 'Student'}</span><span>Status</span>{!studentView && <span>Action</span>}</div>{entries.length ? entries.map(row => <div className="attendance-table-row" key={row.student_id}><div className="person-cell"><div className="mini-avatar">{studentView ? <BookOpen size={14} /> : initials(row.student_name)}</div><div><strong>{row.student_name}</strong><span>{studentView ? formatDate(row.changed_at) : row.confidence ? `${Math.round(row.confidence * 100)}% synthetic confidence` : 'Manual review'}</span></div></div><span className={`status-chip status-${row.status}`}>{row.status === 'present' ? <Check size={13} /> : row.status === 'absent' ? <X size={13} /> : <AlertCircle size={13} />} {statusCopy[row.status]}</span>{!studentView && <div className="row-actions"><button className="status-action present" disabled={disabled} onClick={() => onUpdate?.(row.student_id, 'present')} aria-label={`Mark ${row.student_name} present`}><Check size={14} /></button><button className="status-action absent" disabled={disabled} onClick={() => onUpdate?.(row.student_id, 'absent')} aria-label={`Mark ${row.student_name} absent`}><X size={14} /></button><button className="status-action edit" disabled={disabled} onClick={() => { const note = window.prompt('Correction note (required for your audit trail):', row.note || ''); if (note !== null) onUpdate?.(row.student_id, row.status === 'pending' ? 'present' : row.status, note) }} aria-label={`Add a note for ${row.student_name}`}><Pencil size={14} /></button></div>}</div>) : <EmptyState icon={<Users />} title="No attendance yet" body="Attendance entries will appear after a session is created." />}</div> }
function AuditLog({ items }: { items: AuditItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const displayItems = expanded ? items : items.slice(0, 5)

  return (
    <div className="panel audit-panel">
      <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Traceability</p>
          <h3>Audit log ({items.length} events)</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {items.length > 5 && (
            <button
              className="text-button"
              onClick={() => setExpanded(!expanded)}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              {expanded ? 'Show fewer' : `Show all (${items.length})`}
            </button>
          )}
          <FileText size={18} className="muted" />
        </div>
      </div>
      <div style={{ maxHeight: expanded ? '420px' : 'none', overflowY: expanded ? 'auto' : 'visible' }}>
        {displayItems.length ? displayItems.map(item => (
          <div className="audit-row" key={item.id}>
            <div className="audit-line" />
            <div>
              <strong>{item.action.replace('.', ' · ')}</strong>
              <span>{item.note || item.details || item.actor_name || 'System event'}{item.actor_name && item.note ? ` · ${item.actor_name}` : ''}</span>
              <small>{formatDate(item.timestamp || item.created_at, true)}</small>
            </div>
          </div>
        )) : <p className="muted">No events yet.</p>}
      </div>
    </div>
  )
}

function TeacherAnalysisView() {
  const [data, setData] = useState<api.AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getAnalytics()
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const fn = () => load()
    window.addEventListener('rollcall:refresh', fn)
    return () => window.removeEventListener('rollcall:refresh', fn)
  }, [load])

  const summary = data?.summary || {
    total_sessions: 0,
    total_classes: 0,
    total_students: 0,
    total_attendance_records: 0,
    present_count: 0,
    absent_count: 0,
    pending_count: 0,
    attendance_rate: 0,
    verified_live_count: 0,
    proxy_blocked_count: 0,
  }

  const students = (data?.students || []).filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  )

  const audits = (data?.recent_audits || []).filter(a => {
    if (filterAction === 'all') return true
    if (filterAction === 'verified') return a.action.includes('verified')
    if (filterAction === 'proxy') return a.action.includes('proxy') || (a.note && a.note.toLowerCase().includes('proxy'))
    if (filterAction === 'session') return a.action.includes('session')
    return true
  })

  return (
    <>
      <PageIntro
        eyebrow="Academic Attendance Analysis"
        title="Attendance Analytics & Audits"
        description="Comprehensive biometric verification metrics, student attendance breakdown, and live security audit trail."
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={api.getMasterExcelUrl()}
              download
              className="primary-button"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <FileSpreadsheet size={16} /> Export Excel Analytics (.xlsx)
            </a>
            <button className="secondary-button" onClick={load} disabled={loading}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        }
      />

      <div className="metric-grid">
        <Metric
          icon={<TrendingUp />}
          label="Attendance Rate"
          value={`${summary.attendance_rate}%`}
          detail={`${summary.present_count} of ${summary.total_attendance_records} entries`}
          tone="teal"
        />
        <Metric
          icon={<ScanFace />}
          label="Biometric Verified"
          value={String(summary.verified_live_count)}
          detail="Live face + 180° panorama"
          tone="blue"
        />
        <Metric
          icon={<ShieldAlert />}
          label="Proxy Shield Blocks"
          value={String(summary.proxy_blocked_count)}
          detail="1:N template mismatch blocked"
          tone="coral"
        />
        <Metric
          icon={<Users />}
          label="Enrolled Roster"
          value={String(summary.total_students)}
          detail="Students across all sections"
          tone="violet"
        />
      </div>

      <div className="panel table-panel" style={{ marginTop: '24px' }}>
        <div className="table-toolbar">
          <div>
            <p className="eyebrow">Student Roster Performance</p>
            <h3>Attendance Matrix ({students.length} Students)</h3>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search name or roll #..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--line)',
                  fontSize: '13px',
                  background: 'var(--panel-bg, #fff)',
                  color: 'inherit',
                  width: '200px',
                }}
              />
            </div>
          </div>
        </div>

        <div className="attendance-table">
          <div className="attendance-table-head" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr' }}>
            <span>Student & Roll No.</span>
            <span>Biometric Status</span>
            <span>Sessions Attended</span>
            <span>Attendance Rate</span>
            <span>Last Verification</span>
          </div>

          {students.length ? (
            students.map(s => {
              const isHigh = s.attendance_rate >= 75
              const isMed = s.attendance_rate >= 60 && s.attendance_rate < 75
              const badgeClass = isHigh ? 'status-present' : isMed ? 'status-pending' : 'status-absent'

              return (
                <div className="attendance-table-row" key={s.id} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr' }}>
                  <div className="person-cell">
                    <div className="mini-avatar">{initials(s.name)}</div>
                    <div>
                      <strong>{s.name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--slate, #64748B)' }}>{s.roll_number} • {s.email}</span>
                    </div>
                  </div>
                  <div>
                    <span className={`status-chip ${s.registration_locked ? 'status-present' : 'status-pending'}`} style={{ fontSize: '11px' }}>
                      {s.registration_locked ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                      {s.registration_locked ? 'Locked & Enrolled' : 'Pending Enrollment'}
                    </span>
                  </div>
                  <div>
                    <strong>{s.present_count}</strong>
                    <span style={{ color: 'var(--slate, #64748B)', fontSize: '12px' }}> / {s.total_sessions} sessions</span>
                  </div>
                  <div>
                    <span className={`status-chip ${badgeClass}`} style={{ fontWeight: 800 }}>
                      {s.attendance_rate}%
                    </span>
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ fontWeight: 600, color: s.last_status === 'present' ? 'var(--emerald, #10B981)' : 'var(--slate, #64748B)' }}>
                      {s.last_status.toUpperCase()}
                    </div>
                    <span style={{ color: 'var(--slate, #64748B)' }}>{formatDate(s.last_verified_at || undefined, true)}</span>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyState icon={<Users />} title="No student records match" body="Try adjusting your search criteria." />
          )}
        </div>
      </div>

      <div className="panel audit-panel" style={{ marginTop: '24px' }}>
        <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="eyebrow">Enterprise Traceability</p>
            <h3>Complete System Security & Verification Audit Trail</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'verified', 'proxy', 'session'].map(filterKey => (
              <button
                key={filterKey}
                onClick={() => setFilterAction(filterKey)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: filterAction === filterKey ? '1px solid var(--primary, #4F46E5)' : '1px solid var(--line, #E2E8F0)',
                  background: filterAction === filterKey ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                  color: filterAction === filterKey ? 'var(--primary, #4F46E5)' : 'inherit',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {filterKey === 'all' ? 'All Events' : filterKey === 'verified' ? 'Face Verified' : filterKey === 'proxy' ? 'Proxy Shield Blocks' : 'Sessions'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {audits.length ? (
            audits.map(item => {
              const isProxy = item.action.includes('proxy') || (item.note && item.note.toLowerCase().includes('proxy'))
              const isVerified = item.action.includes('verified')
              const toneColor = isProxy ? '#EF4444' : isVerified ? '#10B981' : '#4F46E5'

              return (
                <div className="audit-row" key={item.id} style={{ display: 'flex', gap: '14px', padding: '12px 0', borderBottom: '1px solid var(--line, #F1F5F9)' }}>
                  <div style={{ width: '4px', borderRadius: '4px', background: toneColor }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: toneColor }}>
                        {item.action.replace('.', ' · ').toUpperCase()}
                      </strong>
                      <small style={{ color: 'var(--slate, #94A3B8)', fontSize: '11px' }}>
                        {formatDate(item.timestamp || item.created_at, true)}
                      </small>
                    </div>
                    <p style={{ margin: '4px 0 4px 0', fontSize: '13px', color: 'var(--ink, #0F172A)' }}>
                      {item.note || item.details || 'System event triggered'}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', fontSize: '11px', color: 'var(--slate, #64748B)' }}>
                      <span>Actor: <b>{item.actor_name || 'System Engine'}</b></span>
                      {item.session_id && <span>Session: <code>{item.session_id.substring(0, 8)}</code></span>}
                      {Boolean(item.metadata?.hall_capacity) && (
                        <span className={`badge-capacity capacity-${String(item.metadata?.hall_capacity)}`}>
                          {String(item.metadata?.hall_capacity)}-Seater Hall
                        </span>
                      )}
                      {Boolean(item.metadata?.sir_detected) && (
                        <span className="badge-room" style={{ fontSize: '10px' }}>
                          ✓ Sir Detected
                        </span>
                      )}
                      {Boolean(item.metadata?.crowd_detected) && (
                        <span style={{ color: '#087f74', fontWeight: 700 }}>
                          • Crowd: {String(item.metadata?.crowd_count || 1)} peers
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="muted" style={{ padding: '24px', textAlign: 'center' }}>No audit records match the selected filter.</p>
          )}
        </div>
      </div>
    </>
  )
}
function sanitizeReportHtml(input: string) {
  const document = new DOMParser().parseFromString(input, 'text/html')
  document.querySelectorAll('script, iframe, object, embed, link, base, form, meta, img, svg').forEach(node => node.remove())
  document.querySelectorAll('*').forEach(node => Array.from(node.attributes).forEach(attribute => {
    const name = attribute.name.toLowerCase()
    const value = attribute.value.trim().toLowerCase()
    if (name.startsWith('on') || ((name === 'href' || name === 'src' || name === 'action') && value.startsWith('javascript:'))) node.removeAttribute(attribute.name)
  }))
  return `<!doctype html>${document.documentElement.outerHTML}`
}
function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
}
function printReport(html: string) {
  const popup = window.open('', '_blank')
  if (!popup) { downloadText(sanitizeReportHtml(html), 'attendance-report.html', 'text/html;charset=utf-8'); return }
  popup.opener = null
  popup.document.open(); popup.document.write(sanitizeReportHtml(html)); popup.document.close(); popup.focus(); popup.onload = () => popup.print()
}
function ReportDrawer({ session, onClose }: { session: Session; onClose: () => void }) {
  const [report, setReport] = useState<Report | null>(null)
  useEffect(() => { api.reports(session.id).then(setReport).catch(() => undefined) }, [session.id])
  const rows: AttendanceEntry[] = (report?.rows ?? []).map((row, index) => ({ student_id: `report-${index}-${row.email}`, student_name: row.name, student_email: row.email, status: row.status, note: row.note || undefined, changed_at: row.updated_at, updated_at: row.updated_at }))
  function csv() { if (report) downloadText(report.csv, `${session.id}-attendance.csv`, 'text/csv;charset=utf-8') }
  function htmlReport() { if (report) downloadText(sanitizeReportHtml(report.pdf_html), `${session.id}-attendance-report.html`, 'text/html;charset=utf-8') }
  return <div className="drawer-backdrop" onClick={onClose}><aside className="report-drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Session report</p><h2>{report?.session.class_name || session.class_name || 'Attendance report'}</h2><span>{formatDate(report?.session.started_at || session.started_at, true)} · {session.id}</span></div><button className="icon-button" onClick={onClose} aria-label="Close report"><X size={18} /></button></div><div className="report-actions"><button className="primary-button excel-btn" onClick={() => window.open(api.getExcelExportUrl(session.id), '_blank')}><FileSpreadsheet size={15} /> Export Styled Excel (.xlsx)</button><button className="secondary-button" onClick={csv} disabled={!report}><Download size={15} /> CSV</button><button className="secondary-button" onClick={htmlReport} disabled={!report}><FileText size={15} /> HTML report</button><button className="secondary-button" onClick={() => report && printReport(report.pdf_html)} disabled={!report}><Printer size={15} /> Print / save PDF</button></div><div className="report-summary"><Metric icon={<Users />} label="Roster" value={String(rows.length)} detail={report ? 'students' : 'loading report'} tone="blue" /><Metric icon={<CheckCircle2 />} label="Present" value={String(rows.filter(r => r.status === 'present').length)} detail="marked present" tone="teal" /></div><AttendanceTable entries={rows} /></aside></div>
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-description">{description}</p></div>{action && <div className="intro-action">{action}</div>}</div> }
function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) { return <div className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }
function ClassCard({ item, onStart }: { item: ClassItem; onStart: () => void }) { return <div className="class-card"><div className="class-card-top"><div className="class-code">{item.code || 'CLASS'}</div><span className="class-dot" /></div><h3>{item.name}</h3><div className="class-meta"><span><Zap size={14} /> {item.schedule || 'Schedule flexible'}</span><span><Users size={14} /> {item.student_count || 0} students</span></div><button className="card-link" onClick={onStart}>Start session <ArrowRight size={15} /></button></div> }
function SessionRow({ session }: { session: Session }) { return <div className="session-row"><div className="session-status"><span className={session.status === 'open' ? 'open-dot' : 'closed-dot'} /></div><div><strong>{session.class_name || 'Class session'}</strong><span>{formatDate(session.started_at, true)}</span></div><span className={`status-chip ${session.status === 'open' ? 'status-pending' : 'status-present'}`}>{session.status === 'open' ? 'Open' : 'Finalized'}</span></div> }
function WorkflowStep({ number, title, body, active }: { number: string; title: string; body: string; active: boolean }) { return <div className={`workflow-step ${active ? 'active' : ''}`}><span>{number}</span><div><strong>{title}</strong><small>{body}</small></div></div> }
function NavButton({ active, icon, label, onClick, badge }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; badge?: string }) { return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{badge && <small>{badge}</small>}</button> }
function ConnectionBadge({ state, onRetry }: { state: ConnectionState; onRetry: () => void }) { const copy = state === 'connected' ? 'Live connected' : state === 'connecting' ? 'Connecting…' : state === 'error' ? 'Connection error' : 'Offline'; return <button className={`connection-badge ${state}`} onClick={state === 'error' || state === 'closed' ? onRetry : undefined} title={state === 'error' || state === 'closed' ? 'Retry connection' : undefined}>{state === 'connected' ? <Wifi size={14} /> : state === 'connecting' ? <RefreshCw size={14} className="spin" /> : <WifiOff size={14} />}<span>{copy}</span>{(state === 'error' || state === 'closed') && <small>Retry</small>}</button> }
function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <div className="empty-state">{icon}<strong>{title}</strong><span>{body}</span></div> }
function initials(name: string) { return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() }

function ControllerClassesView() {
  const [classes, setClasses] = useState<api.ControllerClass[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [captureModalOpen, setCaptureModalOpen] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')

  // Create Class form states
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [section, setSection] = useState('Section A')
  const [roomNumber, setRoomNumber] = useState('LH-120')
  const [capacity, setCapacity] = useState<number>(120)
  const [roomPhoto, setRoomPhoto] = useState('https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  // Capture modal states
  const [captureCapacity, setCaptureCapacity] = useState<number>(120)
  const [captureRoomNumber, setCaptureRoomNumber] = useState('LH-120')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [savingCapture, setSavingCapture] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getControllerClasses()
      setClasses(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const startCamera = async () => {
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      mediaStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      alert('Camera access unavailable. You can use the panoramic file upload option.')
    }
  }

  const takeSnapshot = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedPhoto(base64)
    stopCamera()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCapturedPhoto(reader.result as string)
      stopCamera()
    }
    reader.readAsDataURL(file)
  }

  const openCapture = (cls?: api.ControllerClass) => {
    const target = cls || classes[0]
    if (target) {
      setSelectedClassId(target.id)
      setCaptureCapacity(target.capacity || 120)
      setCaptureRoomNumber(target.room_number || `LH-${target.capacity || 120}`)
      setCapturedPhoto(target.room_photo?.startsWith('data:') ? target.room_photo : null)
    }
    setCaptureModalOpen(true)
  }

  const closeCaptureModal = () => {
    stopCamera()
    setCaptureModalOpen(false)
    setCapturedPhoto(null)
  }

  const handleSaveCapture = async () => {
    if (!selectedClassId || !capturedPhoto) return
    setSavingCapture(true)
    try {
      const hallTypeMap: Record<number, string> = {
        80: '80-Seater Seminar Hall',
        120: '120-Seater Lecture Theater',
        240: '240-Seater Tiered Amphitheater',
        260: '260-Seater Grand Auditorium',
      }
      await api.captureClassRoom(selectedClassId, {
        photo_base64: capturedPhoto,
        capacity: captureCapacity,
        hall_type: hallTypeMap[captureCapacity] || `${captureCapacity}-Seater Hall`,
        room_number: captureRoomNumber,
      })
      setMsg(`Official reference panorama captured for ${hallTypeMap[captureCapacity]} (${captureRoomNumber}).`)
      closeCaptureModal()
      await load()
    } catch {
      alert('Could not save captured room reference. Please retry.')
    } finally {
      setSavingCapture(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setSubmitting(true)
    try {
      const hallTypeMap: Record<number, string> = {
        80: '80-Seater Seminar Hall',
        120: '120-Seater Lecture Theater',
        240: '240-Seater Tiered Amphitheater',
        260: '260-Seater Grand Auditorium',
      }
      await api.createControllerClass({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        section: section.trim(),
        room_number: roomNumber.trim(),
        capacity,
        hall_type: hallTypeMap[capacity] || `${capacity}-Seater Hall`,
        room_photo: roomPhoto.trim(),
      })
      setName('')
      setCode('')
      setModalOpen(false)
      setMsg('Classroom venue created successfully.')
      await load()
    } catch {
      alert('Could not create class. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="Academic Controller"
        title="Classroom & Venue Management"
        description="Configure academic sections, set hall seating capacity (80, 120, 240, 260-seater), and capture official classroom panoramic references for live attendance verification."
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="secondary-button" onClick={() => openCapture()}>
              <Camera size={16} /> Capture Classroom Room
            </button>
            <button className="primary-button" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Add Class & Venue
            </button>
          </div>
        }
      />
      {msg && <div className="toast" role="status"><CheckCircle2 size={17} /> {msg}<button onClick={() => setMsg('')}><X size={16} /></button></div>}

      <div className="metric-grid">
        <Metric icon={<BookOpen />} label="Managed Classes" value={loading ? '—' : String(classes.length)} detail="Across all departments" tone="teal" />
        <Metric icon={<Building />} label="Assigned Halls" value={loading ? '—' : String(new Set(classes.map(c => c.room_number)).size)} detail="Physical lecture rooms" tone="violet" />
        <Metric icon={<Users />} label="Total Roster" value={loading ? '—' : String(classes.reduce((acc, c) => acc + (c.student_count || 0), 0))} detail="Active enrolled students" tone="blue" />
      </div>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Academic Catalog</p>
          <h2>Assigned Venues & Reference Templates</h2>
        </div>
      </div>

      <div className="class-grid">
        {classes.map(cls => (
          <div key={cls.id} className="class-card venue-card">
            <div className="class-card-top">
              <div className="class-code">{cls.code}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className={`badge-capacity capacity-${cls.capacity || 120}`}>
                  {cls.capacity || 120}-Seater
                </span>
                <span className="badge-room">{cls.room_number || 'Room Unassigned'}</span>
              </div>
            </div>
            <h3>{cls.name}</h3>
            <p className="venue-section-tag">{cls.section || 'General'} • {cls.hall_type || `${cls.capacity || 120}-Seater Hall`}</p>
            {cls.room_photo && (
              <div className="room-photo-preview">
                <img src={cls.room_photo} alt={`Venue ${cls.room_number}`} onError={e => (e.currentTarget.style.display = 'none')} />
                <span className="photo-tag"><Camera size={12} /> {cls.capacity || 120}-Seater Panorama</span>
                {cls.reference_captured_at && (
                  <span className="photo-verified-tag"><Check size={11} /> Captured</span>
                )}
              </div>
            )}
            <div className="class-meta" style={{ marginBottom: '14px' }}>
              <span><Building size={14} /> Room: {cls.room_number || 'TBD'} ({cls.capacity || 120} seats)</span>
              <span><Users size={14} /> {cls.student_count || 0} enrolled • Lecturer: {cls.teacher_name || 'Assigned'}</span>
            </div>
            <button className="secondary-button small" style={{ marginTop: 'auto', width: '100%' }} onClick={() => openCapture(cls)}>
              <Camera size={13} /> {cls.reference_captured_at ? 'Re-capture Room Panorama' : 'Capture Room Panorama'}
            </button>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="drawer-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Create Class & Assign Classroom Venue</h3>
              <button className="icon-button" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="dialog-form">
              <label>Course Name
                <input type="text" placeholder="e.g. Distributed Operating Systems" value={name} onChange={e => setName(e.target.value)} required />
              </label>
              <div className="form-row">
                <label>Course Code
                  <input type="text" placeholder="e.g. CS-402" value={code} onChange={e => setCode(e.target.value)} required />
                </label>
                <label>Section
                  <input type="text" placeholder="e.g. Section A" value={section} onChange={e => setSection(e.target.value)} />
                </label>
              </div>

              <div>
                <label style={{ marginBottom: '6px' }}>Hall Seating Capacity</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[80, 120, 240, 260].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setCapacity(s)
                        setRoomNumber(`LH-${s}`)
                      }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        border: capacity === s ? '2px solid var(--primary, #087f74)' : '1px solid var(--line)',
                        background: capacity === s ? '#e6f7ef' : '#fff',
                        color: capacity === s ? '#087f74' : 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {s} Seater
                    </button>
                  ))}
                </div>
              </div>

              <label>Assigned Physical Room Number
                <input type="text" placeholder="e.g. LH-120" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} required />
              </label>
              <label>Initial Room Photo URL (or capture directly afterwards)
                <input type="url" placeholder="https://..." value={roomPhoto} onChange={e => setRoomPhoto(e.target.value)} />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Save & Publish Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {captureModalOpen && (
        <div className="drawer-backdrop" onClick={closeCaptureModal}>
          <div className="modal-dialog" style={{ width: 'min(640px, 94vw)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Classroom Panorama Reference</p>
                <h3>Capture Official Hall & Stage Panorama</h3>
              </div>
              <button className="icon-button" onClick={closeCaptureModal}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                Select Class to Capture:
                <select
                  value={selectedClassId}
                  onChange={e => {
                    const found = classes.find(c => c.id === e.target.value)
                    if (found) {
                      setSelectedClassId(found.id)
                      setCaptureCapacity(found.capacity || 120)
                      setCaptureRoomNumber(found.room_number || `LH-${found.capacity || 120}`)
                    }
                  }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px', background: '#fff' }}
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.capacity || 120}-Seater {c.room_number})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>Hall Seating Capacity:</span>
                {[80, 120, 240, 260].map(seats => (
                  <button
                    key={seats}
                    type="button"
                    onClick={() => {
                      setCaptureCapacity(seats)
                      setCaptureRoomNumber(`LH-${seats}`)
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      border: captureCapacity === seats ? '2px solid var(--primary, #087f74)' : '1px solid var(--line)',
                      background: captureCapacity === seats ? '#e6f7ef' : '#fff',
                      color: captureCapacity === seats ? '#087f74' : 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {seats} Seater
                  </button>
                ))}
              </div>

              <div className="camera-viewfinder">
                {capturedPhoto ? (
                  <img src={capturedPhoto} alt="Captured preview" />
                ) : (
                  <video ref={videoRef} playsInline autoPlay muted style={{ display: cameraActive ? 'block' : 'none' }} />
                )}
                {!cameraActive && !capturedPhoto && (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                    <Camera size={36} style={{ marginBottom: '8px', color: '#64748b' }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>Tap "Start Live Camera" or upload a panoramic photo below</p>
                  </div>
                )}
                <div className="viewfinder-overlay">
                  <div className="stage-target">
                    PODIUM / STAGE AREA (SIR DETECTION ZONE)
                  </div>
                  <div className="crowd-target">
                    AUDIENCE SEATING TIERS ({captureCapacity}-SEATER CROWD ZONE)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!cameraActive ? (
                    <button type="button" className="secondary-button small" onClick={startCamera}>
                      <Camera size={14} /> Start Live Camera
                    </button>
                  ) : (
                    <button type="button" className="primary-button small" onClick={takeSnapshot}>
                      <Camera size={14} /> Snap Photo
                    </button>
                  )}
                  {cameraActive && (
                    <button type="button" className="secondary-button small" onClick={stopCamera}>
                      Stop Camera
                    </button>
                  )}
                  {capturedPhoto && (
                    <button type="button" className="secondary-button small" onClick={() => setCapturedPhoto(null)}>
                      Retake
                    </button>
                  )}
                </div>

                <label className="secondary-button small" style={{ cursor: 'pointer', margin: 0 }}>
                  <Upload size={14} /> Upload Panoramic Image
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: '12px' }}>
                <button type="button" className="secondary-button" onClick={closeCaptureModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!capturedPhoto || savingCapture}
                  onClick={handleSaveCapture}
                >
                  {savingCapture ? 'Saving Reference…' : 'Save as Official Reference'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ControllerStudentsView() {
  const [students, setStudents] = useState<api.ControllerStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [studentId, setStudentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getControllerStudents()
      setStudents(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    try {
      await api.createControllerStudent({
        name: name.trim(),
        email: email.trim(),
        roll_number: rollNumber.trim() || `CS-2026-${String(students.length + 1).padStart(3, '0')}`,
        student_id: studentId.trim() || `STU-${9000 + students.length + 1}`,
      })
      setName('')
      setEmail('')
      setRollNumber('')
      setStudentId('')
      setModalOpen(false)
      setNotice('Student added to authorized college database.')
      await load()
    } catch {
      alert('Could not add student. Email might already exist.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnlock(student: api.ControllerStudent) {
    if (!window.confirm(`Unlock registration for ${student.name}? This will allow the student to register/re-enroll their facial reference.`)) return
    setUnlockingId(student.id)
    try {
      await api.unlockStudentRegistration(student.id)
      setNotice(`Registration unlocked for ${student.name}. Option is reopened.`)
      await load()
    } catch {
      alert('Could not unlock registration.')
    } finally {
      setUnlockingId(null)
    }
  }

  const lockedCount = students.filter(s => s.registration_locked).length
  const openCount = students.length - lockedCount

  return (
    <>
      <PageIntro
        eyebrow="Academic Controller"
        title="College Student Biometric Registry"
        description="Verify authorized college students, manage one-time biometric registration locks, and reset biometric enrollment on demand."
        action={
          <button className="primary-button" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Add College Student
          </button>
        }
      />
      {notice && <div className="toast" role="status"><CheckCircle2 size={17} /> {notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}

      <div className="metric-grid">
        <Metric icon={<Users />} label="Authorized Students" value={loading ? '—' : String(students.length)} detail="College database" tone="teal" />
        <Metric icon={<Lock size={18} />} label="Registration Locked" value={loading ? '—' : String(lockedCount)} detail="Enrolled & closed" tone="blue" />
        <Metric icon={<Unlock size={18} />} label="Registration Open" value={loading ? '—' : String(openCount)} detail="Awaiting first sign-in" tone="amber" />
      </div>

      <div className="panel" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3>Student Enrollment & Biometric Lock Status</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Students register once on first sign-in. Once enrolled, registration is closed and locked unless unlocked by the Controller.
          </p>
        </div>
        <div className="table-responsive">
          <table className="roster-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 20px', fontSize: 12 }}>Student</th>
                <th style={{ padding: '12px 16px', fontSize: 12 }}>Roll Number</th>
                <th style={{ padding: '12px 16px', fontSize: 12 }}>College ID</th>
                <th style={{ padding: '12px 16px', fontSize: 12 }}>Biometric Status</th>
                <th style={{ padding: '12px 20px', fontSize: 12, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.email}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {s.roll_number || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                    {s.student_id || '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {s.registration_locked ? (
                      <span className="status-chip status-present" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Lock size={12} /> Locked & Enrolled
                      </span>
                    ) : (
                      <span className="status-chip status-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Unlock size={12} /> Registration Open
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    {s.registration_locked ? (
                      <button
                        className="secondary-button"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleUnlock(s)}
                        disabled={unlockingId === s.id}
                      >
                        <Unlock size={13} /> {unlockingId === s.id ? 'Unlocking…' : 'Unlock Registration'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ready to Enroll</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="drawer-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Add Approved College Student</h3>
              <button className="icon-button" onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="dialog-form">
              <label>Full Name
                <input type="text" placeholder="e.g. Alex Johnson" value={name} onChange={e => setName(e.target.value)} required />
              </label>
              <label>College Email Address
                <input type="email" placeholder="alex@demo.edu" value={email} onChange={e => setEmail(e.target.value)} required />
              </label>
              <div className="form-row">
                <label>Roll Number
                  <input type="text" placeholder="e.g. CS-2026-003" value={rollNumber} onChange={e => setRollNumber(e.target.value)} />
                </label>
                <label>Student ID
                  <input type="text" placeholder="e.g. STU-9023" value={studentId} onChange={e => setStudentId(e.target.value)} />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? 'Adding…' : 'Add to College Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default App

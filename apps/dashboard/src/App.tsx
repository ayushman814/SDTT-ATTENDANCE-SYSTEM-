import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Bell, BookOpen, Camera, Check, CheckCircle2, ChevronRight, CircleHelp, Download, FileCheck2, FileText, History, LayoutDashboard, LockKeyhole, LogOut, Menu, MessageSquare, Pencil, Play, Printer, RefreshCw, ScanFace, ShieldCheck, Sparkles, UserRound, Users, Wifi, WifiOff, X, Zap } from 'lucide-react'
import * as api from './api'
import { ProfessorSessionsFlow, StudentAttendanceFlow } from './attendance-flows'
import { type AttendanceEntry, type AuditItem, type ClassItem, type Notification, type Report, type Session, type StudentAttendance, type User } from './types'
import './styles.css'

type Section = 'overview' | 'sessions' | 'attendance' | 'notifications'
type ConnectionState = 'connecting' | 'connected' | 'closed' | 'error'

const formatDate = (value?: string, withTime = false) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(value)) : '—'
const formatPct = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${Math.round(value)}%`
const statusCopy: Record<string, string> = { present: 'Present', absent: 'Absent', pending: 'Needs review' }

function App() {
  const [user, setUser] = useState<User | null>(api.currentUser())
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

  const handleSignOut = () => { api.signOut(); setUser(null) }
  if (!user) return <Login onLogin={next => setUser(next)} />

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-block"><div className="brand-mark" aria-hidden="true"><span>R</span></div><div><strong>rollcall</strong><small>Campus attendance</small></div></div>
      <div className="workspace-pill"><span className="workspace-dot" /> {api.roleLabel(user.role)}</div>
      <nav aria-label="Primary navigation" className="main-nav">
        <NavButton active={section === 'overview'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => { setSection('overview'); setMenuOpen(false) }} />
        {user.role === 'teacher' ? <>
          <NavButton active={section === 'sessions'} icon={<Zap size={18} />} label="Live sessions" onClick={() => { setSection('sessions'); setMenuOpen(false) }} />
          <NavButton active={section === 'attendance'} icon={<History size={18} />} label="Session history" onClick={() => { setSection('attendance'); setMenuOpen(false) }} />
        </> : <NavButton active={section === 'attendance'} icon={<CheckCircle2 size={18} />} label="My attendance" onClick={() => { setSection('attendance'); setMenuOpen(false) }} />}
        <NavButton active={section === 'notifications'} icon={<Bell size={18} />} label="Notifications" onClick={() => { setSection('notifications'); setMenuOpen(false) }} />
      </nav>
      <div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={16} /><span><b>Private by design</b><br />Images are private and purged after the configured retention period.</span></div><button className="sidebar-signout" onClick={handleSignOut}><LogOut size={17} /> Sign out</button></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><div className="breadcrumb"><span>Rollcall</span><ChevronRight size={15} /><strong>{section === 'overview' ? 'Overview' : section === 'sessions' ? 'Live sessions' : section === 'attendance' ? (user.role === 'teacher' ? 'Session history' : 'My attendance') : 'Notifications'}</strong></div><div className="topbar-actions"><ConnectionBadge state={connection} onRetry={() => connect()} /><button className="avatar-button" aria-label={`Signed in as ${user.name}`}><span className="avatar">{initials(user.name)}</span><span className="avatar-name">{user.name}</span></button></div></header>
      <div className="page-wrap">
        {notice && <div className="toast" role="status"><CheckCircle2 size={17} /> {notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={16} /></button></div>}
        {section === 'overview' && <Overview user={user} onNavigate={setSection} />}
        {section === 'sessions' && user.role === 'teacher' && <ProfessorSessionsFlow />}
        {section === 'attendance' && (user.role === 'teacher' ? <TeacherHistory /> : <StudentAttendanceView />)}
        {section === 'notifications' && <NotificationsView />}
      </div>
    </main>
  </div>
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [role, setRole] = useState<User['role'] | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!role) return
    setLoading(true); setError('')
    try {
      const result = await api.login(identifier, password)
      if (result.user.role !== role) { api.signOut(); throw new Error(`This account is not a ${role === 'teacher' ? 'professor' : 'student'} account.`) }
      onLogin(result.user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed. Check your ID/email and password.')
    } finally { setLoading(false) }
  }
  return <main className="login-page"><section className="login-panel" aria-labelledby="login-title">
    <p className="eyebrow">College attendance</p><h1 id="login-title">Smart Classroom Attendance</h1>
    {!role ? <><p>Select your account type to continue.</p><div className="role-choice"><button className="primary-button full" onClick={() => setRole('student')}>Student</button><button className="secondary-button full" onClick={() => setRole('teacher')}>Professor</button></div></> : <>
      <button className="text-button" onClick={() => { setRole(null); setError('') }}>← Choose another role</button>
      <h2>{role === 'student' ? 'Student login' : 'Professor login'}</h2>
      <form onSubmit={submit} className="login-form"><label>{role === 'student' ? 'Student ID or registered email' : 'Professor ID or registered email'}<input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <div className="inline-error" role="alert"><AlertCircle size={16} /> {error}</div>}<button className="primary-button full" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button></form>
      <p className="login-foot"><LockKeyhole size={14} /> Your account is verified by the attendance service.</p>
    </>}
  </section></main>
}

function Overview({ user, onNavigate }: { user: User; onNavigate: (s: Section) => void }) {
  return user.role === 'teacher' ? <TeacherOverview user={user} onNavigate={onNavigate} /> : <StudentAttendanceFlow user={user} />
}
function TeacherOverview({ user, onNavigate }: { user: User; onNavigate: (s: Section) => void }) {
  const [classes, setClasses] = useState<ClassItem[]>([]); const [sessions, setSessions] = useState<Session[]>([]); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); try { const [c, s] = await Promise.all([api.getClasses(), api.getSessions()]); setClasses(c); setSessions(s) } finally { setLoading(false) } }, [])
  useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load])
  const open = sessions.filter(s => s.status === 'open').length
  const displayClasses = classes
  const displaySessions = sessions
  const finalized = sessions.filter(s => s.status === 'finalized').length
  const enrolled = displayClasses.reduce((total, item) => total + (item.student_count || 0), 0)
  return <><PageIntro eyebrow={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())} title={`Good morning, ${user.name.split(' ')[0]}.`} description="Schedule a timed session, review scene evidence, and finalize attendance when ready." action={<button className="primary-button" onClick={() => onNavigate('sessions')}><Play size={16} /> Start a session</button>} /><div className="metric-grid"><Metric icon={<BookOpen />} label="Active classes" value={loading ? '—' : String(displayClasses.length)} detail="This term" tone="teal" /><Metric icon={<Zap />} label="Open sessions" value={String(open)} detail="Needs your attention" tone="amber" /><Metric icon={<CheckCircle2 />} label="Finalized sessions" value={String(finalized)} detail="Recorded sessions" tone="violet" /><Metric icon={<MessageSquare />} label="Enrolled students" value={String(enrolled)} detail="Across listed classes" tone="blue" /></div><div className="section-heading"><div><p className="eyebrow">Your teaching space</p><h2>Classes at a glance</h2></div><button className="text-button" onClick={() => onNavigate('attendance')}>View session history <ArrowRight size={15} /></button></div><div className="class-grid">{displayClasses.map(item => <ClassCard key={item.id} item={item} onStart={() => onNavigate('sessions')} />)}</div><div className="dashboard-lower"><div className="panel recent-panel"><div className="panel-heading"><div><p className="eyebrow">Recent activity</p><h3>Session history</h3></div><button className="icon-button" onClick={() => onNavigate('attendance')} aria-label="View all sessions"><ArrowRight size={17} /></button></div>{displaySessions.slice(0, 3).map(s => <SessionRow session={s} key={s.id} />)}</div><div className="panel callout-panel"><div className="callout-icon"><CircleHelp size={20} /></div><div><p className="eyebrow">A calm workflow</p><h3>Review before you finalize</h3><p>Scene checks do not identify people. Review uncertain submissions and correct the roster before finalizing.</p><button className="text-button" onClick={() => onNavigate('sessions')}>See the workflow <ArrowRight size={15} /></button></div></div></div></>
}
function StudentOverview({ user, onNavigate }: { user: User; onNavigate: (s: Section) => void }) {
  const [attendance, setAttendance] = useState<StudentAttendance | null>(null); const [notes, setNotes] = useState<Notification[]>([])
  const load = useCallback(async () => { try { const [a, n] = await Promise.all([api.studentAttendance(), api.notifications()]); setAttendance(a); setNotes(n) } catch { /* keep the seeded empty state */ } }, [])
  useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load])
  const summary = attendance?.summary || { present: 0, absent: 0, pending: 0, total_finalized: 0, percentage: null }
  return <><PageIntro eyebrow={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())} title={`Hi, ${user.name.split(' ')[0]}.`} description="Here’s the latest view of your attendance and class updates." action={<button className="secondary-button" onClick={() => onNavigate('notifications')}><Bell size={16} /> {notes.filter(n => !n.read).length} new update</button>} /><div className="student-hero"><div className="attendance-ring" style={{ '--percent': `${summary.percentage ?? 0}%` } as React.CSSProperties}><div><strong>{formatPct(summary.percentage)}</strong><span>attendance</span></div></div><div className="student-hero-copy"><p className="eyebrow">Your term snapshot</p><h2>Showing up adds up.</h2><p>You’ve been present for <strong>{summary.present} of {summary.total_finalized} sessions</strong>. Keep an eye on the class details below for the full picture.</p><button className="text-button" onClick={() => onNavigate('attendance')}>View attendance details <ArrowRight size={15} /></button></div></div><div className="metric-grid student-metrics"><Metric icon={<CheckCircle2 />} label="Present" value={String(summary.present)} detail="Sessions attended" tone="teal" /><Metric icon={<X />} label="Absent" value={String(summary.absent)} detail="Sessions missed" tone="coral" /><Metric icon={<BookOpen />} label="Total sessions" value={String(summary.total_finalized)} detail="This term" tone="violet" /></div><div className="section-heading"><div><p className="eyebrow">Latest record</p><h2>Recent attendance</h2></div><button className="text-button" onClick={() => onNavigate('attendance')}>See all <ArrowRight size={15} /></button></div><div className="panel table-panel"><AttendanceTable entries={(attendance?.entries || []).slice(0, 4).map(e => ({ student_id: e.session_id, student_name: e.class_name || 'Class session', status: e.status, changed_at: e.created_at, updated_at: e.updated_at }))} studentView /></div></>
}

function TeacherSessions() { return <ProfessorSessionsFlow /> }

function TeacherHistory() { const [sessions, setSessions] = useState<Session[]>([]); const [selected, setSelected] = useState<Session | null>(null); const load = useCallback(() => { api.getSessions().then(setSessions).catch(() => undefined) }, []); const displaySessions = sessions; useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load]); return <><PageIntro eyebrow="Faculty workspace" title="Session history" description="A clear, auditable record of every class session." action={<button className="secondary-button" onClick={() => api.getSessions().then(setSessions)}><RefreshCw size={16} /> Refresh</button>} /><div className="panel table-panel history-table"><div className="table-toolbar"><div><p className="eyebrow">All sessions</p><h3>{displaySessions.length} recorded sessions</h3></div><span className="muted">CSV and print exports available per session</span></div><div className="history-list">{displaySessions.map(s => <div className="history-row" key={s.id}><div className="history-date"><strong>{new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(new Date(s.started_at))}</strong><span>{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(s.started_at))}</span></div><div className="history-copy"><strong>{s.class_name || 'Class session'}</strong><span>{formatDate(s.started_at, true)} · {s.id}</span></div><span className={`status-chip ${s.status === 'open' || s.status === 'scheduled' ? 'status-pending' : 'status-present'}`}>{(s.status || 'scheduled')[0].toUpperCase() + (s.status || 'scheduled').slice(1)}</span><button className="icon-button" aria-label={`Open ${s.class_name || 'session'}`} onClick={() => setSelected(s)}><ChevronRight size={17} /></button></div>)}</div></div>{selected && <ReportDrawer session={selected} onClose={() => setSelected(null)} />}</> }

function StudentAttendanceView() { const [attendance, setAttendance] = useState<StudentAttendance | null>(null); const load = useCallback(() => { api.studentAttendance().then(setAttendance).catch(() => undefined) }, []); useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load]); const summary = attendance?.summary || { present: 0, absent: 0, pending: 0, total_finalized: 0, percentage: null }; return <><PageIntro eyebrow="Student view" title="My attendance" description="Your personal record, available only to you." action={<button className="secondary-button" onClick={() => api.studentAttendance().then(setAttendance)}><RefreshCw size={16} /> Refresh</button>} /><div className="metric-grid student-metrics"><Metric icon={<CheckCircle2 />} label="Present" value={String(summary.present)} detail="Sessions attended" tone="teal" /><Metric icon={<X />} label="Absent" value={String(summary.absent)} detail="Sessions missed" tone="coral" /><Metric icon={<Zap />} label="Attendance rate" value={formatPct(summary.percentage)} detail="Across all sessions" tone="violet" /></div><div className="panel table-panel"><div className="table-toolbar"><div><p className="eyebrow">Personal record</p><h3>Attendance by date</h3></div><div className="private-label"><LockKeyhole size={14} /> Private to you</div></div><AttendanceTable entries={(attendance?.entries || []).map(e => ({ student_id: e.session_id, student_name: e.class_name || 'Class session', status: e.status, changed_at: e.created_at, updated_at: e.updated_at }))} studentView /></div></> }

function NotificationsView() { const [items, setItems] = useState<Notification[]>([]); const load = useCallback(() => { api.notifications().then(setItems).catch(() => undefined) }, []); useEffect(() => { load(); const fn = () => load(); window.addEventListener('rollcall:refresh', fn); return () => window.removeEventListener('rollcall:refresh', fn) }, [load]); async function read(note: Notification) { await api.markRead(note.id); setItems(prev => prev.map(n => n.id === note.id ? { ...n, read: true } : n)) } return <><PageIntro eyebrow="Student-safe updates" title="Notifications" description="Private in-app updates from your attendance workspace. No email, SMS, or push messages are sent." /><div className="panel notifications-panel"><div className="panel-heading"><div><p className="eyebrow">Your feed</p><h3>{items.filter(n => !n.read).length} unread updates</h3></div><div className="private-label"><LockKeyhole size={14} /> Private</div></div>{(items.length ? items : []).map(n => <button className={`notification-row ${n.read ? '' : 'unread'}`} key={n.id} onClick={() => read(n)}><div className="notification-icon"><Bell size={17} /></div><div><strong>{n.title}</strong><p>{n.body}</p><span>{formatDate(n.created_at, true)} {n.read ? '· Read' : '· Click to mark read'}</span></div>{!n.read && <span className="unread-dot" />}</button>)}{!items.length && <EmptyState icon={<Bell />} title="You’re all caught up" body="New private updates will appear here." />}</div></> }

function AttendanceTable({ entries, onUpdate, disabled, studentView = false }: { entries: AttendanceEntry[]; onUpdate?: (id: string, status: AttendanceEntry['status'], note?: string) => void; disabled?: boolean; studentView?: boolean }) { return <div className="attendance-table"><div className="attendance-table-head"><span>{studentView ? 'Class / date' : 'Student'}</span><span>Status</span>{!studentView && <span>Action</span>}</div>{entries.length ? entries.map(row => <div className="attendance-table-row" key={row.student_id}><div className="person-cell"><div className="mini-avatar">{studentView ? <BookOpen size={14} /> : initials(row.student_name)}</div><div><strong>{row.student_name}</strong><span>{studentView ? formatDate(row.changed_at) : row.verification_status ? row.verification_status.replaceAll('_', ' ') : 'Manual attendance'}</span></div></div><span className={`status-chip status-${row.status}`}>{row.status === 'present' ? <Check size={13} /> : row.status === 'absent' ? <X size={13} /> : <AlertCircle size={13} />} {statusCopy[row.status]}</span>{!studentView && <div className="row-actions"><button className="status-action present" disabled={disabled} onClick={() => onUpdate?.(row.student_id, 'present')} aria-label={`Mark ${row.student_name} present`}><Check size={14} /></button><button className="status-action absent" disabled={disabled} onClick={() => onUpdate?.(row.student_id, 'absent')} aria-label={`Mark ${row.student_name} absent`}><X size={14} /></button><button className="status-action edit" disabled={disabled} onClick={() => { const note = window.prompt('Correction note (required for your audit trail):', row.note || ''); if (note !== null) onUpdate?.(row.student_id, row.status === 'pending' ? 'present' : row.status, note) }} aria-label={`Add a note for ${row.student_name}`}><Pencil size={14} /></button></div>}</div>) : <EmptyState icon={<Users />} title="No attendance yet" body="Attendance entries will appear after a session is created." />}</div> }
function AuditLog({ items }: { items: AuditItem[] }) { return <div className="panel audit-panel"><div className="panel-heading"><div><p className="eyebrow">Traceability</p><h3>Audit log</h3></div><FileText size={18} className="muted" /></div>{items.length ? items.slice(0, 5).map(item => <div className="audit-row" key={item.id}><div className="audit-line" /><div><strong>{item.action.replace('.', ' · ')}</strong><span>{item.note || item.details || item.actor_name || 'System event'}{item.actor_name && item.note ? ` · ${item.actor_name}` : ''}</span><small>{formatDate(item.timestamp || item.created_at, true)}</small></div></div>) : <p className="muted">No events yet.</p>}</div> }
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
  return <div className="drawer-backdrop" onClick={onClose}><aside className="report-drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Session report</p><h2>{report?.session.class_name || session.class_name || 'Attendance report'}</h2><span>{formatDate(report?.session.started_at || session.started_at, true)} · {session.id}</span></div><button className="icon-button" onClick={onClose} aria-label="Close report"><X size={18} /></button></div><div className="report-actions"><button className="secondary-button" onClick={csv} disabled={!report}><Download size={15} /> CSV</button><button className="secondary-button" onClick={htmlReport} disabled={!report}><FileText size={15} /> HTML report</button><button className="secondary-button" onClick={() => report && printReport(report.pdf_html)} disabled={!report}><Printer size={15} /> Print / save PDF</button></div><div className="report-summary"><Metric icon={<Users />} label="Roster" value={String(rows.length)} detail={report ? 'students' : 'loading report'} tone="blue" /><Metric icon={<CheckCircle2 />} label="Present" value={String(rows.filter(r => r.status === 'present').length)} detail="marked present" tone="teal" /></div><AttendanceTable entries={rows} /></aside></div>
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-description">{description}</p></div>{action && <div className="intro-action">{action}</div>}</div> }
function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) { return <div className={`metric-card tone-${tone}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }
function ClassCard({ item, onStart }: { item: ClassItem; onStart: () => void }) { return <div className="class-card"><div className="class-card-top"><div className="class-code">{item.code || 'CLASS'}</div><span className="class-dot" /></div><h3>{item.name}</h3><div className="class-meta"><span><Zap size={14} /> {item.schedule || 'Schedule flexible'}</span><span><Users size={14} /> {item.student_count || 0} students</span></div><button className="card-link" onClick={onStart}>Start session <ArrowRight size={15} /></button></div> }
function SessionRow({ session }: { session: Session }) { return <div className="session-row"><div className="session-status"><span className={session.status === 'open' || session.status === 'scheduled' ? 'open-dot' : 'closed-dot'} /></div><div><strong>{session.title || session.class_name || 'Class session'}</strong><span>{formatDate(session.created_at || session.started_at, true)}</span></div><span className={`status-chip ${session.status === 'open' || session.status === 'scheduled' ? 'status-pending' : 'status-present'}`}>{(session.status || 'scheduled')[0].toUpperCase() + (session.status || 'scheduled').slice(1)}</span></div> }
function WorkflowStep({ number, title, body, active }: { number: string; title: string; body: string; active: boolean }) { return <div className={`workflow-step ${active ? 'active' : ''}`}><span>{number}</span><div><strong>{title}</strong><small>{body}</small></div></div> }
function NavButton({ active, icon, label, onClick, badge }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void; badge?: string }) { return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{badge && <small>{badge}</small>}</button> }
function ConnectionBadge({ state, onRetry }: { state: ConnectionState; onRetry: () => void }) { const copy = state === 'connected' ? 'Live connected' : state === 'connecting' ? 'Connecting…' : state === 'error' ? 'Connection error' : 'Offline'; return <button className={`connection-badge ${state}`} onClick={state === 'error' || state === 'closed' ? onRetry : undefined} title={state === 'error' || state === 'closed' ? 'Retry connection' : undefined}>{state === 'connected' ? <Wifi size={14} /> : state === 'connecting' ? <RefreshCw size={14} className="spin" /> : <WifiOff size={14} />}<span>{copy}</span>{(state === 'error' || state === 'closed') && <small>Retry</small>}</button> }
function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <div className="empty-state">{icon}<strong>{title}</strong><span>{body}</span></div> }
function initials(name: string) { return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() }

export default App

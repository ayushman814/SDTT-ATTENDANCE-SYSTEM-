import { demoClasses, demoController, demoNotifications, demoNotifications2, demoRoster, demoSessions, demoStudent, demoStudent2, demoStudentAttendance, demoStudentAttendance2, demoTeacher, type AttendanceEntry, type AuditItem, type ClassItem, type ControllerClass, type ControllerStudent, type Notification, type Report, type ReportRow, type ReviewItem, type Role, type Session, type StudentAttendance, type Suggestion, type User } from './types'
export type { ControllerClass, ControllerStudent } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '')
const localModeKey = 'rollcall-local-mode'

export const getApiBase = () => API_BASE
export const isLocalMode = () => window.localStorage.getItem(localModeKey) === 'true'
const setLocalMode = (value: boolean) => window.localStorage.setItem(localModeKey, String(value))

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
function text(value: unknown, fallback = ''): string { return value === null || value === undefined ? fallback : String(value) }
function id(value: unknown): string { return text(value) }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' ? value : Number(value ?? fallback) || fallback }
function status(value: unknown): AttendanceEntry['status'] { return value === 'present' || value === 'absent' || value === 'pending' ? value : 'pending' }
function normalizeUser(value: unknown): User {
  const raw = record(value)
  const r = text(raw.role)
  const role: Role = r === 'controller' ? 'controller' : r === 'teacher' ? 'teacher' : 'student'
  return { id: id(raw.id), name: text(raw.name, 'User'), email: text(raw.email), role }
}
function normalizeAttendance(value: unknown): AttendanceEntry {
  const raw = record(value)
  const updatedAt = raw.updated_at === null || raw.updated_at === undefined ? undefined : text(raw.updated_at)
  return {
    student_id: id(raw.student_id ?? raw.id),
    student_name: text(raw.name ?? raw.student_name, 'Student'),
    student_email: raw.email === undefined || raw.email === null ? undefined : text(raw.email),
    status: status(raw.status),
    confidence: raw.confidence === undefined || raw.confidence === null ? undefined : number(raw.confidence),
    note: raw.note === null || raw.note === undefined ? undefined : text(raw.note),
    changed_at: updatedAt,
    updated_at: updatedAt,
  }
}
function normalizeSuggestion(value: unknown): Suggestion {
  const raw = record(value)
  return { student_id: id(raw.student_id ?? raw.id), student_name: text(raw.name ?? raw.student_name, 'Student'), confidence: number(raw.confidence), status: raw.status === 'suggestion' ? 'suggestion' : status(raw.status) }
}
function normalizeReviewItem(value: unknown): ReviewItem {
  const raw = record(value)
  const rawStatus = String(raw.status ?? raw.state ?? 'flagged')
  const status: ReviewItem['status'] = rawStatus === 'verified' || rawStatus === 'rejected' ? rawStatus : 'flagged'
  const reasonCodes = list(raw.reason_codes).map(r => String(r))
  return {
    id: id(raw.id ?? raw.attempt_id),
    attempt_id: raw.attempt_id === undefined || raw.attempt_id === null ? id(raw.id) : String(raw.attempt_id),
    session_id: id(raw.session_id),
    student_id: id(raw.student_id),
    student_name: text(raw.student_name, 'Student'),
    student_email: text(raw.student_email),
    status,
    reason_codes: reasonCodes.length > 0 ? reasonCodes : (raw.error_code ? [String(raw.error_code)] : ['FLAGGED']),
    created_at: text(raw.created_at),
    filmstrip_urls: list(raw.filmstrip_urls).map(u => String(u)),
    metrics: record(raw.metrics),
  }
}
function normalizeSession(value: unknown): Session {
  const raw = record(value)
  const createdAt = text(raw.created_at ?? raw.started_at)
  const rawStatus = text(raw.status)
  const statusVal: Session['status'] = rawStatus === 'finalized' ? 'finalized' : rawStatus === 'closed' ? 'closed' : 'open'
  return {
    id: id(raw.id ?? raw.session_id),
    class_id: id(raw.class_id),
    class_name: raw.class_name === null || raw.class_name === undefined ? undefined : text(raw.class_name),
    started_at: createdAt,
    created_at: createdAt,
    starts_at: raw.starts_at === undefined || raw.starts_at === null ? undefined : text(raw.starts_at),
    ends_at: raw.ends_at === undefined || raw.ends_at === null ? undefined : text(raw.ends_at),
    duration_minutes: raw.duration_minutes === undefined ? undefined : number(raw.duration_minutes),
    finalized_at: raw.finalized_at === null || raw.finalized_at === undefined ? null : text(raw.finalized_at),
    status: statusVal,
    attendance: list(raw.attendance).map(normalizeAttendance),
    suggestions: list(raw.suggestions).map(normalizeSuggestion),
    present_count: raw.present_count === undefined ? undefined : number(raw.present_count),
    absent_count: raw.absent_count === undefined ? undefined : number(raw.absent_count),
    pending_count: raw.pending_count === undefined ? undefined : number(raw.pending_count),
    needs_review_count: raw.needs_review_count === undefined ? undefined : number(raw.needs_review_count),
    rejected_count: raw.rejected_count === undefined ? undefined : number(raw.rejected_count),
    total_enrolled: raw.total_enrolled === undefined ? undefined : number(raw.total_enrolled),
  }
}
function normalizeClass(value: unknown): ClassItem {
  const raw = record(value)
  return { id: id(raw.id ?? raw.class_id), name: text(raw.name ?? raw.title, 'Class'), code: raw.code === undefined ? undefined : text(raw.code), schedule: raw.schedule === undefined ? undefined : text(raw.schedule), room: raw.room === undefined ? undefined : text(raw.room), student_count: raw.student_count === undefined ? undefined : number(raw.student_count) }
}
function normalizeStudentAttendance(value: unknown): StudentAttendance {
  const raw = record(value)
  const summary = record(raw.summary)
  return {
    entries: list(raw.entries).map(entry => {
      const item = record(entry)
      return { session_id: id(item.session_id), class_name: item.class_name === undefined ? undefined : text(item.class_name), created_at: text(item.created_at), updated_at: item.updated_at === null || item.updated_at === undefined ? undefined : text(item.updated_at), status: status(item.status), note: item.note === null || item.note === undefined ? undefined : text(item.note) }
    }),
    summary: { present: number(summary.present), absent: number(summary.absent), pending: number(summary.pending), total_finalized: number(summary.total_finalized), percentage: summary.percentage === null || summary.percentage === undefined ? null : number(summary.percentage) },
  }
}
function normalizeAudit(value: unknown): AuditItem {
  const raw = record(value)
  const timestamp = text(raw.timestamp)
  return { id: id(raw.id), session_id: id(raw.session_id), action: text(raw.action, 'event'), timestamp, created_at: timestamp, note: raw.note === null || raw.note === undefined ? undefined : text(raw.note), metadata: record(raw.metadata), actor_name: raw.actor_name === undefined ? undefined : text(raw.actor_name), details: raw.note === null || raw.note === undefined ? undefined : text(raw.note) }
}
function normalizeNotification(value: unknown): Notification {
  const raw = record(value)
  const readAt = raw.read_at === null || raw.read_at === undefined ? null : text(raw.read_at)
  return { id: id(raw.id), title: text(raw.title, 'Attendance update'), body: text(raw.body), created_at: text(raw.created_at), read_at: readAt, read: Boolean(readAt) }
}
function normalizeReportRow(value: unknown): ReportRow {
  const raw = record(value)
  return { name: text(raw.name ?? raw.student_name, 'Student'), email: text(raw.email), status: status(raw.status), note: raw.note === null || raw.note === undefined ? undefined : text(raw.note), updated_at: raw.updated_at === null || raw.updated_at === undefined ? undefined : text(raw.updated_at) }
}
function demoReport(sessionId: string): Report {
  const session = normalizeSession({ ...demoSessions[0], id: sessionId })
  const rows = demoRoster.map(row => ({ name: row.student_name, email: `${row.student_id}@demo.edu`, status: row.status, note: row.note, updated_at: row.updated_at }))
  const csv = [['student_name', 'student_email', 'status', 'note', 'updated_at'], ...rows.map(row => [row.name, row.email, row.status, row.note || '', row.updated_at || ''])].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  return { session, rows, csv, pdf_html: `<h1>${session.class_name || 'Attendance'} attendance</h1><p>Session ${session.id}</p>` }
}

function readStoredUser(): User | null {
  try { const value = window.localStorage.getItem('rollcall-user'); return value ? normalizeUser(JSON.parse(value)) : null } catch { return null }
}

let token = window.localStorage.getItem('rollcall-token') || ''
let cachedUser: User | null = readStoredUser()

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function currentUser() { return cachedUser }
export function signOut() { token = ''; cachedUser = null; window.localStorage.removeItem('rollcall-token'); window.localStorage.removeItem('rollcall-user'); setLocalMode(false) }

export async function login(email: string, password: string): Promise<{ user: User; local: boolean }> {
  try {
    const result = await request<{ access_token: string; user: unknown }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    token = result.access_token; cachedUser = normalizeUser(result.user); setLocalMode(false)
    window.localStorage.setItem('rollcall-token', token); window.localStorage.setItem('rollcall-user', JSON.stringify(cachedUser))
    return { user: cachedUser, local: false }
  } catch (error) {
    const isTeacher = email === demoTeacher.email && password === 'teach123'
    const isStudent1 = email === demoStudent.email && password === 'student123'
    const isStudent2 = email === demoStudent2.email && password === 'student123'
    if (!isTeacher && !isStudent1 && !isStudent2) throw error
    cachedUser = isTeacher ? demoTeacher : isStudent2 ? demoStudent2 : demoStudent
    token = `demo-${cachedUser.id}`; setLocalMode(true)
    window.localStorage.setItem('rollcall-token', token); window.localStorage.setItem('rollcall-user', JSON.stringify(cachedUser))
    return { user: cachedUser, local: true }
  }
}

export async function getClasses(): Promise<ClassItem[]> { if (isLocalMode()) return demoClasses; return list(await request<unknown>('/classes')).map(normalizeClass) }
export async function getSessions(): Promise<Session[]> { if (isLocalMode()) return demoSessions; return list(await request<unknown>('/sessions')).map(normalizeSession) }
export async function getRoster(sessionId: string): Promise<Session> { if (isLocalMode()) return { ...demoSessions[0], id: sessionId, status: 'open', started_at: new Date().toISOString(), created_at: new Date().toISOString(), attendance: demoRoster, suggestions: [] }; return normalizeSession(await request<unknown>(`/sessions/${encodeURIComponent(sessionId)}`)) }

export async function serverTime(): Promise<Date> {
  if (isLocalMode()) return new Date()
  try {
    const res = await request<{ server_time: string }>('/time')
    return new Date(res.server_time)
  } catch {
    return new Date()
  }
}

export async function startSession(classId: string, durationMinutes = 10): Promise<Session> {
  if (isLocalMode()) return {
    id: `local-${Date.now()}`,
    class_id: classId,
    class_name: demoClasses.find(c => c.id === classId)?.name,
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + durationMinutes * 60000).toISOString(),
    duration_minutes: durationMinutes,
    status: 'open',
    attendance: demoRoster.map(s => ({ ...s, status: 'pending', confidence: undefined })),
  }
  return normalizeSession(await request<unknown>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, duration_minutes: durationMinutes }),
  }))
}

export async function getReviewQueue(sessionId: string): Promise<ReviewItem[]> {
  if (isLocalMode()) return []
  return list(await request<unknown>(`/sessions/${encodeURIComponent(sessionId)}/review-queue`)).map(normalizeReviewItem)
}

export async function submitReviewDecision(sessionId: string, attemptId: string, decision: 'verified' | 'rejected', note?: string): Promise<void> {
  if (isLocalMode()) return
  await request(`/sessions/${encodeURIComponent(sessionId)}/review/${encodeURIComponent(attemptId)}`, {
    method: 'POST',
    body: JSON.stringify({ decision, note }),
  })
}
export async function patchAttendance(sessionId: string, studentId: string, attendanceStatus: AttendanceEntry['status'], note?: string) { if (isLocalMode()) return; return request(`/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(studentId)}`, { method: 'PATCH', body: JSON.stringify({ status: attendanceStatus, note }) }) }
export async function finalize(sessionId: string) { if (isLocalMode()) return; return request(`/sessions/${encodeURIComponent(sessionId)}/finalize`, { method: 'POST', body: JSON.stringify({ mark_pending_absent: true }) }) }
export async function reports(sessionId: string): Promise<Report> {
  if (isLocalMode()) return demoReport(sessionId)
  const raw = record(await request<unknown>(`/reports/sessions/${encodeURIComponent(sessionId)}`))
  return { session: normalizeSession(raw.session), rows: list(raw.rows).map(normalizeReportRow), csv: text(raw.csv), pdf_html: text(raw.pdf_html ?? raw.pdf) }
}
export interface AnalyticsData {
  summary: {
    total_sessions: number
    total_classes: number
    total_students: number
    total_attendance_records: number
    present_count: number
    absent_count: number
    pending_count: number
    attendance_rate: number
    verified_live_count: number
    proxy_blocked_count: number
  }
  classes: Array<{
    id: string
    name: string
    code: string
    room_number: string
    session_count: number
  }>
  students: Array<{
    id: string
    name: string
    roll_number: string
    email: string
    registration_locked: boolean
    present_count: number
    total_sessions: number
    attendance_rate: number
    last_verified_at: string | null
    last_status: string
  }>
  recent_audits: AuditItem[]
}

export async function getAnalytics(): Promise<AnalyticsData> {
  if (isLocalMode()) {
    return {
      summary: {
        total_sessions: 3,
        total_classes: 2,
        total_students: 28,
        total_attendance_records: 84,
        present_count: 76,
        absent_count: 5,
        pending_count: 3,
        attendance_rate: 90.5,
        verified_live_count: 74,
        proxy_blocked_count: 2,
      },
      classes: [
        { id: 'c1', name: 'Computer Networks', code: 'CS-301', room_number: 'LH-302', session_count: 2 },
        { id: 'c2', name: 'Software Engineering', code: 'CS-401', room_number: 'Lab-104', session_count: 1 },
      ],
      students: [
        { id: 's1', name: 'Ada Lovelace', roll_number: 'CS-2024-001', email: 'student1@demo.edu', registration_locked: true, present_count: 3, total_sessions: 3, attendance_rate: 100, last_verified_at: new Date().toISOString(), last_status: 'present' },
        { id: 's2', name: 'Grace Hopper', roll_number: 'CS-2024-002', email: 'student2@demo.edu', registration_locked: true, present_count: 2, total_sessions: 3, attendance_rate: 66.7, last_verified_at: new Date().toISOString(), last_status: 'present' },
      ],
      recent_audits: [
        { id: 'a1', session_id: 'global', action: 'attendance.verified_live', actor_name: 'Ada Lovelace', timestamp: new Date().toISOString(), note: 'Face verified: Ada Lovelace (CS-2024-001) — 88% match + Classroom LH-302 confirmed' },
        { id: 'a2', session_id: 'global', action: 'attendance.proxy_rejected', actor_name: 'System Shield', timestamp: new Date(Date.now() - 300000).toISOString(), note: 'Proxy rejected: Scanned face matches Grace Hopper, not registered identity' },
      ],
    }
  }
  return request<AnalyticsData>('/analytics')
}

export function getMasterExcelUrl(): string {
  const t = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${API_BASE}/reports/analytics/excel${t}`
}

export async function audit(sessionId?: string): Promise<AuditItem[]> {
  if (isLocalMode()) return [
    { id: 'audit-1', session_id: sessionId || 'global', action: 'session.created', actor_name: demoTeacher.name, timestamp: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 3600000).toISOString(), note: 'Created CS-101 session in LH-302' },
    { id: 'audit-2', session_id: sessionId || 'global', action: 'attendance.verified_live', actor_name: 'Ada Lovelace', timestamp: new Date(Date.now() - 1800000).toISOString(), created_at: new Date(Date.now() - 1800000).toISOString(), note: 'Face verified (89% ArcFace match) + Classroom LH-302 confirmed' },
    { id: 'audit-3', session_id: sessionId || 'global', action: 'attendance.proxy_blocked', actor_name: 'Security Shield', timestamp: new Date(Date.now() - 900000).toISOString(), created_at: new Date(Date.now() - 900000).toISOString(), note: 'Proxy blocked: Face template matched another registered student' },
  ]
  const url = sessionId ? `/audit?session_id=${encodeURIComponent(sessionId)}` : '/audit'
  return list(await request<unknown>(url)).map(normalizeAudit)
}
export async function studentAttendance(): Promise<StudentAttendance> { if (isLocalMode()) return cachedUser?.id === demoStudent2.id ? demoStudentAttendance2 : demoStudentAttendance; return normalizeStudentAttendance(await request<unknown>('/students/me/attendance')) }
export async function notifications(): Promise<Notification[]> { if (isLocalMode()) return cachedUser?.role === 'teacher' ? [] : cachedUser?.id === demoStudent2.id ? demoNotifications2 : demoNotifications; return list(await request<unknown>('/notifications')).map(normalizeNotification) }
export async function markRead(notificationId: string) { if (isLocalMode()) return; return request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' }) }
export async function wsTicket(): Promise<string> { if (isLocalMode()) return `demo-ticket-${Date.now()}`; const result = record(await request<unknown>('/auth/ws-ticket', { method: 'POST' })); return text(result.ticket) }

export function openRealtime(ticket: string, onMessage: (event: { type: string; data?: unknown }) => void, onState: (state: 'connected' | 'closed' | 'error') => void) {
  if (isLocalMode()) { onState('connected'); return () => onState('closed') }
  const origin = new URL(API_BASE)
  const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${origin.host}/ws?ticket=${encodeURIComponent(ticket)}`)
  socket.onopen = () => onState('connected'); socket.onclose = () => onState('closed'); socket.onerror = () => onState('error'); socket.onmessage = event => { try { onMessage(JSON.parse(event.data)) } catch { /* ignore malformed event */ } }
  return () => socket.close()
}

export const roleLabel = (role: Role) => role === 'controller' ? 'Academic Controller' : role === 'teacher' ? 'Lecturer workspace' : 'Student view'

export function getExcelExportUrl(sessionId: string): string {
  const t = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/export/excel${t}`
}

export async function getControllerClasses(): Promise<ControllerClass[]> {
  if (isLocalMode()) {
    return [
      { id: 'class-1', name: 'Computer Networks', code: 'CS-301', section: 'Section A', room_number: 'LH-302', room_photo: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800', student_count: 32 },
      { id: 'class-2', name: 'Software Engineering', code: 'CS-401', section: 'Section B', room_number: 'Lab-104', room_photo: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800', student_count: 28 },
    ]
  }
  return list(await request<unknown>('/controller/classes')).map(c => {
    const raw = record(c)
    return {
      id: id(raw.id),
      name: text(raw.name),
      code: text(raw.code),
      section: text(raw.section),
      room_number: text(raw.room_number),
      capacity: number(raw.capacity, 120),
      hall_type: text(raw.hall_type, '120-Seater Lecture Theater'),
      room_photo: text(raw.room_photo),
      student_count: number(raw.student_count),
      teacher_name: text(raw.teacher_name, 'Unassigned'),
      reference_captured_at: raw.reference_captured_at ? text(raw.reference_captured_at) : undefined,
    }
  })
}

export async function createControllerClass(data: {
  name: string
  code: string
  section?: string
  room_number?: string
  capacity?: number
  hall_type?: string
  room_photo?: string
}): Promise<ControllerClass> {
  const res = record(await request<unknown>('/controller/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  }))
  return {
    id: id(res.id),
    name: text(res.name),
    code: text(res.code),
    section: text(res.section),
    room_number: text(res.room_number),
    capacity: number(res.capacity, 120),
    hall_type: text(res.hall_type, '120-Seater Lecture Theater'),
    room_photo: text(res.room_photo),
    student_count: number(res.student_count),
    teacher_name: text(res.teacher_name, 'Unassigned'),
  }
}

export async function captureClassRoom(classId: string, data: {
  photo_base64?: string
  capacity?: number
  hall_type?: string
  room_number?: string
}): Promise<ControllerClass> {
  const formData = new FormData()
  if (data.photo_base64) formData.append('photo_base64', data.photo_base64)
  if (data.capacity) formData.append('capacity', String(data.capacity))
  if (data.hall_type) formData.append('hall_type', data.hall_type)
  if (data.room_number) formData.append('room_number', data.room_number)

  const currentToken = token || window.localStorage.getItem('rollcall-token') || ''
  const headers: Record<string, string> = {}
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

  const res = await fetch(`${API_BASE}/controller/classes/${encodeURIComponent(classId)}/capture-room`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) throw new Error('Failed to capture room reference')
  const json = await res.json()
  return {
    id: id(json.class_id || classId),
    name: text(json.name),
    code: text(json.code),
    room_number: text(json.room_number),
    capacity: number(json.capacity, 120),
    hall_type: text(json.hall_type),
    room_photo: text(json.room_photo),
  }
}

export async function getControllerStudents(): Promise<ControllerStudent[]> {
  if (isLocalMode()) {
    return [
      { id: 'student-1', name: 'Jordan Ellis', email: 'student1@demo.edu', roll_number: 'CS-2026-001', student_id: 'STU-9021', registration_locked: true, has_template: true },
      { id: 'student-2', name: 'Samira Patel', email: 'student2@demo.edu', roll_number: 'CS-2026-002', student_id: 'STU-9022', registration_locked: false, has_template: false },
    ]
  }
  return list(await request<unknown>('/controller/students')).map(s => {
    const raw = record(s)
    return {
      id: id(raw.id),
      name: text(raw.name),
      email: text(raw.email),
      roll_number: text(raw.roll_number),
      student_id: text(raw.student_id),
      registration_locked: Boolean(raw.registration_locked),
      has_template: Boolean(raw.has_template),
    }
  })
}

export async function createControllerStudent(data: { name: string; email: string; roll_number?: string; student_id?: string }): Promise<ControllerStudent> {
  const res = record(await request<unknown>('/controller/students', {
    method: 'POST',
    body: JSON.stringify(data),
  }))
  return {
    id: id(res.id),
    name: text(res.name),
    email: text(res.email),
    roll_number: text(res.roll_number),
    student_id: text(res.student_id),
    registration_locked: Boolean(res.registration_locked),
    has_template: Boolean(res.has_template),
  }
}

export async function unlockStudentRegistration(studentId: string): Promise<void> {
  await request(`/controller/students/${encodeURIComponent(studentId)}/unlock`, {
    method: 'POST',
  })
}

export async function setSessionReference(sessionId: string, data: { photo_base64?: string; photo?: File }): Promise<{ session_id: string; status: string; room_photo: string }> {
  const currentToken = token || window.localStorage.getItem('rollcall-token') || ''
  const headers: Record<string, string> = {}
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

  const formData = new FormData()
  if (data.photo) formData.append('photo', data.photo)
  if (data.photo_base64) formData.append('photo_base64', data.photo_base64)

  const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}/reference`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) throw new Error('Failed to set session reference')
  return res.json()
}

export async function getRegistrationWindow(): Promise<{ is_open: boolean; updated_at: string; updated_by?: string }> {
  if (isLocalMode()) return { is_open: true, updated_at: new Date().toISOString() }
  return request<{ is_open: boolean; updated_at: string; updated_by?: string }>('/controller/registration-window')
}

export async function setRegistrationWindow(isOpen: boolean, note?: string): Promise<{ is_open: boolean; status: string; message: string }> {
  if (isLocalMode()) return { is_open: isOpen, status: isOpen ? 'open' : 'closed', message: 'Local updated' }
  return request<{ is_open: boolean; status: string; message: string }>('/controller/registration-window', {
    method: 'POST',
    body: JSON.stringify({ is_open: isOpen, note }),
  })
}

export async function importStudentRegistry(params: { file?: File; csvText?: string }): Promise<{
  total_processed: number
  imported: number
  updated: number
  error_count: number
  errors: string[]
  message: string
}> {
  const currentToken = token || window.localStorage.getItem('rollcall-token') || ''
  const headers: Record<string, string> = {}
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`

  const formData = new FormData()
  if (params.file) formData.append('file', params.file)
  if (params.csvText) formData.append('csv_text', params.csvText)

  const res = await fetch(`${API_BASE}/controller/registry/import`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Import failed' }))
    throw new Error(err.detail || 'Failed to import student registry')
  }
  return res.json()
}



import { type AttendanceEntry, type AuditItem, type ClassItem, type ImageSubmission, type Notification, type Report, type ReportRow, type Role, type Session, type SessionStatus, type StudentAttendance, type User } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://sdtt-attendance-system.onrender.com/api').replace(/\/$/, '')

export const getApiBase = () => API_BASE

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
function text(value: unknown, fallback = ''): string { return value === null || value === undefined ? fallback : String(value) }
function id(value: unknown): string { return text(value) }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' ? value : Number(value ?? fallback) || fallback }
function status(value: unknown): AttendanceEntry['status'] { return value === 'present' || value === 'absent' || value === 'pending' ? value : 'pending' }
function normalizeUser(value: unknown): User {
  const raw = record(value)
  return { id: id(raw.id), name: text(raw.name, 'User'), email: text(raw.email), role: raw.role === 'teacher' ? 'teacher' : raw.role === 'controller' ? 'controller' : 'student', registration_id: raw.registration_id === undefined ? undefined : text(raw.registration_id), face_enrolled: raw.face_enrolled === undefined ? undefined : Boolean(raw.face_enrolled) }
}
function normalizeAttendance(value: unknown): AttendanceEntry {
  const raw = record(value)
  const updatedAt = raw.updated_at === null || raw.updated_at === undefined ? undefined : text(raw.updated_at)
  return {
    student_id: id(raw.student_id ?? raw.id),
    registration_id: raw.registration_id === undefined ? undefined : text(raw.registration_id),
    student_name: text(raw.name ?? raw.student_name, 'Student'),
    student_email: raw.email === undefined || raw.email === null ? undefined : text(raw.email),
    status: status(raw.status),
    verification_status: raw.verification_status === undefined ? undefined : text(raw.verification_status),
    verification_source: raw.verification_source === undefined ? undefined : text(raw.verification_source),
    submission_time: raw.submission_time === undefined || raw.submission_time === null ? undefined : text(raw.submission_time),
    confidence: raw.confidence === undefined || raw.confidence === null ? undefined : number(raw.confidence),
    note: raw.note === null || raw.note === undefined ? undefined : text(raw.note),
    changed_at: updatedAt,
    updated_at: updatedAt,
  }
}
function normalizeSession(value: unknown): Session {
  const raw = record(value)
  const createdAt = text(raw.created_at ?? raw.started_at)
  return {
    id: id(raw.id ?? raw.session_id),
    class_id: id(raw.class_id),
    class_name: raw.class_name === null || raw.class_name === undefined ? undefined : text(raw.class_name),
    started_at: createdAt,
    created_at: createdAt,
    finalized_at: raw.finalized_at === null || raw.finalized_at === undefined ? null : text(raw.finalized_at),
    status: ['scheduled', 'open', 'closed', 'finalized'].includes(text(raw.status)) ? text(raw.status) as SessionStatus : 'open',
    title: text(raw.title, 'Attendance session'),
    professor_name: raw.professor_name === undefined ? undefined : text(raw.professor_name),
    opens_at: raw.opens_at === undefined || raw.opens_at === null ? undefined : text(raw.opens_at),
    deadline_at: raw.deadline_at === undefined || raw.deadline_at === null ? undefined : text(raw.deadline_at),
    closed_at: raw.closed_at === undefined || raw.closed_at === null ? null : text(raw.closed_at),
    stage_region: raw.stage_region && typeof raw.stage_region === 'object' ? raw.stage_region as Session['stage_region'] : null,
    minimum_people_visible: raw.minimum_people_visible === undefined ? undefined : number(raw.minimum_people_visible),
    submission: raw.submission && typeof raw.submission === 'object' ? record(raw.submission) as unknown as Session['submission'] : null,
    attendance: list(raw.attendance).map(normalizeAttendance),
    suggestions: [],
    present_count: raw.present_count === undefined ? undefined : number(raw.present_count),
    absent_count: raw.absent_count === undefined ? undefined : number(raw.absent_count),
    pending_count: raw.pending_count === undefined ? undefined : number(raw.pending_count),
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
      return { session_id: id(item.session_id), class_name: item.class_name === undefined ? undefined : text(item.class_name), created_at: text(item.created_at), updated_at: item.updated_at === null || item.updated_at === undefined ? undefined : text(item.updated_at), status: status(item.status), verification_status: item.verification_status === undefined ? undefined : text(item.verification_status), verification_source: item.verification_source === undefined ? undefined : text(item.verification_source), submission_time: item.submission_time === undefined || item.submission_time === null ? undefined : text(item.submission_time), note: item.note === null || item.note === undefined ? undefined : text(item.note) }
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
  return { student_code: raw.student_code === undefined ? undefined : text(raw.student_code), name: text(raw.name ?? raw.student_name, 'Student'), email: text(raw.email), status: status(raw.status), verification_status: raw.verification_status === undefined ? undefined : text(raw.verification_status), review_decision: raw.review_decision === null || raw.review_decision === undefined ? null : text(raw.review_decision), submission_time: raw.submission_time === null || raw.submission_time === undefined ? null : text(raw.submission_time), note: raw.note === null || raw.note === undefined ? undefined : text(raw.note), updated_at: raw.updated_at === null || raw.updated_at === undefined ? undefined : text(raw.updated_at) }
}
function readStoredUser(): User | null {
  try { if (window.localStorage.getItem('rollcall-token')?.startsWith('demo-')) { window.localStorage.removeItem('rollcall-token'); window.localStorage.removeItem('rollcall-user'); return null }; const value = window.localStorage.getItem('rollcall-user'); return value ? normalizeUser(JSON.parse(value)) : null } catch { return null }
}

let token = (window.localStorage.getItem('rollcall-token') || '').startsWith('demo-') ? '' : window.localStorage.getItem('rollcall-token') || ''
let cachedUser: User | null = readStoredUser()

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    const body = await response.text()
    let message = body || `Request failed (${response.status})`
    try { const parsed = record(JSON.parse(body)); message = text(parsed.detail ?? parsed.message, message) } catch { /* response was not JSON */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function currentUser() { return cachedUser }
export function signOut() { token = ''; cachedUser = null; window.localStorage.removeItem('rollcall-token'); window.localStorage.removeItem('rollcall-user') }

export async function login(email: string, password: string): Promise<{ user: User }> {
  const result = await request<{ access_token: string; user: unknown }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: email, password }) })
  token = result.access_token; cachedUser = normalizeUser(result.user)
  window.localStorage.setItem('rollcall-token', token); window.localStorage.setItem('rollcall-user', JSON.stringify(cachedUser))
  return { user: cachedUser }
}

export async function getClasses(): Promise<ClassItem[]> { return list(await request<unknown>('/classes')).map(normalizeClass) }
export async function getControllerClasses(): Promise<ClassItem[]> { return list(await request<unknown>('/controller/classes')).map(normalizeClass) }
export async function getControllerStudents(): Promise<Array<{ id: string; name: string; email: string; registration_id?: string; face_enrolled?: boolean }>> {
  return list(await request<unknown>('/controller/students')).map(value => { const raw = record(value); return { id: id(raw.id), name: text(raw.name, 'Student'), email: text(raw.email), registration_id: raw.registration_id === undefined ? undefined : text(raw.registration_id), face_enrolled: Boolean(raw.face_enrolled) } })
}
export async function controllerAudit(): Promise<AuditItem[]> { return list(await request<unknown>('/controller/audit')).map(normalizeAudit) }
export async function setRegistration(open: boolean) { return request(`/registration/${open ? 'open' : 'close'}`, { method: 'POST' }) }
export async function requestRegistrationStatus(): Promise<{ is_open: boolean; eligible: boolean; face_enrolled: boolean }> { return request<{ is_open: boolean; eligible: boolean; face_enrolled: boolean }>('/registration') }
export async function importRoster(file: File): Promise<{ accepted: number; rejected: number; errors: Array<{ row: number; reason: string }> }> {
  const form = new FormData(); form.append('file', file)
  return request<{ accepted: number; rejected: number; errors: Array<{ row: number; reason: string }> }>('/controller/students/import', { method: 'POST', body: form })
}
export async function getSessions(): Promise<Session[]> { return list(await request<unknown>('/sessions')).map(normalizeSession) }
export async function getRoster(sessionId: string): Promise<Session> { return normalizeSession(await request<unknown>(`/sessions/${encodeURIComponent(sessionId)}`)) }
export async function startSession(classId: string, details?: { title: string; opens_at: string; deadline_at: string; stage_region: { x: number; y: number; width: number; height: number } | null; minimum_people_visible: number }): Promise<Session> {
  return normalizeSession(await request<unknown>('/sessions', { method: 'POST', body: JSON.stringify({ class_id: classId, ...details }) }))
}
export async function submitPhoto(sessionId: string, file: File, onProgress: (progress: number) => void): Promise<ImageSubmission> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/submissions`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
    xhr.onerror = () => reject(new Error('Upload failed. Check the network connection and retry.'))
    xhr.onload = () => {
      const result = record((() => { try { return JSON.parse(xhr.responseText) } catch { return {} } })())
      if (xhr.status < 200 || xhr.status >= 300) reject(new Error(text(result.detail ?? result.message, `Upload failed (${xhr.status}).`)))
      else resolve({ id: text(result.id), session_id: text(result.session_id), student_id: '', student_name: '', submitted_at: text(result.submitted_at), status: text(result.status), explanation: text(result.explanation), quality_result: record(result.quality), detected_people: result.detected_people === null ? null : number(result.detected_people), nearby_people: result.nearby_people === null ? null : number(result.nearby_people), stage_person_detected: result.stage_person_detected === null ? null : Boolean(result.stage_person_detected), attempt_number: number(result.attempt_number) })
    }
    const form = new FormData(); form.append('photo', file); xhr.send(form)
  })
}
export async function listSubmissions(sessionId: string): Promise<ImageSubmission[]> { return list(await request<unknown>(`/sessions/${encodeURIComponent(sessionId)}/submissions`)).map(value => { const raw = record(value); return { id: id(raw.id), session_id: id(raw.session_id), student_id: id(raw.student_id), student_name: text(raw.student_name, 'Student'), student_email: raw.student_email === undefined ? undefined : text(raw.student_email), submitted_at: text(raw.submitted_at), status: text(raw.status), explanation: text(raw.explanation), quality_result: record(raw.quality_result), detected_people: raw.detected_people === null ? null : raw.detected_people === undefined ? undefined : number(raw.detected_people), nearby_people: raw.nearby_people === null ? null : raw.nearby_people === undefined ? undefined : number(raw.nearby_people), stage_person_detected: raw.stage_person_detected === null ? null : raw.stage_person_detected === undefined ? undefined : Boolean(raw.stage_person_detected), image_url: raw.image_url === null ? null : raw.image_url === undefined ? undefined : text(raw.image_url), review_decision: raw.review_decision === null ? null : raw.review_decision === undefined ? undefined : text(raw.review_decision), review_reason: raw.review_reason === null ? null : raw.review_reason === undefined ? undefined : text(raw.review_reason), attempt_number: number(raw.attempt_number) } }) }
export async function reviewSubmission(sessionId: string, submissionId: string, decision: 'approve' | 'reject', reason: string) { return request(`/sessions/${encodeURIComponent(sessionId)}/submissions/${encodeURIComponent(submissionId)}/review`, { method: 'POST', body: JSON.stringify({ decision, reason }) }) }
export async function openSession(sessionId: string) { return request(`/sessions/${encodeURIComponent(sessionId)}/open`, { method: 'POST' }) }
export async function closeSession(sessionId: string) { return request(`/sessions/${encodeURIComponent(sessionId)}/close`, { method: 'POST' }) }
export async function patchAttendance(sessionId: string, studentId: string, attendanceStatus: AttendanceEntry['status'], note?: string) { return request(`/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(studentId)}`, { method: 'PATCH', body: JSON.stringify({ status: attendanceStatus, note }) }) }
export async function finalize(sessionId: string) { return request(`/sessions/${encodeURIComponent(sessionId)}/finalize`, { method: 'POST', body: JSON.stringify({ mark_pending_absent: true }) }) }
export async function reports(sessionId: string): Promise<Report> {
  const raw = record(await request<unknown>(`/reports/sessions/${encodeURIComponent(sessionId)}`))
  const summary = record(raw.summary)
  return { session: normalizeSession(raw.session), rows: list(raw.rows).map(normalizeReportRow), summary: Object.keys(summary).length ? { total_enrolled: number(summary.total_enrolled), automatically_verified_present: number(summary.automatically_verified_present), manually_approved_present: number(summary.manually_approved_present), rejected_submissions: number(summary.rejected_submissions), awaiting_review: number(summary.awaiting_review), did_not_submit: number(summary.did_not_submit), final_absent: number(summary.final_absent) } : undefined, csv: text(raw.csv), pdf_html: text(raw.pdf_html ?? raw.pdf) }
}
export async function downloadXlsx(sessionId: string): Promise<Blob> {
  const headers = new Headers({ Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE}/reports/sessions/${encodeURIComponent(sessionId)}/xlsx`, { headers })
  if (!response.ok) throw new Error(`Workbook export failed (${response.status})`)
  return response.blob()
}
export async function audit(sessionId: string): Promise<AuditItem[]> {
  return list(await request<unknown>(`/audit?session_id=${encodeURIComponent(sessionId)}`)).map(normalizeAudit)
}
export async function studentAttendance(): Promise<StudentAttendance> { return normalizeStudentAttendance(await request<unknown>('/students/me/attendance')) }
export async function notifications(): Promise<Notification[]> { return list(await request<unknown>('/notifications')).map(normalizeNotification) }
export async function markRead(notificationId: string) { return request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' }) }
export async function wsTicket(): Promise<string> { const result = record(await request<unknown>('/auth/ws-ticket', { method: 'POST' })); return text(result.ticket) }

export function openRealtime(ticket: string, onMessage: (event: { type: string; data?: unknown }) => void, onState: (state: 'connected' | 'closed' | 'error') => void) {
  const origin = new URL(API_BASE)
  const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${origin.host}/ws?ticket=${encodeURIComponent(ticket)}`)
  socket.onopen = () => onState('connected'); socket.onclose = () => onState('closed'); socket.onerror = () => onState('error'); socket.onmessage = event => { try { onMessage(JSON.parse(event.data)) } catch { /* ignore malformed event */ } }
  return () => socket.close()
}

export const roleLabel = (role: Role) => role === 'teacher' ? 'Faculty workspace' : role === 'controller' ? 'Controller workspace' : 'Student view'

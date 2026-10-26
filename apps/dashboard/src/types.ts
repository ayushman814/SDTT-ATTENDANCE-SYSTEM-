export type Role = 'teacher' | 'student' | 'controller'
export type AttendanceStatus = 'present' | 'absent' | 'pending'

export interface User { id: string; name: string; email: string; role: Role }
export interface ControllerClass {
  id: string
  name: string
  code: string
  section?: string
  room_number?: string
  capacity?: number
  hall_type?: string
  room_photo?: string
  student_count?: number
  teacher_name?: string
  reference_captured_at?: string
}
export interface ControllerStudent {
  id: string
  name: string
  email: string
  roll_number?: string
  student_id?: string
  registration_locked: boolean
  has_template: boolean
}
export interface ClassItem { id: string; name: string; code?: string; schedule?: string; room?: string; student_count?: number }
export interface AttendanceEntry { student_id: string; student_name: string; student_email?: string; status: AttendanceStatus; confidence?: number; note?: string; changed_at?: string; updated_at?: string }
export interface Suggestion { student_id: string; student_name: string; confidence: number; status?: 'suggestion' | AttendanceStatus }
export interface ReviewItem {
  id: string
  attempt_id?: string
  session_id: string
  student_id: string
  student_name: string
  student_email: string
  status: 'flagged' | 'verified' | 'rejected'
  reason_codes: string[]
  created_at: string
  filmstrip_urls: string[]
  metrics?: Record<string, unknown>
}
export interface Session {
  id: string
  class_id: string
  class_name?: string
  started_at: string
  created_at?: string
  starts_at?: string
  ends_at?: string
  duration_minutes?: number
  finalized_at?: string | null
  status?: 'open' | 'closed' | 'finalized'
  attendance?: AttendanceEntry[]
  suggestions?: Suggestion[]
  present_count?: number
  absent_count?: number
  pending_count?: number
  needs_review_count?: number
  rejected_count?: number
  total_enrolled?: number
}
export interface AttendanceSummary { present: number; absent: number; pending: number; total_finalized: number; percentage: number | null }
export interface StudentAttendanceEntry { session_id: string; class_name?: string; created_at: string; updated_at?: string; status: AttendanceStatus; note?: string }
export interface StudentAttendance { entries: StudentAttendanceEntry[]; summary: AttendanceSummary }
export interface Notification { id: string; title: string; body: string; created_at: string; read_at?: string | null; read: boolean }
export interface AuditItem { id: string; session_id: string; action: string; timestamp: string; note?: string | null; metadata?: Record<string, unknown>; actor_name?: string; created_at?: string; details?: string }
export interface ReportRow { name: string; email: string; status: AttendanceStatus; note?: string | null; updated_at?: string }
export interface Report { session: Session; rows: ReportRow[]; csv: string; pdf_html: string }

export const demoTeacher: User = { id: 'teacher-1', name: 'Dr. Mira Chen', email: 'teacher@demo.edu', role: 'teacher' }
export const demoController: User = { id: 'controller-1', name: 'Dr. Sarah Vance', email: 'controller@demo.edu', role: 'controller' }
export const demoStudent: User = { id: 'student-1', name: 'Jordan Ellis', email: 'student1@demo.edu', role: 'student' }
export const demoStudent2: User = { id: 'student-2', name: 'Samira Patel', email: 'student2@demo.edu', role: 'student' }
export const demoClasses: ClassItem[] = [
  { id: 'cs-204', name: 'Human-Computer Interaction', code: 'CS 204', schedule: 'Mon / Wed · 10:00 AM', room: 'North Hall 204', student_count: 28 },
  { id: 'design-112', name: 'Design Systems Studio', code: 'DES 112', schedule: 'Tue / Thu · 1:30 PM', room: 'Arts Annex 12', student_count: 19 },
  { id: 'cs-318', name: 'Responsible AI Seminar', code: 'CS 318', schedule: 'Fri · 9:00 AM', room: 'Library Lab 3', student_count: 16 },
]
export const demoRoster: AttendanceEntry[] = [
  { student_id: 'student-1', student_name: 'Jordan Ellis', status: 'present', confidence: 0.98 },
  { student_id: 'student-2', student_name: 'Samira Patel', status: 'present', confidence: 0.94 },
  { student_id: 'student-3', student_name: 'Theo Martinez', status: 'pending' },
  { student_id: 'student-4', student_name: 'Casey Nguyen', status: 'absent' },
  { student_id: 'student-5', student_name: 'Ari Wilson', status: 'pending' },
  { student_id: 'student-6', student_name: 'Naomi Brooks', status: 'present', confidence: 0.89 },
]
export const demoSessions: Session[] = [
  { id: 'session-042', class_id: 'cs-204', class_name: 'Human-Computer Interaction', started_at: new Date(Date.now() - 86400000).toISOString(), status: 'finalized' },
  { id: 'session-041', class_id: 'design-112', class_name: 'Design Systems Studio', started_at: new Date(Date.now() - 172800000).toISOString(), status: 'finalized' },
  { id: 'session-040', class_id: 'cs-318', class_name: 'Responsible AI Seminar', started_at: new Date(Date.now() - 604800000).toISOString(), status: 'finalized' },
]
export const demoNotifications: Notification[] = [
  { id: 'note-1', title: 'Attendance posted', body: 'Your attendance for Human-Computer Interaction is now available.', created_at: new Date(Date.now() - 3600000).toISOString(), read_at: null, read: false },
  { id: 'note-2', title: 'Session finalized', body: 'Design Systems Studio · Tuesday session has been finalized.', created_at: new Date(Date.now() - 172800000).toISOString(), read_at: new Date(Date.now() - 171000000).toISOString(), read: true },
]
export const demoNotifications2: Notification[] = [
  { id: 'note-2-1', title: 'Attendance posted', body: 'Your attendance for Design Systems Studio is now available.', created_at: new Date(Date.now() - 5400000).toISOString(), read_at: null, read: false },
]
export const demoStudentAttendance: StudentAttendance = {
  entries: [
    { session_id: 'session-042', class_name: 'Human-Computer Interaction', created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 82800000).toISOString(), status: 'present' },
    { session_id: 'session-041', class_name: 'Design Systems Studio', created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 169200000).toISOString(), status: 'present' },
    { session_id: 'session-040', class_name: 'Responsible AI Seminar', created_at: new Date(Date.now() - 604800000).toISOString(), updated_at: new Date(Date.now() - 601200000).toISOString(), status: 'absent' },
    { session_id: 'session-039', class_name: 'Human-Computer Interaction', created_at: new Date(Date.now() - 864000000).toISOString(), updated_at: new Date(Date.now() - 860400000).toISOString(), status: 'present' },
    { session_id: 'session-038', class_name: 'Design Systems Studio', created_at: new Date(Date.now() - 1209600000).toISOString(), updated_at: new Date(Date.now() - 1206000000).toISOString(), status: 'present' },
  ],
  summary: { present: 4, absent: 1, pending: 0, total_finalized: 5, percentage: 80 },
}
export const demoStudentAttendance2: StudentAttendance = {
  entries: [
    { session_id: 'session-042', class_name: 'Human-Computer Interaction', created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 82800000).toISOString(), status: 'absent' },
    { session_id: 'session-041', class_name: 'Design Systems Studio', created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 169200000).toISOString(), status: 'present' },
    { session_id: 'session-040', class_name: 'Responsible AI Seminar', created_at: new Date(Date.now() - 604800000).toISOString(), updated_at: new Date(Date.now() - 601200000).toISOString(), status: 'present' },
  ],
  summary: { present: 2, absent: 1, pending: 0, total_finalized: 3, percentage: 66.7 },
}

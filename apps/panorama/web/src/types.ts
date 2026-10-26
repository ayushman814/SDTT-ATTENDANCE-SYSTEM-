export type Role = "student" | "professor";

export interface User {
  id: number;
  role: Role;
  name: string;
  email: string;
  roll_no: string | null;
  face_enrolled: boolean;
}

export interface SessionInfo {
  public_id: string;
  course_id: number;
  course_name: string;
  course_code: string;
  professor_name: string;
  start_time: string;
  end_time: string;
  status: "active" | "closed";
  geo_enabled: boolean;
}

export interface ActiveSession {
  public_id: string;
  course_code: string;
  course_name: string;
  start_time: string;
  end_time: string;
  geo_enabled: boolean;
  my_status: string | null;
  my_reason: string | null;
}

export type SubmissionStatus = "processing" | "present" | "rejected" | "pending_review";

export interface Submission {
  id: number;
  session_id: number;
  student_id: number;
  student_name: string;
  roll_no: string | null;
  image_url: string;
  submitted_at: string;
  status: SubmissionStatus;
  reason: string | null;
  scores: Record<string, unknown> | null;
}

export interface SessionSummary {
  session: SessionInfo;
  enrolled_count: number;
  present_count: number;
  absent_count: number;
  rejected_count: number;
  pending_count: number;
  present_pct: number;
  present: Submission[];
  rejected: Submission[];
  pending: Submission[];
}

export interface SessionListItem extends SessionInfo {
  present_count: number;
  submission_count: number;
}

export interface CourseHistory {
  course_code: string;
  course_name: string;
  sessions_attended: number;
  sessions_total: number;
  pct: number;
}

export interface StudentHistory {
  courses: CourseHistory[];
  submissions: Submission[];
}

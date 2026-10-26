-- ============================================================
--  Attendrix / SDTT Attendance System – Migration 002
--  Real Continuous Sweep Face Verification & Session Time Limits
-- ============================================================

-- 1. Extend sessions table with starts_at, ends_at, and duration_minutes
alter table public.sessions add column if not exists starts_at timestamptz;
alter table public.sessions add column if not exists ends_at timestamptz;
alter table public.sessions add column if not exists duration_minutes integer not null default 10;

-- Update status check constraint to include 'closed'
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('open', 'closed', 'finalized'));

-- 2. Biometric face_templates table (encrypted embeddings only)
create table if not exists public.face_templates (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade unique,
  encrypted_embedding text not null,
  model_version       text not null,
  consent_timestamp   timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- 3. Extend checkin_attempts table for sweep evidence & metrics
alter table public.checkin_attempts add column if not exists metrics_json text;
alter table public.checkin_attempts add column if not exists filmstrip_paths text[];

alter table public.checkin_attempts drop constraint if exists checkin_attempts_state_check;
alter table public.checkin_attempts add constraint checkin_attempts_state_check
  check (state in ('evaluating', 'verified', 'flagged', 'rejected', 'error'));

-- Ensure at most one VERIFIED record per (session, student)
create unique index if not exists idx_unique_verified_session_student
  on public.checkin_attempts(session_id, student_id)
  where state = 'verified';

-- 4. Row-Level Security for face_templates and checkin_attempts
alter table public.face_templates enable row level security;

-- Face templates: users can check their own enrollment status; backend service role reads embedding
create policy "face_templates_read_own" on public.face_templates
  for select using (auth.uid() = user_id);

create policy "face_templates_insert_own" on public.face_templates
  for insert with check (auth.uid() = user_id);

-- Students can read their own checkin attempts
create policy "checkin_attempts_student_read" on public.checkin_attempts
  for select using (student_id = auth.uid());

-- Teachers can read checkin attempts for their classes
create policy "checkin_attempts_teacher_read" on public.checkin_attempts
  for select using (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

-- 5. Drop deprecated simulated suggestions table if present
drop table if exists public.suggestions cascade;

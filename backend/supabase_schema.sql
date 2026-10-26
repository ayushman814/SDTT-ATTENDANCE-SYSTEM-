-- ============================================================
--  Classroom Attendance – Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
--
--  This script:
--    1. Enables UUID extension
--    2. Creates all tables (using UUIDs for PKs)
--    3. Links profiles to Supabase Auth users
--    4. Sets Row-Level Security (RLS) policies
--    5. Seeds demo data (optional – comment out for production)
-- ============================================================

-- 1. Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- 2. Tables ───────────────────────────────────────────────────

-- profiles: mirrors auth.users and stores role + display name
create table if not exists public.profiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  name     text        not null,
  email    text        not null unique,
  role     text        not null check (role in ('controller', 'teacher', 'student')),
  registration_id text unique,
  face_embedding_encrypted text,
  face_enrolled_at timestamptz,
  created_at timestamptz not null default now()
);

-- classes
create table if not exists public.classes (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  code       text not null unique,
  section    text not null default '',
  room_number text not null default '',
  teacher_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- enrollments
create table if not exists public.enrollments (
  class_id   uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  primary key (class_id, student_id)
);

-- sessions
create table if not exists public.sessions (
  id               uuid primary key default uuid_generate_v4(),
  class_id         uuid not null references public.classes(id),
  status           text not null check (status in ('open', 'closed', 'finalized')) default 'open',
  starts_at        timestamptz,
  ends_at          timestamptz,
  duration_minutes integer not null default 10,
  created_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now(),
  finalized_at     timestamptz
);

-- attendance
create table if not exists public.attendance (
  id         uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  status     text not null check (status in ('pending', 'present', 'absent')) default 'pending',
  note       text,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- face_templates: encrypted 512-d embeddings with consent timestamp
create table if not exists public.face_templates (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade unique,
  encrypted_embedding text not null,
  model_version       text not null,
  consent_timestamp   timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- checkin_attempts: continuous sweep verification records
create table if not exists public.checkin_attempts (
  id              uuid primary key default uuid_generate_v4(),
  attempt_id      text not null unique,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  state           text not null check (state in ('evaluating', 'verified', 'flagged', 'rejected', 'error')),
  error_code      text,
  metrics_json    text,
  filmstrip_paths text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Ensure at most one VERIFIED record per (session, student)
create unique index if not exists idx_unique_verified_session_student
  on public.checkin_attempts(session_id, student_id)
  where state = 'verified';

-- audit_log
create table if not exists public.audit_log (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references public.sessions(id) on delete cascade,
  action        text not null,
  actor_id      uuid not null references public.profiles(id),
  timestamp     timestamptz not null default now(),
  note          text,
  metadata_json text
);

-- notifications
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- 3. Indexes ──────────────────────────────────────────────────
create index if not exists idx_attendance_student    on public.attendance(student_id);
create index if not exists idx_checkin_session       on public.checkin_attempts(session_id);
create index if not exists idx_checkin_student       on public.checkin_attempts(student_id);
create index if not exists idx_audit_session         on public.audit_log(session_id);
create index if not exists idx_notifications_user    on public.notifications(user_id, created_at desc);

-- 4. Trigger: auto-create profile on Supabase Auth signup ─────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Row-Level Security ───────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.classes         enable row level security;
alter table public.enrollments     enable row level security;
alter table public.sessions        enable row level security;
alter table public.attendance      enable row level security;
alter table public.face_templates  enable row level security;
alter table public.audit_log       enable row level security;
alter table public.notifications   enable row level security;
alter table public.checkin_attempts enable row level security;

-- profiles: users can read their own; service role sees all
create policy "profiles_read_own" on public.profiles
  for select using (auth.uid() = id);

-- classes: teacher sees their own; enrolled students see their classes
create policy "classes_teacher_own" on public.classes
  for all using (auth.uid() = teacher_id);

create policy "classes_student_enrolled" on public.classes
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.class_id = id and e.student_id = auth.uid()
    )
  );

-- enrollments: teacher sees enrollments in their classes; students see their own
create policy "enrollments_teacher" on public.enrollments
  for select using (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

create policy "enrollments_student_own" on public.enrollments
  for select using (student_id = auth.uid());

-- sessions: teacher sees own; students see sessions in enrolled classes
create policy "sessions_teacher" on public.sessions
  for all using (
    exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

-- face_templates: users can check their own enrollment status; backend service role reads embedding
create policy "face_templates_read_own" on public.face_templates
  for select using (auth.uid() = user_id);

create policy "face_templates_insert_own" on public.face_templates
  for insert with check (auth.uid() = user_id);

-- checkin_attempts: students read own, teacher reads class attempts
create policy "checkin_attempts_student_read" on public.checkin_attempts
  for select using (student_id = auth.uid());

create policy "checkin_attempts_teacher_read" on public.checkin_attempts
  for select using (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

create policy "sessions_student" on public.sessions
  for select using (
    exists (
      select 1 from public.enrollments e where e.class_id = class_id and e.student_id = auth.uid()
    )
  );

-- attendance: teacher manages; student reads own
create policy "attendance_teacher" on public.attendance
  for all using (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

create policy "attendance_student_own" on public.attendance
  for select using (student_id = auth.uid());

-- notifications: users read/update their own
create policy "notifications_own" on public.notifications
  for all using (user_id = auth.uid());

-- audit_log: teacher reads their session audits
create policy "audit_teacher" on public.audit_log
  for select using (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

-- ============================================================
--  DEMO SEED DATA  (comment out or delete for production)
--
--  IMPORTANT: You must first create these users through
--  Supabase Auth (Dashboard → Authentication → Users → Add user)
--  and paste their UUIDs below before running this block.
--
--  Or use the Supabase Admin API / supabase CLI to create them.
-- ============================================================

-- After creating users via Supabase Auth, their profiles are
-- auto-created by the trigger above. Update roles with:
--
--   update public.profiles set role = 'teacher' where email = 'teacher@demo.edu';
--   update public.profiles set role = 'student' where email = 'student1@demo.edu';
--   update public.profiles set role = 'student' where email = 'student2@demo.edu';
--
-- Then enroll students:
--
--   insert into public.enrollments (class_id, student_id)
--   select
--     c.id,
--     p.id
--   from public.classes c, public.profiles p
--   where c.code = 'CS-101'
--   and p.email in ('student1@demo.edu', 'student2@demo.edu');
-- Smart Classroom Attendance upgrade for existing Supabase projects.
-- Run once in Supabase SQL Editor after the original schema.

alter table public.profiles
  add column if not exists registration_id text;
create unique index if not exists profiles_registration_id_unique
  on public.profiles (registration_id) where registration_id is not null;

-- Roles are assigned by an administrator/seed script, never by public signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.sessions
  add column if not exists title text not null default 'Attendance session',
  add column if not exists opens_at timestamptz,
  add column if not exists deadline_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists stage_region jsonb,
  add column if not exists minimum_people_visible integer not null default 2;
update public.sessions set opens_at = created_at where opens_at is null;
update public.sessions set deadline_at = created_at + interval '10 minutes' where deadline_at is null;
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('scheduled', 'open', 'closed', 'finalized'));
alter table public.sessions drop constraint if exists sessions_minimum_people_visible_check;
alter table public.sessions add constraint sessions_minimum_people_visible_check
  check (minimum_people_visible between 1 and 30);

alter table public.attendance
  add column if not exists verification_status text,
  add column if not exists verification_source text;
alter table public.attendance drop constraint if exists attendance_verification_status_check;
alter table public.attendance add constraint attendance_verification_status_check
  check (verification_status is null or verification_status in
    ('VERIFIED', 'NEEDS_REVIEW', 'REJECTED', 'MANUALLY_APPROVED', 'MANUALLY_REJECTED'));
alter table public.attendance drop constraint if exists attendance_verification_source_check;
alter table public.attendance add constraint attendance_verification_source_check
  check (verification_source is null or verification_source in ('automatic', 'manual'));

create table if not exists public.image_submissions (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number >= 1),
  submitted_at timestamptz not null default now(),
  status text not null check (status in ('VERIFIED', 'NEEDS_REVIEW', 'REJECTED')),
  explanation text not null,
  quality_result jsonb not null default '{}'::jsonb,
  analysis_json jsonb not null default '{}'::jsonb,
  detected_people integer,
  nearby_people integer,
  stage_person_detected boolean,
  storage_path text,
  image_sha256 text,
  review_decision text check (review_decision is null or review_decision in ('APPROVE', 'REJECT')),
  review_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.registration_windows (
  id boolean primary key default true check (id),
  is_open boolean not null default false,
  opened_by uuid references public.profiles(id),
  opened_at timestamptz,
  closed_at timestamptz
);
insert into public.registration_windows (id, is_open) values (true, false) on conflict (id) do nothing;

-- Separate verification evidence keeps identity, liveness, and classroom
-- context auditable without exposing biometric material to clients.
create table if not exists public.verification_attempts (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  identity_status text not null check (identity_status in ('VERIFIED', 'INCONCLUSIVE', 'REJECTED')),
  liveness_status text not null check (liveness_status in ('VERIFIED', 'INCONCLUSIVE', 'REJECTED')),
  classroom_status text not null check (classroom_status in ('VERIFIED', 'INCONCLUSIVE', 'REJECTED')),
  final_status text not null check (final_status in ('CONFIRMED', 'PENDING_REVIEW', 'REJECTED')),
  identity_result jsonb not null default '{}'::jsonb,
  liveness_result jsonb not null default '{}'::jsonb,
  classroom_result jsonb not null default '{}'::jsonb,
  reason text not null,
  unique (session_id, student_id)
);
create index if not exists idx_verification_attempts_session on public.verification_attempts(session_id, submitted_at desc);
alter table public.verification_attempts enable row level security;
create index if not exists idx_image_submissions_session_status
  on public.image_submissions(session_id, status, submitted_at desc);
create index if not exists idx_image_submissions_student
  on public.image_submissions(student_id, submitted_at desc);

alter table public.image_submissions enable row level security;
drop policy if exists image_submissions_student_read_own on public.image_submissions;
create policy image_submissions_student_read_own on public.image_submissions
  for select using (student_id = auth.uid());
drop policy if exists image_submissions_teacher_read on public.image_submissions;
create policy image_submissions_teacher_read on public.image_submissions
  for select using (
    exists (
      select 1 from public.sessions s
      join public.classes c on c.id = s.class_id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

-- Only the server's service-role key can read/write this private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-submissions', 'attendance-submissions', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];


-- Image retention worker progress marker (safe for existing/fresh installs).
alter table public.image_submissions
  add column if not exists image_purged_at timestamptz;

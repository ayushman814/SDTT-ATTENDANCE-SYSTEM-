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
  image_purged_at timestamptz,
  image_sha256 text,
  review_decision text check (review_decision is null or review_decision in ('APPROVE', 'REJECT')),
  review_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);
alter table public.image_submissions
  add column if not exists image_purged_at timestamptz;
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

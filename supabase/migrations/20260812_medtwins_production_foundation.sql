-- MedTwin production foundation. Apply with the Supabase CLI or SQL editor.
-- This schema stores screening records and audit events. It does not represent
-- a diagnostic system or a medication-prescribing workflow.

create extension if not exists pgcrypto;

create type public.medtwin_role as enum ('patient', 'clinician', 'admin');
create type public.medtwin_record_status as enum ('complete', 'incomplete');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.medtwin_role not null default 'patient',
  username text unique check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.screening_records (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^MT-[A-Z0-9-]{5,80}$'),
  patient_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  status public.medtwin_record_status not null,
  consent_version text not null,
  consented_at timestamptz not null,
  completed_at timestamptz not null,
  demographics jsonb not null,
  scan_result jsonb not null,
  triage_result jsonb not null,
  source text not null default 'smartphone_screening',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index screening_records_patient_created_idx on public.screening_records(patient_id, created_at desc);
create index screening_records_public_id_idx on public.screening_records(public_id);

create table public.record_clinician_access (
  record_id uuid not null references public.screening_records(id) on delete cascade,
  clinician_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (record_id, clinician_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  record_id uuid references public.screening_records(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.screening_records enable row level security;
alter table public.record_clinician_access enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.current_medtwin_role()
returns public.medtwin_role
language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'patient'::public.medtwin_role)
$$;

create policy "profiles: users read own" on public.profiles for select using (id = auth.uid());
create policy "profiles: users update own basic profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = public.current_medtwin_role());

create policy "records: patients read own" on public.screening_records for select using (patient_id = auth.uid());
create policy "records: clinicians read granted" on public.screening_records for select using (
  public.current_medtwin_role() in ('clinician', 'admin') and exists (
    select 1 from public.record_clinician_access access where access.record_id = screening_records.id and access.clinician_id = auth.uid()
  )
);

create policy "access: clinicians read own grants" on public.record_clinician_access for select using (clinician_id = auth.uid());
create policy "audit: users read own record events" on public.audit_events for select using (
  actor_id = auth.uid() or exists (
    select 1 from public.screening_records record where record.id = audit_events.record_id and record.patient_id = auth.uid()
  )
);

-- All inserts and clinician-access grants run only through server APIs using
-- the service-role key after verifying authentication and authorization.
revoke insert, update, delete on public.screening_records from anon, authenticated;
revoke insert, update, delete on public.record_clinician_access from anon, authenticated;
revoke insert, update, delete on public.audit_events from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, username, full_name)
  values (
    new.id,
    case when new.raw_app_meta_data ->> 'role' in ('clinician', 'admin') then (new.raw_app_meta_data ->> 'role')::public.medtwin_role else 'patient'::public.medtwin_role end,
    nullif(lower(new.raw_user_meta_data ->> 'username'), ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger screening_records_updated_at before update on public.screening_records for each row execute procedure public.set_updated_at();

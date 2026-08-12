-- Username support for projects where the production foundation migration was
-- already applied. Supabase Auth remains the credential authority; this table
-- stores only the public MedTwin username, never a password.

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$');

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

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

create extension if not exists pgcrypto;

create table if not exists public.gap_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade, title text not null, summary text,
  readiness_score integer not null default 0, items jsonb not null default '[]'::jsonb, status text not null default 'Complete',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.readiness_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade, title text not null, category text,
  description text, status text not null default 'Missing', owner text, due_date date, created_at timestamptz not null default now()
);
create table if not exists public.finding_responses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade, finding_id uuid references public.audit_findings(id) on delete set null,
  title text not null, correction text, root_cause text, why_analysis jsonb, fishbone_notes jsonb,
  corrective_action text, evidence_list jsonb, effectiveness_check text, method text, status text not null default 'Draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.closure_packs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade, title text not null, covering_letter text,
  finding_summary text, evidence_index jsonb, status text not null default 'Draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.audit_checklists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade, title text not null, audit_type text,
  checklist_type text, items jsonb not null default '[]'::jsonb, status text not null default 'Draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.gap_reports enable row level security;
alter table public.readiness_items enable row level security;
alter table public.finding_responses enable row level security;
alter table public.closure_packs enable row level security;
alter table public.audit_checklists enable row level security;

drop policy if exists "Users manage own gap reports" on public.gap_reports;
create policy "Users manage own gap reports" on public.gap_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own readiness items" on public.readiness_items;
create policy "Users manage own readiness items" on public.readiness_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own finding responses" on public.finding_responses;
create policy "Users manage own finding responses" on public.finding_responses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own closure packs" on public.closure_packs;
create policy "Users manage own closure packs" on public.closure_packs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own checklists" on public.audit_checklists;
create policy "Users manage own checklists" on public.audit_checklists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('audit-files', 'audit-files', false) on conflict (id) do update set public = false;
drop policy if exists "Users access own audit files" on storage.objects;
create policy "Users access own audit files" on storage.objects for all using (bucket_id = 'audit-files' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'audit-files' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- Verification query: run after this migration. Every result should be true or show a row.
select to_regclass('public.gap_reports') is not null as gap_reports_created,
       to_regclass('public.readiness_items') is not null as readiness_items_created,
       to_regclass('public.finding_responses') is not null as finding_responses_created,
       to_regclass('public.closure_packs') is not null as closure_packs_created,
       to_regclass('public.audit_checklists') is not null as audit_checklists_created;

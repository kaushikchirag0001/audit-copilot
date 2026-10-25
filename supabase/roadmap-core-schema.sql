-- Audit Copilot roadmap core schema.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.audit_criteria_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade,
  name text not null,
  source_type text not null default 'Standard'
    check (source_type in ('Standard', 'Customer checklist', 'Supplier manual', 'Company procedure', 'Regulatory criteria')),
  standard text,
  edition text,
  description text,
  file_id uuid references public.uploaded_files(id) on delete set null,
  criteria_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.gap_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade,
  criteria_source_id uuid references public.audit_criteria_sources(id) on delete set null,
  title text not null,
  summary text,
  readiness_score integer check (readiness_score is null or readiness_score between 0 and 100),
  status text not null default 'Draft'
    check (status in ('Draft', 'Analyzing', 'Complete', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gap_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.gap_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requirement_reference text,
  requirement_text text not null,
  classification text not null default 'Missing'
    check (classification in ('Covered', 'Partially covered', 'Missing', 'Not applicable')),
  evidence_found text,
  evidence_missing text,
  reason text,
  suggested_fix text,
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  owner text,
  due_date date,
  status text not null default 'Open'
    check (status in ('Open', 'In progress', 'Resolved', 'Accepted')),
  fixed_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.readiness_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.audit_projects(id) on delete cascade,
  title text not null,
  category text not null default 'Document'
    check (category in ('Document', 'Evidence', 'Record', 'People', 'Process', 'Other')),
  description text,
  status text not null default 'Missing'
    check (status in ('Missing', 'Requested', 'Available', 'Verified', 'Not applicable')),
  owner text,
  due_date date,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mock_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade,
  title text not null,
  audit_area text,
  standard text,
  status text not null default 'In progress'
    check (status in ('In progress', 'Complete', 'Archived')),
  score integer check (score is null or score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mock_audit_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mock_audits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_number integer not null,
  question text not null,
  user_answer text,
  evidence_description text,
  evaluation text,
  missing_points text,
  follow_up_question text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Answered', 'Reviewed')),
  created_at timestamptz not null default now()
);

create table if not exists public.finding_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade,
  finding_id uuid references public.audit_findings(id) on delete cascade,
  title text not null,
  finding_text text,
  correction text,
  root_cause text,
  why_analysis text,
  fishbone_notes text,
  corrective_action text,
  evidence_list text,
  effectiveness_check text,
  method text not null default 'CAPA'
    check (method in ('CAPA', '8D', '5 Why', 'Fishbone', 'Simple response')),
  status text not null default 'Draft'
    check (status in ('Draft', 'Under review', 'Submitted', 'Accepted', 'Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.closure_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.audit_projects(id) on delete cascade,
  title text not null,
  covering_letter text,
  evidence_index text,
  finding_summary text,
  submission_deadline date,
  status text not null default 'Draft'
    check (status in ('Draft', 'Ready for review', 'Submitted', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade,
  title text not null,
  audit_type text,
  standard text,
  checklist_type text not null default 'Internal'
    check (checklist_type in ('Internal', 'Customer', 'Supplier', 'Process', 'Product', 'Regulatory')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade,
  supplier_name text not null,
  supplier_contact text,
  audit_date date,
  standard text,
  score numeric,
  status text not null default 'Planning'
    check (status in ('Planning', 'In progress', 'Report ready', 'Follow-up required', 'Closed')),
  checklist jsonb not null default '[]'::jsonb,
  evaluation text,
  corrective_action_request text,
  follow_up_verification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.audit_criteria_sources enable row level security;
alter table public.gap_reports enable row level security;
alter table public.gap_items enable row level security;
alter table public.readiness_items enable row level security;
alter table public.mock_audits enable row level security;
alter table public.mock_audit_questions enable row level security;
alter table public.finding_responses enable row level security;
alter table public.closure_packs enable row level security;
alter table public.audit_checklists enable row level security;
alter table public.supplier_audits enable row level security;

drop policy if exists "Users manage own criteria sources" on public.audit_criteria_sources;
create policy "Users manage own criteria sources"
on public.audit_criteria_sources for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own gap reports" on public.gap_reports;
create policy "Users manage own gap reports"
on public.gap_reports for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own gap items" on public.gap_items;
create policy "Users manage own gap items"
on public.gap_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own readiness items" on public.readiness_items;
create policy "Users manage own readiness items"
on public.readiness_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own mock audits" on public.mock_audits;
create policy "Users manage own mock audits"
on public.mock_audits for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own mock audit questions" on public.mock_audit_questions;
create policy "Users manage own mock audit questions"
on public.mock_audit_questions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own finding responses" on public.finding_responses;
create policy "Users manage own finding responses"
on public.finding_responses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own closure packs" on public.closure_packs;
create policy "Users manage own closure packs"
on public.closure_packs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own audit checklists" on public.audit_checklists;
create policy "Users manage own audit checklists"
on public.audit_checklists for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage own supplier audits" on public.supplier_audits;
create policy "Users manage own supplier audits"
on public.supplier_audits for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists gap_reports_project_id_idx
on public.gap_reports(project_id);

create index if not exists gap_items_report_id_idx
on public.gap_items(report_id);

create index if not exists readiness_items_project_id_idx
on public.readiness_items(project_id);

create index if not exists mock_audits_project_id_idx
on public.mock_audits(project_id);

create index if not exists finding_responses_project_id_idx
on public.finding_responses(project_id);

create index if not exists closure_packs_project_id_idx
on public.closure_packs(project_id);

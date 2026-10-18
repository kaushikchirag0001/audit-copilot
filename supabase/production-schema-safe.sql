create extension if not exists pgcrypto;

create table if not exists public.audit_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  audit_type text,
  standard text,
  audit_scope text,
  audit_date date,
  status text not null default 'In preparation'
    check (status in ('In preparation', 'Ready for internal review', 'Complete', 'Archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_documents (
  project_id uuid not null references public.audit_projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  primary key (project_id, document_id)
);

alter table public.documents
  add column if not exists status text not null default 'Draft'
    check (status in ('Draft', 'Needs input', 'Reviewed', 'Approved', 'Archived'));

alter table public.documents
  add column if not exists project_id uuid references public.audit_projects(id) on delete set null;

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision_number integer not null default 1,
  content text not null,
  change_summary text,
  created_at timestamptz not null default now(),
  unique (document_id, revision_number)
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.audit_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'Missing'
    check (status in ('Missing', 'Requested', 'Uploaded', 'Verified', 'Not applicable')),
  owner text,
  due_date date,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.audit_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  severity text not null default 'Medium'
    check (severity in ('Low', 'Medium', 'High', 'Critical')),
  title text not null,
  description text,
  status text not null default 'Open'
    check (status in ('Open', 'In progress', 'Closed', 'Accepted')),
  owner text,
  due_date date,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.audit_projects(id) on delete cascade,
  finding_id uuid references public.audit_findings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  owner text,
  due_date date,
  status text not null default 'Open'
    check (status in ('Open', 'In progress', 'Complete', 'Overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.audit_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  file_type text,
  file_size integer,
  extracted_text text,
  status text not null default 'Reference'
    check (status in ('Reference', 'Evidence', 'Draft', 'Approved')),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.audit_projects(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.audit_projects enable row level security;
alter table public.project_documents enable row level security;
alter table public.documents enable row level security;
alter table public.document_revisions enable row level security;
alter table public.evidence_items enable row level security;
alter table public.audit_findings enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Users manage own projects" on public.audit_projects;
create policy "Users manage own projects"
  on public.audit_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own project documents" on public.project_documents;
create policy "Users manage own project documents"
  on public.project_documents for all
  using (
    exists (
      select 1 from public.audit_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.audit_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own revisions" on public.document_revisions;
create policy "Users manage own revisions"
  on public.document_revisions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own evidence" on public.evidence_items;
create policy "Users manage own evidence"
  on public.evidence_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own findings" on public.audit_findings;
create policy "Users manage own findings"
  on public.audit_findings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own corrective actions" on public.corrective_actions;
create policy "Users manage own corrective actions"
  on public.corrective_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own uploaded files" on public.uploaded_files;
create policy "Users manage own uploaded files"
  on public.uploaded_files for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own chat messages" on public.chat_messages;
create policy "Users manage own chat messages"
  on public.chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('audit-files', 'audit-files', false)
on conflict (id) do nothing;

drop policy if exists "Users access own audit files" on storage.objects;
create policy "Users access own audit files"
  on storage.objects for all
  using (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'audit-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

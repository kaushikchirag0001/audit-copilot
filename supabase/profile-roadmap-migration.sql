-- Audit Copilot roadmap: reusable company and audit profile fields.
-- Safe to run more than once.

alter table public.profiles
  add column if not exists site_location text,
  add column if not exists main_products text,
  add column if not exists main_processes text,
  add column if not exists employee_count text,
  add column if not exists departments text,
  add column if not exists applicable_standards text,
  add column if not exists numbering_scheme text,
  add column if not exists revision_format text,
  add column if not exists retention_period text,
  add column if not exists upcoming_audit_type text,
  add column if not exists upcoming_audit_date date,
  add column if not exists auditor_name text,
  add column if not exists audit_scope text,
  add column if not exists customer_requirements text,
  add column if not exists updated_at timestamptz default now();

create index if not exists profiles_upcoming_audit_date_idx
  on public.profiles (upcoming_audit_date);

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;

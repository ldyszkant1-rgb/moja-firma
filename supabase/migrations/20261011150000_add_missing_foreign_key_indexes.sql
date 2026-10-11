-- Add covering indexes for foreign keys flagged by the Supabase performance advisor.
-- These indexes do not change application behavior or access policies.
create index if not exists calendar_job_exclusions_job_id_idx
  on public.calendar_job_exclusions (job_id);

create index if not exists calendar_plans_job_id_idx
  on public.calendar_plans (job_id);

create index if not exists jobs_assigned_team_org_idx
  on public.jobs (assigned_team_id, organization_id);

create index if not exists profit_distributions_reversed_from_id_idx
  on public.profit_distributions (reversed_from_id);

create index if not exists team_members_org_user_idx
  on public.team_members (organization_id, user_id);

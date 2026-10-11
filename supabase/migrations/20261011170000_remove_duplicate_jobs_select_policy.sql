-- Remove a duplicate jobs SELECT policy.
-- The legacy policy has the exact same predicate as tenant_select_authenticated.
-- Keep members_can_view_organization_jobs because it supports users who belong
-- to more than one organization; tenant_select_authenticated uses the current
-- organization helper and is not equivalent for multi-organization accounts.
drop policy if exists "legacy device users can view current organization jobs" on public.jobs;

-- The membership-based policy already grants SELECT for every organization
-- the current user belongs to. private.current_organization_id() derives its
-- result from the same organization_members table, so the tenant policy is
-- redundant and can be removed without narrowing valid access.
-- Keep the membership policy because users may belong to multiple organizations.
drop policy if exists tenant_select_authenticated on public.jobs;

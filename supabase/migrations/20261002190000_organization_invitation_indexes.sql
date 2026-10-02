-- Performance indexes for organization invitation foreign keys.
-- Applied to the connected Supabase project on 2026-10-02.

create index if not exists organization_invitations_accepted_user_id_idx
  on public.organization_invitations (accepted_user_id);

create index if not exists organization_invitations_invited_by_idx
  on public.organization_invitations (invited_by);

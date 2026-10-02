alter table public.organization_members add column if not exists email text;
update public.organization_members om
set email = u.email
from auth.users u
where u.id = om.user_id and om.email is null;
create index if not exists organization_members_email_idx on public.organization_members(lower(email));

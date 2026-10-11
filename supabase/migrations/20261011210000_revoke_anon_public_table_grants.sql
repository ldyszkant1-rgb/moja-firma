-- Direct table access should require an authenticated Supabase session.
-- The legacy device flow uses authenticated anonymous-auth sessions, whose database
-- role is "authenticated"; it does not require direct grants to the "anon" role.
revoke all privileges on all tables in schema public from anon;
alter default privileges in schema public revoke all privileges on tables from anon;

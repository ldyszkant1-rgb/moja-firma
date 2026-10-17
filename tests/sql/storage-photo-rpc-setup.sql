-- Minimal isolated schema for exercising append_job_photo migration.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.jobs (
  id uuid primary key,
  organization_id uuid not null,
  photos jsonb not null default '[]'::jsonb
);

create table public.organization_members (
  organization_id uuid not null,
  user_id uuid not null,
  primary key (organization_id, user_id)
);

insert into public.jobs (id, organization_id, photos) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '[]'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '[]'::jsonb);

insert into public.organization_members (organization_id, user_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

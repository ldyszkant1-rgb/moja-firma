-- Close self-service enrollment for legacy Aeroinstal devices.
-- Existing device IDs remain valid; unknown IDs must be provisioned by an administrator.
create or replace function private.claim_legacy_device(p_device_id text, p_user_name text)
returns text language plpgsql security definer set search_path to '' as $function$
declare
  current_user_id uuid := (select auth.uid());
  assigned_user text;
  aeroinstal_org_id uuid;
  legacy_role text;
begin
  if current_user_id is null then raise exception 'Brak sesji użytkownika.'; end if;
  if coalesce((select auth.jwt()->>'is_anonymous'), 'false')::boolean is not true then raise exception 'To urządzenie wymaga sesji anonimowej.'; end if;
  if p_user_name is null or p_user_name not in ('Łukasz', 'Paweł') then raise exception 'Nieprawidłowy użytkownik urządzenia.'; end if;
  if p_device_id is null or length(trim(p_device_id)) < 8 then raise exception 'Nieprawidłowy identyfikator urządzenia.'; end if;
  select du.user_name into assigned_user from public.device_users du where du.device_id = p_device_id for update;
  if assigned_user is null then raise exception 'To urządzenie nie jest zarejestrowane. Skontaktuj się z administratorem Aeroinstal.'; end if;
  if assigned_user <> p_user_name then raise exception 'To urządzenie jest przypisane do innego użytkownika.'; end if;
  if exists (select 1 from public.device_users du where du.device_id = p_device_id and du.auth_user_id is not null and du.auth_user_id <> current_user_id) then raise exception 'To urządzenie ma już aktywną sesję innego użytkownika.'; end if;
  update public.device_users set auth_user_id = current_user_id where device_id = p_device_id and user_name = p_user_name;
  select o.id into aeroinstal_org_id from public.organizations o where o.name = 'Aeroinstal' limit 1;
  if aeroinstal_org_id is null then raise exception 'Nie znaleziono organizacji Aeroinstal.'; end if;
  legacy_role := case when p_user_name = 'Łukasz' then 'owner' else 'employee' end;
  insert into public.organization_members (organization_id, user_id, role, display_name) values (aeroinstal_org_id, current_user_id, legacy_role, p_user_name)
  on conflict (organization_id, user_id) do update set role = excluded.role, display_name = excluded.display_name;
  return p_user_name;
end;
$function$;

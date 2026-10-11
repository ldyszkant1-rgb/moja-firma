-- Keep legacy device assignments writable only through the vetted SECURITY DEFINER RPC.
-- The app reads/claims devices through public.claim_legacy_device, not direct table writes.
revoke all privileges on table public.device_users from public, anon, authenticated;
grant select on table public.device_users to authenticated;

-- The private implementation is only called by the SECURITY DEFINER public wrapper.
revoke all privileges on function private.claim_legacy_device(text, text) from public, anon, authenticated;

-- Allow only authenticated Supabase sessions (including anonymous-auth sessions) to use the public wrapper.
revoke all privileges on function public.claim_legacy_device(text, text) from public, anon;
grant execute on function public.claim_legacy_device(text, text) to authenticated;

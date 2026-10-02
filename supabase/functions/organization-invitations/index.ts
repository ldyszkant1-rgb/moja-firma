import { createSupabaseContext } from 'npm:@supabase/server@1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: 'user' })
  if (authError) return Response.json({ error: authError.message }, { status: authError.status, headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action || 'send'
    const userId = ctx.userClaims?.sub
    const email = String(ctx.userClaims?.email || '').trim().toLowerCase()

    if (!userId || !email) {
      return Response.json({ error: 'Brak danych zalogowanego użytkownika.' }, { status: 401, headers: corsHeaders })
    }

    if (action === 'send') {
      const inviteEmail = String(body?.email || '').trim().toLowerCase()
      const role = body?.role === 'admin' ? 'admin' : 'employee'

      if (!inviteEmail || !inviteEmail.includes('@')) {
        return Response.json({ error: 'Podaj prawidłowy adres e-mail.' }, { status: 400, headers: corsHeaders })
      }
      if (inviteEmail === email) {
        return Response.json({ error: 'Nie możesz zaprosić własnego konta.' }, { status: 400, headers: corsHeaders })
      }

      const { data: membership } = await ctx.supabaseAdmin
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId)
        .in('role', ['owner', 'admin'])
        .limit(1)
        .maybeSingle()

      if (!membership) {
        return Response.json({ error: 'Brak uprawnień do zapraszania pracowników.' }, { status: 403, headers: corsHeaders })
      }

      const { data: users } = await ctx.supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const memberIds = new Set(
        (await ctx.supabaseAdmin
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', membership.organization_id)).data?.map((row) => row.user_id) || []
      )

      if (users?.users?.some((u) => memberIds.has(u.id) && String(u.email || '').toLowerCase() === inviteEmail)) {
        return Response.json({ error: 'Ten adres e-mail jest już członkiem firmy.' }, { status: 409, headers: corsHeaders })
      }

      await ctx.supabaseAdmin
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('organization_id', membership.organization_id)
        .eq('email', inviteEmail)
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString())

      const { data: pending } = await ctx.supabaseAdmin
        .from('organization_invitations')
        .select('id')
        .eq('organization_id', membership.organization_id)
        .eq('email', inviteEmail)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      if (pending) {
        return Response.json({ error: 'Dla tego adresu istnieje już aktywne zaproszenie.' }, { status: 409, headers: corsHeaders })
      }

      const { data: invitation, error: invitationError } = await ctx.supabaseAdmin
        .from('organization_invitations')
        .insert({
          organization_id: membership.organization_id,
          email: inviteEmail,
          role,
          invited_by: userId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()

      if (invitationError) throw invitationError

      const siteUrl = Deno.env.get('APP_SITE_URL') || 'https://moja-firma.vercel.app'
      const { error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(inviteEmail, {
        data: {
          display_name: inviteEmail.split('@')[0],
          invitation_id: invitation.id,
          invitation_role: role,
        },
        redirectTo: siteUrl,
      })

      if (inviteError) {
        await ctx.supabaseAdmin.from('organization_invitations').delete().eq('id', invitation.id)
        throw inviteError
      }

      return Response.json({ ok: true, invitationId: invitation.id }, { headers: corsHeaders })
    }

    if (action === 'accept') {
      const invitationId = String(body?.invitationId || '').trim()
      if (!invitationId) {
        return Response.json({ error: 'Brak identyfikatora zaproszenia.' }, { status: 400, headers: corsHeaders })
      }

      const { data: invitation, error: invitationError } = await ctx.supabaseAdmin
        .from('organization_invitations')
        .select('id,organization_id,email,role,status,expires_at')
        .eq('id', invitationId)
        .maybeSingle()

      if (invitationError) throw invitationError
      if (!invitation) return Response.json({ error: 'Zaproszenie nie istnieje.' }, { status: 404, headers: corsHeaders })
      if (invitation.status !== 'pending') return Response.json({ error: 'Zaproszenie nie jest już aktywne.' }, { status: 409, headers: corsHeaders })
      if (new Date(invitation.expires_at).getTime() < Date.now()) {
        await ctx.supabaseAdmin.from('organization_invitations').update({ status: 'expired' }).eq('id', invitation.id)
        return Response.json({ error: 'Zaproszenie wygasło. Poproś administratora o nowe.' }, { status: 410, headers: corsHeaders })
      }
      if (String(invitation.email).trim().toLowerCase() !== email) {
        return Response.json({ error: 'To zaproszenie jest przeznaczone dla innego adresu e-mail.' }, { status: 403, headers: corsHeaders })
      }

      const { error: memberError } = await ctx.supabaseAdmin
        .from('organization_members')
        .upsert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          display_name: String(ctx.userClaims?.user_metadata?.display_name || email.split('@')[0]),
          email,
        }, { onConflict: 'organization_id,user_id' })

      if (memberError) throw memberError

      await ctx.supabaseAdmin
        .from('organization_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_user_id: userId,
        })
        .eq('id', invitation.id)

      return Response.json({ ok: true, organizationId: invitation.organization_id }, { headers: corsHeaders })
    }

    return Response.json({ error: 'Nieznana operacja.' }, { status: 400, headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error?.message || 'Wystąpił błąd serwera.' }, { status: 500, headers: corsHeaders })
  }
})

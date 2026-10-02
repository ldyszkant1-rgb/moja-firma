import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Brak konfiguracji Supabase po stronie serwera.')
    }

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return Response.json({ error: 'Brak autoryzacji.' }, { status: 401, headers: corsHeaders })
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser(token)
    if (userError || !user) {
      return Response.json({ error: 'Sesja logowania jest nieprawidłowa lub wygasła.' }, { status: 401, headers: corsHeaders })
    }

    const body = await req.json().catch(() => ({}))
    const action = body?.action || 'send'
    const userId = user.id
    const email = String(user.email || '').trim().toLowerCase()

    if (action === 'create-company') {
      const companyName = String(body?.name || '').trim()
      const displayName = String(body?.displayName || '').trim()
      if (!companyName) {
        return Response.json({ error: 'Podaj nazwę firmy.' }, { status: 400, headers: corsHeaders })
      }

      const { data: existingMembership } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (existingMembership) {
        return Response.json({ error: 'To konto ma już przypisaną firmę.' }, { status: 409, headers: corsHeaders })
      }

      let slug = companyName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50)

      if (!slug) slug = `firma-${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`

      const { data: organization, error: organizationError } = await admin
        .from('organizations')
        .insert({
          name: companyName,
          short_name: companyName,
          slug,
          plan: 'free',
          email,
        })
        .select('id')
        .single()

      if (organizationError) {
        if (organizationError.code === '23505') {
          return Response.json({ error: 'Taka nazwa firmy jest już zajęta. Wybierz inną nazwę.' }, { status: 409, headers: corsHeaders })
        }
        throw organizationError
      }

      const { error: membershipError } = await admin
        .from('organization_members')
        .insert({
          organization_id: organization.id,
          user_id: userId,
          role: 'owner',
          display_name: displayName || email.split('@')[0],
          email,
        })

      if (membershipError) {
        await admin.from('organizations').delete().eq('id', organization.id)
        throw membershipError
      }

      return Response.json({ ok: true, organizationId: organization.id }, { headers: corsHeaders })
    }

    const { data: membership } = await admin
      .from('organization_members')
      .select('organization_id,role')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle()

    if (!membership) {
      return Response.json({ error: 'Brak uprawnień do zarządzania pracownikami.' }, { status: 403, headers: corsHeaders })
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

      const { data: existingMembers } = await admin
        .from('organization_members')
        .select('email')
        .eq('organization_id', membership.organization_id)

      if ((existingMembers || []).some((row) => String(row.email || '').trim().toLowerCase() === inviteEmail)) {
        return Response.json({ error: 'Ten adres e-mail jest już członkiem firmy.' }, { status: 409, headers: corsHeaders })
      }

      await admin
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('organization_id', membership.organization_id)
        .eq('email', inviteEmail)
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString())

      const { data: pending } = await admin
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

      const { data: invitation, error: invitationError } = await admin
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
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(inviteEmail, {
        data: {
          display_name: inviteEmail.split('@')[0],
          invitation_id: invitation.id,
          invitation_role: role,
        },
        redirectTo: siteUrl,
      })

      if (inviteError) {
        await admin.from('organization_invitations').delete().eq('id', invitation.id)
        throw inviteError
      }

      return Response.json({ ok: true, invitationId: invitation.id }, { headers: corsHeaders })
    }

    if (action === 'accept') {
      const invitationId = String(body?.invitationId || '').trim()
      if (!invitationId) {
        return Response.json({ error: 'Brak identyfikatora zaproszenia.' }, { status: 400, headers: corsHeaders })
      }

      const { data: invitation, error: invitationError } = await admin
        .from('organization_invitations')
        .select('id,organization_id,email,role,status,expires_at')
        .eq('id', invitationId)
        .maybeSingle()

      if (invitationError) throw invitationError
      if (!invitation) return Response.json({ error: 'Zaproszenie nie istnieje.' }, { status: 404, headers: corsHeaders })
      if (invitation.status !== 'pending') return Response.json({ error: 'Zaproszenie nie jest już aktywne.' }, { status: 409, headers: corsHeaders })
      if (new Date(invitation.expires_at).getTime() < Date.now()) {
        await admin.from('organization_invitations').update({ status: 'expired' }).eq('id', invitation.id)
        return Response.json({ error: 'Zaproszenie wygasło. Poproś administratora o nowe.' }, { status: 410, headers: corsHeaders })
      }
      if (String(invitation.email).trim().toLowerCase() !== email) {
        return Response.json({ error: 'To zaproszenie jest przeznaczone dla innego adresu e-mail.' }, { status: 403, headers: corsHeaders })
      }

      const { data: currentMembership } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (currentMembership && currentMembership.organization_id !== invitation.organization_id) {
        return Response.json({ error: 'To konto należy już do innej firmy.' }, { status: 409, headers: corsHeaders })
      }

      const { error: memberError } = await admin
        .from('organization_members')
        .upsert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          display_name: String(user.user_metadata?.display_name || email.split('@')[0]),
          email,
        }, { onConflict: 'organization_id,user_id' })

      if (memberError) throw memberError

      await admin
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

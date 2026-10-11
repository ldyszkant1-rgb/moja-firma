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
      // Firma nie może być tworzona samodzielnie przez dowolną zalogowaną
      // lub anonimową sesję. Dostęp nadaje administrator przez zaproszenie.
      return Response.json(
        { error: 'Samodzielne tworzenie firmy jest wyłączone. Poproś administratora Aeroinstal o zaproszenie.' },
        { status: 403, headers: corsHeaders },
      )
    }

    if (action === 'list-my-invitations') {
      const { data: invitations, error: invitationsError } = await admin
        .from('organization_invitations')
        .select('id,organization_id,email,role,status,expires_at,organizations(name)')
        .eq('email', email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (invitationsError) throw invitationsError

      return Response.json({
        ok: true,
        invitations: (invitations || []).map((invite) => ({
          id: invite.id,
          organization_id: invite.organization_id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expires_at: invite.expires_at,
          organization_name: invite.organizations?.name || 'Twoja firma',
        })),
      }, { headers: corsHeaders })
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

      const { data: authUsers, error: authUsersError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      if (authUsersError) throw authUsersError

      const existingAuthUser = (authUsers?.users || []).find(
        (candidate) => String(candidate.email || '').trim().toLowerCase() === inviteEmail,
      )

      // Jeżeli konto już istnieje, nie próbujemy ponownie wysyłać
      // zaproszenia Auth. Dodajemy istniejącego użytkownika bezpośrednio
      // do bieżącej firmy. Użytkownik zachowuje swoje konto i logowanie.
      if (existingAuthUser) {
        const { data: existingMembership } = await admin
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', existingAuthUser.id)
          .limit(1)
          .maybeSingle()

        if (existingMembership && existingMembership.organization_id !== membership.organization_id) {
          return Response.json(
            { error: 'To konto należy już do innej firmy.' },
            { status: 409, headers: corsHeaders },
          )
        }

        if (!existingMembership) {
          const { error: memberError } = await admin
            .from('organization_members')
            .insert({
              organization_id: membership.organization_id,
              user_id: existingAuthUser.id,
              role,
              display_name: String(existingAuthUser.user_metadata?.display_name || inviteEmail.split('@')[0]),
              email: inviteEmail,
            })

          if (memberError) throw memberError
        }

        return Response.json(
          { ok: true, existingUser: true, userId: existingAuthUser.id },
          { headers: corsHeaders },
        )
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

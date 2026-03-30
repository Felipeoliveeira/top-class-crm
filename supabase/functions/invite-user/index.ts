import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar se o usuário chamador é admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse do Authorization: aceita tanto "Bearer <token>" quanto apenas "<token>".
    // O Supabase Edge Runtime valida o JWT, mas algumas variações de header podem quebrar o parse simples.
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authorization header sem token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token)

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar se o chamador tem role de admin na tabela perfis
    const { data: callerPerfil } = await supabaseAdmin
      .from('perfis')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerPerfil || callerPerfil.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem convidar usuários' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const frontendBase = (Deno.env.get('FRONTEND_URL') ?? '').replace(/\/$/, '')
    if (!frontendBase) {
      return new Response(
        JSON.stringify({
          error:
            'FRONTEND_URL não configurada na Edge Function. Defina o secret (ex.: https://app.seudominio.com ou http://localhost:8080).',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const redirectTo = `${frontendBase}/definir-senha`

    // -------------------------------------------------------------------------
    // Reenvio de convite (RF-34): mesmo redirect /definir-senha, novo link ~24h
    // -------------------------------------------------------------------------
    if (body.resend === true) {
      const email = String(body.email ?? '')
        .trim()
        .toLowerCase()
      if (!email) {
        return new Response(JSON.stringify({ error: 'E-mail é obrigatório para reenvio' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: perfil, error: perfilErr } = await supabaseAdmin
        .from('perfis')
        .select('id, email, nome_completo, role, ultimo_acesso')
        .ilike('email', email)
        .maybeSingle()

      if (perfilErr || !perfil) {
        return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (perfil.ultimo_acesso) {
        return new Response(
          JSON.stringify({
            error: 'Este usuário já realizou o primeiro acesso. Use recuperação de senha se necessário.',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { nome_completo: perfil.nome_completo, role: perfil.role },
        redirectTo,
      })

      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, message: 'Convite reenviado com sucesso!' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // -------------------------------------------------------------------------
    // Novo convite (RF-32)
    // -------------------------------------------------------------------------
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase()
    const nome_completo = String(body.nome_completo ?? '').trim()
    const role = body.role

    if (!email || !nome_completo || !role) {
      return new Response(JSON.stringify({ error: 'Email, nome e role são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { nome_completo, role },
      redirectTo,
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (inviteData?.user) {
      await supabaseAdmin.from('perfis').upsert({
        id: inviteData.user.id,
        email,
        nome_completo,
        role,
        status: 'ativo',
      })
    }

    return new Response(JSON.stringify({ success: true, message: 'Convite enviado com sucesso!' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

import { createClient } from 'npm:@supabase/supabase-js@2'

interface OutboxRow {
  id: string
  user_id: string
  title: string
  body: string
  data: Record<string, unknown> | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: OutboxRow
  schema: 'public'
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (payload.type !== 'INSERT' || payload.table !== 'push_notifications_outbox') {
    return Response.json({ skipped: true })
  }

  const record = payload.record
  const { data: tokens, error: tokenError } = await supabaseAdmin
    .from('user_push_tokens')
    .select('expo_push_token')
    .eq('user_id', record.user_id)

  if (tokenError) {
    console.error('[push] Failed to load tokens:', tokenError.message)
    return new Response(tokenError.message, { status: 500 })
  }

  if (!tokens || tokens.length === 0) {
    return Response.json({ delivered: 0, reason: 'no_tokens' })
  }

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (expoAccessToken) {
    headers.Authorization = `Bearer ${expoAccessToken}`
  }

  const messages = tokens.map((row) => ({
    to: row.expo_push_token,
    title: record.title,
    body: record.body,
    data: record.data ?? {},
    sound: 'default',
  }))

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  })

  const result = await response.json()

  if (!response.ok) {
    console.error('[push] Expo push failed:', result)
    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return Response.json({
    delivered: messages.length,
    expo: result,
  })
})

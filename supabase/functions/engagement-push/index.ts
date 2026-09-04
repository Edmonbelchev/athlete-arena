import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { data, error } = await supabaseAdmin.rpc('run_engagement_push_scheduler')

  if (error) {
    console.error('[engagement-push] Scheduler failed:', error.message)
    return new Response(error.message, { status: 500 })
  }

  return Response.json(data ?? { ok: true })
})

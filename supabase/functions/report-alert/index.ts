/**
 * Moderation alert for new user reports (user_reports INSERT, via a Supabase Database Webhook).
 * Sends a short summary to Slack and/or email so reports can be handled within 24 hours.
 *
 * Secrets (supabase secrets set ...):
 *   REPORT_ALERT_SECRET   required - must match the webhook's `x-report-alert-secret` header
 *   SLACK_WEBHOOK_URL     optional - Slack incoming webhook
 *   RESEND_API_KEY        optional - Resend API key, for email
 *   REPORT_ALERT_EMAIL    optional - where emails go (needs RESEND_API_KEY)
 *   REPORT_ALERT_FROM     optional - sender, default "Athlete Arena <onboarding@resend.dev>"
 */

interface ReportRow {
  id: string
  reporter_id: string
  reported_id: string
  reason: string
  details: string | null
  reported_username: string | null
  reported_display_name: string | null
  reported_bio: string | null
  created_at: string
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: ReportRow
}

const REASON_LABELS: Record<string, string> = {
  inappropriate_name: 'Inappropriate name',
  inappropriate_bio: 'Inappropriate bio',
  offensive_avatar: 'Offensive avatar',
  harassment: 'Harassment',
  cheating: 'Cheating',
  other: 'Other',
}

function summarize(report: ReportRow): { subject: string; text: string } {
  const who = report.reported_username ? `@${report.reported_username}` : report.reported_id
  const reason = REASON_LABELS[report.reason] ?? report.reason
  const lines = [
    `New user report: ${who}`,
    `Reason: ${reason}`,
    report.details ? `Details: ${report.details}` : null,
    report.reported_display_name ? `Display name: ${report.reported_display_name}` : null,
    report.reported_bio ? `Bio: ${report.reported_bio}` : null,
    `Reported user id: ${report.reported_id}`,
    `Reporter id: ${report.reporter_id}`,
    `Report id: ${report.id} (${report.created_at})`,
    'Review it in Supabase: Table Editor -> user_reports. Respond within 24 hours.',
  ].filter(Boolean)
  return { subject: `User report: ${who} (${reason})`, text: lines.join('\n') }
}

async function sendSlack(url: string, text: string): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    throw new Error(`Slack ${res.status}: ${await res.text()}`)
  }
}

async function sendEmail(apiKey: string, to: string, subject: string, text: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: Deno.env.get('REPORT_ALERT_FROM') ?? 'Athlete Arena <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('REPORT_ALERT_SECRET')
  if (!secret || req.headers.get('x-report-alert-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (payload.type !== 'INSERT' || payload.table !== 'user_reports' || !payload.record) {
    return Response.json({ skipped: true })
  }

  const { subject, text } = summarize(payload.record)
  const slackUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const email = Deno.env.get('REPORT_ALERT_EMAIL')

  const sends: Promise<void>[] = []
  if (slackUrl) sends.push(sendSlack(slackUrl, text))
  if (resendKey && email) sends.push(sendEmail(resendKey, email, subject, text))

  if (sends.length === 0) {
    console.error('[report-alert] No SLACK_WEBHOOK_URL or RESEND_API_KEY + REPORT_ALERT_EMAIL configured')
    return new Response('No alert channel configured', { status: 500 })
  }

  const results = await Promise.allSettled(sends)
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  failures.forEach((f) => console.error('[report-alert]', f.reason))

  return failures.length === results.length
    ? new Response('All alert channels failed', { status: 502 })
    : Response.json({ sent: results.length - failures.length, failed: failures.length })
})

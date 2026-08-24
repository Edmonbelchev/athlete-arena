import { createClient } from 'npm:@supabase/supabase-js@2'

const PREMIUM_ENTITLEMENT_ID = Deno.env.get('PREMIUM_ENTITLEMENT_ID') ?? 'athlete_arena_pro'
const WEBHOOK_AUTHORIZATION = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION') ?? ''
const WEBHOOK_SIGNING_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SIGNING_SECRET') ?? ''
const SIGNATURE_TOLERANCE_SECONDS = 300

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SubscriptionStatus = 'active' | 'expired' | 'canceled'

interface RevenueCatWebhookEvent {
  id?: string
  type?: string
  app_user_id?: string
  entitlement_ids?: string[] | null
  expiration_at_ms?: number | null
  transferred_from?: string[] | null
  transferred_to?: string[] | null
  environment?: string | null
}

interface RevenueCatWebhookPayload {
  api_version?: string
  event?: RevenueCatWebhookEvent
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'TEST',
])

const EXTEND_ACTIVE_EVENTS = new Set(['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'])

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)

  if (leftBytes.length !== rightBytes.length) {
    return false
  }

  let result = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    result |= leftBytes[index] ^ rightBytes[index]
  }

  return result === 0
}

async function verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SIGNING_SECRET) {
    return true
  }

  const signatureHeader = req.headers.get('X-RevenueCat-Webhook-Signature')
  if (!signatureHeader) {
    return false
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.trim().split('=')
      return [key, value]
    }),
  )

  const timestamp = parts.t
  const signature = parts.v1

  if (!timestamp || !signature) {
    return false
  }

  const timestampSeconds = Number.parseInt(timestamp, 10)
  if (!Number.isFinite(timestampSeconds)) {
    return false
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds)
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) {
    return false
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signedPayload = `${timestamp}.${rawBody}`
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return timingSafeEqual(expected, signature)
}

function verifyAuthorization(req: Request): boolean {
  if (!WEBHOOK_AUTHORIZATION) {
    console.warn('[revenuecat-webhook] REVENUECAT_WEBHOOK_AUTHORIZATION is not set')
    return false
  }

  const header = req.headers.get('Authorization') ?? ''
  return timingSafeEqual(header, WEBHOOK_AUTHORIZATION)
}

function parseSupabaseUserId(appUserId: string | undefined | null): string | null {
  if (!appUserId) {
    return null
  }

  return UUID_REGEX.test(appUserId) ? appUserId : null
}

function hasPremiumEntitlement(event: RevenueCatWebhookEvent): boolean {
  const entitlementIds = event.entitlement_ids ?? []
  return entitlementIds.includes(PREMIUM_ENTITLEMENT_ID)
}

function msToIso(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) {
    return null
  }

  return new Date(ms).toISOString()
}

function resolveSubscriptionUpdate(
  event: RevenueCatWebhookEvent,
): { status: SubscriptionStatus; expiresAt: string | null } | null {
  const eventType = event.type ?? ''

  if (eventType === 'EXPIRATION') {
    return {
      status: 'expired',
      expiresAt: msToIso(event.expiration_at_ms) ?? new Date().toISOString(),
    }
  }

  if (eventType === 'TRANSFER') {
    return {
      status: 'active',
      expiresAt: msToIso(event.expiration_at_ms),
    }
  }

  if (GRANT_EVENTS.has(eventType)) {
    return {
      status: 'active',
      expiresAt: msToIso(event.expiration_at_ms),
    }
  }

  if (EXTEND_ACTIVE_EVENTS.has(eventType)) {
    return {
      status: 'active',
      expiresAt: msToIso(event.expiration_at_ms),
    }
  }

  return null
}

function collectTargetUserIds(event: RevenueCatWebhookEvent): string[] {
  const eventType = event.type ?? ''
  const ids = new Set<string>()

  if (eventType === 'TRANSFER') {
    for (const appUserId of event.transferred_to ?? []) {
      const userId = parseSupabaseUserId(appUserId)
      if (userId) {
        ids.add(userId)
      }
    }
  }

  const primaryUserId = parseSupabaseUserId(event.app_user_id)
  if (primaryUserId) {
    ids.add(primaryUserId)
  }

  return [...ids]
}

function collectRevokedUserIds(event: RevenueCatWebhookEvent): string[] {
  if ((event.type ?? '') !== 'TRANSFER') {
    return []
  }

  const ids = new Set<string>()
  for (const appUserId of event.transferred_from ?? []) {
    const userId = parseSupabaseUserId(appUserId)
    if (userId) {
      ids.add(userId)
    }
  }

  return [...ids]
}

async function processSubscriptionForUser(
  event: RevenueCatWebhookEvent,
  userId: string,
  update: { status: SubscriptionStatus; expiresAt: string | null },
) {
  const { data, error } = await supabaseAdmin.rpc('process_revenuecat_webhook', {
    p_event_id: `${event.id}:${userId}`,
    p_event_type: event.type ?? 'unknown',
    p_app_user_id: event.app_user_id ?? userId,
    p_user_id: userId,
    p_status: update.status,
    p_expires_at: update.expiresAt,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!verifyAuthorization(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rawBody = await req.text()

  if (!(await verifyWebhookSignature(req, rawBody))) {
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: RevenueCatWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const event = payload.event
  if (!event?.id || !event.type) {
    return new Response('Missing webhook event', { status: 400 })
  }

  if (!hasPremiumEntitlement(event) && event.type !== 'TRANSFER' && event.type !== 'EXPIRATION') {
    return Response.json({ skipped: true, reason: 'non_premium_entitlement' })
  }

  const update = resolveSubscriptionUpdate(event)
  if (!update) {
    return Response.json({ skipped: true, reason: 'ignored_event_type', type: event.type })
  }

  const targetUserIds = collectTargetUserIds(event)
  if (targetUserIds.length === 0) {
    await supabaseAdmin.from('revenuecat_webhook_events').upsert({
      event_id: event.id,
      event_type: event.type,
      app_user_id: event.app_user_id ?? null,
    })

    return Response.json({ skipped: true, reason: 'non_profile_app_user_id' })
  }

  const results: Record<string, unknown>[] = []

  for (const userId of targetUserIds) {
    const result = await processSubscriptionForUser(event, userId, update)
    results.push({ userId, result })
  }

  for (const userId of collectRevokedUserIds(event)) {
    if (targetUserIds.includes(userId)) {
      continue
    }

    const result = await processSubscriptionForUser(event, userId, {
      status: 'expired',
      expiresAt: new Date().toISOString(),
    })
    results.push({ userId, revoked: true, result })
  }

  return Response.json({
    ok: true,
    event_id: event.id,
    type: event.type,
    environment: event.environment ?? null,
    results,
  })
})

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

interface TokenRow {
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface CalendarEvent {
  id: string
  summary: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
  colorId?: string
}

async function getAccessToken(env: CloudflareEnv): Promise<string | null> {
  const row = await env.DB
    .prepare('SELECT access_token, refresh_token, expires_at FROM google_tokens WHERE id = 1')
    .first() as TokenRow | null

  if (!row) return null

  // まだ有効なトークン（1分の余裕を持たせる）
  if (row.expires_at > Date.now() + 60_000) {
    return row.access_token
  }

  // リフレッシュ
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  })

  const data = await res.json() as { access_token: string; expires_in: number; error?: string }
  if (data.error || !data.access_token) return null

  const expiresAt = Date.now() + data.expires_in * 1000
  await env.DB.prepare(
    `UPDATE google_tokens SET access_token = ?, expires_at = ?, updated_at = datetime('now') WHERE id = 1`
  ).bind(data.access_token, expiresAt).run()

  return data.access_token
}

// GET /api/calendar/events — 今月±1ヶ月のイベント取得
export async function GET() {
  try {
    const { env } = await getCloudflareContext()
    const token = await getAccessToken(env)

    if (!token) {
      return NextResponse.json({ connected: false, events: [] })
    }

    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0)

    const params = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '200',
    })

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json() as { items?: CalendarEvent[] }

    return NextResponse.json({ connected: true, events: data.items ?? [] })
  } catch {
    return NextResponse.json({ error: 'カレンダーの取得に失敗しました' }, { status: 500 })
  }
}

// POST /api/calendar/events — 出勤イベントを作成
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext()
    const token = await getAccessToken(env)

    if (!token) {
      return NextResponse.json({ error: '未連携', connected: false }, { status: 401 })
    }

    const body = await request.json() as { date?: unknown; shift?: unknown; description?: unknown }

    // 入力バリデーション
    if (
      typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
      typeof body.shift !== 'string' || body.shift.length > 100 ||
      typeof body.description !== 'string' || body.description.length > 1000
    ) {
      return NextResponse.json({ error: '入力値が不正です' }, { status: 400 })
    }

    const event = {
      summary: `🏪 コスモス出勤（${body.shift}）`,
      description: body.description,
      start: { date: body.date },
      end: { date: body.date },
      colorId: '9',
    }

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'カレンダーへの追加に失敗しました' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'カレンダーへの追加に失敗しました' }, { status: 500 })
  }
}

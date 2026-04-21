import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const runtime = 'edge'

// GET /api/reports → 全日報を日付の新しい順で返す
export async function GET() {
  try {
    const { env } = await getCloudflareContext()
    const { results } = await env.DB
      .prepare('SELECT date, data FROM reports ORDER BY date DESC')
      .all()

    const reports = results.map((row) => {
      const r = row as { date: string; data: string }
      return JSON.parse(r.data)
    })

    return NextResponse.json({ reports })
  } catch {
    return NextResponse.json({ error: '日報の取得に失敗しました' }, { status: 500 })
  }
}

// POST /api/reports → 日報を保存（同じ日付があれば上書き）
export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext()
    const data = await request.json() as { date?: string }

    if (!data.date) {
      return NextResponse.json({ error: 'date が必要です' }, { status: 400 })
    }

    await env.DB
      .prepare(`
        INSERT INTO reports (date, data, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `)
      .bind(data.date, JSON.stringify(data))
      .run()

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '日報の保存に失敗しました' }, { status: 500 })
  }
}

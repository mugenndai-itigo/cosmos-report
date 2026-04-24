import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// 日付フォーマット検証（YYYY-MM-DD）
function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

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
    const data = await request.json() as { date?: unknown }

    // 入力バリデーション
    if (!isValidDate(data.date)) {
      return NextResponse.json({ error: '日付の形式が不正です' }, { status: 400 })
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

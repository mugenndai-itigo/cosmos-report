import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const runtime = 'edge'

// DELETE /api/reports/[date] → 指定した日付の日報を削除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params
    const { env } = await getCloudflareContext()

    await env.DB
      .prepare('DELETE FROM reports WHERE date = ?')
      .bind(date)
      .run()

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '日報の削除に失敗しました' }, { status: 500 })
  }
}

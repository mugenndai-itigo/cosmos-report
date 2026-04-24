import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// 日付フォーマット検証（YYYY-MM-DD）
function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

// DELETE /api/reports/[date] → 指定した日付の日報を削除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params

    // 入力バリデーション
    if (!isValidDate(date)) {
      return NextResponse.json({ error: '日付の形式が不正です' }, { status: 400 })
    }

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

import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const REDIRECT_URI = 'https://cosmos-report.rie813806.workers.dev/api/auth/google/callback'
const APP_URL = 'https://cosmos-report.rie813806.workers.dev'

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext()
    const url = new URL(request.url)
    const code = url.searchParams.get('code')

    if (!code) {
      return NextResponse.redirect(`${APP_URL}?error=auth_failed`)
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
      error?: string
    }

    if (tokens.error || !tokens.access_token) {
      return NextResponse.redirect(`${APP_URL}?error=token_failed`)
    }

    const expiresAt = Date.now() + tokens.expires_in * 1000

    await env.DB.prepare(`
      INSERT INTO google_tokens (id, access_token, refresh_token, expires_at, updated_at)
      VALUES (1, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, google_tokens.refresh_token),
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).bind(
      tokens.access_token,
      tokens.refresh_token ?? null,
      expiresAt
    ).run()

    return NextResponse.redirect(`${APP_URL}?connected=google`)
  } catch {
    return NextResponse.redirect(`${APP_URL}?error=server_error`)
  }
}

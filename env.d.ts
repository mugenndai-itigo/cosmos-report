// Cloudflare バインディングの型定義
// wrangler.jsonc の d1_databases と合わせて定義する

interface CloudflareEnv {
  DB: D1Database
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
}

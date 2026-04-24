import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // クリックジャッキング対策（iframeへの埋め込みを禁止）
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIMEタイプスニッフィング対策
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // リファラー情報を最小限に
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // カメラ・マイク等の不要なブラウザ機能を無効化
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig

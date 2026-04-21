-- コスモス日報 D1データベース スキーマ
-- Cloudflare D1 に適用するSQL

CREATE TABLE IF NOT EXISTS reports (
  date       TEXT PRIMARY KEY,          -- 例: "2026-04-21"
  data       TEXT NOT NULL,             -- JSON形式で日報データを保存
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 日付の降順インデックス（一覧取得を高速化）
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (date DESC);

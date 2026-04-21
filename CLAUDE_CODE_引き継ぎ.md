# 🏪 コスモス作業日報アプリ — Claude Code 引き継ぎ書

## 📋 プロジェクト概要

ドラッグストア「コスモス」で働く登録販売者（パート）向けの作業日報アプリをiPhoneで使えるように改修する。

---

## 👤 ユーザー情報

- 職種：登録販売者（パート）／コスモスドラッグストア勤務
- 端末：iPhone（Safari）＋ Mac
- 技術レベル：初心者（コードは読めないが指示はできる）
- 目標：iPhoneのホーム画面に追加してアプリのように使いたい

---

## 📁 既存ファイル

`drugstore_daily_report.html` がベースファイル。
このファイルをPWA（Progressive Web App）に改修する。

---

## ✅ やってほしいこと（優先順に）

### 1. PWA化（最優先）
iPhoneのホーム画面に追加してアプリのように起動できるようにする。

必要な対応：
- `manifest.json` の作成
  - `name`: "コスモス日報"
  - `short_name`: "日報"
  - `display`: "standalone"
  - `background_color`: "#534AB7"
  - `theme_color`: "#534AB7"
  - `start_url`: "./index.html"
  - `icons`: 192px・512px のPNGアイコン（紫背景に白の📋絵文字風）
- `service-worker.js` の作成（オフライン対応）
- `index.html` にPWA用メタタグを追加：
  ```html
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="コスモス日報">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="manifest" href="manifest.json">
  ```

### 2. iPhone向けUI最適化
- フォントサイズ最小16px（iOSの自動ズーム防止）
- タップターゲット最小44px（Apple HIG準拠）
- `viewport-fit=cover` でノッチ対応
- 送信ボタンは画面下部に固定（`position: fixed; bottom: env(safe-area-inset-bottom)`）
- スクロール時にヘッダーが邪魔にならないよう調整

### 3. ローカル保存機能（localStorage）
- 日報を送信したら `localStorage` に保存
- キー例：`report_2026-04-19`（日付ごと）
- 保存データのJSON構造：
```json
{
  "date": "2026-04-19",
  "start": "12:30",
  "end": "21:15",
  "shift": "遅番（〜21:15）",
  "members": ["りえ（自分）", "田中さん"],
  "categories": ["医薬品相談", "レジ・接客"],
  "tasks": ["花粉症薬の相談3件"],
  "consult": "5件",
  "pharma": "特になし",
  "hiyari": "特になし",
  "rating": 3,
  "memo": "忙しかった"
}
```

### 4. 過去の日報一覧画面
- 画面下部にタブバーを追加（「日報作成」「履歴」の2タブ）
- 履歴画面：localStorageから読み込んで日付順に一覧表示
- 各日報をタップすると詳細を表示
- 削除ボタンあり

### 5. 日報テキストのコピー＆共有
- 「日報テキストをコピー」ボタン
- iOSの共有シート（`navigator.share()`）対応
  ```javascript
  if (navigator.share) {
    await navigator.share({ title: '作業日報', text: reportText });
  }
  ```

---

## 🗂️ 作成するファイル構成

```
cosmos-report/
├── index.html          ← 既存HTMLをリネーム・改修
├── manifest.json       ← PWA設定
├── service-worker.js   ← オフラインキャッシュ
├── icons/
│   ├── icon-192.png    ← ホーム画面アイコン
│   └── icon-512.png    ← スプラッシュ用アイコン
└── CLAUDE_CODE_引き継ぎ.md  ← この文書
```

---

## 🎨 デザイン仕様

| 項目 | 値 |
|------|-----|
| メインカラー | `#534AB7`（紫） |
| サブカラー | `#7F77DD`（薄紫） |
| アクセント | `#EF9F27`（星評価のオレンジ） |
| 成功色 | `#3B6D11`（緑） |
| フォント | システムフォント（`-apple-system`） |
| 角丸 | `12px`〜`14px` |
| カードの影 | `box-shadow: 0 1px 4px rgba(0,0,0,.06)` |

---

## 📝 日報フォームの入力項目（現状）

| 項目 | 種別 | 備考 |
|------|------|------|
| 日付 | date input | 今日の日付がデフォルト |
| 開始時間 | time input | デフォルト12:30 |
| 終了時間 | time input | デフォルト21:15 |
| シフト区分 | ボタン選択 | 遅番/早番/中番/その他 |
| メンバー | タグ入力 | Enterキーで追加 |
| 作業カテゴリ | 複数選択ボタン | 医薬品相談/レジ/品出しなど |
| 作業内容詳細 | textarea（複数追加可） | |
| 医薬品相談件数 | text input | 登録販売者専用 |
| 第2類医薬品記録 | textarea | 登録販売者専用 |
| ヒヤリハット | textarea | 申し送り事項 |
| コンディション | 星評価（1〜5） | |
| メモ | textarea | |

---

## 🚀 Claude Codeへの最初の指示（コピペ用）

```
このフォルダにある drugstore_daily_report.html を
iPhoneのホーム画面から使えるPWAアプリに改修してください。

CLAUDE_CODE_引き継ぎ.md に詳細な仕様が書いてあります。
まずそのファイルを読んでから、作業を始めてください。

作業の順番：
1. まずファイル構成を作る（cosmos-reportフォルダ）
2. manifest.json と service-worker.js を作成
3. index.html にPWA用メタタグを追加
4. iPhone向けにUIを調整（フォントサイズ・タップ領域）
5. localStorageで日報を保存する機能を追加
6. 過去日報の履歴タブを追加
7. 共有ボタンを追加

わからないことがあれば日本語で質問してください。
```

---

## ⚠️ 注意事項

- **Google Calendar連携は今回は不要**（Claude.aiとの連携機能のため）
- iOSのSafariでは `navigator.share()` が使える
- `localStorage` はiOSのSafariでも動作する（シークレットモードを除く）
- アイコン画像はCanvasで生成してもOK（外部画像不要）
- デプロイ先は後で決める（GitHub Pages or Netlifyが候補）

---

## 📦 完成後にやること（Claude Codeに続けて頼む）

```
完成したらGitHub Pagesにデプロイする手順を教えてください。
GitHubのユーザー名は mugenndai-itigo です。
```

---

*作成日：2026-04-19 / Claude claude-sonnet-4-6による引き継ぎ書*

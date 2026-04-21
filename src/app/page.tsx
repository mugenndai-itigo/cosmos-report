'use client'

import { useState, useEffect } from 'react'

// ---------- 型定義 ----------
interface CalendarEvent {
  id: string
  summary: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
}

interface Report {
  date: string
  start: string
  end: string
  shift: string
  members: string[]
  categories: string[]
  tasks: string[]
  consult: string
  pharma: string
  hiyari: string
  rating: number
  memo: string
}

// ---------- 定数 ----------
const CATEGORIES = [
  '医薬品相談', 'レジ・接客', '品出し・陳列', '在庫確認',
  '発注', '清掃', '閉店作業', '棚卸し', '研修・勉強',
]

const SHIFTS = [
  { label: '遅番（〜21:15）', endTime: '21:15' },
  { label: '早番（〜17:00）', endTime: '17:00' },
  { label: '中番', endTime: '' },
  { label: 'その他', endTime: '' },
]

// ---------- ヘルパー関数 ----------
function calcHours(start: string, end: string): string {
  if (!start || !end) return '?'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + em - sh * 60 - sm
  if (mins <= 0) return '0'
  return (mins / 60).toFixed(2).replace(/\.?0+$/, '')
}

function buildReport(data: Report): string {
  const stars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating)
  const validTasks = data.tasks.filter(Boolean)
  return `【コスモス 作業日報】${data.date}
━━━━━━━━━━━━━━━━━━
◆ 基本情報
・日付：${data.date}
・勤務時間：${data.start}〜${data.end}（${calcHours(data.start, data.end)}h）
・シフト区分：${data.shift}

◆ 本日のメンバー
・${data.members.join('、') || '（未記入）'}

◆ 作業カテゴリ
・${data.categories.join('・') || '（未選択）'}

◆ 作業内容
${validTasks.length ? validTasks.map((t, i) => `${i + 1}. ${t}`).join('\n') : '（未記入）'}

◆ 登録販売者 専門記録
・医薬品相談：${data.consult || '記録なし'}
・第2類販売記録：${data.pharma || '特になし'}
・ヒヤリハット・申し送り：${data.hiyari || '特になし'}

◆ 本日のコンディション：${stars}（${data.rating}/5）
・メモ：${data.memo || '特になし'}
━━━━━━━━━━━━━━━━━━
#コスモス #登録販売者 #日報`
}

function getTodayStr(): string {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function copyText(text: string, btn: HTMLButtonElement) {
  const orig = btn.innerHTML
  try {
    await navigator.clipboard.writeText(text)
    btn.innerHTML = '✅ コピーしました'
    setTimeout(() => { btn.innerHTML = orig }, 2000)
  } catch {
    // フォールバック
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    btn.innerHTML = '✅ コピーしました'
    setTimeout(() => { btn.innerHTML = orig }, 2000)
  }
}

async function shareText(text: string) {
  try {
    await navigator.share({ title: 'コスモス 作業日報', text })
  } catch (e) {
    // AbortError（キャンセル）は無視
  }
}

// ---------- メインコンポーネント ----------
export default function CosmosReport() {
  // タブ
  const [activeTab, setActiveTab] = useState<'form' | 'calendar' | 'history'>('form')

  // フォームの状態
  const [date, setDate] = useState(getTodayStr())
  const [start, setStart] = useState('12:30')
  const [end, setEnd] = useState('21:15')
  const [shift, setShift] = useState('遅番（〜21:15）')
  const [members, setMembers] = useState<string[]>(['りえ（自分）'])
  const [memberInput, setMemberInput] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>(['医薬品相談'])
  const [tasks, setTasks] = useState<string[]>([''])
  const [consult, setConsult] = useState('')
  const [pharma, setPharma] = useState('')
  const [hiyari, setHiyari] = useState('')
  const [rating, setRating] = useState(3)
  const [memo, setMemo] = useState('')

  // UI の状態
  const [showPreview, setShowPreview] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastReport, setLastReport] = useState<Report | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 履歴
  const [reports, setReports] = useState<Report[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [modalReport, setModalReport] = useState<Report | null>(null)

  // Googleカレンダー
  const [calConnected, setCalConnected] = useState(false)
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [loadingCal, setLoadingCal] = useState(false)

  // 共有APIサポート確認（SSR対応）
  const [hasShare, setHasShare] = useState(false)
  useEffect(() => {
    setHasShare(!!navigator.share)

    // Service Worker 登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {})
    }

    // Google連携の状態チェック
    fetchCalendar()

    // 連携完了のURLパラメータを確認
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'google') {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // ---------- Googleカレンダー ----------
  async function fetchCalendar() {
    setLoadingCal(true)
    try {
      const res = await fetch('/api/calendar/events')
      const data = await res.json() as { connected: boolean; events: CalendarEvent[] }
      setCalConnected(data.connected)
      setCalEvents(data.events ?? [])
    } catch {
      // 取得失敗は無視
    } finally {
      setLoadingCal(false)
    }
  }

  function getEventDate(ev: CalendarEvent): string {
    return ev.start.date ?? ev.start.dateTime?.slice(0, 10) ?? ''
  }

  // ---------- 日報の読み込み ----------
  async function fetchReports() {
    setLoadingHistory(true)
    setError('')
    try {
      const res = await fetch('/api/reports')
      if (!res.ok) throw new Error()
      const { reports: data } = await res.json() as { reports: Report[] }
      setReports(data)
    } catch {
      setError('日報の読み込みに失敗しました。インターネット接続を確認してください。')
    } finally {
      setLoadingHistory(false)
    }
  }

  // ---------- フォームデータの収集 ----------
  function collectFormData(): Report {
    return {
      date, start, end, shift,
      members,
      categories: selectedCats,
      tasks: tasks.filter(Boolean),
      consult, pharma, hiyari, rating, memo,
    }
  }

  // ---------- 勤務時間の計算 ----------
  function durationLabel(): string {
    const h = calcHours(start, end)
    return h && h !== '0' ? `勤務時間：${h}時間` : ''
  }

  // ---------- メンバー操作 ----------
  function addMember() {
    const val = memberInput.trim()
    if (val) {
      setMembers(prev => [...prev, val])
      setMemberInput('')
      document.getElementById('member-inp')?.focus()
    }
  }

  function handleMemberKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    addMember()
  }

  function removeMember(name: string) {
    setMembers(prev => prev.filter(m => m !== name))
  }

  // ---------- カテゴリ操作 ----------
  function toggleCat(cat: string) {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  // ---------- タスク操作 ----------
  function addTask() { setTasks(prev => [...prev, '']) }
  function updateTask(idx: number, val: string) {
    setTasks(prev => { const n = [...prev]; n[idx] = val; return n })
  }
  function removeTask(idx: number) {
    if (tasks.length > 1) setTasks(prev => prev.filter((_, i) => i !== idx))
  }

  // ---------- 日報を保存 ----------
  async function submitReport() {
    setSaving(true)
    setError('')
    const data = collectFormData()
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()

      setLastReport(data)
      setShowSuccess(true)
      setShowPreview(false)

      // バックグラウンドでクリップボードにもコピー
      const text = buildReport(data)
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})

      // Googleカレンダーに出勤イベントを自動追加
      if (calConnected) {
        fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: data.date,
            shift: data.shift,
            description: `勤務時間: ${data.start}〜${data.end}（${calcHours(data.start, data.end)}h）\nメンバー: ${data.members.join('、')}`,
          }),
        }).catch(() => {})
      }

      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('保存に失敗しました。インターネット接続を確認してください。')
    } finally {
      setSaving(false)
    }
  }

  // ---------- フォームリセット ----------
  function resetForm() {
    setShowSuccess(false)
    setDate(getTodayStr())
    setMembers(['りえ（自分）'])
    setMemberInput('')
    setSelectedCats(['医薬品相談'])
    setConsult(''); setPharma(''); setHiyari(''); setMemo('')
    setTasks([''])
    setRating(3)
    setShowPreview(false)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---------- 日報を削除 ----------
  async function deleteReport(reportDate: string) {
    if (!confirm(`${reportDate} の日報を削除しますか？`)) return
    try {
      await fetch(`/api/reports/${reportDate}`, { method: 'DELETE' })
      setReports(prev => prev.filter(r => r.date !== reportDate))
    } catch {
      setError('削除に失敗しました。')
    }
  }

  // ---------- タブ切り替え ----------
  function switchTab(tab: 'form' | 'calendar' | 'history') {
    setActiveTab(tab)
    if (tab === 'history') fetchReports()
    if (tab === 'calendar') fetchCalendar()
  }

  // ---------- テキスト生成 ----------
  const previewText = showPreview ? buildReport(collectFormData()) : ''
  const lastReportText = lastReport ? buildReport(lastReport) : ''
  const modalText = modalReport ? buildReport(modalReport) : ''

  // ---------- 描画 ----------
  return (
    <>
      {/* ヘッダー */}
      <div className="app-header">
        <h1>
          📋 コスモス 作業日報
          <span className="sync-badge">☁️ クラウド同期</span>
        </h1>
        <p>登録販売者 日次記録アプリ — Mac・iPhone どちらからでも記録できます</p>
      </div>

      {/* ===== 日報作成タブ ===== */}
      {activeTab === 'form' && (
        <div className="container">

          {/* エラー表示 */}
          {error && <div className="error-box">⚠️ {error}</div>}

          {/* 保存完了 */}
          {showSuccess && lastReport && (
            <div className="success-box">
              <div className="success-icon">✅</div>
              <p>{lastReport.date} の日報をクラウドに保存しました！<br />Mac・iPhone どちらからも確認できます。</p>
              <div className="action-btns">
                <button
                  className="action-btn btn-copy"
                  onClick={e => copyText(lastReportText, e.currentTarget)}
                >
                  📋 コピー
                </button>
                {hasShare && (
                  <button
                    className="action-btn btn-share"
                    onClick={() => shareText(lastReportText)}
                  >
                    📤 共有
                  </button>
                )}
              </div>
              <div className="action-btns" style={{ marginTop: 8 }}>
                <button className="action-btn btn-reset" onClick={resetForm}>
                  ＋ 新しい日報を作成する
                </button>
              </div>
            </div>
          )}

          {/* フォーム本体（保存完了後は非表示） */}
          {!showSuccess && (
            <>
              {/* 基本情報 */}
              <div className="card">
                <div className="card-title">基本情報</div>
                <div className="field-row">
                  <div className="field">
                    <label>日付</label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>開始時間</label>
                    <input
                      type="time"
                      value={start}
                      onChange={e => setStart(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>終了時間</label>
                    <input
                      type="time"
                      value={end}
                      onChange={e => setEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="duration-display">{durationLabel()}</div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, color: '#a0aec0', fontWeight: 500 }}>
                    シフト区分
                  </label>
                  <div className="shift-btns">
                    {SHIFTS.map(s => (
                      <button
                        key={s.label}
                        className={`sbtn${shift === s.label ? ' sel' : ''}`}
                        onClick={() => {
                          setShift(s.label)
                          if (s.endTime) setEnd(s.endTime)
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* メンバー */}
              <div className="card">
                <div className="card-title">本日のメンバー</div>
                <div className="member-tags">
                  {members.map(m => (
                    <div key={m} className="mtag">
                      {m}
                      <button onClick={() => removeMember(m)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="member-input-row">
                  <input
                    id="member-inp"
                    type="text"
                    placeholder="名前を入力…"
                    value={memberInput}
                    onChange={e => setMemberInput(e.target.value)}
                    onKeyDown={handleMemberKeyDown}
                  />
                  <button
                    className="member-add-btn"
                    onClick={addMember}
                    disabled={!memberInput.trim()}
                  >
                    追加
                  </button>
                </div>
                <div className="hint">
                  「追加」ボタンまたはEnterキーで追加できます。
                </div>
              </div>

              {/* 作業カテゴリ */}
              <div className="card">
                <div className="card-title">作業カテゴリ（複数選択可）</div>
                <div className="cat-btns">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      className={`sbtn${selectedCats.includes(cat) ? ' sel' : ''}`}
                      onClick={() => toggleCat(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 作業内容 */}
              <div className="card">
                <div className="card-title">作業内容の詳細</div>
                {tasks.map((task, idx) => (
                  <div key={idx} className="task-row">
                    <textarea
                      rows={3}
                      placeholder="例：花粉症薬の相談対応 3件。アレグラとクラリチンの違いを案内しました。"
                      value={task}
                      onChange={e => updateTask(idx, e.target.value)}
                    />
                    <button className="del-btn" onClick={() => removeTask(idx)}>×</button>
                  </div>
                ))}
                <button className="add-btn" onClick={addTask}>＋ 作業を追加</button>
              </div>

              {/* 登録販売者専用記録 */}
              <div className="card">
                <div className="card-title">登録販売者 専門記録</div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>医薬品相談件数と内容</label>
                  <input
                    type="text"
                    value={consult}
                    onChange={e => setConsult(e.target.value)}
                    placeholder="例：5件（花粉症×3、頭痛×1、胃腸薬×1）"
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>第2類医薬品 販売・対応の記録</label>
                  <textarea
                    rows={3}
                    value={pharma}
                    onChange={e => setPharma(e.target.value)}
                    placeholder="例：禁忌確認済み。他の薬との飲み合わせをお客様に説明。"
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div className="field">
                  <label>ヒヤリハット・申し送り事項</label>
                  <textarea
                    rows={3}
                    value={hiyari}
                    onChange={e => setHiyari(e.target.value)}
                    placeholder="例：特になし。／薬の配置変更あり、翌日スタッフへ要共有。"
                    style={{ marginTop: 4 }}
                  />
                </div>
              </div>

              {/* コンディション */}
              <div className="card">
                <div className="card-title">本日のコンディション</div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: '#a0aec0', fontWeight: 500, display: 'block', marginBottom: 7 }}>
                    体力・集中力（★で評価）
                  </label>
                  <div className="star-row">
                    {[1, 2, 3, 4, 5].map(n => (
                      <span
                        key={n}
                        className={`star${rating >= n ? ' on' : ''}`}
                        onClick={() => setRating(n)}
                      >★</span>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>メモ・一言感想</label>
                  <textarea
                    rows={3}
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="例：花粉症シーズンで忙しかったが充実。足が疲れた。"
                  />
                </div>
              </div>

              {/* プレビュー */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="card-title" style={{ margin: 0 }}>日報プレビュー</div>
                  <button className="preview-toggle" onClick={() => setShowPreview(!showPreview)}>
                    表示 / 非表示
                  </button>
                </div>
                {showPreview && <div className="preview-box">{previewText}</div>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== カレンダータブ ===== */}
      {activeTab === 'calendar' && (
        <div className="container">
          {/* 接続カード */}
          <div className="card">
            <div className="card-title">📅 Googleカレンダー連携</div>
            {loadingCal ? (
              <div className="cal-loading">読み込み中...</div>
            ) : calConnected ? (
              <div className="cal-connected">
                <span className="cal-badge">✅ 連携中</span>
                <p className="cal-desc">日報を保存すると、自動でGoogleカレンダーに出勤日が追加されます。</p>
                <button className="cal-refresh-btn" onClick={fetchCalendar}>🔄 更新</button>
              </div>
            ) : (
              <div>
                <p className="cal-desc">Googleカレンダーと連携すると、日報保存時に自動で出勤日が登録されます。</p>
                <a href="/api/auth/google" className="cal-connect-btn">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="20" height="20" />
                  Googleカレンダーと連携する
                </a>
              </div>
            )}
          </div>

          {/* イベント一覧 */}
          {calConnected && (
            <div className="card">
              <div className="card-title">今月のカレンダー</div>
              {calEvents.length === 0 ? (
                <div className="cal-empty">イベントがありません</div>
              ) : (
                <div className="cal-event-list">
                  {calEvents
                    .filter(ev => {
                      const d = getEventDate(ev)
                      const now = new Date()
                      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                      return d.startsWith(thisMonth)
                    })
                    .map(ev => (
                      <div key={ev.id} className="cal-event-item">
                        <span className="cal-event-date">{getEventDate(ev).slice(5).replace('-', '/')}</span>
                        <span className="cal-event-title">{ev.summary}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== 履歴タブ ===== */}
      {activeTab === 'history' && (
        <div className="container">
          {loadingHistory && (
            <div className="history-empty">⏳<br />読み込み中...</div>
          )}
          {!loadingHistory && error && (
            <div className="error-box">⚠️ {error}</div>
          )}
          {!loadingHistory && !error && reports.length === 0 && (
            <div className="history-empty">
              📭<br />
              まだ保存された日報はありません。<br />
              日報を作成して保存しましょう！
            </div>
          )}
          {reports.map(r => (
            <div
              key={r.date}
              className="card history-card"
              onClick={() => setModalReport(r)}
            >
              <div style={{ paddingRight: 56 }}>
                <div className="history-date">{r.date}</div>
                <div className="history-shift">{r.shift}</div>
                <div className="history-meta">
                  👥 {r.members?.join('、') || '—'}<br />
                  🏷️ {r.categories?.length
                    ? r.categories.slice(0, 3).join('・') + (r.categories.length > 3 ? '…' : '')
                    : '（カテゴリなし）'
                  }
                </div>
              </div>
              <button
                className="history-del"
                onClick={e => { e.stopPropagation(); deleteReport(r.date) }}
                title="削除"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ===== 固定送信ボタン（作成タブ・保存前のみ表示） ===== */}
      {activeTab === 'form' && !showSuccess && (
        <div id="submit-area">
          <button
            className="submit-btn"
            onClick={submitReport}
            disabled={saving}
          >
            {saving ? '保存中...' : '💾 クラウドに保存する'}
          </button>
        </div>
      )}

      {/* ===== タブバー ===== */}
      <div className="tab-bar">
        <button
          className={`tab-btn${activeTab === 'form' ? ' active' : ''}`}
          onClick={() => switchTab('form')}
        >
          <span className="tab-icon">📝</span>
          <span className="tab-label">日報作成</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'calendar' ? ' active' : ''}`}
          onClick={() => switchTab('calendar')}
        >
          <span className="tab-icon">📅</span>
          <span className="tab-label">カレンダー</span>
        </button>
        <button
          className={`tab-btn${activeTab === 'history' ? ' active' : ''}`}
          onClick={() => switchTab('history')}
        >
          <span className="tab-icon">📚</span>
          <span className="tab-label">履歴</span>
        </button>
      </div>

      {/* ===== 詳細モーダル（ボトムシート） ===== */}
      {modalReport && (
        <div
          className="modal open"
          onClick={e => { if (e.target === e.currentTarget) setModalReport(null) }}
        >
          <div className="modal-sheet">
            <div className="modal-handle" />
            <div className="modal-header">
              <span className="modal-title">日報 {modalReport.date}</span>
              <button className="modal-close" onClick={() => setModalReport(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-report-text">{modalText}</div>
            </div>
            <div className="modal-actions">
              <button
                className="action-btn btn-copy"
                style={{ flex: 1 }}
                onClick={e => copyText(modalText, e.currentTarget)}
              >
                📋 コピー
              </button>
              {hasShare && (
                <button
                  className="action-btn btn-share"
                  style={{ flex: 1 }}
                  onClick={() => shareText(modalText)}
                >
                  📤 共有
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

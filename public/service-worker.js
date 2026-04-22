const CACHE_NAME = 'cosmos-report-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // 古いキャッシュを削除
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIリクエストはキャッシュしない（常にサーバーから取得）
  if (url.pathname.startsWith('/api/')) return;

  // 静的ファイルはネットワーク優先・失敗時はキャッシュから
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 成功したレスポンスをキャッシュに保存
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

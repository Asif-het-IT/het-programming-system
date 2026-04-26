const CACHE_NAME = 'het-pwa-v1';

globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/offline.html'])),
  );
  globalThis.skipWaiting();
});

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  globalThis.clients.claim();
});

globalThis.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

globalThis.addEventListener('push', (event) => {
  let data = { title: 'het System', body: 'New notification', link: '/dashboard', priority: 'normal' };
  if (event.data) {
    try {
      data = { ...data, ...JSON.parse(event.data.text()) };
    } catch {
      data.body = event.data.text();
    }
  }

  const badgeUrl = '/icons/het-192.png';
  const iconUrl = '/icons/het-512.png';

  const priorityToVibrate = {
    emergency: [300, 100, 300, 100, 300],
    important: [200, 100, 200],
    normal: [100],
  };

  const options = {
    body: data.body,
    icon: iconUrl,
    badge: badgeUrl,
    tag: data.type || 'het-notification',
    data: { link: data.link || '/dashboard' },
    vibrate: priorityToVibrate[data.priority] || priorityToVibrate.normal,
    requireInteraction: data.priority === 'emergency',
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(globalThis.registration.showNotification(data.title, options));
});

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const link = event.notification.data?.link || '/dashboard';
  const targetUrl = new URL(link, globalThis.location.origin).href;

  event.waitUntil(
    globalThis.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url === targetUrl);
        if (existing) return existing.focus();
        return globalThis.clients.openWindow(targetUrl);
      }),
  );
});

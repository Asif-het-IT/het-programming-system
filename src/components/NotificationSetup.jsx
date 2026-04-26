import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll('-', '+').replaceAll('_', '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function getVapidKey() {
  try {
    const resp = await fetch('/api/notifications/vapid-public-key');
    if (!resp.ok) return null;
    const { publicKey } = await resp.json();
    return publicKey || null;
  } catch {
    return null;
  }
}

async function subscribeOnServer(subscription) {
  const token = localStorage.getItem('accessToken');
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ subscription }),
  });
}

async function unsubscribeOnServer(endpoint) {
  const token = localStorage.getItem('accessToken');
  await fetch('/api/notifications/unsubscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ endpoint }),
  });
}

export default function NotificationSetup({ compact = false }) {
  const [permissionState, setPermissionState] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [vapidReady, setVapidReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!('Notification' in globalThis) || !('serviceWorker' in navigator)) return;

    setPermissionState(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) { setSwReady(false); return; }
      setSwReady(true);

      const key = await getVapidKey();
      setVapidReady(Boolean(key));

      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    } catch {
      setSwReady(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== 'granted') return;

      const key = await getVapidKey();
      if (!key) return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      await subscribeOnServer(sub.toJSON());
      setIsSubscribed(true);
    } catch {
      // user denied or SW error — do not crash
    } finally {
      setLoading(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        await unsubscribeOnServer(sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const isSupported = 'Notification' in globalThis && 'serviceWorker' in navigator && 'PushManager' in globalThis;

  if (!isSupported || !swReady) return null;

  if (permissionState === 'denied') {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-4 w-4" />
        <span>Notifications blocked in browser</span>
      </div>
    );
  }

  if (!vapidReady) {
    if (compact) return null;
    return null;
  }

  if (compact) {
    return (
      <Button
        size="sm"
        variant={isSubscribed ? 'ghost' : 'outline'}
        onClick={isSubscribed ? disable : enable}
        disabled={loading}
        title={isSubscribed ? 'Disable notifications' : 'Enable notifications'}
      >
        {isSubscribed ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isSubscribed ? (
            <BellRing className="h-5 w-5 text-primary" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isSubscribed ? 'Notifications enabled' : 'Enable Push Notifications'}
          </p>
          {!isSubscribed && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive system alerts, admin announcements, and view update alerts directly in your browser.
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant={isSubscribed ? 'outline' : 'default'}
          onClick={isSubscribed ? disable : enable}
          disabled={loading}
        >
          {loading ? 'Updating...' : isSubscribed ? 'Disable' : 'Enable Notifications'}
        </Button>
      </div>
    </div>
  );
}

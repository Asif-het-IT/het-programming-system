import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getNotificationSubscribersRequest,
  getNotificationLogsRequest,
  getNotificationStatusRequest,
  sendNotificationRequest,
} from '@/api/enterpriseApi';
import { Bell, Send, Users, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

const EMPTY_FORM = {
  title: '', body: '', link: '', priority: 'normal', type: 'admin_announcement',
  target: 'all', targetEmail: '', targetRole: 'user', targetDatabases: [], targetViews: [],
};

function getUiError(e, fallback) { return e?.response?.data?.error || e?.response?.data?.message || e?.message || fallback; }

export default function AdminNotifications() {
  const [vapidReady, setVapidReady] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, subsRes, logsRes] = await Promise.all([
        getNotificationStatusRequest(),
        getNotificationSubscribersRequest(),
        getNotificationLogsRequest(50),
      ]);
      setVapidReady(Boolean(statusRes?.vapidReady));
      setSubscribers(subsRes?.subscribers || []);
      setLogs(logsRes?.logs || []);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    setFeedback({ type: '', text: '' });
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        priority: form.priority,
        type: form.type,
        ...(form.link.trim() && { url: form.link.trim() }),
        ...(form.target === 'email' && { targetEmail: form.targetEmail.trim() }),
        ...(form.target === 'role' && { targetRole: form.targetRole }),
      };
      const res = await sendNotificationRequest(payload);
      setFeedback({ type: 'success', text: `Sent to ${res?.delivered ?? 0} subscribers` });
      setForm(EMPTY_FORM);
      await loadData();
    } catch (error) {
      setFeedback({ type: 'error', text: getUiError(error, 'Send failed') });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">Send push notifications to subscribers</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${vapidReady ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {vapidReady ? '✓ VAPID ready' : '✗ VAPID not configured'}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {subscribers.length} subscribers
          </span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Feedback */}
      {feedback.text && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
          feedback.type === 'error' ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400' :
          'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <XCircle className="h-4 w-4 mt-0.5" />}
          <span>{feedback.text}</span>
          <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setFeedback({ type: '', text: '' })}>✕</button>
        </div>
      )}

      {/* Send notification form */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <h2 className="font-semibold text-base">Send Notification</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Notification title" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Message *</Label>
          <Input value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Notification body text" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Link (optional)</Label>
            <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="/dashboard" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Send To</Label>
            <Select value={form.target} onValueChange={(v) => setForm((f) => ({ ...f, target: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subscribers</SelectItem>
                <SelectItem value="email">Specific email</SelectItem>
                <SelectItem value="role">By role</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.target === 'email' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Target Email</Label>
            <Input value={form.targetEmail} onChange={(e) => setForm((f) => ({ ...f, targetEmail: e.target.value }))} placeholder="user@company.com" />
          </div>
        )}

        {form.target === 'role' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Target Role</Label>
            <Select value={form.targetRole} onValueChange={(v) => setForm((f) => ({ ...f, targetRole: v }))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center justify-end pt-2">
          <Button
            className="gap-2"
            disabled={sending || !form.title.trim() || !form.body.trim()}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send Notification'}
          </Button>
        </div>
      </div>

      {/* Notification history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Notification History</h2>
        </div>
        {logs.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted-foreground text-sm">No notifications sent yet.</div>
        ) : (
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  {['Time', 'Title', 'Target', 'Priority', 'Sent / Failed'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 whitespace-nowrap">{new Date(log.sentAt || log.at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-medium">{log.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{log.target}</td>
                    <td className="px-4 py-2.5 capitalize">{log.priority}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-emerald-600 dark:text-emerald-400">{log.delivered}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className={log.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>{log.failed}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active subscribers */}
      {subscribers.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">Active Subscribers ({subscribers.length})</h2>
          </div>
          <div className="overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  {['Email', 'Role', 'Subscribed', 'Last Seen'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {subscribers.map((sub) => (
                  <tr key={`${sub.email}-${sub.subscribedAt}`} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{sub.email}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{sub.role}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{new Date(sub.subscribedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{sub.lastSeen ? new Date(sub.lastSeen).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

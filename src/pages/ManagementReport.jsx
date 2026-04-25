import React, { useState, useMemo, useEffect } from "react";
import { localDB } from "@/api/localDB";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useDatabaseManager } from "@/lib/DatabaseManager";
import { useViewManager } from "@/lib/ViewManager";
import { scopeOrdersByDatabase } from "@/lib/dataScope";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Package, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const AED_RATE = 3.6735;

function parseNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function fmtDate(v) {
  if (!v) return "—";
  try { return format(new Date(v), "dd MMM yy"); } catch { return String(v); }
}

function fmtUSD(v) {
  const n = parseNum(v);
  return n ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
}

function fmtAED(v) {
  const n = parseNum(v);
  return n ? `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
}

function StatBox({ icon: Icon, label, value, sub, color = "text-primary" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
          <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center bg-current/10`} style={{ color: "var(--primary)" }}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function ManagementReport() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { user } = useAuth();
  const { activeDatabase } = useDatabaseManager();
  const { getDefaultViewForUser, applyView } = useViewManager();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["orders", activeDatabase?.id],
    queryFn: () => localDB.Order.list("-sr", 500),
    refetchInterval: 60000,
  });

  const scopedOrders = useMemo(() => {
    const dbOrders = scopeOrdersByDatabase(orders, activeDatabase?.id);
    if (user?.role === 'admin') return dbOrders;

    const defaultView = getDefaultViewForUser(user?.email || user?.id || '');
    if (!defaultView?.id) return [];

    return applyView(dbOrders, defaultView.id);
  }, [orders, activeDatabase?.id, user, getDefaultViewForUser, applyView]);

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastRefresh(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, [refetch]);

  const activeOrders = useMemo(() =>
    scopedOrders.filter(o => {
      const s = String(o.shipment_status || "").toLowerCase();
      return !s.includes("completed");
    }),
    [scopedOrders]
  );

  const filtered = useMemo(() =>
    categoryFilter === "all" ? activeOrders : activeOrders.filter(o => o.category === categoryFilter),
    [activeOrders, categoryFilter]
  );

  const categories = useMemo(() => [...new Set(scopedOrders.map(o => o.category).filter(Boolean))].sort(), [scopedOrders]);

  const totalContractUSD = filtered.reduce((s, o) => s + parseNum(o.amount_usd), 0);
  const totalInvUSD = filtered.reduce((s, o) => s + parseNum(o.inv_amount_usd), 0);
  const totalInvAED = filtered.reduce((s, o) => s + parseNum(o.inv_amount_aed), 0);
  const totalQty = filtered.reduce((s, o) => s + parseNum(o.quantity), 0);
  const pendingQty = filtered.filter(o => {
    const s = String(o.shipment_status || "").toLowerCase();
    return !s.includes("dubai") && !s.includes("africa") && !s.includes("way");
  }).reduce((s, o) => s + parseNum(o.quantity), 0);

  const overdueOrders = filtered.filter(o => parseNum(o.overdue_days) < 0);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const c = o.category || "Unknown";
      if (!map[c]) map[c] = { orders: 0, qty: 0, contractUSD: 0, invUSD: 0 };
      map[c].orders++;
      map[c].qty += parseNum(o.quantity);
      map[c].contractUSD += parseNum(o.amount_usd);
      map[c].invUSD += parseNum(o.inv_amount_usd);
    });
    return Object.entries(map).sort((a, b) => b[1].contractUSD - a[1].contractUSD);
  }, [filtered]);

  const byStatus = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const s = o.shipment_status || "Unknown";
      if (!map[s]) map[s] = 0;
      map[s]++;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const statusColor = (s) => {
    const l = String(s).toLowerCase();
    if (l.includes("dubai")) return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    if (l.includes("africa")) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    if (l.includes("ready")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Management Report
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active orders only · Auto-refresh every 60s · Last: {format(lastRefresh, "HH:mm:ss")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-36 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { refetch(); setLastRefresh(new Date()); }} className="text-xs h-8">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => <div key={i} className="rounded-xl border border-border bg-card p-5 h-24 animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatBox icon={Package} label="Active Orders" value={filtered.length} sub={`${pendingQty.toLocaleString()} Mtr pending`} color="text-primary" />
              <StatBox icon={DollarSign} label="Contract Value" value={fmtUSD(totalContractUSD)} sub={fmtAED(totalContractUSD * AED_RATE)} color="text-emerald-400" />
              <StatBox icon={DollarSign} label="Invoiced (USD)" value={fmtUSD(totalInvUSD)} sub={fmtAED(totalInvAED)} color="text-amber-400" />
              <StatBox icon={AlertTriangle} label="Overdue Orders" value={overdueOrders.length} sub="delivery date passed" color={overdueOrders.length > 0 ? "text-rose-400" : "text-emerald-400"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Category Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30">
                        {["Category", "Orders", "Quantity", "Contract USD", "Invoiced USD"].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.map(([cat, d], i) => (
                        <motion.tr key={cat} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          className="border-t border-border hover:bg-secondary/40">
                          <td className="px-4 py-2.5 font-medium text-foreground">{cat}</td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">{d.orders}</td>
                          <td className="px-4 py-2.5 font-mono text-foreground">{d.qty.toLocaleString()}</td>
                          <td className="px-4 py-2.5 font-mono text-emerald-400">{fmtUSD(d.contractUSD)}</td>
                          <td className="px-4 py-2.5 font-mono text-amber-400">{fmtUSD(d.invUSD)}</td>
                        </motion.tr>
                      ))}
                      <tr className="border-t-2 border-primary/30 bg-primary/5">
                        <td className="px-4 py-2.5 font-bold text-foreground text-[11px] uppercase">Total</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-primary">{filtered.length}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-foreground">{totalQty.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-emerald-400">{fmtUSD(totalContractUSD)}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-amber-400">{fmtUSD(totalInvUSD)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Shipment Status Summary</h2>
                </div>
                <div className="p-5 space-y-2.5">
                  {byStatus.map(([status, count]) => {
                    const pct = Math.round((count / filtered.length) * 100);
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${statusColor(status)}`}>{status}</span>
                          <span className="text-xs font-mono text-muted-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full">
                          <div className="h-1.5 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {overdueOrders.length > 0 && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-rose-500/20 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <h2 className="text-sm font-semibold text-rose-400">Overdue Orders ({overdueOrders.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-rose-500/5">
                        {["SR", "Brand", "Marka", "Party", "Contract Date", "Delivery Date", "Overdue Days", "Quantity", "Status"].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400/70">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overdueOrders.map((o, i) => (
                        <tr key={o.id || i} className="border-t border-rose-500/10 hover:bg-rose-500/5">
                          <td className="px-4 py-2 font-mono text-muted-foreground">{o.sr || i + 1}</td>
                          <td className="px-4 py-2 text-foreground font-medium">{o.brand || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{o.marka || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{o.party_name || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(o.contract_date)}</td>
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(o.delivery_date)}</td>
                          <td className="px-4 py-2 font-mono font-bold text-rose-400">{parseNum(o.overdue_days)}</td>
                          <td className="px-4 py-2 font-mono text-foreground">{parseNum(o.quantity).toLocaleString()}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-400">{o.shipment_status || "—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

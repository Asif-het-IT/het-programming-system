import React, { useState, useMemo } from "react";
import { localDB } from "@/api/localDB";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useDatabaseManager } from "@/lib/DatabaseManager";
import { useViewManager } from "@/lib/ViewManager";
import { scopeOrdersByDatabase } from "@/lib/dataScope";
import { motion } from "framer-motion";
import { Download, BarChart2, Package, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { applyFilters, StatusBadge, FIELD_LABELS } from "./DataViews";

const BRAND_COLS = ["sr", "category", "brand", "marka", "contract_date", "contract_num", "dsn", "quantity", "delivery_date", "goods_ready", "shipment_status"];

function parseNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function fmtDate(v) {
  if (!v) return "—";
  try { return format(new Date(v), "dd MMM yy"); } catch { return String(v); }
}

function fmtNum(v) {
  const n = parseNum(v);
  return n ? n.toLocaleString() : "—";
}

const EMPTY_FILTERS = { category: "all", range: "all", marka: "all", consignee: "all", status: "all" };

export default function BrandReport() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sortMode, setSortMode] = useState("st_first");
  const { user } = useAuth();
  const { activeDatabase } = useDatabaseManager();
  const { getDefaultViewForUser, applyView } = useViewManager();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", activeDatabase?.id],
    queryFn: () => localDB.Order.list("-sr", 500),
  });

  const scopedOrders = useMemo(() => {
    const dbOrders = scopeOrdersByDatabase(orders, activeDatabase?.id);
    if (user?.role === 'admin') return dbOrders;

    const defaultView = getDefaultViewForUser(user?.email || user?.id || '');
    if (!defaultView?.id) return [];

    return applyView(dbOrders, defaultView.id);
  }, [orders, activeDatabase?.id, user, getDefaultViewForUser, applyView]);

  const normalize = (s) => {
    const lower = String(s || "").toLowerCase().trim();
    if (lower.includes("way to dubai")) return "Way to Dubai";
    if (lower.includes("way to africa")) return "Way to Africa";
    if (lower.includes("ready")) return "Ready for Shipment";
    if (lower.includes("completed")) return "Completed";
    if (lower.includes("under process") || lower.includes("process")) return "Under Process";
    return s || "—";
  };

  const cleanedOrders = useMemo(() =>
    scopedOrders
      .filter(o => o.brand || o.sr)
      .map(o => ({
        ...o,
        quantity: parseNum(o.quantity),
        dsn: parseNum(o.dsn),
        shipment_status: normalize(o.shipment_status),
      })),
    [scopedOrders]
  );

  const filtered = useMemo(() => {
    const f = { ...filters, status: filters.status !== "all" ? normalize(filters.status) : "all" };
    return applyFilters(cleanedOrders, { ...f, party_name: "all", brand: "all", range: "all", contract_date_from: "", contract_date_to: "", delivery_date_from: "", delivery_date_to: "" });
  }, [cleanedOrders, filters]);

  const brandGroups = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const b = o.brand || "Unknown";
      if (!map[b]) map[b] = [];
      map[b].push(o);
    });

    Object.values(map).forEach(rows =>
      rows.sort((a, b) => {
        if (!a.contract_date && !b.contract_date) return 0;
        if (!a.contract_date) return 1;
        if (!b.contract_date) return -1;
        return new Date(a.contract_date) - new Date(b.contract_date);
      })
    );

    let entries = Object.entries(map);
    if (sortMode === "st_first") {
      entries.sort(([a], [b]) => {
        const aST = a.toUpperCase().startsWith("ST-") ? 0 : 1;
        const bST = b.toUpperCase().startsWith("ST-") ? 0 : 1;
        if (aST !== bST) return aST - bST;
        return a.localeCompare(b);
      });
    } else if (sortMode === "alpha") {
      entries.sort(([a], [b]) => a.localeCompare(b));
    } else if (sortMode === "qty_desc") {
      entries.sort(([, ar], [, br]) => {
        const aq = ar.reduce((s, o) => s + o.quantity, 0);
        const bq = br.reduce((s, o) => s + o.quantity, 0);
        return bq - aq;
      });
    }
    return entries;
  }, [filtered, sortMode]);

  const uniq = (key) => [...new Set(cleanedOrders.map(o => o[key]).filter(Boolean))].sort();

  const exportCSV = () => {
    const lines = [];
    brandGroups.forEach(([brand, rows]) => {
      lines.push(`\n"=== ${brand} ===",,,,,,,,,,`);
      lines.push(BRAND_COLS.map(f => FIELD_LABELS[f] || f).join(","));
      rows.forEach((o, i) => {
        lines.push(BRAND_COLS.map(f => {
          if (f === "sr") return i + 1;
          return `"${o[f] ?? ""}"`;
        }).join(","));
      });
      const totalQty = rows.reduce((s, o) => s + o.quantity, 0);
      const totalDsn = rows.reduce((s, o) => s + o.dsn, 0);
      lines.push(`"TOTAL",,,,,,${totalDsn},${totalQty},,,`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Brand_Wise_Report.csv";
    a.click();
  };

  const totalOrders = filtered.length;
  const totalQty = filtered.reduce((s, o) => s + o.quantity, 0);
  const totalBrands = brandGroups.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" /> Brand Wise Report
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Grouped by brand · Auto totals</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs h-8">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Brands", value: totalBrands, color: "text-primary" },
            { label: "Total Orders", value: totalOrders, color: "text-amber-400" },
            { label: "Total Quantity", value: `${(totalQty / 1000).toFixed(1)}K Mtr`, color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold font-mono mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /><span>Filter:</span>
            </div>
            {[
              { key: "category", label: "Category", opts: uniq("category") },
              { key: "marka", label: "Marka", opts: uniq("marka") },
              { key: "consignee", label: "Consignee", opts: uniq("consignee") },
              { key: "status", label: "Status", opts: [...new Set(cleanedOrders.map(o => o.shipment_status).filter(Boolean))].sort() },
            ].map(({ key, label, opts }) => (
              <div key={key}>
                <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                <Select value={filters[key]} onValueChange={v => setFilters(f => ({ ...f, [key]: v }))}>
                  <SelectTrigger className={`h-7 text-[11px] w-36 border-border ${filters[key] !== "all" ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary"}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {label}s</SelectItem>
                    {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Sort Brands</p>
              <Select value={sortMode} onValueChange={setSortMode}>
                <SelectTrigger className="h-7 text-[11px] w-36 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="st_first">ST Series First</SelectItem>
                  <SelectItem value="alpha">Alphabetical</SelectItem>
                  <SelectItem value="qty_desc">Most Quantity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {Object.values(filters).some(v => v !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)} className="h-7 text-[11px] text-muted-foreground px-2 self-end">
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="h-5 bg-muted rounded w-48 mb-4" />
                {Array(3).fill(0).map((_, j) => <div key={j} className="h-4 bg-muted rounded mb-2" />)}
              </div>
            ))}
          </div>
        ) : brandGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">No data matches the current filters</p>
          </div>
        ) : (
          <div className="space-y-5">
            {brandGroups.map(([brand, rows], gi) => {
              const totalDsn = rows.reduce((s, o) => s + o.dsn, 0);
              const totalQtyBrand = rows.reduce((s, o) => s + o.quantity, 0);

              return (
                <motion.div
                  key={brand}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.04 }}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-3 bg-primary/8 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="text-primary text-xs font-bold">{brand[0]}</span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground">{brand}</span>
                        <span className="text-xs text-muted-foreground ml-2">{rows.length} order{rows.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-muted-foreground text-[10px]">Total DSN</p>
                        <p className="font-mono font-bold text-primary">{totalDsn}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-[10px]">Total Qty</p>
                        <p className="font-mono font-bold text-emerald-400">{totalQtyBrand.toLocaleString()} Mtr</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/30">
                          {["SR", "Category", "Marka", "Contract Date", "Contract No.", "DSN", "Quantity", "Delivery Date", "Goods Ready", "Status"].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((o, ri) => (
                          <tr key={o.id || ri} className="border-t border-border hover:bg-secondary/30 transition-colors">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{ri + 1}</td>
                            <td className="px-3 py-2 text-muted-foreground">{o.category || "—"}</td>
                            <td className="px-3 py-2 text-foreground font-medium">{o.marka || "—"}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(o.contract_date)}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap font-mono text-[10px]">{o.contract_num || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-foreground">{o.dsn || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-foreground">{fmtNum(o.quantity)}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(o.delivery_date)}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(o.goods_ready)}</td>
                            <td className="px-3 py-2 whitespace-nowrap"><StatusBadge value={o.shipment_status} /></td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-primary/30 bg-primary/5">
                          <td colSpan={5} className="px-3 py-2 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Brand Total</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-primary">{totalDsn}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">{totalQtyBrand.toLocaleString()}</td>
                          <td colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

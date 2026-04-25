import React, { useState, useMemo, useRef, useEffect } from "react";
import { localDB } from "@/api/localDB";
import { useAuth } from "@/lib/AuthContext";
import { useDatabaseManager } from "@/lib/DatabaseManager";
import { useViewManager } from "@/lib/ViewManager";
import { scopeOrdersByDatabase } from "@/lib/dataScope";
import { formatDatabaseLabel } from "@/config/columnMapping";
import { Logger } from "@/lib/logger";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Eye, Download, ChevronLeft, ChevronRight, Filter, RotateCcw, X } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export const FIELD_LABELS = {
  sr: "SR", category: "Category", range: "Range", brand: "Brand", marka: "Marka",
  party_name: "Party Name", consignee: "Consignee", contract_date: "Contract Date",
  contract_num: "Contract No.", dsn: "DSN", shades: "Shades", shades_qty: "Shades Qty",
  per_dsn_qty: "Per Dsn Qty", quantity: "Quantity", price_usd: "Price USD",
  amount_usd: "Amount USD", per_box: "Per Box", total_box: "Total Box",
  delivery_date: "Delivery Date", goods_ready: "Goods Ready", overdue_days: "Overdue Days",
  shipment_arrival: "Shipment Arrival", inv_num: "Inv Num", inv_date: "Inv Date",
  actual_qty: "Actual Qty", actual_qty_box: "Actual Box", inv_amount_usd: "Inv USD",
  inv_amount_aed: "Inv AED", payment_due_date: "Payment Due", payment_date: "Payment Date",
  dxb_qty: "DXB Qty", dxb_arrive_date: "DXB Arrive",
  kkk_qty: "KKK Qty", kkk_arrive_date: "KKK Arrive",
  sss_qty: "SSS Qty", sss_arrive_date: "SSS Arrive",
  ttt_qty: "TTT Qty", ttt_arrive_date: "TTT Arrive",
  mmm_qty: "MMM Qty", mmm_arrive_date: "MMM Arrive",
  ccc_qty: "CCC Qty", ccc_arrive_date: "CCC Arrive",
  lll_qty: "LLL Qty", lll_arrive_date: "LLL Arrive",
  shipment_status: "Status"
};

const DATE_FIELDS = ["contract_date", "delivery_date", "goods_ready", "inv_date", "payment_due_date", "payment_date", "shipment_arrival"];
const NUM_FIELDS = ["sr", "dsn", "shades", "shades_qty", "per_dsn_qty", "quantity", "price_usd", "amount_usd", "per_box", "total_box", "actual_qty", "actual_qty_box", "inv_amount_usd", "inv_amount_aed", "overdue_days", "dxb_qty", "kkk_qty", "sss_qty", "ttt_qty", "mmm_qty", "ccc_qty", "lll_qty"];

export function formatCell(field, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (DATE_FIELDS.includes(field)) {
    try { return format(new Date(value), "dd MMM yy"); } catch { return value; }
  }
  if (field === "amount_usd" || field === "inv_amount_usd") return `$${Number(value).toLocaleString()}`;
  if (field === "price_usd") return `$${Number(value).toFixed(2)}`;
  if (field === "inv_amount_aed") return `AED ${Number(value).toLocaleString()}`;
  return String(value);
}

export function StatusBadge({ value }) {
  const s = String(value || "").toLowerCase();
  const cls = s.includes("dubai") ? "bg-blue-500/15 text-blue-400" :
    s.includes("africa") ? "bg-amber-500/15 text-amber-400" :
    s.includes("ready") ? "bg-emerald-500/15 text-emerald-400" :
    s.includes("completed") ? "bg-purple-500/15 text-purple-400" :
    "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>{value || "—"}</span>;
}

const EMPTY_FILTERS = { category: "all", range: "all", brand: "all", marka: "all", party_name: "all", consignee: "all", status: "all", contract_date_from: "", contract_date_to: "", delivery_date_from: "", delivery_date_to: "" };
const PAGE_SIZE = 15;

function FilterPanel({ orders, filters, setFilters, onClose }) {
  const uniq = (key) => [...new Set(orders.map(o => o[key]).filter(Boolean))].sort();
  const activeCount = Object.entries(filters).filter(([, v]) => v && v !== "all").length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Filters</span>
          {activeCount > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/30">{activeCount} active</Badge>}
        </div>
        <div className="flex gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)} className="h-6 text-[10px] text-muted-foreground px-2">
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          )}
          {onClose && <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6"><X className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
        {[
          { key: "category", label: "Category", opts: uniq("category") },
          { key: "range", label: "Range", opts: uniq("range") },
          { key: "brand", label: "Brand", opts: uniq("brand") },
          { key: "marka", label: "Marka", opts: uniq("marka") },
          { key: "party_name", label: "Party Name", opts: uniq("party_name") },
          { key: "consignee", label: "Consignee", opts: uniq("consignee") },
          { key: "status", label: "Status", opts: uniq("shipment_status") },
        ].map(({ key, label, opts }) => (
          <div key={key}>
            <p className="text-[10px] text-muted-foreground mb-1 font-medium">{label}</p>
            <Select value={filters[key]} onValueChange={v => setFilters(f => ({ ...f, [key]: v }))}>
              <SelectTrigger className={`h-7 text-[11px] border-border ${filters[key] !== "all" ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary"}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {label}s</SelectItem>
                {opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border">
        {[
          { key: "contract_date_from", label: "Contract From" },
          { key: "contract_date_to", label: "Contract To" },
          { key: "delivery_date_from", label: "Delivery From" },
          { key: "delivery_date_to", label: "Delivery To" },
        ].map(({ key, label }) => (
          <div key={key}>
            <p className="text-[10px] text-muted-foreground mb-1 font-medium">{label}</p>
            <Input
              type="date"
              value={filters[key] || ""}
              onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              className={`h-7 text-[11px] border-border ${filters[key] ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary"}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function applyFilters(orders, filters) {
  return orders.filter(o => {
    if (filters.category !== "all" && o.category !== filters.category) return false;
    if (filters.range !== "all" && o.range !== filters.range) return false;
    if (filters.brand !== "all" && o.brand !== filters.brand) return false;
    if (filters.marka !== "all" && o.marka !== filters.marka) return false;
    if (filters.party_name !== "all" && o.party_name !== filters.party_name) return false;
    if (filters.consignee !== "all" && o.consignee !== filters.consignee) return false;
    if (filters.status !== "all" && o.shipment_status !== filters.status) return false;
    if (filters.contract_date_from && o.contract_date && o.contract_date < filters.contract_date_from) return false;
    if (filters.contract_date_to && o.contract_date && o.contract_date > filters.contract_date_to) return false;
    if (filters.delivery_date_from && o.delivery_date && o.delivery_date < filters.delivery_date_from) return false;
    if (filters.delivery_date_to && o.delivery_date && o.delivery_date > filters.delivery_date_to) return false;
    return true;
  });
}

export default function DataViews() {
  const [activeView, setActiveView] = useState("view_summary");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const { user } = useAuth();
  const { activeDatabase } = useDatabaseManager();
  const { listViews, getUserViews, applyView } = useViewManager();
  const perfRef = useRef({
    apply_view_ms: 0,
    filter_ms: 0,
    render_ms: 0,
    rows_in_scope: 0,
    rows_after_view: 0,
    rows_after_filter: 0,
    logged_at: 0,
  });
  const renderStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", activeDatabase?.id],
    queryFn: () => localDB.Order.list("-sr", 500),
  });

  const allViews = useMemo(() => {
    if (user?.role === "admin") {
      return listViews();
    }

    return getUserViews(user?.email || user?.id || '');
  }, [listViews, getUserViews, user]);

  const currentView = allViews.find(v => v.id === activeView) || allViews[0];
  const fields = currentView?.fields || [];

  const scopedOrders = useMemo(() => {
    return scopeOrdersByDatabase(orders, activeDatabase?.id);
  }, [orders, activeDatabase?.id]);

  const viewedOrders = useMemo(() => {
    if (!currentView?.id) return [];
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const result = applyView(scopedOrders, currentView.id);
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();

    perfRef.current.apply_view_ms = Number((ended - started).toFixed(2));
    perfRef.current.rows_in_scope = scopedOrders.length;
    perfRef.current.rows_after_view = result.length;

    return result;
  }, [scopedOrders, currentView?.id, applyView]);

  const filtered = useMemo(() => {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let result = applyFilters(viewedOrders, filters);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o => fields.some(f => String(o[f] || "").toLowerCase().includes(q)));
    }

    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
    perfRef.current.filter_ms = Number((ended - started).toFixed(2));
    perfRef.current.rows_after_filter = result.length;

    return result;
  }, [viewedOrders, filters, search, fields]);

  useEffect(() => {
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
    perfRef.current.render_ms = Number((ended - renderStartMs).toFixed(2));

    const rows = perfRef.current.rows_after_view;
    if (rows < 2000) {
      return;
    }

    const now = Date.now();
    if (now - perfRef.current.logged_at < 5000) {
      return;
    }
    perfRef.current.logged_at = now;

    Logger.info('Data view performance metrics', {
      database_id: activeDatabase?.id || 'db_default',
      view_id: currentView?.id || 'none',
      rows_in_scope: perfRef.current.rows_in_scope,
      rows_after_view: perfRef.current.rows_after_view,
      rows_after_filter: perfRef.current.rows_after_filter,
      apply_view_ms: perfRef.current.apply_view_ms,
      filter_ms: perfRef.current.filter_ms,
      render_ms: perfRef.current.render_ms,
      page_size: PAGE_SIZE,
      current_page: page + 1,
    });
  }, [filtered, viewedOrders, currentView?.id, activeDatabase?.id, page, renderStartMs]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCSV = () => {
    const headers = fields.map(f => FIELD_LABELS[f] || f).join(",");
    const rows = filtered.map(o => fields.map(f => `"${o[f] ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${currentView?.name || 'view'}.csv`;
    a.click();
  };

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v && v !== "all").length;

  if (allViews.length === 0 && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">No view assigned</h2>
          <p className="text-sm text-muted-foreground mt-2">Admin se apna view assign karwaein.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Data Views</h1>
            <p className="text-xs text-muted-foreground mt-0.5">User-specific column views with advanced filters</p>
            <p className="text-xs text-primary mt-1">Active Database: {formatDatabaseLabel(activeDatabase)}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(s => !s)}
              className={`text-xs h-8 ${showFilters ? "border-primary/30 text-primary bg-primary/10" : ""}`}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs h-8">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {allViews.map(v => (
            <button
              key={v.id}
              onClick={() => { setActiveView(v.id); setPage(0); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                activeView === v.id
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Eye className="h-3 w-3" />
              {v.name}
              {!v.is_system && <Badge className="text-[9px] px-1 py-0 bg-accent/20 text-accent border-accent/30 ml-1">Custom</Badge>}
            </button>
          ))}
        </div>

        {showFilters && (
          <FilterPanel orders={viewedOrders} filters={filters} setFilters={f => { setFilters(f); setPage(0); }} onClose={() => setShowFilters(false)} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{currentView?.name}</span>
            <span className="mx-1.5">·</span>
            <span>{fields.length} cols</span>
            <span className="mx-1.5">·</span>
            <span className="text-primary font-medium">{filtered.length} records</span>
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search visible columns..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-8 text-xs bg-secondary border-border w-60"
            />
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {fields.map(f => (
                    <TableHead key={f} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {FIELD_LABELS[f] || f}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      {fields.map((_, j) => <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse w-16" /></TableCell>)}
                    </TableRow>
                  ))
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={fields.length || 1} className="text-center py-12 text-muted-foreground text-sm">
                      No records match the current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((o, i) => (
                    <TableRow key={o.id || i} className="border-border hover:bg-secondary/40 transition-colors">
                      {fields.map(f => (
                        <TableCell key={f} className={`text-xs whitespace-nowrap ${
                          f === "overdue_days" && Number(o[f] || 0) < 0 ? "text-rose-400 font-mono font-medium" :
                          f === "overdue_days" && Number(o[f] || 0) > 0 ? "text-emerald-400 font-mono font-medium" :
                          NUM_FIELDS.includes(f) ? "font-mono text-foreground" : "text-muted-foreground"
                        }`}>
                          {f === "shipment_status" ? <StatusBadge value={o[f]} /> : formatCell(f, o[f])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">{page + 1} / {totalPages || 1}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

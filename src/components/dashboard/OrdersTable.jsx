import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from "lucide-react";
import { StatusBadge, formatCell } from "@/pages/DataViews";
import { format } from "date-fns";

const COLUMNS = [
  { key: "sr", label: "SR" },
  { key: "brand", label: "Brand" },
  { key: "marka", label: "Marka" },
  { key: "party_name", label: "Party" },
  { key: "quantity", label: "Qty" },
  { key: "delivery_date", label: "Delivery" },
  { key: "overdue_days", label: "Overdue" },
  { key: "shipment_status", label: "Status" },
];

const PAGE_SIZE = 10;

export default function OrdersTable({ orders = [] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState("sr");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = orders;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        COLUMNS.some(c => String(o[c.key] || "").toLowerCase().includes(q))
      );
    }
    result = [...result].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const an = Number(av), bn = Number(bv);
      const numComp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? numComp : -numComp;
    });
    return result;
  }, [orders, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{filtered.length}</span> orders
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-8 h-7 text-xs bg-secondary border-border w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {COLUMNS.map(c => (
                <TableHead key={c.key} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer select-none"
                  onClick={() => toggleSort(c.key)}>
                  <div className="flex items-center gap-1">
                    {c.label}
                    <ArrowUpDown className={`h-2.5 w-2.5 ${sortKey === c.key ? "text-primary" : "opacity-40"}`} />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="text-center py-8 text-muted-foreground text-sm">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              paged.map((o, i) => (
                <TableRow key={o.id || i} className="border-border hover:bg-secondary/40 transition-colors">
                  {COLUMNS.map(c => (
                    <TableCell key={c.key} className={`text-xs whitespace-nowrap py-2 ${
                      c.key === "overdue_days" && Number(o[c.key] || 0) < 0 ? "text-rose-400 font-mono font-bold" :
                      c.key === "overdue_days" ? "text-emerald-400 font-mono" :
                      c.key === "sr" ? "font-mono text-muted-foreground" :
                      ["quantity"].includes(c.key) ? "font-mono text-foreground" :
                      "text-muted-foreground"
                    }`}>
                      {c.key === "shipment_status" ? <StatusBadge value={o[c.key]} /> : formatCell(c.key, o[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-3">
        <p className="text-[10px] text-muted-foreground">
          {filtered.length === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)}`} of {filtered.length}
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-6 w-6" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground font-mono">{page + 1}/{totalPages || 1}</span>
          <Button variant="outline" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

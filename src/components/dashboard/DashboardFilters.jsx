import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import PropTypes from "prop-types";

export const EMPTY_FILTERS = {
  category: "all",
  range: "all",
  brand: "all",
  marka: "all",
  party_name: "all",
  shipment_status: "all",
};

export default function DashboardFilters({ orders, filters, onChange }) {
  const uniq = (key) => [...new Set(orders.map(o => o[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const hasActive = Object.values(filters).some(v => v !== "all");

  const filterDefs = [
    { key: "category", label: "Category" },
    { key: "range", label: "Range" },
    { key: "brand", label: "Brand" },
    { key: "marka", label: "Marka" },
    { key: "party_name", label: "Party Name" },
    { key: "shipment_status", label: "Status" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Filters</span>
          {hasActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
              {Object.values(filters).filter(v => v !== "all").length} active
            </span>
          )}
        </div>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}
            className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2">
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {filterDefs.map(({ key, label }) => (
          <div key={key}>
            <p className="text-[10px] text-muted-foreground mb-1 font-medium">{label}</p>
            <Select value={filters[key]} onValueChange={v => onChange({ ...filters, [key]: v })}>
              <SelectTrigger className={`h-7 text-[11px] border-border ${filters[key] === "all" ? "bg-secondary" : "bg-primary/10 border-primary/30 text-primary"}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {uniq(key).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

DashboardFilters.propTypes = {
  orders: PropTypes.arrayOf(PropTypes.object).isRequired,
  filters: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

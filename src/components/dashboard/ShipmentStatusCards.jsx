import React from "react";
import { motion } from "framer-motion";
import PropTypes from "prop-types";

const STATUS_CONFIG = [
  { key: "way_to_dubai", label: "Way to Dubai", color: "bg-blue-500", textColor: "text-blue-400", match: (s) => String(s).toLowerCase().includes("dubai") },
  { key: "way_to_africa", label: "Way to Africa", color: "bg-amber-500", textColor: "text-amber-400", match: (s) => String(s).toLowerCase().includes("africa") },
  { key: "ready", label: "Ready for Shipment", color: "bg-emerald-500", textColor: "text-emerald-400", match: (s) => String(s).toLowerCase().includes("ready") },
  { key: "under_process", label: "Under Process", color: "bg-purple-500", textColor: "text-purple-400", match: (s) => String(s).toLowerCase().includes("process") || String(s).toLowerCase().includes("under") },
  { key: "completed", label: "Completed", color: "bg-slate-500", textColor: "text-slate-400", match: (s) => String(s).toLowerCase().includes("completed") },
];

export default function ShipmentStatusCards({ orders = [] }) {
  const total = orders.length || 1;

  const statusData = STATUS_CONFIG.map(cfg => {
    const count = orders.filter(o => cfg.match(o.shipment_status || "")).length;
    return { ...cfg, count, pct: Math.round((count / total) * 100) };
  });

  const other = orders.filter(o => !STATUS_CONFIG.some(cfg => cfg.match(o.shipment_status || ""))).length;

  return (
    <div className="space-y-2.5">
      {statusData.map((s, i) => (
        <motion.div key={s.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${s.textColor}`}>{s.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">{s.pct}%</span>
              <span className={`text-[11px] font-bold font-mono ${s.textColor}`}>{s.count}</span>
            </div>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${s.pct}%` }}
              transition={{ delay: i * 0.05 + 0.1, duration: 0.5, ease: "easeOut" }}
              className={`h-full ${s.color} rounded-full`}
            />
          </div>
        </motion.div>
      ))}
      {other > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-muted-foreground">Other</span>
            <span className="text-[11px] font-bold font-mono text-muted-foreground">{other}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-muted rounded-full" style={{ width: `${Math.round((other / total) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

ShipmentStatusCards.propTypes = {
  orders: PropTypes.arrayOf(PropTypes.object),
};

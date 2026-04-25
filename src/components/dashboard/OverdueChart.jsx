import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import PropTypes from "prop-types";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-foreground mb-1">{label}</p>
      <p className={`text-[11px] font-mono ${v < 0 ? "text-rose-400" : "text-emerald-400"}`}>
        {v < 0 ? `${Math.abs(v)} days overdue` : `${v} days remaining`}
      </p>
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
};

function getBarColor(days) {
  if (days < 0) return "#ef4444";
  if (days < 7) return "#f59e0b";
  return "#10b981";
}

export default function OverdueChart({ data = [] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
  );

  const chartData = data.slice(0, 15).map(o => ({
    name: (o.brand || o.marka || `SR-${o.sr}` || "").slice(0, 10),
    days: Number(o.overdue_days || 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
        <Bar dataKey="days" radius={[4, 4, 0, 0]}>
          {chartData.map((d) => (
            <Cell key={`${d.name}-${d.days}`} fill={getBarColor(d.days)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

OverdueChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
};

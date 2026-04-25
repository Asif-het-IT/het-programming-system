import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import PropTypes from "prop-types";

const COLORS = ["#8b5cf6","#6366f1","#3b82f6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#f97316","#84cc16"];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-foreground mb-1">{label}</p>
      <p className="text-[11px] text-primary font-mono">{payload[0].value} orders</p>
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
};

export default function OrdersByBrandChart({ data = [] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
  );

  const chartData = data.slice(0, 12).map(([brand, count]) => ({ name: brand.length > 10 ? brand.slice(0, 10) + "…" : brand, fullName: brand, count }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((item, i) => <Cell key={item.fullName} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

OrdersByBrandChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    )
  ),
};

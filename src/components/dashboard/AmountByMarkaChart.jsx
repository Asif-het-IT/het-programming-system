import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import PropTypes from "prop-types";

const COLORS = ["#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#6366f1","#ec4899","#f97316"];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-foreground">{d.name}</p>
      <p className="text-[11px] text-primary font-mono">{d.value.toLocaleString()} Mtr</p>
    </div>
  );
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
};

function CustomLegend({ payload }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
      {payload.map((entry) => (
        <div key={`${entry.value}-${entry.color}`} className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-[10px] text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

CustomLegend.propTypes = {
  payload: PropTypes.arrayOf(PropTypes.object),
};

CustomLegend.defaultProps = {
  payload: [],
};

export default function AmountByMarkaChart({ data = [] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
  );

  const chartData = data.slice(0, 8).map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 12) + "…" : name, value }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="45%" outerRadius={85} innerRadius={45} dataKey="value" paddingAngle={2}>
          {chartData.map((item, i) => <Cell key={item.name} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

AmountByMarkaChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    )
  ),
};

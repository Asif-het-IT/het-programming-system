import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Package, DollarSign, Clock, AlertTriangle, CheckCircle, Truck, BarChart2 } from "lucide-react";

const iconMap = {
  TrendingUp, Package, DollarSign, Clock, AlertTriangle, CheckCircle, Truck, BarChart2,
};

const colorMap = {
  blue: "from-blue-500/20 to-blue-600/10 border-blue-500/20",
  emerald: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20",
  amber: "from-amber-500/20 to-amber-600/10 border-amber-500/20",
  rose: "from-rose-500/20 to-rose-600/10 border-rose-500/20",
  purple: "from-purple-500/20 to-purple-600/10 border-purple-500/20",
  cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/20",
};

const iconColorMap = {
  blue: "text-blue-400 bg-blue-500/15",
  emerald: "text-emerald-400 bg-emerald-500/15",
  amber: "text-amber-400 bg-amber-500/15",
  rose: "text-rose-400 bg-rose-500/15",
  purple: "text-purple-400 bg-purple-500/15",
  cyan: "text-cyan-400 bg-cyan-500/15",
};

const textColorMap = {
  blue: "text-blue-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  purple: "text-purple-400",
  cyan: "text-cyan-400",
};

export default function StatCard({ icon, label, value, sub, color = "blue", index = 0 }) {
  const Icon = iconMap[icon] || Package;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: "spring", stiffness: 120 }}
      className={`rounded-xl border bg-gradient-to-br p-5 ${colorMap[color] || colorMap.blue}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
          <p className={`text-2xl font-bold font-mono mt-1.5 ${textColorMap[color] || "text-blue-400"}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 ${iconColorMap[color] || iconColorMap.blue}`}>
          <Icon className={`h-5 w-5 ${textColorMap[color] || "text-blue-400"}`} />
        </div>
      </div>
    </motion.div>
  );
}

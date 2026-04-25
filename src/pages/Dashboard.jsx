import React, { useState, useMemo } from "react";
import { localDB } from "@/api/localDB";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useDatabaseManager } from "@/lib/DatabaseManager";
import { useViewManager } from "@/lib/ViewManager";
import { scopeOrdersByDatabase } from "@/lib/dataScope";
import { formatDatabaseLabel } from "@/config/columnMapping";
import { Package, DollarSign, Box, AlertTriangle, TrendingUp, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

import StatCard from "../components/dashboard/StatCard";
import DashboardFilters from "../components/dashboard/DashboardFilters";
import OrdersByBrandChart from "../components/dashboard/OrdersByBrandChart";
import AmountByMarkaChart from "../components/dashboard/AmountByMarkaChart";
import OverdueChart from "../components/dashboard/OverdueChart";
import ShipmentStatusCards from "../components/dashboard/ShipmentStatusCards";
import OrdersTable from "../components/dashboard/OrdersTable";

export default function Dashboard() {
  const [filters, setFilters] = useState({ brand: "all", marka: "all", range: "all", category: "all", consignee: "all", status: "all" });
  const { user } = useAuth();
  const { activeDatabase } = useDatabaseManager();
  const { getDefaultViewForUser, applyView } = useViewManager();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", activeDatabase?.id],
    queryFn: () => localDB.Order.list("-created_date", 200),
  });

  const scopedOrders = useMemo(() => {
    const dbOrders = scopeOrdersByDatabase(orders, activeDatabase?.id);
    if (user?.role === 'admin') return dbOrders;

    const defaultView = getDefaultViewForUser(user?.email || user?.id || '');
    if (!defaultView?.id) return [];

    return applyView(dbOrders, defaultView.id);
  }, [orders, activeDatabase?.id, user, getDefaultViewForUser, applyView]);

  const filtered = useMemo(() => {
    return scopedOrders.filter(o => {
      if (filters.brand !== "all" && o.brand !== filters.brand) return false;
      if (filters.marka !== "all" && o.marka !== filters.marka) return false;
      if (filters.range !== "all" && o.range !== filters.range) return false;
      if (filters.category !== "all" && o.category !== filters.category) return false;
      if (filters.consignee !== "all" && o.consignee !== filters.consignee) return false;
      if (filters.status !== "all" && o.shipment_status !== filters.status) return false;
      return true;
    });
  }, [scopedOrders, filters]);

  const stats = useMemo(() => {
    const totalQty = filtered.reduce((s, o) => s + (o.quantity || 0), 0);
    const totalAmount = filtered.reduce((s, o) => s + (o.amount_usd || 0), 0);
    const totalBoxes = filtered.reduce((s, o) => s + (o.total_box || 0), 0);
    const overdueCount = filtered.filter(o => (o.overdue_days || 0) < 0).length;
    const avgPrice = filtered.length > 0 && totalQty > 0 ? totalAmount / totalQty : 0;
    const uniqueBrands = new Set(filtered.map(o => o.brand)).size;
    return { totalQty, totalAmount, totalBoxes, overdueCount, avgPrice, uniqueBrands };
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-bold text-foreground tracking-tight">
                Programming Database
              </motion.h1>
              <p className="text-sm text-muted-foreground mt-0.5">Textile Orders & Shipment Tracking</p>
              <p className="text-xs text-primary mt-1">Active Database: {formatDatabaseLabel(activeDatabase)}</p>
            </div>
            <DashboardFilters orders={scopedOrders} filters={filters} setFilters={setFilters} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Quantity" value={`${(stats.totalQty/1000).toFixed(1)}K Mtr`} icon={Package} color="purple" index={0} subtitle={`${filtered.length} orders`} />
          <StatCard title="Total Amount" value={`$${(stats.totalAmount/1000).toFixed(1)}K`} icon={DollarSign} color="green" index={1} subtitle="USD value" />
          <StatCard title="Total Boxes" value={stats.totalBoxes.toLocaleString()} icon={Box} color="yellow" index={2} subtitle={`${stats.uniqueBrands} brands`} />
          <StatCard title="Overdue Orders" value={stats.overdueCount} icon={AlertTriangle} color="red" index={3} subtitle={stats.overdueCount > 0 ? "Action required" : "All on track"} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Avg Price/Mtr" value={`$${stats.avgPrice.toFixed(2)}`} icon={TrendingUp} color="cyan" index={4} />
          <StatCard title="Active Brands" value={stats.uniqueBrands} icon={Layers} color="blue" index={5} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OrdersByBrandChart orders={filtered} />
          <AmountByMarkaChart orders={filtered} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OverdueChart orders={filtered} />
          <ShipmentStatusCards orders={filtered} />
        </div>

        <OrdersTable orders={filtered} />
      </div>
    </div>
  );
}

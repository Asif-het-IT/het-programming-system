export function scopeOrdersByDatabase(orders, activeDatabaseId) {
  if (!activeDatabaseId) return orders;

  return (orders || []).filter((order) => {
    if (order.database_id === activeDatabaseId) return true;

    // Backward compatibility for legacy records without database_id.
    if (!order.database_id && activeDatabaseId === 'db_default') return true;

    return false;
  });
}

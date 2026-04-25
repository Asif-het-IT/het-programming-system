/**
 * localStorage-based Database (replaces Base44 entity store)
 * All data is stored in browser localStorage
 */

import {
  isIndexedDBSupported,
  listOrders,
  filterOrders,
  getOrder,
  putOrder,
  deleteOrder,
  bulkPutOrders,
  clearOrders,
  countOrders,
  replaceOrdersByField
} from '@/api/indexedDB';

const ORDERS_MIGRATION_FLAG = 'progdb_orders_migrated_to_indexeddb_v1';

function uuid() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function withMeta(data) {
  return {
    ...data,
    id: data.id || uuid(),
    created_date: data.created_date || new Date().toISOString(),
  };
}

function createEntityStore(storageKey) {
  const getAll = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  };

  const setAll = (data) => {
    localStorage.setItem(storageKey, JSON.stringify(data));
  };

  return {
    list: (sortField = '', limit = 0) => {
      let items = getAll();

      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items = [...items].sort((a, b) => {
          const va = a[field] ?? '';
          const vb = b[field] ?? '';
          if (typeof va === 'number' && typeof vb === 'number') {
            return desc ? vb - va : va - vb;
          }
          const sa = String(va);
          const sb = String(vb);
          return desc ? sb.localeCompare(sa) : sa.localeCompare(sb);
        });
      }

      if (limit > 0) items = items.slice(0, limit);
      return Promise.resolve(items);
    },

    filter: (filterObj) => {
      let items = getAll();
      if (filterObj) {
        items = items.filter(item => {
          return Object.entries(filterObj).every(([key, val]) => item[key] === val);
        });
      }
      return Promise.resolve(items);
    },

    get: (id) => {
      const items = getAll();
      const item = items.find(i => i.id === id);
      return item ? Promise.resolve(item) : Promise.reject(new Error('Not found'));
    },

    create: (data) => {
      const items = getAll();
      const item = {
        ...data,
        id: uuid(),
        created_date: new Date().toISOString(),
      };
      items.push(item);
      setAll(items);
      return Promise.resolve(item);
    },

    update: (id, data) => {
      const items = getAll();
      const idx = items.findIndex(i => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...data };
        setAll(items);
        return Promise.resolve(items[idx]);
      }
      return Promise.reject(new Error('Not found: ' + id));
    },

    delete: (id) => {
      const items = getAll();
      const filtered = items.filter(i => i.id !== id);
      setAll(filtered);
      return Promise.resolve();
    },

    bulkCreate: (dataArray) => {
      const items = getAll();
      const newItems = dataArray.map(d => ({
        ...d,
        id: uuid(),
        created_date: new Date().toISOString(),
      }));
      items.push(...newItems);
      setAll(items);
      return Promise.resolve(newItems);
    },

    replaceByField: (field, value, dataArray = []) => {
      const items = getAll();
      const keep = items.filter(item => item[field] !== value);
      const newItems = dataArray.map(d => ({
        ...d,
        id: uuid(),
        created_date: new Date().toISOString(),
      }));
      setAll([...keep, ...newItems]);
      return Promise.resolve(newItems);
    },

    clear: () => {
      setAll([]);
      return Promise.resolve();
    },

    count: () => {
      return Promise.resolve(getAll().length);
    },
  };
}

let ordersMigrationPromise = null;

function ensureOrdersMigration(getLegacyOrders) {
  if (!isIndexedDBSupported()) {
    return Promise.resolve(false);
  }

  if (localStorage.getItem(ORDERS_MIGRATION_FLAG) === 'true') {
    return Promise.resolve(true);
  }

  if (ordersMigrationPromise) {
    return ordersMigrationPromise;
  }

  ordersMigrationPromise = (async () => {
    const legacyOrders = getLegacyOrders();
    if (legacyOrders.length > 0) {
      const normalized = legacyOrders.map(withMeta);
      await bulkPutOrders(normalized);
    }

    localStorage.setItem('progdb_orders', JSON.stringify([]));
    localStorage.setItem(ORDERS_MIGRATION_FLAG, 'true');
    return true;
  })().catch(() => false);

  return ordersMigrationPromise;
}

function createOrderStore(storageKey) {
  const localStore = createEntityStore(storageKey);

  const withBackend = async (idbOp, localOp) => {
    const ready = await ensureOrdersMigration(() => {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch {
        return [];
      }
    });

    if (!ready) {
      return localOp();
    }

    try {
      return await idbOp();
    } catch {
      return localOp();
    }
  };

  return {
    list: (sortField = '', limit = 0) => {
      return withBackend(
        () => listOrders(sortField, limit),
        () => localStore.list(sortField, limit)
      );
    },

    filter: (filterObj) => {
      return withBackend(
        () => filterOrders(filterObj),
        () => localStore.filter(filterObj)
      );
    },

    get: (id) => {
      return withBackend(
        () => getOrder(id),
        () => localStore.get(id)
      );
    },

    create: (data) => {
      const item = withMeta(data);
      return withBackend(
        () => putOrder(item),
        () => localStore.create(item)
      );
    },

    update: (id, data) => {
      return withBackend(
        async () => {
          const existing = await getOrder(id);
          const updated = { ...existing, ...data, id };
          await putOrder(updated);
          return updated;
        },
        () => localStore.update(id, data)
      );
    },

    delete: (id) => {
      return withBackend(
        async () => {
          await deleteOrder(id);
        },
        () => localStore.delete(id)
      );
    },

    bulkCreate: (dataArray) => {
      const items = dataArray.map(withMeta);
      return withBackend(
        () => bulkPutOrders(items),
        () => localStore.bulkCreate(dataArray)
      );
    },

    replaceByField: (field, value, dataArray = []) => {
      const items = dataArray.map(withMeta);
      return withBackend(
        () => replaceOrdersByField(field, value, items),
        () => localStore.replaceByField(field, value, dataArray)
      );
    },

    clear: () => {
      return withBackend(
        async () => {
          await clearOrders();
        },
        () => localStore.clear()
      );
    },

    count: () => {
      return withBackend(
        () => countOrders(),
        () => localStore.count()
      );
    },
  };
}

export const localDB = {
  Order: createOrderStore('progdb_orders'),
  SyncConfig: createEntityStore('progdb_sync_configs'),
  SyncLog: createEntityStore('progdb_sync_logs'),
};

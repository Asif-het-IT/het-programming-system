const DB_NAME = 'progdb_indexed';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const store = db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
        store.createIndex('database_id', 'database_id', { unique: false });
        store.createIndex('created_date', 'created_date', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('IndexedDB open failed'));
    };
  });
}

function runTransaction(storeName, mode, handler) {
  return openDatabase().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let handlerResult;
      try {
        handlerResult = handler(store, tx);
      } catch (err) {
        tx.abort();
        reject(err);
        db.close();
        return;
      }

      tx.oncomplete = () => {
        db.close();
        resolve(handlerResult);
      };

      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB transaction failed'));
      };

      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB transaction aborted'));
      };
    });
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function sortItems(items, sortField) {
  if (!sortField) return items;

  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  const sorted = [...items].sort((a, b) => {
    const va = a[field] ?? '';
    const vb = b[field] ?? '';

    if (typeof va === 'number' && typeof vb === 'number') {
      return desc ? vb - va : va - vb;
    }

    const sa = String(va);
    const sb = String(vb);
    return desc ? sb.localeCompare(sa) : sa.localeCompare(sb);
  });

  return sorted;
}

export function isIndexedDBSupported() {
  return typeof indexedDB !== 'undefined';
}

export async function listOrders(sortField = '', limit = 0) {
  const items = await runTransaction(STORE_ORDERS, 'readonly', (store) => {
    return requestToPromise(store.getAll());
  });

  const sorted = sortItems(items || [], sortField);
  if (limit > 0) {
    return sorted.slice(0, limit);
  }
  return sorted;
}

export async function filterOrders(filterObj) {
  const items = await listOrders();
  if (!filterObj) return items;

  return items.filter((item) => {
    return Object.entries(filterObj).every(([key, val]) => item[key] === val);
  });
}

export async function getOrder(id) {
  const item = await runTransaction(STORE_ORDERS, 'readonly', (store) => {
    return requestToPromise(store.get(id));
  });

  if (!item) {
    throw new Error('Not found');
  }
  return item;
}

export async function putOrder(item) {
  return runTransaction(STORE_ORDERS, 'readwrite', (store) => {
    return requestToPromise(store.put(item)).then(() => item);
  });
}

export async function deleteOrder(id) {
  await runTransaction(STORE_ORDERS, 'readwrite', (store) => {
    return requestToPromise(store.delete(id));
  });
}

export async function bulkPutOrders(items = []) {
  await runTransaction(STORE_ORDERS, 'readwrite', (store) => {
    const operations = items.map((item) => requestToPromise(store.put(item)));
    return Promise.all(operations);
  });
  return items;
}

export async function clearOrders() {
  await runTransaction(STORE_ORDERS, 'readwrite', (store) => {
    return requestToPromise(store.clear());
  });
}

export async function countOrders() {
  const count = await runTransaction(STORE_ORDERS, 'readonly', (store) => {
    return requestToPromise(store.count());
  });
  return count || 0;
}

export async function replaceOrdersByField(field, value, dataArray = []) {
  const existing = await listOrders();
  const keep = existing.filter((item) => item[field] !== value);
  const merged = [...keep, ...dataArray];
  await clearOrders();
  await bulkPutOrders(merged);
  return dataArray;
}
/**
 * View Manager Context
 * Manages data views with field-level access control
 * Admin defines which fields/data each user/role can see
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Logger } from './logger';
import { getFieldsForView } from './viewConfig';

const VIEWS_KEY = 'progdb_views';
const USER_VIEWS_KEY = 'progdb_user_views_mapping';
const LEGACY_USER_VIEWS_KEY = 'progdb_user_views';
const LEGACY_MIGRATION_FLAG = 'progdb_user_views_migrated_v2';

export const ViewManagerContext = createContext();

// System-wide field definitions (all available fields)
export const AVAILABLE_FIELDS = {
  // Order identification
  sr: { label: 'SR #', type: 'number', category: 'identification' },
  order_id: { label: 'Order ID', type: 'text', category: 'identification' },
  
  // Product info
  brand: { label: 'Brand', type: 'text', category: 'product' },
  marka: { label: 'Marka', type: 'text', category: 'product' },
  category: { label: 'Category', type: 'text', category: 'product' },
  
  // Status & tracking
  status: { label: 'Status', type: 'select', category: 'status' },
  shipment_status: { label: 'Shipment Status', type: 'select', category: 'status' },
  overdue_days: { label: 'Overdue Days', type: 'number', category: 'status' },
  
  // Quantities
  quantity: { label: 'Quantity', type: 'number', category: 'quantity' },
  qty_received: { label: 'Qty Received', type: 'number', category: 'quantity' },
  qty_pending: { label: 'Qty Pending', type: 'number', category: 'quantity' },
  
  // Dates
  contract_date: { label: 'Contract Date', type: 'date', category: 'dates' },
  delivery_date: { label: 'Delivery Date', type: 'date', category: 'dates' },
  shipment_date: { label: 'Shipment Date', type: 'date', category: 'dates' },
  created_date: { label: 'Created Date', type: 'date', category: 'dates' },
  
  // Amount
  amount_usd: { label: 'Amount (USD)', type: 'number', category: 'financial' },
  inv_amount_usd: { label: 'Invoiced Amount (USD)', type: 'number', category: 'financial' },
  
  // Additional
  notes: { label: 'Notes', type: 'text', category: 'additional' },
  assigned_to: { label: 'Assigned To', type: 'text', category: 'additional' },
  priority: { label: 'Priority', type: 'select', category: 'additional' }
};

// Predefined system views (read-only)
const SYSTEM_VIEWS = {
  full_access: {
    id: 'view_full_access',
    name: 'Full Access',
    description: 'All fields, all data',
    is_system: true,
    fields: Object.keys(AVAILABLE_FIELDS),
    filters: {},
    sort_field: '-created_date',
    limit: 5000
  },
  summary_view: {
    id: 'view_summary',
    name: 'Summary View',
    description: 'Key fields only',
    is_system: true,
    fields: ['sr', 'brand', 'marka', 'status', 'quantity', 'amount_usd', 'delivery_date'],
    filters: {},
    sort_field: '-sr',
    limit: 1000
  },
  operations_view: {
    id: 'view_operations',
    name: 'Operations',
    description: 'For operations team',
    is_system: true,
    fields: ['sr', 'brand', 'quantity', 'shipment_status', 'shipment_date', 'assigned_to', 'priority'],
    filters: { status: 'active' },
    sort_field: '-priority',
    limit: 500
  },
  finance_view: {
    id: 'view_finance',
    name: 'Finance',
    description: 'For finance team',
    is_system: true,
    fields: ['sr', 'brand', 'contract_date', 'amount_usd', 'inv_amount_usd', 'status'],
    filters: { status: ['active', 'completed'] },
    sort_field: '-amount_usd',
    limit: 1000
  }
};

function normalizeViewField(field = '') {
  const key = String(field).trim();
  if (key === 'amount') return 'amount_usd';
  if (key === 'due_date') return 'delivery_date';
  if (key === 'order_date') return 'contract_date';
  if (key === 'amount_pending') return 'inv_amount_usd';
  return key;
}

function normalizeViewDefinition(view) {
  const originalFields = Array.isArray(view?.fields) ? view.fields : [];
  const normalizedFields = [...new Set(originalFields.map(normalizeViewField).filter(Boolean))];

  return {
    ...view,
    fields: normalizedFields
  };
}

function getViews() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
    const merged = { ...SYSTEM_VIEWS, ...saved };
    const normalized = {};

    Object.entries(merged).forEach(([id, view]) => {
      normalized[id] = normalizeViewDefinition(view);
    });

    return normalized;
  } catch {
    return SYSTEM_VIEWS;
  }
}

function saveCustomViews(views) {
  const custom = {};
  Object.entries(views).forEach(([id, view]) => {
    if (!view.is_system) {
      custom[id] = view;
    }
  });
  localStorage.setItem(VIEWS_KEY, JSON.stringify(custom));
}

function getUserViewMappings() {
  try {
    return JSON.parse(localStorage.getItem(USER_VIEWS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveUserViewMappings(mappings) {
  localStorage.setItem(USER_VIEWS_KEY, JSON.stringify(mappings));
}

function migrateLegacyUserViews() {
  try {
    if (localStorage.getItem(LEGACY_MIGRATION_FLAG) === '1') {
      return {
        views: getViews(),
        mappings: getUserViewMappings(),
        migrated: 0
      };
    }

    const legacyViews = JSON.parse(localStorage.getItem(LEGACY_USER_VIEWS_KEY) || '[]');
    const views = getViews();
    const mappings = getUserViewMappings();

    if (!Array.isArray(legacyViews) || legacyViews.length === 0) {
      localStorage.setItem(LEGACY_MIGRATION_FLAG, '1');
      return { views, mappings, migrated: 0 };
    }

    const mutableViews = { ...views };
    const mutableMappings = { ...mappings };
    const nameToId = new Map(Object.values(mutableViews).map((v) => [String(v.name || '').toLowerCase(), v.id]));
    let migrated = 0;

    for (const legacy of legacyViews) {
      if (!legacy || legacy.is_active === false) continue;

      const name = String(legacy.view_name || '').trim();
      if (!name) continue;

      const columns = Array.isArray(legacy.columns) ? legacy.columns : [];
      const fields = [...new Set(getFieldsForView(columns).map(normalizeViewField).filter(Boolean))];
      if (fields.length === 0) continue;

      const loweredName = name.toLowerCase();
      let viewId = nameToId.get(loweredName);

      if (!viewId) {
        viewId = `view_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        mutableViews[viewId] = {
          id: viewId,
          name,
          description: 'Migrated from legacy UserView storage',
          is_system: false,
          fields,
          filters: {},
          sort_field: '-sr',
          limit: 1000,
          created_date: legacy.created_date || new Date().toISOString()
        };
        nameToId.set(loweredName, viewId);
        migrated += 1;
      }

      const userId = String(legacy.assigned_user_email || '').trim();
      if (!userId) continue;

      if (!mutableMappings[userId]) {
        mutableMappings[userId] = [];
      }
      if (!mutableMappings[userId].includes(viewId)) {
        mutableMappings[userId].push(viewId);
      }
    }

    saveCustomViews(mutableViews);
    saveUserViewMappings(mutableMappings);
    localStorage.removeItem(LEGACY_USER_VIEWS_KEY);
    localStorage.setItem(LEGACY_MIGRATION_FLAG, '1');

    if (migrated > 0) {
      Logger.info('Legacy UserView migration completed', { migrated });
    }

    return {
      views: getViews(),
      mappings: getUserViewMappings(),
      migrated
    };
  } catch (err) {
    Logger.error('Legacy UserView migration failed', err);
    return {
      views: getViews(),
      mappings: getUserViewMappings(),
      migrated: 0
    };
  }
}

function normalizeFilterKey(key = '') {
  const map = {
    marka: 'marka',
    marka_code: 'marka',
    product_category: 'category',
    category: 'category',
    stage: 'status',
    stage_nig: 'status',
    stage_sss: 'status',
    qty: 'quantity',
    shipment_status: 'shipment_status',
    status: 'status'
  };

  const normalized = String(key).trim().toLowerCase();
  return map[normalized] || normalized;
}

function matchesFilter(record, key, expectedValue) {
  const recordValue = record?.[key];

  if (Array.isArray(expectedValue)) {
    return expectedValue.map((v) => String(v)).includes(String(recordValue));
  }

  if (typeof expectedValue === 'string' && expectedValue.includes(',')) {
    const options = expectedValue.split(',').map((v) => v.trim()).filter(Boolean);
    return options.includes(String(recordValue));
  }

  return String(recordValue) === String(expectedValue);
}

export const ViewProvider = ({ children }) => {
  const [views, setViews] = useState(SYSTEM_VIEWS);
  const [userMappings, setUserMappings_] = useState({});

  useEffect(() => {
    const { views: allViews, mappings } = migrateLegacyUserViews();
    setViews(allViews);
    setUserMappings_(mappings);
  }, []);

  /**
   * Create custom view
   */
  const createView = (viewData) => {
    try {
      if (!viewData.name || !viewData.fields || viewData.fields.length === 0) {
        throw new Error('View name and fields are required');
      }

      const newView = {
        id: `view_custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...normalizeViewDefinition(viewData),
        is_system: false,
        created_date: new Date().toISOString()
      };

      const allViews = { ...views, [newView.id]: newView };
      saveCustomViews(allViews);
      setViews(allViews);

      Logger.info('Custom view created', { name: newView.name, fields: newView.fields.length });
      return newView;
    } catch (err) {
      Logger.error('Create view error', err);
      throw err;
    }
  };

  /**
   * Delete custom view
   */
  const deleteView = (viewId) => {
    try {
      const view = views[viewId];
      if (!view || view.is_system) {
        throw new Error('Cannot delete system views');
      }

      const newViews = { ...views };
      delete newViews[viewId];
      
      saveCustomViews(newViews);
      setViews(newViews);

      // Remove user mappings for this view
      const newMappings = { ...userMappings };
      Object.keys(newMappings).forEach(userId => {
        newMappings[userId] = newMappings[userId].filter(v => v !== viewId);
      });
      saveUserViewMappings(newMappings);
      setUserMappings_(newMappings);

      Logger.info('View deleted', { id: viewId });
      return true;
    } catch (err) {
      Logger.error('Delete view error', err);
      throw err;
    }
  };

  /**
   * Assign view to user/role
   */
  const assignViewToUser = (userId, viewId) => {
    try {
      if (!views[viewId]) {
        throw new Error('View not found');
      }

      const mappings = { ...userMappings };
      if (!mappings[userId]) {
        mappings[userId] = [];
      }

      if (!mappings[userId].includes(viewId)) {
        mappings[userId].push(viewId);
      }

      saveUserViewMappings(mappings);
      setUserMappings_(mappings);

      Logger.info('View assigned to user', { userId, viewId });
      return true;
    } catch (err) {
      Logger.error('Assign view error', err);
      throw err;
    }
  };

  /**
   * Remove view from user
   */
  const removeViewFromUser = (userId, viewId) => {
    try {
      const mappings = { ...userMappings };
      if (mappings[userId]) {
        mappings[userId] = mappings[userId].filter(v => v !== viewId);
      }

      saveUserViewMappings(mappings);
      setUserMappings_(mappings);

      return true;
    } catch (err) {
      Logger.error('Remove view error', err);
      throw err;
    }
  };

  /**
   * Get views available to user
   */
  const getUserViews = (userId) => {
    const viewIds = userMappings[userId] || [];
    return viewIds.map(id => views[id]).filter(Boolean);
  };

  /**
   * Get default view for user (first assigned or full access)
   */
  const getDefaultViewForUser = (userId) => {
    const userViews = getUserViews(userId);
    if (userViews.length > 0) {
      return userViews[0];
    }
    // Strict deny when no view is assigned.
    return null;
  };

  /**
   * Apply view to data (filter fields and records)
   */
  const applyView = (data, viewId) => {
    try {
      const view = views[viewId];
      if (!view) {
        throw new Error('View not found');
      }

      // Filter fields
      if (!Array.isArray(data)) {
        return [];
      }

      const normalizedFilters = Object.entries(view.filters || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([filterKey, filterValue]) => [normalizeFilterKey(filterKey), filterValue]);

      const rowFiltered = normalizedFilters.length > 0
        ? data.filter((record) => {
            return normalizedFilters.every(([normalizedKey, filterValue]) => {
              return matchesFilter(record, normalizedKey, filterValue);
            });
          })
        : data;

      return rowFiltered.map(record => {
        const filtered = {};
        view.fields.forEach(field => {
          if (record.hasOwnProperty(field)) {
            filtered[field] = record[field];
          }
        });
        return filtered;
      });
    } catch (err) {
      Logger.error('Apply view error', err);
      return [];
    }
  };

  /**
   * Get all views (for admin)
   */
  const listViews = () => {
    return Object.values(views);
  };

  /**
   * Get view by ID
   */
  const getView = (viewId) => {
    return views[viewId];
  };

  return (
    <ViewManagerContext.Provider
      value={{
        views,
        userMappings,
        createView,
        deleteView,
        assignViewToUser,
        removeViewFromUser,
        getUserViews,
        getDefaultViewForUser,
        applyView,
        listViews,
        getView,
        AVAILABLE_FIELDS
      }}
    >
      {children}
    </ViewManagerContext.Provider>
  );
};

export const useViewManager = () => {
  const context = useContext(ViewManagerContext);
  if (!context) {
    throw new Error('useViewManager must be used within ViewProvider');
  }
  return context;
};

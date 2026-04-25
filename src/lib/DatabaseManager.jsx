/**
 * Database Manager Context
 * Manages multiple Google Sheet databases and active selection
 * Only ONE database is active at a time
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { Logger } from './logger';
import { DATABASE_TYPES, normalizeDatabaseType } from '@/config/columnMapping';

const DATABASES_KEY = 'progdb_databases';
const ACTIVE_DB_KEY = 'progdb_active_database';

export const DatabaseManagerContext = createContext();

const DEFAULT_DB = {
  id: 'db_default',
  name: 'Default Database',
  bridge_url: '',
  api_token: '',
  sheet_id: '',
  tab_name: 'Database',
  type: DATABASE_TYPES.GAYLE_LACE,
  created_date: new Date().toISOString(),
  is_active: true,
  last_synced: null,
  record_count: 0,
  status: 'pending' // pending, connected, error
};

function getDatabases() {
  try {
    return JSON.parse(localStorage.getItem(DATABASES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDatabases(dbs) {
  localStorage.setItem(DATABASES_KEY, JSON.stringify(dbs));
}

function getActiveDatabase() {
  try {
    const id = localStorage.getItem(ACTIVE_DB_KEY);
    const dbs = getDatabases();
    return dbs.find(db => db.id === id) || dbs[0] || null;
  } catch {
    return null;
  }
}

function setActiveDatabase(dbId) {
  localStorage.setItem(ACTIVE_DB_KEY, dbId);
}

export const DatabaseProvider = ({ children }) => {
  const [databases, setDatabases] = useState([]);
  const [activeDatabase, setActiveDatabase_] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize databases on mount
  useEffect(() => {
    const dbs = getDatabases().map((db) => ({
      ...db,
      type: normalizeDatabaseType(db.type)
    }));
    if (dbs.length === 0) {
      // Create default database on first run
      saveDatabases([DEFAULT_DB]);
      setDatabases([DEFAULT_DB]);
      setActiveDatabase_(DEFAULT_DB);
      setActiveDatabase(DEFAULT_DB.id);
    } else {
      saveDatabases(dbs);
      setDatabases(dbs);
      const active = getActiveDatabase();
      setActiveDatabase_(active ? { ...active, type: normalizeDatabaseType(active.type) } : active);
    }
    setIsLoading(false);
  }, []);

  /**
   * Add new database
   */
  const addDatabase = (config) => {
    try {
      if (!config.name || !config.bridge_url || !config.api_token) {
        throw new Error('Database name, bridge URL, and API token are required');
      }

      const dbs = getDatabases();
      const duplicate = dbs.find(
        (db) => db.name.toLowerCase() === String(config.name).toLowerCase().trim()
      );
      if (duplicate) {
        throw new Error('Database with this name already exists');
      }

      const newDb = {
        id: `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...config,
        type: normalizeDatabaseType(config.type),
        created_date: new Date().toISOString(),
        last_synced: null,
        record_count: 0,
        status: 'pending'
      };

      dbs.push(newDb);
      saveDatabases(dbs);
      setDatabases(dbs);

      Logger.info('Database added', { name: newDb.name, id: newDb.id });
      return newDb;
    } catch (err) {
      Logger.error('Add database error', err);
      throw err;
    }
  };

  /**
   * Switch active database
   */
  const switchDatabase = (dbId) => {
    try {
      const dbs = getDatabases();
      const db = dbs.find(d => d.id === dbId);
      
      if (!db) {
        throw new Error('Database not found');
      }

      setActiveDatabase(dbId);
      setActiveDatabase_(db);
      Logger.info('Database switched', { name: db.name, id: db.id });
      
      return db;
    } catch (err) {
      Logger.error('Switch database error', err);
      throw err;
    }
  };

  /**
   * Delete database
   */
  const deleteDatabase = (dbId) => {
    try {
      if (dbId === DEFAULT_DB.id) {
        throw new Error('Cannot delete default database');
      }

      const dbs = getDatabases().filter(d => d.id !== dbId);
      saveDatabases(dbs);

      // If deleted DB was active, switch to first available
      if (activeDatabase?.id === dbId) {
        const nextDb = dbs[0];
        if (nextDb) {
          switchDatabase(nextDb.id);
        }
      }

      setDatabases(dbs);
      Logger.info('Database deleted', { id: dbId });
      
      return true;
    } catch (err) {
      Logger.error('Delete database error', err);
      throw err;
    }
  };

  /**
   * Update database metadata (name, status, record count)
   */
  const updateDatabase = (dbId, updates) => {
    try {
      const dbs = getDatabases();
      const idx = dbs.findIndex(d => d.id === dbId);
      
      if (idx < 0) {
        throw new Error('Database not found');
      }

      dbs[idx] = { ...dbs[idx], ...updates };
      saveDatabases(dbs);

      if (activeDatabase?.id === dbId) {
        setActiveDatabase_({ ...activeDatabase, ...updates });
      }

      setDatabases(dbs);
      return dbs[idx];
    } catch (err) {
      Logger.error('Update database error', err);
      throw err;
    }
  };

  /**
   * Get all databases
   */
  const listDatabases = () => {
    return getDatabases();
  };

  /**
   * Get database by ID
   */
  const getDatabase = (dbId) => {
    return getDatabases().find(d => d.id === dbId);
  };

  /**
   * Bulk add databases from presets (skips duplicates by name)
   */
  const addDatabasesBulk = (presetList = [], sharedConfig = {}) => {
    try {
      const existing = getDatabases();
      const existingNames = new Set(existing.map((db) => String(db.name).toLowerCase()));
      const now = Date.now();

      const newItems = presetList
        .filter((preset) => {
          const lowered = String(preset?.name || '').toLowerCase();
          if (!lowered || existingNames.has(lowered)) return false;
          existingNames.add(lowered);
          return true;
        })
        .map((preset, idx) => ({
          id: `db_${now}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
          name: preset.name,
          bridge_url: sharedConfig.bridge_url || '',
          api_token: sharedConfig.api_token || '',
          sheet_id: preset.sheet_id || '',
          tab_name: preset.tab_name || 'Database',
          type: normalizeDatabaseType(preset.type),
          sheet_key: preset.sheet_key || `company_${idx + 1}`,
          created_date: new Date().toISOString(),
          last_synced: null,
          record_count: 0,
          status: 'pending',
          preset_filters: preset.filters || {}
        }));

      if (newItems.length === 0) {
        return { added: 0, skipped: presetList.length };
      }

      const merged = [...existing, ...newItems];
      saveDatabases(merged);
      setDatabases(merged);

      Logger.info('Database presets imported', {
        added: newItems.length,
        skipped: presetList.length - newItems.length
      });

      return {
        added: newItems.length,
        skipped: presetList.length - newItems.length
      };
    } catch (err) {
      Logger.error('Bulk add database error', err);
      throw err;
    }
  };

  return (
    <DatabaseManagerContext.Provider
      value={{
        databases,
        activeDatabase,
        isLoading,
        addDatabase,
        switchDatabase,
        deleteDatabase,
        updateDatabase,
        addDatabasesBulk,
        listDatabases,
        getDatabase
      }}
    >
      {children}
    </DatabaseManagerContext.Provider>
  );
};

export const useDatabaseManager = () => {
  const context = useContext(DatabaseManagerContext);
  if (!context) {
    throw new Error('useDatabaseManager must be used within DatabaseProvider');
  }
  return context;
};

/**
 * Data backup and recovery system for localStorage data
 */

import { Logger } from './logger';

const BACKUP_KEY = 'progdb_backups';
const MAX_BACKUPS = 5;

export const BackupManager = {
  /**
   * Create automatic backup of all data
   */
  createBackup: (label = '') => {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        label: label || `Auto-backup ${new Date().toLocaleString()}`,
        data: {
          orders: localStorage.getItem('progdb_orders'),
          syncConfigs: localStorage.getItem('progdb_sync_configs'),
          syncLogs: localStorage.getItem('progdb_sync_logs'),
          userViews: localStorage.getItem('progdb_user_views'),
          users: localStorage.getItem('progdb_users'),
          auth: localStorage.getItem('progdb_auth')
        }
      };

      const backups = BackupManager.listBackups();
      backups.unshift(backup);

      // Keep only last N backups
      if (backups.length > MAX_BACKUPS) {
        backups.pop();
      }

      localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
      Logger.info('Data backup created', { label: backup.label });

      return backup;
    } catch (err) {
      Logger.error('Backup creation failed', err);
      return null;
    }
  },

  /**
   * List all available backups
   */
  listBackups: () => {
    try {
      return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    } catch {
      return [];
    }
  },

  /**
   * Restore data from backup
   */
  restoreBackup: (timestamp) => {
    try {
      const backups = BackupManager.listBackups();
      const backup = backups.find(b => b.timestamp === timestamp);

      if (!backup) {
        Logger.warn('Backup not found', { timestamp });
        return false;
      }

      // Restore each data set
      Object.entries(backup.data).forEach(([key, value]) => {
        const storageKey = {
          orders: 'progdb_orders',
          syncConfigs: 'progdb_sync_configs',
          syncLogs: 'progdb_sync_logs',
          userViews: 'progdb_user_views',
          users: 'progdb_users',
          auth: 'progdb_auth'
        }[key];

        if (value) {
          localStorage.setItem(storageKey, value);
        }
      });

      Logger.info('Backup restored', { label: backup.label });
      return true;
    } catch (err) {
      Logger.error('Backup restore failed', err);
      return false;
    }
  },

  /**
   * Export backup as JSON file
   */
  exportBackup: (timestamp) => {
    try {
      const backups = BackupManager.listBackups();
      const backup = backups.find(b => b.timestamp === timestamp);

      if (!backup) return false;

      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url);

      Logger.info('Backup exported', { timestamp });
      return true;
    } catch (err) {
      Logger.error('Backup export failed', err);
      return false;
    }
  },

  /**
   * Import backup from JSON file
   */
  importBackup: async (file) => {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.data || !backup.timestamp) {
        throw new Error('Invalid backup format');
      }

      // Create backup of current state first
      BackupManager.createBackup('Before import');

      // Restore imported backup
      Object.entries(backup.data).forEach(([key, value]) => {
        const storageKey = {
          orders: 'progdb_orders',
          syncConfigs: 'progdb_sync_configs',
          syncLogs: 'progdb_sync_logs',
          userViews: 'progdb_user_views',
          users: 'progdb_users',
          auth: 'progdb_auth'
        }[key];

        if (value) {
          localStorage.setItem(storageKey, value);
        }
      });

      Logger.info('Backup imported successfully', { label: backup.label });
      return true;
    } catch (err) {
      Logger.error('Backup import failed', err);
      return false;
    }
  },

  /**
   * Get storage quota info
   */
  getStorageInfo: async () => {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        return null;
      }

      const estimate = await navigator.storage.estimate();
      const usagePercent = Math.round((estimate.usage / estimate.quota) * 100);

      return {
        usage: estimate.usage,
        quota: estimate.quota,
        available: estimate.quota - estimate.usage,
        usagePercent,
        warning: usagePercent > 80,
        critical: usagePercent > 95
      };
    } catch (err) {
      Logger.debug('Could not estimate storage', { error: err.message });
      return null;
    }
  },

  /**
   * Delete old backup
   */
  deleteBackup: (timestamp) => {
    try {
      const backups = BackupManager.listBackups().filter(b => b.timestamp !== timestamp);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
      Logger.info('Backup deleted', { timestamp });
      return true;
    } catch (err) {
      Logger.error('Backup deletion failed', err);
      return false;
    }
  },

  /**
   * Check data integrity
   */
  verifyDataIntegrity: () => {
    const issues = [];

    const keys = ['progdb_orders', 'progdb_sync_configs', 'progdb_sync_logs', 'progdb_user_views', 'progdb_users'];
    
    keys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          JSON.parse(data);
        }
      } catch {
        issues.push(`Corrupted data in ${key}`);
      }
    });

    if (issues.length > 0) {
      Logger.warn('Data integrity issues detected', { issues });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
};

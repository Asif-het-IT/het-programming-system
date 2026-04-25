import React, { useState } from 'react';
import { useDatabaseManager } from '@/lib/DatabaseManager';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Database, Plus, Trash2, Check, Clock, AlertCircle, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { COMPANY_DATABASE_PRESETS, QUICK_TWO_SHEET_PRESETS, QUICK_THREE_SHEET_PRESETS, TWO_DATABASE_TYPE_PRESETS } from '@/lib/companyPresets';
import { DATABASE_TYPES, formatDatabaseLabel } from '@/config/columnMapping';

function maskBridgeUrl(url = '') {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '***');
    }
    return parsed.toString();
  } catch {
    return String(url).replace(/([?&]token=)[^&]+/i, '$1***');
  }
}

export default function DatabaseManager() {
  const { user } = useAuth();
  const { databases, activeDatabase, addDatabase, addDatabasesBulk, switchDatabase, deleteDatabase } = useDatabaseManager();
  const { toast } = useToast();
  
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bridge_url: '',
    api_token: '',
    sheet_id: '',
    tab_name: 'Database',
    type: DATABASE_TYPES.GAYLE_LACE
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Database name required';
    if (!formData.bridge_url) newErrors.bridge_url = 'Bridge URL required';
    if (!formData.api_token) newErrors.api_token = 'API token required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddDatabase = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const db = addDatabase(formData);
      toast({
        title: "Success",
        description: `Database "${formatDatabaseLabel(db)}" added successfully`
      });
      setFormData({ name: '', bridge_url: '', api_token: '', sheet_id: '', tab_name: 'Database', type: DATABASE_TYPES.GAYLE_LACE });
      setShowAdd(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (db) => {
    try {
      switchDatabase(db.id);
      toast({
        title: "Success",
        description: `Switched to "${formatDatabaseLabel(db)}"`
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = (dbId) => {
    if (confirm('Are you sure you want to delete this database? This cannot be undone.')) {
      try {
        deleteDatabase(dbId);
        toast({
          title: "Success",
          description: "Database deleted"
        });
      } catch (err) {
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleImportPresets = () => {
    if (!formData.bridge_url || !formData.api_token) {
      toast({
        title: 'Bridge URL & API token required',
        description: 'Bridge URL aur API token fill karein, phir presets import karein.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = addDatabasesBulk(COMPANY_DATABASE_PRESETS, {
        bridge_url: formData.bridge_url,
        api_token: formData.api_token
      });

      toast({
        title: 'Company presets imported',
        description: `Added ${result.added}, skipped ${result.skipped}`
      });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const handleImportTwoSheets = () => {
    if (!formData.bridge_url || !formData.api_token) {
      toast({
        title: 'Bridge URL & API token required',
        description: '2-sheet setup ke liye pehle bridge URL aur API token fill karein.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = addDatabasesBulk(QUICK_TWO_SHEET_PRESETS, {
        bridge_url: formData.bridge_url,
        api_token: formData.api_token
      });

      toast({
        title: '2 Google Sheets imported',
        description: `Added ${result.added}, skipped ${result.skipped}`
      });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const handleImportThreeSheets = () => {
    if (!formData.bridge_url || !formData.api_token) {
      toast({
        title: 'Bridge URL & API token required',
        description: '3-database setup ke liye pehle bridge URL aur API token fill karein.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = addDatabasesBulk(QUICK_THREE_SHEET_PRESETS, {
        bridge_url: formData.bridge_url,
        api_token: formData.api_token
      });

      toast({
        title: '3 Google Sheets imported',
        description: `Added ${result.added}, skipped ${result.skipped}`
      });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const handleImportTwoStructuredDatabases = () => {
    if (!formData.bridge_url || !formData.api_token) {
      toast({
        title: 'Bridge URL & API token required',
        description: 'Men Material + Gayle/Lace setup ke liye bridge URL aur API token fill karein.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = addDatabasesBulk(TWO_DATABASE_TYPE_PRESETS, {
        bridge_url: formData.bridge_url,
        api_token: formData.api_token
      });

      toast({
        title: '2 structure databases imported',
        description: `Added ${result.added}, skipped ${result.skipped}`
      });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  // Only admin can manage databases
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4 opacity-50" />
          <h1 className="text-lg font-semibold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-2">Only administrators can manage databases</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> Database Manager
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage multiple Google Sheet databases. Only one can be active at a time.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleImportTwoStructuredDatabases} className="text-xs h-8">
              Import Men+Gayle Databases
            </Button>
            <Button size="sm" variant="outline" onClick={handleImportThreeSheets} className="text-xs h-8">
              Import 3 Core Databases
            </Button>
            <Button size="sm" variant="outline" onClick={handleImportTwoSheets} className="text-xs h-8">
              Import 2 Google Sheets
            </Button>
            <Button size="sm" variant="outline" onClick={handleImportPresets} className="text-xs h-8">
              Import Company Presets
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)} className="text-xs h-8 bg-primary hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Database
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Add Database Form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add New Database
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Database Name</label>
                  <Input
                    placeholder="e.g. Main Database"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (errors.name) setErrors({ ...errors, name: '' });
                    }}
                    className={`h-8 text-xs ${errors.name ? 'border-destructive' : ''}`}
                  />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Bridge URL</label>
                  <Input
                    placeholder="https://script.google.com/..."
                    value={formData.bridge_url}
                    onChange={(e) => {
                      setFormData({ ...formData, bridge_url: e.target.value });
                      if (errors.bridge_url) setErrors({ ...errors, bridge_url: '' });
                    }}
                    className={`h-8 text-xs ${errors.bridge_url ? 'border-destructive' : ''}`}
                  />
                  {errors.bridge_url && <p className="text-xs text-destructive mt-1">{errors.bridge_url}</p>}
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">API Token</label>
                  <Input
                    type="password"
                    placeholder="Your API token"
                    value={formData.api_token}
                    onChange={(e) => {
                      setFormData({ ...formData, api_token: e.target.value });
                      if (errors.api_token) setErrors({ ...errors, api_token: '' });
                    }}
                    className={`h-8 text-xs ${errors.api_token ? 'border-destructive' : ''}`}
                  />
                  {errors.api_token && <p className="text-xs text-destructive mt-1">{errors.api_token}</p>}
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Sheet ID (Optional)</label>
                  <Input
                    placeholder="Google Sheet ID"
                    value={formData.sheet_id}
                    onChange={(e) => setFormData({ ...formData, sheet_id: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Tab Name</label>
                  <Input
                    placeholder="Sheet tab name"
                    value={formData.tab_name}
                    onChange={(e) => setFormData({ ...formData, tab_name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Database Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="h-8 text-xs bg-secondary border border-border rounded-md px-2 py-1 w-full"
                  >
                    <option value={DATABASE_TYPES.MEN_MATERIAL}>MEN_MATERIAL</option>
                    <option value={DATABASE_TYPES.GAYLE_LACE}>GAYLE_LACE</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdd(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddDatabase}
                  disabled={loading}
                  className="text-xs h-8 bg-primary hover:bg-primary/90"
                >
                  {loading ? "Adding..." : "Add Database"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Database List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Databases ({databases.length})</h2>
          
          {databases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No databases configured yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {databases.map((db) => (
                <motion.div
                  key={db.id}
                  layout
                  className="rounded-xl border border-border bg-card p-4 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-foreground">{formatDatabaseLabel(db)}</h3>
                        {activeDatabase?.id === db.id && (
                          <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <Check className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        )}
                        <Badge className={`text-xs ${
                          db.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' :
                          db.status === 'error' ? 'bg-destructive/20 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {db.status === 'connected' ? <Check className="h-3 w-3 mr-1" /> :
                           db.status === 'error' ? <AlertCircle className="h-3 w-3 mr-1" /> :
                           <Clock className="h-3 w-3 mr-1" />}
                          {db.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-md">{maskBridgeUrl(db.bridge_url)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Created: {new Date(db.created_date).toLocaleDateString()}</p>
                      {db.last_synced && (
                        <p className="text-[10px] text-muted-foreground">Last synced: {new Date(db.last_synced).toLocaleString()}</p>
                      )}
                      {db.record_count > 0 && (
                        <p className="text-[10px] text-muted-foreground">Records: {db.record_count.toLocaleString()}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {activeDatabase?.id !== db.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwitch(db)}
                          className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Check className="h-3 w-3 mr-1" /> Switch
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={db.id === 'db_default'}
                        onClick={() => handleDelete(db.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Database Info */}
        {activeDatabase && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-primary" /> Active Database Info
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground mb-1">Name</p>
                <p className="font-semibold text-foreground">{formatDatabaseLabel(activeDatabase)}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Type</p>
                <p className="font-semibold text-foreground">{activeDatabase.type}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Tab</p>
                <p className="font-semibold text-foreground">{activeDatabase.tab_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Status</p>
                <p className="font-semibold text-emerald-400 capitalize">{activeDatabase.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Records</p>
                <p className="font-semibold text-foreground">{activeDatabase.record_count.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

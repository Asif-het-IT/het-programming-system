import React, { useState } from 'react';
import { useViewManager } from '@/lib/ViewManager';
import { useAuth } from '@/lib/AuthContext';
import { useDatabaseManager } from '@/lib/DatabaseManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Plus, Trash2, Users, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { COMPANY_DATABASE_PRESETS, DEFAULT_VIEW_FIELDS, EXTERNAL_VIEW_PRESETS, CORE_THREE_COMPANY_VIEW_PRESETS, TWO_DATABASE_VIEW_PRESETS } from '@/lib/companyPresets';
import { getFieldsForView } from '@/lib/viewConfig';
import { getDynamicFilterFields, formatDatabaseLabel } from '@/config/columnMapping';

export default function ViewAccessControl() {
  const { user } = useAuth();
  const { activeDatabase } = useDatabaseManager();
  const { views, userMappings, createView, deleteView, assignViewToUser, removeViewFromUser, AVAILABLE_FIELDS } = useViewManager();
  const { toast } = useToast();

  const [showCreateView, setShowCreateView] = useState(false);
  const [showAssignView, setShowAssignView] = useState(false);
  const [selectedViewForAssign, setSelectedViewForAssign] = useState(null);
  
  const [viewForm, setViewForm] = useState({
    name: '',
    description: '',
    fields: [],
    filters: {}
  });

  const [assignForm, setAssignForm] = useState({
    viewId: '',
    userId: ''
  });

  const [errors, setErrors] = useState({});

  const dynamicFilterFields = getDynamicFilterFields(activeDatabase?.type);

  // Only admin
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4 opacity-50" />
          <h1 className="text-lg font-semibold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-2">Only administrators can manage views and access</p>
        </div>
      </div>
    );
  }

  const handleCreateView = async () => {
    const newErrors = {};
    if (!viewForm.name) newErrors.name = 'View name required';
    if (viewForm.fields.length === 0) newErrors.fields = 'Select at least one field';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await createView({
        name: viewForm.name,
        description: viewForm.description,
        fields: viewForm.fields,
        filters: Object.fromEntries(
          Object.entries(viewForm.filters || {}).filter(([, value]) => String(value || '').trim() !== '')
        ),
        sort_field: '-sr',
        limit: 1000
      });

      toast({
        title: "Success",
        description: `View "${viewForm.name}" created`
      });

      setViewForm({ name: '', description: '', fields: [], filters: {} });
      setShowCreateView(false);
      setErrors({});
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleAssignView = async () => {
    if (!assignForm.viewId || !assignForm.userId) {
      setErrors({ form: 'Select both view and user' });
      return;
    }

    try {
      await assignViewToUser(assignForm.userId, assignForm.viewId);
      toast({
        title: "Success",
        description: "View assigned to user"
      });

      setAssignForm({ viewId: '', userId: '' });
      setShowAssignView(false);
      setErrors({});
    } catch (err) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteView = (viewId) => {
    const view = views[viewId];
    if (view?.is_system) {
      toast({
        title: "Error",
        description: "Cannot delete system views",
        variant: "destructive"
      });
      return;
    }

    if (confirm(`Delete view "${view?.name}"? This will remove it from all users.`)) {
      try {
        deleteView(viewId);
        toast({
          title: "Success",
          description: "View deleted"
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

  const handleGenerateCompanyViews = async () => {
    let added = 0;
    let skipped = 0;
    const existingNames = new Set(Object.values(views).map((v) => String(v.name).toLowerCase()));

    for (const company of COMPANY_DATABASE_PRESETS) {
      const viewName = `${company.name} - ${company.filters.PRODUCT_CATEGORY}`;
      if (existingNames.has(viewName.toLowerCase())) {
        skipped += 1;
        continue;
      }

      await createView({
        name: viewName,
        description: `Auto preset for ${company.name}`,
        fields: DEFAULT_VIEW_FIELDS,
        filters: {
          MARKA_CODE: company.filters.MARKA_CODE,
          PRODUCT_CATEGORY: company.filters.PRODUCT_CATEGORY
        },
        sort_field: '-sr',
        limit: 1000
      });

      existingNames.add(viewName.toLowerCase());
      added += 1;
    }

    toast({
      title: 'Company views generated',
      description: `Added ${added}, skipped ${skipped}`
    });
  };

  const handleImportExternalViews = async () => {
    let added = 0;
    let skipped = 0;
    const existingNames = new Set(Object.values(views).map((v) => String(v.name).toLowerCase()));

    for (const preset of EXTERNAL_VIEW_PRESETS) {
      if (existingNames.has(String(preset.name).toLowerCase())) {
        skipped += 1;
        continue;
      }

      const columns = String(preset.columns_list)
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      const fields = getFieldsForView(columns);

      if (fields.length === 0) {
        skipped += 1;
        continue;
      }

      await createView({
        name: preset.name,
        description: `External sheet sync view (${preset.target_sheet_name})`,
        fields,
        filters: {},
        sort_field: '-sr',
        limit: 1000,
        target_url: preset.target_url,
        target_sheet_name: preset.target_sheet_name,
        columns_list: preset.columns_list
      });

      existingNames.add(String(preset.name).toLowerCase());
      added += 1;
    }

    toast({
      title: 'External views imported',
      description: `Added ${added}, skipped ${skipped}`
    });
  };

  const handleImportCoreThreeViews = async () => {
    let added = 0;
    let skipped = 0;
    const existingNames = new Set(Object.values(views).map((v) => String(v.name).toLowerCase()));

    for (const preset of CORE_THREE_COMPANY_VIEW_PRESETS) {
      if (existingNames.has(preset.name.toLowerCase())) {
        skipped += 1;
        continue;
      }

      await createView({
        name: preset.name,
        description: 'Core 3-company filter preset',
        fields: DEFAULT_VIEW_FIELDS,
        filters: {
          MARKA_CODE: preset.marka_code,
          PRODUCT_CATEGORY: preset.product_category
        },
        sort_field: '-sr',
        limit: 1000
      });
      existingNames.add(preset.name.toLowerCase());
      added += 1;
    }

    toast({
      title: 'Core views imported',
      description: `Added ${added}, skipped ${skipped}`
    });
  };

  const handleImportTwoDatabaseViews = async () => {
    let added = 0;
    let skipped = 0;
    const existingNames = new Set(Object.values(views).map((v) => String(v.name).toLowerCase()));

    for (const preset of TWO_DATABASE_VIEW_PRESETS) {
      if (existingNames.has(preset.name.toLowerCase())) {
        skipped += 1;
        continue;
      }

      await createView({
        name: preset.name,
        description: 'Two-database compatibility preset',
        fields: preset.fields,
        filters: preset.filters || {},
        sort_field: '-sr',
        limit: 1000
      });
      existingNames.add(preset.name.toLowerCase());
      added += 1;
    }

    toast({
      title: '2-DB views imported',
      description: `Added ${added}, skipped ${skipped}`
    });
  };

  const viewList = Object.values(views);
  const customViews = viewList.filter(v => !v.is_system);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Access Control
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage data views and user access permissions</p>
            <p className="text-xs text-primary mt-1">Active DB: {formatDatabaseLabel(activeDatabase)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleImportTwoDatabaseViews} className="text-xs h-8">
              Import 2-DB Preset Views
            </Button>
            <Button size="sm" variant="outline" onClick={handleImportCoreThreeViews} className="text-xs h-8">
              Import 3-DB Gayle/Lace Views
            </Button>
            <Button size="sm" variant="outline" onClick={handleImportExternalViews} className="text-xs h-8">
              Import Provided Views
            </Button>
            <Button size="sm" variant="outline" onClick={handleGenerateCompanyViews} className="text-xs h-8">
              Generate Company Views
            </Button>
            <Button size="sm" onClick={() => setShowCreateView(true)} className="text-xs h-8 bg-primary hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create View
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Create View Form */}
        <AnimatePresence>
          {showCreateView && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-foreground">Create Custom View</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">View Name</label>
                  <Input
                    placeholder="e.g. Operations Team View"
                    value={viewForm.name}
                    onChange={(e) => setViewForm({ ...viewForm, name: e.target.value })}
                    className={`h-8 text-xs ${errors.name ? 'border-destructive' : ''}`}
                  />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Description</label>
                  <Input
                    placeholder="What this view is for"
                    value={viewForm.description}
                    onChange={(e) => setViewForm({ ...viewForm, description: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                {dynamicFilterFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-[11px] text-muted-foreground font-medium block mb-1">{field.label} Filter (Optional)</label>
                    <Input
                      placeholder={`e.g. ${field.key === 'PRODUCT_CATEGORY' ? 'Lace' : 'FZC'}`}
                      value={viewForm.filters?.[field.key] || ''}
                      onChange={(e) => setViewForm({
                        ...viewForm,
                        filters: {
                          ...viewForm.filters,
                          [field.key]: e.target.value
                        }
                      })}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-2">Select Fields to Include</label>
                {errors.fields && <p className="text-xs text-destructive mb-2">{errors.fields}</p>}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-3 bg-black/20 rounded-lg">
                  {Object.entries(AVAILABLE_FIELDS).map(([fieldKey, fieldInfo]) => (
                    <label key={fieldKey} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={viewForm.fields.includes(fieldKey)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setViewForm({
                              ...viewForm,
                              fields: [...viewForm.fields, fieldKey]
                            });
                          } else {
                            setViewForm({
                              ...viewForm,
                              fields: viewForm.fields.filter(f => f !== fieldKey)
                            });
                          }
                          if (errors.fields) setErrors({ ...errors, fields: '' });
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-xs text-foreground">{fieldInfo.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateView(false);
                    setViewForm({ name: '', description: '', fields: [], filters: {} });
                    setErrors({});
                  }}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateView}
                  className="text-xs h-8 bg-primary hover:bg-primary/90"
                >
                  Create View
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Assign View Form */}
        <AnimatePresence>
          {showAssignView && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Assign View to User
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">Select View</label>
                  <select
                    value={assignForm.viewId}
                    onChange={(e) => setAssignForm({ ...assignForm, viewId: e.target.value })}
                    className="h-8 text-xs bg-secondary border border-border rounded-md px-2 py-1 w-full"
                  >
                    <option value="">Choose a view...</option>
                    {viewList.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.is_system ? '(System)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">User ID/Email</label>
                  <Input
                    placeholder="user@example.com"
                    value={assignForm.userId}
                    onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {errors.form && <p className="text-xs text-destructive">{errors.form}</p>}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAssignView(false);
                    setAssignForm({ viewId: '', userId: '' });
                    setErrors({});
                  }}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAssignView}
                  className="text-xs h-8 bg-primary hover:bg-primary/90"
                >
                  Assign View
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Views List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">System Views (Read-Only)</h2>
          <div className="space-y-2">
            {viewList.filter(v => v.is_system).map(view => (
              <motion.div key={view.id} layout className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{view.name}</h3>
                      <Badge className="text-xs bg-primary/20 text-primary border-primary/30">System</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{view.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{view.fields.length} fields</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Custom Views */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Custom Views</h2>
            <Button size="sm" onClick={() => setShowAssignView(true)} className="text-xs h-7 bg-primary/10 text-primary hover:bg-primary/20">
              <Users className="h-3 w-3 mr-1" /> Assign to User
            </Button>
          </div>

          {customViews.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No custom views yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customViews.map(view => (
                <motion.div key={view.id} layout className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground">{view.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">{view.description}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {view.fields.slice(0, 5).map(field => (
                          <Badge key={field} className="text-xs bg-muted text-muted-foreground">
                            {AVAILABLE_FIELDS[field]?.label || field}
                          </Badge>
                        ))}
                        {view.filters && Object.keys(view.filters).length > 0 && (
                          <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                            Filters: {Object.entries(view.filters).map(([k, v]) => `${k}=${v}`).join(', ')}
                          </Badge>
                        )}
                        {view.fields.length > 5 && (
                          <Badge className="text-xs bg-muted text-muted-foreground">
                            +{view.fields.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteView(view.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* User View Assignments */}
        {Object.keys(userMappings).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">User View Assignments</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(userMappings).map(([userId, viewIds]) => (
                <div key={userId} className="text-xs">
                  <p className="text-muted-foreground font-mono">{userId}</p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {viewIds.map(viewId => (
                      <Badge key={viewId} className="text-xs bg-primary/20 text-primary">
                        {views[viewId]?.name || viewId}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

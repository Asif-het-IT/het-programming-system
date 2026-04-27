import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, LogOut, Loader2, AlertCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDataRequest, getExportRequest, getMyViewsRequest } from '@/api/enterpriseApi';
import ThemeToggle from '@/components/ThemeToggle';
import PwaInstallButton from '@/components/PwaInstallButton';
import NotificationSetup from '@/components/NotificationSetup';
import HetLogo from '@/components/HetLogo';

const FIELD_LABELS = {
  A: 'Col A', B: 'Col B', C: 'Col C', D: 'Col D', E: 'Col E', F: 'Col F', G: 'Col G', H: 'Col H',
  I: 'Col I', J: 'Col J', K: 'Col K', L: 'Col L', M: 'Col M', N: 'Col N', O: 'Col O', P: 'Col P',
  Q: 'Col Q', R: 'Col R', S: 'Col S', T: 'Col T', U: 'Col U', V: 'Col V', W: 'Col W', X: 'Col X',
  Y: 'Col Y', Z: 'Col Z', AA: 'Col AA', AB: 'Col AB', AC: 'Col AC', AD: 'Col AD', AE: 'Col AE',
  AF: 'Col AF', AG: 'Col AG', AH: 'Col AH', AI: 'Col AI', AJ: 'Col AJ', AK: 'Col AK', AL: 'Col AL',
  AM: 'Col AM', AN: 'Col AN', AO: 'Col AO', AP: 'Col AP', AQ: 'Col AQ', AR: 'Col AR', AS: 'Col AS',
  AT: 'Col AT', AU: 'Col AU', AV: 'Col AV', AW: 'Col AW', AX: 'Col AX', AY: 'Col AY', AZ: 'Col AZ',
};

const PAGE_SIZE = 100;

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeColumn(value) {
  return String(value || '').trim();
}

function getViewKey(view) {
  return `${view?.database || 'UNKNOWN'}::${view?.viewName || ''}`;
}

function normalizeRows(payload) {
  if (!payload) {
    return [];
  }
  const envelope = payload?.data && typeof payload.data === 'object' ? payload.data : payload;

  if (Array.isArray(envelope.records)) {
    return envelope.records;
  }

  if (Array.isArray(envelope.items)) {
    return envelope.items;
  }

  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }
  return [];
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [selectedDatabase, setSelectedDatabase] = useState('all');
  const [selectedViewKey, setSelectedViewKey] = useState('');
  const [search, setSearch] = useState('');
  const [marka, setMarka] = useState('');
  const [product, setProduct] = useState('');
  const [dsn, setDsn] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [columnFilters, setColumnFilters] = useState({});
  const [page, setPage] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const parentRef = useRef(null);

  const { data: viewPayload, isLoading: isLoadingViews } = useQuery({
    queryKey: ['my-views'],
    queryFn: getMyViewsRequest,
    enabled: Boolean(user?.email),
    staleTime: 5 * 60 * 1000,
  });

  const safeViews = useMemo(() => {
    if (!Array.isArray(viewPayload?.views)) {
      return [];
    }

    return viewPayload.views.map((view) => ({
      database: view.database,
      viewName: view.viewName,
      columnsList: Array.isArray(view.columnsList) ? view.columnsList : [],
      filterableColumns: Array.isArray(view.filterableColumns) ? view.filterableColumns : [],
      source: view.source || 'legacy',
    }));
  }, [viewPayload]);

  const availableDatabases = useMemo(() => {
    const set = new Set(safeViews.map((view) => view.database).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [safeViews]);

  const filteredViews = useMemo(() => {
    const source = selectedDatabase === 'all'
      ? safeViews
      : safeViews.filter((view) => view.database === selectedDatabase);

    const seen = new Set();
    return source.filter((view) => {
      const key = getViewKey(view);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [safeViews, selectedDatabase]);

  useEffect(() => {
    if (!filteredViews.length) {
      setSelectedViewKey('');
      return;
    }

    const exists = filteredViews.some((view) => getViewKey(view) === selectedViewKey);
    if (!exists) {
      setSelectedViewKey(getViewKey(filteredViews[0]));
      setPage(0);
    }
  }, [filteredViews, selectedViewKey]);

  const currentView = filteredViews.find((v) => getViewKey(v) === selectedViewKey) || filteredViews[0] || safeViews[0];
  const isDynamicView = currentView?.source === 'dynamic';
  const showLegacyFilters = currentView?.source !== 'dynamic';

  const filterableColumns = useMemo(() => {
    return uniqueValues(currentView?.filterableColumns || []);
  }, [currentView]);

  useEffect(() => {
    const defaults = {};
    for (const column of filterableColumns) {
      defaults[column] = '';
    }
    setColumnFilters(defaults);
    setPage(0);
  }, [selectedViewKey, filterableColumns]);

  const activeColumnFilters = useMemo(() => {
    const out = {};
    for (const [key, value] of Object.entries(columnFilters || {})) {
      const clean = String(value || '').trim();
      if (clean) out[key] = clean;
    }
    return out;
  }, [columnFilters]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['enterprise-data', currentView?.database, currentView?.viewName, page, search, marka, product, dsn, fromDate, toDate, sortBy, sortOrder, JSON.stringify(activeColumnFilters)],
    queryFn: () => getDataRequest({
      database: currentView?.database,
      view: currentView?.viewName,
      page: page + 1,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      columnFilters: isDynamicView && Object.keys(activeColumnFilters).length > 0
        ? JSON.stringify(activeColumnFilters)
        : undefined,
      marka: marka || undefined,
      product: product || undefined,
      dsn: dsn || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      sortBy: sortBy || undefined,
      sortOrder,
    }),
    enabled: Boolean(currentView?.viewName),
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(() => normalizeRows(data), [data]);
  const dataEnvelope = useMemo(() => {
    if (!data) {
      return null;
    }
    if (data.data && typeof data.data === 'object') {
      return data.data;
    }
    return data;
  }, [data]);

  const visibleColumns = useMemo(() => {
    if (rows.length > 0) {
      return uniqueValues(Object.keys(rows[0]));
    }
    return uniqueValues(currentView?.columnsList || []);
  }, [rows, currentView]);

  const sortableColumns = useMemo(() => {
    const seen = new Set();
    const unique = [];

    for (const col of visibleColumns) {
      const normalized = normalizeColumn(col);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(normalized);
    }

    return unique;
  }, [visibleColumns]);
  const totalRecords = dataEnvelope?.total ?? dataEnvelope?.count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const runExport = async (format) => {
    const payload = await getExportRequest({
      database: currentView.database,
      view: currentView.viewName,
      format,
    });

    if (payload?.downloadUrl) {
      window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!user) {
    navigate('/');
    return null;
  }

  let mainContent;

  if (safeViews.length === 0) {
    mainContent = (
      <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">No view assigned</h2>
          <p className="text-sm text-muted-foreground mt-2">Admin se apna view assign karwaein</p>
        </div>
      </div>
    );
  } else if (isLoadingViews || isLoading) {
    mainContent = (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading enterprise dataset...</p>
        </div>
      </div>
    );
  } else if (error) {
    mainContent = (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900">Data load failed</p>
            <p className="text-xs text-red-800 mt-1">We could not load the selected view right now. Please retry.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
          {user?.role === 'admin' ? (
            <Button size="sm" variant="outline" onClick={() => setShowDebug((prev) => !prev)}>
              {showDebug ? 'Hide Debug' : 'Show Debug'}
            </Button>
          ) : null}
        </div>
        {showDebug && user?.role === 'admin' ? (
          <pre className="text-[11px] leading-4 whitespace-pre-wrap rounded border border-red-200 bg-white p-2 max-h-52 overflow-auto">{error?.response?.data ? JSON.stringify(error.response.data, null, 2) : String(error?.stack || error?.message || 'unknown_error')}</pre>
        ) : null}
      </div>
    );
  } else {
    mainContent = (
      <>
      <div className="text-xs text-muted-foreground">
        {totalRecords} records · {visibleColumns.length} columns · page {page + 1}
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px]">
            <div className="grid bg-muted/50 border-b" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(120px, 1fr))` }}>
              {visibleColumns.map((col) => (
                <div key={col} className="text-[11px] font-semibold whitespace-nowrap px-3 py-2">
                  {FIELD_LABELS[col] || col}
                </div>
              ))}
            </div>

            <div ref={parentRef} className="h-[540px] overflow-auto">
              {rows.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">No records found</p>
                    <p className="text-xs text-muted-foreground">Try changing filters, search text, or date range.</p>
                    <Button size="sm" variant="outline" onClick={() => refetch()}>
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index] || {};
                  return (
                    <div
                      key={virtualRow.key}
                      className="grid border-b hover:bg-secondary/20"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(120px, 1fr))`,
                      }}
                    >
                      {visibleColumns.map((col) => (
                        <div key={`${virtualRow.index}-${col}`} className="text-xs py-2 px-3 whitespace-nowrap truncate">
                          {row[col] || '—'}
                        </div>
                      ))}
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </div>
        </div>

        {totalPages >= 1 && (
          <div className="flex justify-between items-center p-4 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <HetLogo size={34} />
            <div>
              <h1 className="text-xl font-bold">het Database</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Welcome, {user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <NotificationSetup compact />
            <PwaInstallButton />
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/'); }}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-8 gap-3 items-end">
          <div className="flex-1">
            <p className="block text-sm font-medium mb-1.5">Database</p>
            <Select value={selectedDatabase} onValueChange={(value) => { setSelectedDatabase(value); setPage(0); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableDatabases.map((database) => (
                  <SelectItem key={database} value={database}>
                    {database === 'all' ? 'All Databases' : database}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <p className="block text-sm font-medium mb-1.5">Select View</p>
            <Select value={selectedViewKey} onValueChange={(v) => { setSelectedViewKey(v); setPage(0); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredViews.map((view) => (
                  <SelectItem key={getViewKey(view)} value={getViewKey(view)}>
                    <Eye className="h-3.5 w-3.5 inline mr-2" />
                    {view.viewName} ({view.database})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input placeholder="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          {showLegacyFilters ? <Input placeholder="Marka" value={marka} onChange={(e) => { setMarka(e.target.value); setPage(0); }} /> : null}
          {showLegacyFilters ? <Input placeholder="Product" value={product} onChange={(e) => { setProduct(e.target.value); setPage(0); }} /> : null}
          {showLegacyFilters ? <Input placeholder="DSN" value={dsn} onChange={(e) => { setDsn(e.target.value); setPage(0); }} /> : null}
          {showLegacyFilters ? <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} /> : null}
          {showLegacyFilters ? <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} /> : null}
          <Select value={sortBy || 'none'} onValueChange={(value) => setSortBy(value === 'none' ? '' : value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sort Column</SelectItem>
              {sortableColumns.map((col) => (
                <SelectItem key={`sort-${col}`} value={col}>{FIELD_LABELS[col] || col}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value)}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Asc</SelectItem>
                <SelectItem value="desc">Desc</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => runExport('excel')} disabled={isLoading}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => runExport('pdf')} disabled={isLoading}>
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => runExport('png')} disabled={isLoading}>
              PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing...' : 'Retry'}
            </Button>
          </div>
        </div>

        {isDynamicView && filterableColumns.length > 0 ? (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Enabled Filters</p>
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-2">
              {filterableColumns.map((column) => (
                <div key={`dyn-filter-${column}`} className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">{FIELD_LABELS[column] || column}</p>
                  <Input
                    value={columnFilters[column] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setColumnFilters((prev) => ({ ...prev, [column]: value }));
                      setPage(0);
                    }}
                    placeholder={`Filter ${FIELD_LABELS[column] || column}`}
                    className="h-8"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mainContent}
      </div>
    </div>
  );
}

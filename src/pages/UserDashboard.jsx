import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, LogOut, Loader2, AlertCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDataRequest, getExportRequest } from '@/api/enterpriseApi';
import ThemeToggle from '@/components/ThemeToggle';
import PwaInstallButton from '@/components/PwaInstallButton';

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

function normalizeRows(payload) {
  if (!payload) {
    return [];
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
  const safeViews = user?.views || [];
  const [selectedDatabase, setSelectedDatabase] = useState('all');
  const [selectedViewName, setSelectedViewName] = useState(user?.views?.[0]?.viewName || '');
  const [search, setSearch] = useState('');
  const [marka, setMarka] = useState('');
  const [product, setProduct] = useState('');
  const [dsn, setDsn] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const parentRef = useRef(null);

  const availableDatabases = useMemo(() => {
    const set = new Set(safeViews.map((view) => view.database).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [safeViews]);

  const filteredViews = useMemo(() => {
    if (selectedDatabase === 'all') {
      return safeViews;
    }
    return safeViews.filter((view) => view.database === selectedDatabase);
  }, [safeViews, selectedDatabase]);

  useEffect(() => {
    if (!filteredViews.length) {
      return;
    }

    const exists = filteredViews.some((view) => view.viewName === selectedViewName);
    if (!exists) {
      setSelectedViewName(filteredViews[0].viewName);
      setPage(0);
    }
  }, [filteredViews, selectedViewName]);

  const currentView = filteredViews.find((v) => v.viewName === selectedViewName) || filteredViews[0] || safeViews[0];
  const visibleColumns = currentView?.columnsList || [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['enterprise-data', currentView?.database, currentView?.viewName, page, search, marka, product, dsn, fromDate, toDate, sortBy, sortOrder],
    queryFn: () => getDataRequest({
      database: currentView?.database,
      view: currentView?.viewName,
      page: page + 1,
      pageSize: PAGE_SIZE,
      search: search || undefined,
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
  const totalRecords = data?.total ?? rows.length;
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
  } else if (isLoading) {
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900">Error loading data</p>
            <p className="text-xs text-red-800 mt-1">{error?.response?.data?.error || error?.message}</p>
          </div>
        </div>
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
          <div>
            <h1 className="text-xl font-bold">Het Database</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Welcome, {user.email}</p>
          </div>
          <div className="flex gap-2">
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
            <Select value={selectedViewName} onValueChange={(v) => { setSelectedViewName(v); setPage(0); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredViews.map((view) => (
                  <SelectItem key={view.viewName} value={view.viewName}>
                    <Eye className="h-3.5 w-3.5 inline mr-2" />
                    {view.viewName} ({view.database})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input placeholder="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          <Input placeholder="Marka" value={marka} onChange={(e) => { setMarka(e.target.value); setPage(0); }} />
          <Input placeholder="Product" value={product} onChange={(e) => { setProduct(e.target.value); setPage(0); }} />
          <Input placeholder="DSN" value={dsn} onChange={(e) => { setDsn(e.target.value); setPage(0); }} />
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(0); }} />
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(0); }} />
          <Select value={sortBy || 'none'} onValueChange={(value) => setSortBy(value === 'none' ? '' : value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sort Column</SelectItem>
              {visibleColumns.map((col) => (
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
          </div>
        </div>

        {mainContent}
      </div>
    </div>
  );
}

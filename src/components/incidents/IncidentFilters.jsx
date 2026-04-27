import React from 'react';
import PropTypes from 'prop-types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';

const TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export default function IncidentFilters({
  filters,
  databases,
  onChange,
  onReset,
  total,
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold">Filter Incidents</h2>
        <div className="text-xs text-muted-foreground">{total} matches</div>
      </div>

      <div className="grid lg:grid-cols-5 md:grid-cols-3 gap-2">
        <div className="relative lg:col-span-2 md:col-span-3">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search message, error, type"
            value={filters.search}
            onChange={(event) => onChange('search', event.target.value)}
          />
        </div>

        <select
          className="h-9 border border-input rounded-md px-2 text-sm bg-background"
          value={filters.severity}
          onChange={(event) => onChange('severity', event.target.value)}
        >
          <option value="">All severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          className="h-9 border border-input rounded-md px-2 text-sm bg-background"
          value={filters.status}
          onChange={(event) => onChange('status', event.target.value)}
        >
          <option value="">All status</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          className="h-9 border border-input rounded-md px-2 text-sm bg-background"
          value={filters.database}
          onChange={(event) => onChange('database', event.target.value)}
        >
          <option value="">All databases</option>
          {databases.map((database) => (
            <option key={database} value={database}>{database}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select
          className="h-9 border border-input rounded-md px-2 text-sm bg-background min-w-[180px]"
          value={filters.timeRange}
          onChange={(event) => onChange('timeRange', event.target.value)}
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}

IncidentFilters.propTypes = {
  filters: PropTypes.shape({
    search: PropTypes.string.isRequired,
    severity: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    database: PropTypes.string.isRequired,
    timeRange: PropTypes.string.isRequired,
  }).isRequired,
  databases: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
};

import fs from 'node:fs';
import path from 'node:path';

let cachedConfig = null;

function normalizeView(view, database) {
  return {
    viewName: String(view.viewName || '').trim(),
    database,
    columnsList: Array.isArray(view.columnsList) ? view.columnsList : [],
    filterColumn: view.filterColumn ?? null,
    filterValue: view.filterValue ?? null,
  };
}

export function getViewAlignmentConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(process.cwd(), 'src/config/viewConfig.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);

  const menMaterial = Array.isArray(parsed.menMaterial)
    ? parsed.menMaterial.map((v) => normalizeView(v, 'MEN_MATERIAL'))
    : [];
  const laceGayle = Array.isArray(parsed.laceGayle)
    ? parsed.laceGayle.map((v) => normalizeView(v, 'LACE_GAYLE'))
    : [];

  cachedConfig = [...menMaterial, ...laceGayle];
  return cachedConfig;
}

export function findViewAlignment(database, viewName) {
  const db = String(database || '').toUpperCase();
  const view = String(viewName || '').trim();

  return getViewAlignmentConfig().find(
    (item) => item.database === db && item.viewName === view,
  ) || null;
}

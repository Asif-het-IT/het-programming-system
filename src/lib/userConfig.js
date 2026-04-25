/**
 * View catalog helpers used by the authenticated API-backed UI.
 * No user identities or credentials are stored client-side.
 */

import viewConfigData from '@/config/viewConfig.json';

export function getAllViews() {
  const allViews = [
    ...viewConfigData.menMaterial,
    ...viewConfigData.laceGayle
  ];
  return allViews;
}

export function getViewByName(viewName) {
  const allViews = getAllViews();
  return allViews.find(v => v.viewName === viewName);
}

export function getViewsByDatabase(database) {
  const allViews = getAllViews();
  return allViews.filter(v => v.database === database);
}

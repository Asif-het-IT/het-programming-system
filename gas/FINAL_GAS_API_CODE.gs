const API_SECRET = 'Lace & Gayle';

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAction(e) {
  return ((e && e.parameter && (e.parameter.action || e.parameter.api)) || '').trim();
}

function isAuthorized(e) {
  const token = e && e.parameter ? e.parameter.token : '';
  return token === API_SECRET;
}

function doGet(e) {
  try {
    if (!isAuthorized(e)) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    const action = getAction(e);

    if (action === 'records') {
      return jsonResponse({ success: true, data: getRecords(e) });
    }

    if (action === 'dashboard') {
      return jsonResponse({ success: true, data: getDashboard(e) });
    }

    if (action === 'product-names') {
      return jsonResponse({ success: true, data: getProductNames(e) });
    }

    return jsonResponse({ success: false, error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

function doPost(e) {
  try {
    if (!isAuthorized(e)) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    const action = getAction(e);

    if (action === 'save-entry') {
      let body = {};
      if (e && e.postData && e.postData.contents) {
        body = JSON.parse(e.postData.contents);
      }

      return jsonResponse({ success: true, data: saveEntry(e, body) });
    }

    return jsonResponse({ success: false, error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

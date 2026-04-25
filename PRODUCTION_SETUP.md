# Production Setup Guide

## Current Status
✅ Frontend: Fully functional with mock data  
✅ Authentication: Username/password system working  
✅ Admin Panel: User & view management operational  
🔄 Data Source: Configured for real Google Sheets integration

---

## Google Sheets Integration Options

### Option 1: CORS Proxy (Easy, Dev/Small Scale)
**Best for:** Testing, small deployments, internal use

**Setup:**
1. Open `src/lib/sheetService.js`
2. Ensure these settings:
   ```javascript
   const USE_MOCK_DATA = false;      // Disable mock
   const USE_CORS_PROXY = true;      // Enable CORS proxy
   const CORS_PROXY_URL = 'https://cors.sh/';
   ```

3. Make sure Google Sheets are **publicly shared** (View access):
   - Open your Google Sheet
   - Click "Share" → Change to "Anyone with the link can view"
   - CSV URL format: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={TAB_ID}`

4. Test:
   ```bash
   npm run dev
   ```

**Limitations:**
- CORS proxy may rate-limit requests
- Not suitable for high-traffic production
- Depends on third-party service availability

---

### Option 2: Backend Proxy API (Recommended for Production)
**Best for:** Enterprise, high-traffic, secure access

**Architecture:**
```
Browser → Your Backend API → Google Sheets CSV URL
```

**Benefits:**
- ✅ No CORS issues
- ✅ Server-side caching
- ✅ Authentication control
- ✅ Rate limiting & logging
- ✅ Can use Google Sheets API instead of CSV export

**Setup Steps:**

#### Create a simple Node.js backend:
```javascript
// backend/routes/sheets.js
const express = require('express');
const router = express.Router();

router.get('/data/:viewName', async (req, res) => {
  const { viewName } = req.params;
  const { skipCache } = req.query;
  
  try {
    // Get view config
    const view = getAllViews().find(v => v.viewName === viewName);
    if (!view) return res.status(404).json({ error: 'View not found' });
    
    // Fetch from Google Sheets (no CORS issues on server)
    const response = await fetch(view.targetUrl);
    const csvText = await response.text();
    
    res.set('Content-Type', 'text/csv');
    res.send(csvText);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

#### Update frontend:
```javascript
// In src/lib/sheetService.js
const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchSheetData(csvUrl, { skipCache = false } = {}) {
  const viewName = extractViewNameFromUrl(csvUrl);
  const apiUrl = `${API_URL}/api/sheets/data/${viewName}?skipCache=${skipCache}`;
  
  // ... fetch from API instead of directly from Google Sheets
}
```

---

### Option 3: Google Sheets API v4 (Most Secure)
**Best for:** Enterprise, detailed access control, real-time updates

**Advantages:**
- Native Google authentication
- Server-side operations
- Real-time data
- Better performance than CSV export

**Setup:** (Requires Node.js backend)
```bash
npm install googleapis
```

```javascript
const sheets = google.sheets('v4');

async function getSheetData(spreadsheetId, range) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    auth: googleAuth,
  });
  return response.data.values;
}
```

---

## Deployment Checklist

### Before Going Live:

- [ ] **Disable Mock Data**
  ```javascript
  const USE_MOCK_DATA = false;
  ```

- [ ] **Choose Integration Method** (Options 1, 2, or 3)

- [ ] **Environment Configuration**
  ```bash
  # .env.production
  VITE_API_URL=https://your-api.com
  VITE_SHEETS_PROXY=https://cors.sh/  # Or your proxy
  ```

- [ ] **Update View URLs** in `src/config/viewConfig.json`
  - Verify all Google Sheet IDs are correct
  - Ensure sheets are shared appropriately

- [ ] **Test Data Flow**
  - Log in as each user type
  - Switch between views
  - Verify correct columns appear
  - Test search/filter
  - Test export

- [ ] **Security Review**
  - [ ] Authenticate API endpoints (if using backend)
  - [ ] Validate user permissions on backend
  - [ ] Use HTTPS only
  - [ ] Implement rate limiting
  - [ ] Add error logging

- [ ] **Performance**
  - [ ] Test with real data volume
  - [ ] Monitor cache hit rates
  - [ ] Check page load times
  - [ ] Optimize bundle size

---

## Production Build & Deployment

### Build for Production:
```bash
npm run build
# Output: dist/ folder ready for deployment
```

### Deploy Options:

**Vercel (Recommended for SPA):**
```bash
npm i -g vercel
vercel --prod
```

**Netlify:**
```bash
npm run build
# Drag dist/ folder to Netlify
```

**Traditional Server (Apache/Nginx):**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## Troubleshooting

### "CORS error" when fetching data
- ✅ Enable `USE_CORS_PROXY` for quick fix
- 🔧 Set up backend proxy (recommended)
- 🔐 Use Google Sheets API with authentication

### "No data appears in table"
1. Check browser console for errors
2. Verify Google Sheet is publicly shared
3. Check CSV URL format is correct
4. Ensure view columns exist in sheet

### "Data loads slowly"
1. Enable caching: `CACHE_DURATION_MS` in sheetService.js
2. Reduce columns displayed (column filtering)
3. Set up backend with server-side caching
4. Use Google Sheets API with pagination

---

## Current View Configuration

All 36 views are pre-configured in `src/config/viewConfig.json`:

**Men Material (12 views):**
- Summary, Brand Wise Report, Management Report, Programming View
- Dua, Fazal, Sattar, Dxb, Salam, World, Noor, Hope
- Fashion Fussion View

**Lace & Gayle (24 views):**
- 24 organization-specific views (Gayle + Lace variants)

Each view specifies:
- `targetUrl`: Google Sheet CSV export URL
- `columnsList`: Excel column letters to display (A, B, D, E, AA, AD, etc.)
- `database`: MEN_MATERIAL or LACE_GAYLE
- `filterColumn` / `filterValue`: For pre-filtered views

---

## Next Steps

1. **Test with Real Google Sheets**
   - Get the actual Google Sheet IDs from your team
   - Update URLs in viewConfig.json
   - Set `USE_MOCK_DATA = false`
   - Run `npm run dev`

2. **Set Up Backend API** (if high-traffic)
   - Create Express/Node.js backend
   - Add Google Sheets fetch endpoints
   - Deploy backend
   - Update API URLs in .env

3. **User Acceptance Testing**
   - Have business users verify data accuracy
   - Test all 36 views
   - Verify column selections

4. **Production Deployment**
   - Choose hosting (Vercel/Netlify/Traditional)
   - Configure CI/CD pipeline
   - Set up monitoring & error tracking
   - Deploy!

---

## Support

For issues or questions:
1. Check browser console (F12)
2. Review Logger output
3. Verify Google Sheet sharing settings
4. Check viewConfig.json URLs

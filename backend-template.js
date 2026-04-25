/**
 * Backend API Template - Google Sheets Proxy
 * 
 * This is a template for creating a backend API that proxies Google Sheets requests.
 * This solves CORS issues and enables server-side caching.
 * 
 * Usage:
 * 1. Create a new Node.js/Express project
 * 2. Copy this file as your main server
 * 3. Install dependencies: npm install express cors dotenv node-cache
 * 4. Update frontend API_URL in sheetService.js
 * 5. Deploy backend, then point frontend to it
 */

const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

// ============= CONFIGURATION =============
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5174'];
const CACHE_TTL = 300; // 5 minutes in seconds

// ============= MIDDLEWARE =============
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));

app.use(express.json());

// Simple request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============= AUTHENTICATION (Optional) =============
/**
 * Simple API key authentication
 * In production, use JWT or OAuth2
 */
const authenticateRequest = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ============= VIEW CONFIG =============
/**
 * In production, this would come from a database
 * For now, import from frontend config
 */
const VIEW_CONFIG = {
  'Dua View': {
    sheetId: '1mrd_ijbzN6J869rlze0q6G6J_qkrQLI2OzWvGugFg3c',
    gid: 0,
    columnsList: ['A', 'B', 'C', 'D', 'E', 'H', 'J', 'K', 'L', 'M', 'N', 'Q', 'R', 'S', 'T', 'U', 'AD', 'AM', 'AN', 'AW', 'AX', 'AY']
  },
  // Add other views...
};

// ============= ROUTES =============

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /api/sheets/data/:viewName
 * 
 * Fetch Google Sheet data for a specific view
 * Returns CSV data with caching
 * 
 * Query params:
 *   - skipCache: If true, bypass cache
 *   - format: 'csv' (default) or 'json'
 */
app.get('/api/sheets/data/:viewName', async (req, res) => {
  try {
    const { viewName } = req.params;
    const { skipCache, format } = req.query;

    // Validate view exists
    const view = VIEW_CONFIG[viewName];
    if (!view) {
      return res.status(404).json({ 
        error: 'View not found',
        availableViews: Object.keys(VIEW_CONFIG)
      });
    }

    // Check cache first
    const cacheKey = `sheet_${viewName}`;
    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(`[CACHE HIT] ${viewName}`);
        res.set('X-Cache', 'HIT');
        
        if (format === 'json') {
          return res.json(cached);
        }
        return res.set('Content-Type', 'text/csv').send(cached);
      }
    }

    // Fetch from Google Sheets
    const csvUrl = `https://docs.google.com/spreadsheets/d/${view.sheetId}/export?format=csv&gid=${view.gid}`;
    
    console.log(`[FETCH] ${viewName} from ${csvUrl}`);
    const response = await fetch(csvUrl, {
      timeout: 10000,
      headers: { 'Accept': 'text/csv' }
    });

    if (!response.ok) {
      console.error(`[ERROR] Google Sheets returned ${response.status}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch sheet: HTTP ${response.status}`
      });
    }

    const csvData = await response.text();

    // Validate CSV (check it's not HTML error page)
    if (csvData.includes('<!DOCTYPE') || csvData.includes('<html')) {
      return res.status(403).json({ 
        error: 'Sheet not accessible. Check sharing settings and URL.'
      });
    }

    // Cache the result
    cache.set(cacheKey, csvData);
    console.log(`[CACHED] ${viewName}`);

    res.set('X-Cache', 'MISS');
    res.set('Content-Type', 'text/csv');
    res.send(csvData);

  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/sheets/views
 * 
 * List all available views
 */
app.get('/api/sheets/views', (req, res) => {
  res.json({
    views: Object.keys(VIEW_CONFIG),
    count: Object.keys(VIEW_CONFIG).length
  });
});

/**
 * POST /api/cache/clear
 * 
 * Clear cache for a specific view or all views
 * Requires authentication
 */
app.post('/api/cache/clear', authenticateRequest, (req, res) => {
  try {
    const { viewName } = req.body;
    
    if (viewName) {
      cache.del(`sheet_${viewName}`);
      res.json({ message: `Cache cleared for ${viewName}` });
    } else {
      cache.flushAll();
      res.json({ message: 'All cache cleared' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/cache/stats
 * 
 * Get cache statistics
 */
app.get('/api/cache/stats', (req, res) => {
  res.json({
    keys: cache.keys(),
    stats: cache.getStats(),
    items: cache.getStats().kv.vsize
  });
});

// ============= ERROR HANDLING =============

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============= START SERVER =============

app.listen(PORT, () => {
  console.log(`\n🚀 Het Database Backend API`);
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🔐 CORS enabled for: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`📊 Cache TTL: ${CACHE_TTL}s`);
  console.log(`\n✅ Ready to proxy Google Sheets requests\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;

/**
 * Sheet Fetcher Service
 * Fetches data from Google Sheets via CSV export and parses it
 * For development: uses mock data to avoid CORS issues
 */

import { parseCSV, parseCSVLine } from '@/lib/columnResolver';
import { Logger } from '@/lib/logger';

const CACHE_KEY_PREFIX = 'sheet_cache_';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// =========== PRODUCTION CONFIGURATION ===========
const USE_MOCK_DATA = false; // Set to true for development without internet
const USE_CORS_PROXY = true; // Use CORS proxy for Google Sheets (required for browser)
const CORS_PROXY_URL = 'https://cors.sh/'; // Alternative: 'https://api.allorigins.win/raw?url='
// For production backend: remove CORS_PROXY and fetch from your own API endpoint
// ================================================

// Mock data for testing (only used when USE_MOCK_DATA = true)
const MOCK_DATA = {
  'default': `Ref Code,Article,Count,Marka,Category,Stage,Size,Shade,Last Update,Notes,Quality,Status,Preview Link,Col M,Col N,Col O,Col P,Col Q,Col R,Col S,Col T,Col U,Col V,Col W,Col X,Col Y,Col Z,Col AA,Col AB,Col AC,Col AD,Col AE,Col AF,Col AG,Col AH,Col AI,Col AJ,Col AK,Col AL,Col AM,Col AN,Col AO,Col AP,Col AQ,Col AR,Col AS,Col AT,Col AU,Col AV,Col AW,Col AX,Col AY
MM-001,Cotton Plain,500,DUA,BASIC,COMPLETED,1x1,WHITE,2025-01-15,Ready for shipment,A,APPROVED,link1,m1,n1,o1,p1,q1,r1,s1,t1,u1,v1,w1,x1,y1,z1,aa1,ab1,ac1,ad1,ae1,af1,ag1,ah1,ai1,aj1,ak1,al1,am1,an1,ao1,ap1,aq1,ar1,as1,at1,au1,av1,aw1,ax1,ay1
MM-002,Cotton Twill,300,DUA,BASIC,IN_PROGRESS,1x1,BLACK,2025-01-14,Being processed,A,APPROVED,link2,m2,n2,o2,p2,q2,r2,s2,t2,u2,v2,w2,x2,y2,z2,aa2,ab2,ac2,ad2,ae2,af2,ag2,ah2,ai2,aj2,ak2,al2,am2,an2,ao2,ap2,aq2,ar2,as2,at2,au2,av2,aw2,ax2,ay2
MM-003,Silk Blend,200,DUA,PREMIUM,COMPLETED,2x2,NAVY,2025-01-13,Quality check done,AAA,APPROVED,link3,m3,n3,o3,p3,q3,r3,s3,t3,u3,v3,w3,x3,y3,z3,aa3,ab3,ac3,ad3,ae3,af3,ag3,ah3,ai3,aj3,ak3,al3,am3,an3,ao3,ap3,aq3,ar3,as3,at3,au3,av3,aw3,ax3,ay3
MM-004,Linen Mix,150,DUA,BASIC,PENDING,1x1,BEIGE,2025-01-12,Waiting for approval,A,PENDING,link4,m4,n4,o4,p4,q4,r4,s4,t4,u4,v4,w4,x4,y4,z4,aa4,ab4,ac4,ad4,ae4,af4,ag4,ah4,ai4,aj4,ak4,al4,am4,an4,ao4,ap4,aq4,ar4,as4,at4,au4,av4,aw4,ax4,ay4
MM-005,Cotton Jersey,400,DUA,BASIC,COMPLETED,1x1,GREY,2025-01-11,Packed and ready,A,APPROVED,link5,m5,n5,o5,p5,q5,r5,s5,t5,u5,v5,w5,x5,y5,z5,aa5,ab5,ac5,ad5,ae5,af5,ag5,ah5,ai5,aj5,ak5,al5,am5,an5,ao5,ap5,aq5,ar5,as5,at5,au5,av5,aw5,ax5,ay5
MM-006,Wool Blend,100,DUA,PREMIUM,IN_PROGRESS,2x2,CHARCOAL,2025-01-10,In quality check,AA,APPROVED,link6,m6,n6,o6,p6,q6,r6,s6,t6,u6,v6,w6,x6,y6,z6,aa6,ab6,ac6,ad6,ae6,af6,ag6,ah6,ai6,aj6,ak6,al6,am6,an6,ao6,ap6,aq6,ar6,as6,at6,au6,av6,aw6,ax6,ay6
MM-007,Cotton Poplin,250,DUA,BASIC,COMPLETED,1x1,KHAKI,2025-01-09,Ready for shipment,A,APPROVED,link7,m7,n7,o7,p7,q7,r7,s7,t7,u7,v7,w7,x7,y7,z7,aa7,ab7,ac7,ad7,ae7,af7,ag7,ah7,ai7,aj7,ak7,al7,am7,an7,ao7,ap7,aq7,ar7,as7,at7,au7,av7,aw7,ax7,ay7
MM-008,Silk Dupioni,80,DUA,PREMIUM,PENDING,2x2,CREAM,2025-01-08,Awaiting approval,AAA,PENDING,link8,m8,n8,o8,p8,q8,r8,s8,t8,u8,v8,w8,x8,y8,z8,aa8,ab8,ac8,ad8,ae8,af8,ag8,ah8,ai8,aj8,ak8,al8,am8,an8,ao8,ap8,aq8,ar8,as8,at8,au8,av8,aw8,ax8,ay8
MM-009,Cotton Oxford,300,DUA,BASIC,COMPLETED,1x1,LIGHT BLUE,2025-01-07,All checks passed,A,APPROVED,link9,m9,n9,o9,p9,q9,r9,s9,t9,u9,v9,w9,x9,y9,z9,aa9,ab9,ac9,ad9,ae9,af9,ag9,ah9,ai9,aj9,ak9,al9,am9,an9,ao9,ap9,aq9,ar9,as9,at9,au9,av9,aw9,ax9,ay9
MM-010,Poly Cotton,350,DUA,BASIC,IN_PROGRESS,1x1,RED,2025-01-06,Processing in progress,A,APPROVED,link10,m10,n10,o10,p10,q10,r10,s10,t10,u10,v10,w10,x10,y10,z10,aa10,ab10,ac10,ad10,ae10,af10,ag10,ah10,ai10,aj10,ak10,al10,am10,an10,ao10,ap10,aq10,ar10,as10,at10,au10,av10,aw10,ax10,ay10
MM-011,Bamboo Fabric,120,DUA,PREMIUM,COMPLETED,2x2,SAGE,2025-01-05,Premium quality,AAA,APPROVED,link11,m11,n11,o11,p11,q11,r11,s11,t11,u11,v11,w11,x11,y11,z11,aa11,ab11,ac11,ad11,ae11,af11,ag11,ah11,ai11,aj11,ak11,al11,am11,an11,ao11,ap11,aq11,ar11,as11,at11,au11,av11,aw11,ax11,ay11
MM-012,Cotton Sateen,180,DUA,BASIC,COMPLETED,1x1,BURGUNDY,2025-01-04,Final shipment,A,APPROVED,link12,m12,n12,o12,p12,q12,r12,s12,t12,u12,v12,w12,x12,y12,z12,aa12,ab12,ac12,ad12,ae12,af12,ag12,ah12,ai12,aj12,ak12,al12,am12,an12,ao12,ap12,aq12,ar12,as12,at12,au12,av12,aw12,ax12,ay12`
};

function getCacheKey(url) {
  return CACHE_KEY_PREFIX + new URL(url).pathname.split('/').slice(-1)[0];
}

function isCacheValid(cachedData) {
  if (!cachedData) return false;
  const now = Date.now();
  return now - cachedData.timestamp < CACHE_DURATION_MS;
}

function parseCSVText(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 1) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return rows;
}

export async function fetchSheetData(csvUrl, { skipCache = false } = {}) {
  if (!csvUrl || typeof csvUrl !== 'string') {
    throw new Error('Invalid sheet URL provided');
  }

  const cacheKey = getCacheKey(csvUrl);

  // Clear old cache format (objects/arrays instead of strings)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.data) || (typeof parsed.data === 'object' && !typeof parsed.data === 'string')) {
        localStorage.removeItem(cacheKey); // Remove invalid cache
        skipCache = true;
      }
    }
  } catch (err) {
    Logger.warn('Cache validation error', err);
  }

  if (!skipCache) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (isCacheValid(parsed) && typeof parsed.data === 'string') {
          Logger.debug('Sheet data loaded from cache', { url: csvUrl });
          return parsed.data; // Return raw CSV string
        }
      }
    } catch (err) {
      Logger.warn('Cache read error', err);
    }
  }

  try {
    let csvText;
    
    // Use mock data for development
    if (USE_MOCK_DATA) {
      csvText = MOCK_DATA['default'];
      Logger.info('Using mock data for development', { url: csvUrl });
    } else {
      // Fetch from Google Sheets via CSV export URL
      Logger.info('Fetching sheet data from Google Sheets', { url: csvUrl, corsProxy: USE_CORS_PROXY });
      
      let fetchUrl = csvUrl;
      
      // Use CORS proxy if enabled (required for browser requests to Google Sheets)
      if (USE_CORS_PROXY && csvUrl.includes('docs.google.com')) {
        fetchUrl = CORS_PROXY_URL + encodeURIComponent(csvUrl);
        Logger.debug('Using CORS proxy', { proxy: CORS_PROXY_URL });
      }
      
      const response = await fetch(fetchUrl, {
        headers: { 'Accept': 'text/csv' },
        mode: 'cors'
      });

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: Failed to fetch sheet. ${response.status === 403 ? 'May need CORS proxy or authentication.' : ''}`;
        Logger.error(errorMsg, { url: csvUrl, status: response.status });
        throw new Error(errorMsg);
      }

      csvText = await response.text();
      
      // Validate CSV data
      if (!csvText || csvText.includes('<!DOCTYPE') || csvText.includes('<html')) {
        throw new Error('Received HTML instead of CSV - likely a Google Sheets authentication or sharing issue');
      }
    }

    if (!csvText || csvText.length === 0) {
      Logger.warn('Sheet returned empty data', { url: csvUrl });
    }

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: csvText, // Cache raw CSV string
        timestamp: Date.now()
      }));
    } catch {
      Logger.warn('Cache write failed (quota exceeded)', { url: csvUrl });
    }

    Logger.info('Sheet data fetched successfully', { url: csvUrl, length: csvText.length });
    return csvText; // Return raw CSV string
  } catch (err) {
    Logger.error('Sheet fetch failed', err, { url: csvUrl });
    throw err;
  }
}

export function clearSheetCache(csvUrl) {
  if (csvUrl) {
    const cacheKey = getCacheKey(csvUrl);
    localStorage.removeItem(cacheKey);
  }
}

export function clearAllSheetCache() {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

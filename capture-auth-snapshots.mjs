import http from 'http';

const BASE_URL = 'http://localhost:3001';

// Bootstrap admin credentials
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || 'testadmin@test.local';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'test123';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function main() {
  try {
    console.log('Step 1: Attempting login with admin credentials...');
    const loginRes = await makeRequest(`${BASE_URL}/api/login`, {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    if (loginRes.status !== 200) {
      console.log(`Login failed: ${loginRes.status}`);
      console.log('Response:', loginRes.body || loginRes.body);
      process.exit(1);
    }

    const token = loginRes.body?.token;
    if (!token) {
      console.log('No token in login response');
      console.log('Response:', loginRes.body);
      process.exit(1);
    }

    console.log(`✓ Login successful, token length: ${token.length}`);

    const endpoints = [
      '/api/admin/monitoring/health',
      '/api/admin/monitoring/dashboard',
      '/api/admin/monitoring/slo-status',
      '/api/admin/monitoring/channels',
      '/api/admin/monitoring/retries',
    ];

    const results = [];
    for (const endpoint of endpoints) {
      console.log(`Fetching ${endpoint}...`);
      const res = await makeRequest(`${BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      results.push({
        endpoint,
        status: res.status,
        ok: res.status >= 200 && res.status < 300,
        body: res.body,
      });
      console.log(`  → ${res.status} ${res.ok ? '✓' : '✗'}`);
    }

    console.log('\n=== Summary ===');
    results.forEach((r) => {
      console.log(`${r.endpoint} → ${r.status} ${r.ok ? '✓' : '✗'}`);
    });

    // Write results
    const fs = await import('fs');
    const dir = 'server/storage/http-proof-pack-authenticated';
    fs.mkdirSync(dir, { recursive: true });

    for (const result of results) {
      const filename = result.endpoint.split('/').pop() || 'root';
      fs.writeFileSync(
        `${dir}/${filename}.json`,
        JSON.stringify(result, null, 2),
        'utf8'
      );
    }

    fs.writeFileSync(
      `${dir}/summary.json`,
      JSON.stringify({
        at: new Date().toISOString(),
        total: results.length,
        success: results.filter((r) => r.ok).length,
        results: results.map((r) => ({ endpoint: r.endpoint, status: r.status, ok: r.ok })),
      }, null, 2),
      'utf8'
    );

    console.log(`\n✓ Authenticated snapshots saved to ${dir}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

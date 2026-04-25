const BASE = process.env.API_BASE_URL || 'http://localhost:3001/api';

async function login(email, password) {
  const response = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Login failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

async function run() {
  const email = process.env.TEST_USER_EMAIL || 'dua@het.local';
  const password = process.env.TEST_USER_PASSWORD;
  const database = process.env.TEST_DATABASE || 'MEN_MATERIAL';
  const view = process.env.TEST_VIEW || 'Dua View';

  if (!password) {
    throw new Error('TEST_USER_PASSWORD is required for saveEntryDryRun');
  }

  const token = await login(email, password);

  const query = new URLSearchParams({
    database,
    view,
    dryRun: 'true',
  });

  const payload = {
    PROCESS_DATE: new Date().toISOString().slice(0, 10),
    PRODUCT_NAME: 'DRY_RUN_SAMPLE',
    MARKA_CODE: 'DRY',
    DESIGN_NO: `DRY-${Date.now()}`,
    REMARKS: 'middleware dry-run verification only',
  };

  const response = await fetch(`${BASE}/save-entry?${query.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log(JSON.stringify({ status: response.status, data }, null, 2));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

try {
  await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

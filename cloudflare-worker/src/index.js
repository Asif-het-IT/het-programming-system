const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function resolveTarget(env, database) {
  const db = String(database || '').toUpperCase();

  if (db === 'MEN_MATERIAL') {
    return {
      bridgeUrl: env.GAS_MEN_URL || env.GAS_URL_MEN_MATERIAL,
      token: env.GAS_MEN_TOKEN || env.GAS_TOKEN_MEN_MATERIAL,
    };
  }

  return {
    bridgeUrl: env.GAS_LACE_URL || env.GAS_URL_LACE_GAYLE,
    token: env.GAS_LACE_TOKEN || env.GAS_TOKEN_LACE_GAYLE,
  };
}

function corsHeaders(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-proxy-auth',
  };
}

function buildGasUrl(target, api, incomingUrl) {
  const url = new URL(target.bridgeUrl);
  url.searchParams.set('api', api);
  url.searchParams.set('action', api);

  if (target.token) {
    url.searchParams.set('token', target.token);
  }

  for (const [key, value] of incomingUrl.searchParams.entries()) {
    if (['database', 'api'].includes(key)) {
      continue;
    }
    if (value !== '') {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/gas') {
      return json(404, { error: 'Not found' });
    }

    const proxyAuth = request.headers.get('x-proxy-auth') || '';
    if (!env.PROXY_AUTH_TOKEN || proxyAuth !== env.PROXY_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized proxy request' }), {
        status: 401,
        headers: { ...JSON_HEADERS, ...cors },
      });
    }

    const api = (url.searchParams.get('api') || '').trim();
    if (!api) {
      return new Response(JSON.stringify({ error: 'Missing api parameter' }), {
        status: 400,
        headers: { ...JSON_HEADERS, ...cors },
      });
    }

    const database = url.searchParams.get('database') || 'LACE_GAYLE';
    const target = resolveTarget(env, database);

    if (!target.bridgeUrl || !target.token) {
      return new Response(JSON.stringify({ error: `Target configuration missing for database=${database}` }), {
        status: 500,
        headers: { ...JSON_HEADERS, ...cors },
      });
    }

    const gasUrl = buildGasUrl(target, api, url);

    const headers = {
      'x-gas-secret': target.token,
      Authorization: `Bearer ${target.token}`,
    };

    let body;
    if (request.method === 'POST') {
      body = await request.text();
      headers['content-type'] = 'application/json';
    }

    const upstream = await fetch(gasUrl.toString(), {
      method: request.method,
      headers,
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...JSON_HEADERS,
        ...cors,
      },
    });
  },
};

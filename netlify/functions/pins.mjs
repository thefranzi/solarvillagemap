// Store pins as individual JSON files in GitHub (data/pins/*.json)
const GH_API = 'https://api.github.com';

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GH_OWNER;
  const repo  = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  const dir   = process.env.GH_PINS_DIR || 'data/pins';
  if (!token || !owner || !repo) throw new Error('Missing GITHUB_TOKEN / GH_OWNER / GH_REPO');
  return { token, owner, repo, branch, dir };
}

async function gh(path, method = 'GET', body) {
  const { token } = cfg();
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function listPins() {
  const { owner, repo, branch, dir } = cfg();
  let items = [];
  try {
    items = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(dir)}?ref=${branch}`);
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
  const features = [];
  for (const item of items) {
    if (item.type !== 'file' || !item.name.endsWith('.json')) continue;
    const file = await fetch(item.download_url);
    if (!file.ok) continue;
    try { features.push(await file.json()); } catch {}
  }
  return { type: 'FeatureCollection', features };
}

async function createPin(feature) {
  const { owner, repo, branch, dir } = cfg();
  const key = `pin_${Date.now()}_${Math.random().toString(36).slice(2,9)}.json`;
  const path = `${dir}/${key}`;
  const content = Buffer.from(JSON.stringify(feature, null, 2)).toString('base64');
  await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, 'PUT', {
    message: `Add pin ${key}`, content, branch
  });
  return feature;
}

async function deletePin(key) {
  const { owner, repo, branch, dir } = cfg();
  const path = `${dir}/${key}`;
  const meta = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`, 'GET');
  await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, 'DELETE', {
    message: `Delete pin ${key}`, sha: meta.sha, branch
  });
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type'
      }};
    }
    if (event.httpMethod === 'GET') {
      const fc = await listPins();
      return { statusCode: 200, headers: {
        'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*'
      }, body: JSON.stringify(fc) };
    }
    if (event.httpMethod === 'POST') {
      const feature = JSON.parse(event.body || '{}');
      if (feature?.geometry?.type !== 'Point') return { statusCode: 400, body: 'Point feature required' };
      const saved = await createPin(feature);
      return { statusCode: 200, headers: {
        'content-type': 'application/json', 'access-control-allow-origin': '*'
      }, body: JSON.stringify(saved) };
    }
    if (event.httpMethod === 'DELETE') {
      const key = (new URL(event.rawUrl)).searchParams.get('key');
      if (!key) return { statusCode: 400, body: 'key required' };
      await deletePin(key);
      return { statusCode: 204, headers: { 'access-control-allow-origin': '*' } };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' },
      body: e.stack || e.message || 'unknown error'
    };
  }
}

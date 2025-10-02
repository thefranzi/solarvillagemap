// Serve photo metadata (GeoJSON features) from GitHub (data/photo-features/*.json)
const GH_API = 'https://api.github.com';

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GH_OWNER;
  const repo  = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  const dir   = process.env.GH_PHOTOS_DIR || 'data/photo-features';
  if (!token || !owner || !repo) throw new Error('Missing GITHUB_TOKEN / GH_OWNER / GH_REPO');
  return { token, owner, repo, branch, dir };
}

async function gh(path) {
  const { token } = cfg();
  const res = await fetch(`${GH_API}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function listPhotoFeatures() {
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

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': 'content-type'
      }};
    }
    const fc = await listPhotoFeatures();
    return { statusCode: 200, headers: {
      'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*'
    }, body: JSON.stringify(fc) };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}

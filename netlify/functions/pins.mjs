import { gh, cfg } from './gh-utils.mjs';
const GH_API = 'https://api.github.com';
// Store pins as individual JSON files in GitHub (data/pins/*.json)
// Store pins as individual JSON files in GitHub (data/pins/*.json)
async function listPins() {
  const baseCfg = cfg('GITHUB_TOKEN', 'GH_OWNER', 'GH_REPO', 'GH_BRANCH');
  const { pinsDir: dir } = cfg();
  const { owner, repo, branch } = baseCfg;
  let items = [];
  try {
    items = await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(dir) + '?ref=' + branch);
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
  const { Buffer } = await import('buffer');
  const baseCfg = cfg('GITHUB_TOKEN', 'GH_OWNER', 'GH_REPO', 'GH_BRANCH');
  const { pinsDir: dir } = cfg();
  const { owner, repo, branch } = baseCfg;
  const stamp = Date.now();
  const key = 'pin_' + stamp + '.json';
  const path = dir + '/' + key;
  const payload = {
    message: 'Add pin ' + stamp,
    content: Buffer.from(JSON.stringify(feature, null, 2)).toString('base64'),
    branch
  };
  await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path), 'PUT', payload);
  return { key, path };
}
async function deletePin(key) {
  const baseCfg = cfg('GITHUB_TOKEN', 'GH_OWNER', 'GH_REPO', 'GH_BRANCH');
  const { pinsDir: dir } = cfg();
  const { owner, repo, branch } = baseCfg;
  const path = dir + '/' + key;
  const file = await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path) + '?ref=' + branch);
  const payload = {
    message: 'Delete pin ' + key,
    sha: file.sha,
    branch
  };
  await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path), 'DELETE', payload);
  return { ok: true };
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
      return { statusCode: 204, headers: { 'access-control-allow-origin': '*' }};
    }
    return { statusCode: 405, body: 'Method Not Allowed', headers: { 'access-control-allow-origin': '*' } };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}


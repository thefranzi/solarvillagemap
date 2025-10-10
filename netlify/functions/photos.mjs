import { gh, cfg } from './gh-utils.mjs';
const GH_API = 'https://api.github.com';
// Serve photo metadata (GeoJSON features) from GitHub (data/photo-features/*.json)
// Serve photo metadata (GeoJSON features) from GitHub (data/photo-features/*.json)
async function listPhotoFeatures() {
  const baseCfg = cfg('GITHUB_TOKEN', 'GH_OWNER', 'GH_REPO', 'GH_BRANCH');
  const { metaDir: dir } = cfg();
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


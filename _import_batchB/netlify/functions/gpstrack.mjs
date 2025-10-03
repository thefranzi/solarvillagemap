// netlify/functions/gpstrack.mjs
const GH_API = 'https://api.github.com';

function cfg() {
  const token   = process.env.GITHUB_TOKEN;
  const owner   = process.env.GH_OWNER;
  const repo    = process.env.GH_REPO;
  const branch  = process.env.GH_BRANCH || 'main';
  const dir     = process.env.GH_TRACKS_DIR || 'data/tracks';
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function readFile(path) {
  try {
    const r = await gh(path);
    const buf = Buffer.from(r.content || '', 'base64');
    return { json: JSON.parse(buf.toString('utf8')), sha: r.sha };
  } catch (e) {
    // 404 -> new file
    if (String(e).includes('404')) return { json: null, sha: null };
    throw e;
  }
}

export async function handler(event) {
  try {
    // CORS / preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: {
        'access-control-allow-origin':'*',
        'access-control-allow-methods':'POST,OPTIONS',
        'access-control-allow-headers':'content-type'
      }};
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const body = JSON.parse(event.body || '{}');
    const { sessionId, points } = body; // points: [{lat,lng,ts?,acc?}, ...]
    if (!sessionId || !Array.isArray(points) || points.length === 0) {
      return { statusCode: 400, body: 'sessionId and points[] required' };
    }

    const { owner, repo, branch, dir } = cfg();
    const file = `${dir}/${encodeURIComponent(sessionId)}.geojson`;

    // Load existing (FeatureCollection of Points); else start fresh
    const existing = await readFile(`/repos/${owner}/${repo}/contents/${file}`);
    const fc = existing.json ?? { type: 'FeatureCollection', features: [] };

    for (const p of points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      fc.features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          ts: Number.isFinite(p.ts) ? p.ts : Date.now(),
          acc: Number.isFinite(p.acc) ? p.acc : undefined
        }
      });
    }

    const content = Buffer.from(JSON.stringify(fc, null, 2)).toString('base64');

    await gh(`/repos/${owner}/${repo}/contents/${file}`, 'PUT', {
      message: `Append ${points.length} GPS point(s) to ${sessionId}`,
      content,
      // branch,
      sha: existing.sha || undefined
    });

    return {
      statusCode: 200,
      headers: { 'content-type':'application/json','access-control-allow-origin':'*' },
      body: JSON.stringify({ ok:true, sessionId, appended: points.length, file })
    };
  } catch (e) {
    return { statusCode: 500, headers:{'content-type':'text/plain','access-control-allow-origin':'*'}, body: e.stack || e.message };
  }
}

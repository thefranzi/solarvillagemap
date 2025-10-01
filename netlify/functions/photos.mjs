import { createClient } from '@netlify/blobs';
const META_BUCKET = 'photo-features';

function store() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  if (!siteID || !token) throw new Error('Missing env NETLIFY_SITE_ID or NETLIFY_BLOBS_TOKEN');
  return createClient({ siteID, token }).store(META_BUCKET);
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

    const s = store();
    const list = await s.list();
    const features = [];
    for (const b of list.blobs) {
      const txt = await s.get(b.key, { type: 'text' });
      if (!txt) continue;
      try { features.push(JSON.parse(txt)); } catch {}
    }
    return { statusCode: 200, headers: {
      'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*'
    }, body: JSON.stringify({ type: 'FeatureCollection', features }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}

import { getStore } from '@netlify/blobs';

const BUCKET = 'pins';

function getBlobsStore(name, context) {
  return getStore(name, {
    context,
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_BLOBS_TOKEN
  });
}

async function readAll(store) {
  const list = await store.list(); // { blobs: [...] }
  const features = [];
  for (const b of list.blobs) {
    const txt = await store.get(b.key, { type: 'text' });
    if (!txt) continue;
    try { features.push(JSON.parse(txt)); } catch {}
  }
  return { type: 'FeatureCollection', features };
}

export async function handler(event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
          'access-control-allow-headers': 'content-type'
        }
      };
    }

    const store = getBlobsStore(BUCKET, context);

    if (event.httpMethod === 'GET') {
      const fc = await readAll(store);
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
        body: JSON.stringify(fc)
      };
    }

    if (event.httpMethod === 'POST') {
      const feature = JSON.parse(event.body || '{}');
      if (feature?.geometry?.type !== 'Point') return { statusCode: 400, body: 'Point feature required' };
      const id = `pin_${Date.now()}_${Math.random().toString(36).slice(2,9)}.json`;
      await store.set(id, JSON.stringify(feature), { contentType: 'application/json' });
      return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(feature) };
    }

    if (event.httpMethod === 'DELETE') {
      const key = (new URL(event.rawUrl)).searchParams.get('key');
      if (!key) return { statusCode: 400, body: 'key required' };
      await store.delete(key);
      return { statusCode: 204, headers: { 'access-control-allow-origin': '*' } };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' },
      body: (e && (e.stack || e.message)) || 'unknown error'
    };
  }
}

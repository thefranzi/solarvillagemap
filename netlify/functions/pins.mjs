// netlify/functions/pins.mjs
import { getStore } from '@netlify/blobs';

const BUCKET = 'pins'; // blob bucket name

// Utility to read all GeoJSON point features from the bucket
async function readAll(store) {
  const list = await store.list();           // { blobs: [{ key, ... }] }
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
    const store = getStore(BUCKET, { context });

    if (event.httpMethod === 'GET') {
      const fc = await readAll(store);
      return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(fc) };
    }

    if (event.httpMethod === 'POST') {
      const feature = JSON.parse(event.body || '{}');
      if (feature?.geometry?.type !== 'Point') {
        return { statusCode: 400, body: 'Point feature required' };
      }
      const id = `pin_${Date.now()}_${Math.random().toString(36).slice(2,9)}.json`;
      await store.set(id, JSON.stringify(feature), { contentType: 'application/json' });
      return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(feature) };
    }

    if (event.httpMethod === 'DELETE') {
      const key = (new URL(event.rawUrl)).searchParams.get('key');
      if (!key) return { statusCode: 400, body: 'key required' };
      await store.delete(key);
      return { statusCode: 204, body: '' };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e) {
    return { statusCode: 500, body: 'pins error: ' + e.message };
  }
}

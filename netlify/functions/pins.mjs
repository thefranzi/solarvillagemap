// Forcing an update - v2
import { getStore } from '@netlify/blobs';
export const config = { path: "pins" };

const STORE = 'pins';

async function readAll(store) {
  const list = await store.list();
  const feats = [];
  for (const k of list.blobs) {
    const txt = await store.get(k.key, { type: 'text' });
    try { feats.push(JSON.parse(txt)); } catch {}
  }
  return { type: 'FeatureCollection', features: feats };
}

export async function handler(event) {
  try {
    const store = getStore(STORE);

    if (event.httpMethod === 'GET') {
      const fc = await readAll(store);
      return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(fc) };
    }

    if (event.httpMethod === 'POST') {
      const feature = JSON.parse(event.body);
      if (feature?.geometry?.type !== 'Point') {
        return { statusCode: 400, body: 'Point feature required' };
      }
const id = 'pin_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
await store.set(`${id}.json`, JSON.stringify(feature), { contentType: 'application/json' }); 
      return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(feature) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e) {
    return { statusCode: 500, body: 'pins error: ' + e.message };
  }
}

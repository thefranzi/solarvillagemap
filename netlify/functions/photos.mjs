// netlify/functions/photos.mjs
import { getStore } from '@netlify/blobs';

const META_BUCKET = 'photo-features'; // GeoJSON feature metadata

export async function handler(event, context) {
  try {
    const store = getStore(META_BUCKET, { context });
    const list = await store.list();
    const features = [];
    for (const b of list.blobs) {
      const txt = await store.get(b.key, { type: 'text' });
      if (!txt) continue;
      try { features.push(JSON.parse(txt)); } catch {}
    }
    const fc = { type: 'FeatureCollection', features };
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(fc) };
  } catch (e) {
    return { statusCode: 500, body: 'photos error: ' + e.message };
  }
}

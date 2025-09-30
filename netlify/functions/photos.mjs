import { getStore } from '@netlify/blobs';
export const config = { path: "photos" };

export async function handler() {
  try {
    const store = getStore('photo-features');
    const list = await store.list();
    const feats = [];
    for (const k of list.blobs) {
      const txt = await store.get(k.key, { type: 'text' });
      try { feats.push(JSON.parse(txt)); } catch {}
    }
    const fc = { type: 'FeatureCollection', features: feats };
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(fc) };
  } catch (e) {
    return { statusCode: 500, body: 'photos error: ' + e.message };
  }
}

// Forcing an update - v2
// netlify/functions/bloblist.mjs
import { getStore } from '@netlify/blobs';
export const config = { path: "bloblist" };

// GET /api/bloblist?store=photos  (or pins, photo-features)
export async function handler(event) {
  try {
    const url = new URL(event.rawUrl);
    const storeName = url.searchParams.get('store');
    if (!storeName) return { statusCode: 400, body: 'store required' };
    const store = getStore(storeName);
    const list = await store.list(); // { blobs: [{ key, size, createdAt }, ...] }
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(list)
    };
  } catch (e) {
    return { statusCode: 500, body: 'error: ' + e.message };
  }
}

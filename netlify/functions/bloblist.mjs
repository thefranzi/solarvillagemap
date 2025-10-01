// netlify/functions/bloblist.mjs
import { getStore } from '@netlify/blobs';

export async function handler(event, context) {
  try {
    const url = new URL(event.rawUrl);
    const bucket = url.searchParams.get('store');
    if (!bucket) return { statusCode: 400, body: 'store required' };

    const store = getStore(bucket, { context });
    const list = await store.list();  // { blobs: [...] }
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(list) };
  } catch (e) {
    return { statusCode: 500, body: 'error: ' + e.message };
  }
}

// netlify/functions/photo.mjs
import { getStore } from '@netlify/blobs';

const PHOTO_BUCKET = 'photos'; // binary images

export async function handler(event, context) {
  try {
    // URL shape: /.netlify/functions/photo/<key>
    const parts = (event.path || '').split('/');              // ["", ".netlify", "functions", "photo", "<key...>"]
    const idx = parts.indexOf('photo');
    const key = idx >= 0 ? parts.slice(idx + 1).join('/') : '';
    if (!key) return { statusCode: 400, body: 'missing key' };

    const store = getStore(PHOTO_BUCKET, { context });
    const { data, metadata } = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!data) return { statusCode: 404, body: 'not found' };

    const base64 = Buffer.from(data).toString('base64');
    return {
      statusCode: 200,
      headers: {
        'content-type': metadata?.contentType || 'image/jpeg',
        'cache-control': 'public, max-age=31536000, immutable'
      },
      body: base64,
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: 'error: ' + e.message };
  }
}

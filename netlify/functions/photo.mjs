import { BlobsClient } from '@netlify/blobs';
const PHOTO_BUCKET = 'photos';

function store() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  if (!siteID || !token) throw new Error('Missing env NETLIFY_SITE_ID or NETLIFY_BLOBS_TOKEN');
  return new BlobsClient({ siteID, token }).store(PHOTO_BUCKET);
}

export async function handler(event) {
  try {
    const parts = (event.path || '').split('/');
    const idx = parts.indexOf('photo');
    const key = idx >= 0 ? parts.slice(idx + 1).join('/') : '';
    if (!key) return { statusCode: 400, body: 'missing key' };

    const s = store();
    const { data, metadata } = await s.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!data) return { statusCode: 404, body: 'not found' };

    const base64 = Buffer.from(data).toString('base64');
    return {
      statusCode: 200,
      headers: {
        'content-type': metadata?.contentType || 'image/jpeg',
        'cache-control': 'public, max-age=31536000, immutable',
        'access-control-allow-origin': '*'
      },
      body: base64,
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}

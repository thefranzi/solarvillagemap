import { BlobsClient } from '@netlify/blobs';

function store(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  if (!siteID || !token) throw new Error('Missing env NETLIFY_SITE_ID or NETLIFY_BLOBS_TOKEN');
  return new BlobsClient({ siteID, token }).store(name);
}

export async function handler(event) {
  try {
    const url = new URL(event.rawUrl);
    const bucket = url.searchParams.get('store');
    if (!bucket) return { statusCode: 400, body: 'store required' };
    const s = store(bucket);
    const list = await s.list();
    return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(list) };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}

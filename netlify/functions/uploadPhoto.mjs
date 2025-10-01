import { createClient } from '@netlify/blobs';
const PHOTO_BUCKET = 'photos';
const META_BUCKET  = 'photo-features';

function client() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token  = process.env.NETLIFY_BLOBS_TOKEN;
  if (!siteID || !token) throw new Error('Missing env NETLIFY_SITE_ID or NETLIFY_BLOBS_TOKEN');
  return createClient({ siteID, token });
}
const photoStore = () => client().store(PHOTO_BUCKET);
const metaStore  = () => client().store(META_BUCKET);

function parseMultipart(body, boundary) {
  const parts = body.split(`--${boundary}`).filter(x => x && x !== '--\r\n');
  const out = {};
  for (const part of parts) {
    const [rawHeaders, ...rest] = part.split('\r\n\r\n');
    const headers = rawHeaders.split('\r\n').reduce((acc, line) => {
      const i = line.indexOf(':'); if (i>0) acc[line.slice(0,i).toLowerCase()] = line.slice(i+1).trim();
      return acc;
    }, {});
    const dispo = headers['content-disposition'] || '';
    const name = /name="([^"]+)"/.exec(dispo)?.[1];
    const filename = /filename="([^"]+)"/.exec(dispo)?.[1];
    const content = rest.join('\r\n\r\n').replace(/\r\n$/, '');
    if (!name) continue;
    if (filename) out[name] = { filename, contentType: (headers['content-type'] || 'application/octet-stream'), data: content };
    else out[name] = content;
  }
  return out;
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type'
      }};
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const ct = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const match = /multipart\/form-data;\s*boundary=(.+)/i.exec(ct);
    if (!match) return { statusCode: 400, body: 'multipart/form-data required' };

    const fields = parseMultipart(event.body, match[1]);
    const file = fields.file;
    if (!file?.data) return { statusCode: 400, body: 'file required' };

    const lat = parseFloat(fields.lat), lng = parseFloat(fields.lng);
    const title = fields.title || '', description = fields.description || '';

    const stamp = Date.now();
    const ext = (file.filename || '').split('.').pop() || 'jpg';
    const key = `photo_${stamp}.${ext}`;

    await photoStore().set(key, Buffer.from(file.data, 'binary'), { contentType: file.contentType || 'image/jpeg' });

    const imageUrl = `/.netlify/functions/photo/${encodeURIComponent(key)}`;
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { title, description, imageUrl, ts: stamp }
    };
    await metaStore().set(`photo_${stamp}.json`, JSON.stringify(feature), { contentType: 'application/json' });

    return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ imageUrl, feature }) };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}

// netlify/functions/uploadPhoto.mjs
import { getStore } from '@netlify/blobs';

const PHOTO_BUCKET = 'photos';
const META_BUCKET  = 'photo-features';

function parseMultipart(body, boundary) {
  // Minimal multipart parser for small forms (fine here).
  const parts = body.split(`--${boundary}`).filter(x => x && x !== '--\r\n');
  const out = {};
  for (const part of parts) {
    const [rawHeaders, ...rest] = part.split('\r\n\r\n');
    const headers = rawHeaders.split('\r\n').reduce((acc, line) => {
      const i = line.indexOf(':');
      if (i > 0) acc[line.slice(0,i).toLowerCase()] = line.slice(i+1).trim();
      return acc;
    }, {});
    const dispo = headers['content-disposition'] || '';
    const nameMatch = /name="([^"]+)"/.exec(dispo);
    const filenameMatch = /filename="([^"]+)"/.exec(dispo);
    const name = nameMatch?.[1];
    const content = rest.join('\r\n\r\n').replace(/\r\n$/, ''); // strip trailing CRLF
    if (!name) continue;
    if (filenameMatch) {
      out[name] = { filename: filenameMatch[1], contentType: (headers['content-type'] || 'application/octet-stream'), data: content };
    } else {
      out[name] = content;
    }
  }
  return out;
}

export async function handler(event, context) {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const ct = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const match = /multipart\/form-data;\s*boundary=(.+)/i.exec(ct);
    if (!match) return { statusCode: 400, body: 'multipart/form-data required' };
    const boundary = match[1];

    const fields = parseMultipart(event.body, boundary);
    const file = fields.file;
    if (!file?.data) return { statusCode: 400, body: 'file required' };

    const lat = parseFloat(fields.lat), lng = parseFloat(fields.lng);
    const title = fields.title || '';
    const description = fields.description || '';

    const photoStore = getStore(PHOTO_BUCKET, { context });
    const metaStore  = getStore(META_BUCKET, { context });

    const stamp = Date.now();
    const extension = (file.filename || '').split('.').pop() || 'jpg';
    const key = `photo_${stamp}.${extension}`;

    // upload binary
    await photoStore.set(key, Buffer.from(file.data, 'binary'), {
      contentType: file.contentType || 'image/jpeg'
    });

    // write GeoJSON feature
    const imageUrl = `/.netlify/functions/photo/${encodeURIComponent(key)}`;
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { title, description, imageUrl, ts: stamp }
    };
    await metaStore.set(`photo_${stamp}.json`, JSON.stringify(feature), { contentType: 'application/json' });

    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl, feature }) };
  } catch (e) {
    return { statusCode: 500, body: 'upload error: ' + e.message };
  }
}

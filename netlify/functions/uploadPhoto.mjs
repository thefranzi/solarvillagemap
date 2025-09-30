// Forcing an update - v2
// netlify/functions/uploadPhoto.mjs
import { getStore } from '@netlify/blobs';
export const config = { path: "uploadPhoto" };

// Accepts multipart/form-data with fields:
//   file (image/jpeg or image/png), lat, lng, title (optional), description (optional)
// Saves the image into the "photos" Blobs store, writes a GeoJSON Feature to "photo-features",
// and returns { imageUrl: "/api/photo/<key>", feature }.
export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return { statusCode: 400, body: 'multipart/form-data required' };
    }
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return { statusCode: 400, body: 'No boundary' };

    // Use Web Request/FormData API (Node 18+ runtime on Netlify)
    const bodyBuf = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
    const req = new Request('http://local', { method: 'POST', headers: { 'content-type': contentType }, body: bodyBuf });
    const form = await req.formData();

    const file = form.get('file');
    const lat  = parseFloat(form.get('lat'));
    const lng  = parseFloat(form.get('lng'));
    const title = String(form.get('title') || 'Photo');
    const description = String(form.get('description') || '');

    if (!(file && typeof file.arrayBuffer === 'function')) {
      return { statusCode: 400, body: 'file missing' };
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return { statusCode: 400, body: 'lat/lng required' };
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ct  = (file.type || '').toLowerCase();
    const isPng  = ct.includes('png');
    const isJpeg = ct.includes('jpeg') || ct.includes('jpg');

    // Default to JPEG if unknown
    const contentTypeFile = isPng ? 'image/png' : 'image/jpeg';

    const stamp = new Date().toISOString().replace(/[:.]/g, '');
    const key = `photo_${stamp}${isPng ? '.png' : '.jpg'}`;

    // Save image bytes to the "photos" store
    const photos = getStore('photos');
    await photos.set(key, buf, { contentType: contentTypeFile });

    // Serve images via our function route
const imageUrl = `/photo/${key}`;

    // Write a GeoJSON Feature to "photo-features"
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { title, description, imageUrl, ts: Date.now() }
    };
    const meta = getStore('photo-features');
    await meta.set(`photo_${stamp}.json`, JSON.stringify(feature), { contentType: 'application/json' });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageUrl, feature })
    };
  } catch (e) {
    return { statusCode: 500, body: 'upload error: ' + e.message };
  }
}

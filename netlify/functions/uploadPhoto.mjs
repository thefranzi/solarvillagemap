import { photosStore } from './_store.js';
import { v4 as uuid } from 'uuid';

export const config = { path: "/api/uploadPhoto" };

export async function handler(event) {
  try {
    const ct = event.headers['content-type'] || event.headers['Content-Type'] || 'application/octet-stream';
    if (!event.body) return { statusCode: 400, body: 'missing image body' };

    const buf = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
    const ext = ct.includes('png') ? '.png' : ct.includes('webp') ? '.webp' : ct.includes('gif') ? '.gif' : '.jpg';
    const key = uuid() + ext;

    const photos = photosStore();
    await photos.put(key, buf, ct);

    return { statusCode: 200, headers: { 'content-type':'application/json' }, body: JSON.stringify({ key }) };
  } catch (e) {
    return { statusCode: 500, body: `upload error: ${e.message}` };
  }
}

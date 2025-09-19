// netlify/functions/uploadPhoto.mjs
import { store } from './_store.js';
import { v4 as uuid } from 'uuid';

export const config = { path: "/api/uploadPhoto" };

export async function handler(event) {
  try {
    const contentType =
      event.headers['content-type'] ||
      event.headers['Content-Type'] ||
      'application/octet-stream';

    if (!event.body) {
      return { statusCode: 400, body: 'missing image body' };
    }

    // Netlify may set this for binary bodies
    const isB64 = !!event.isBase64Encoded;
    const buf = isB64 ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);

    const ext =
      contentType.includes('png') ? '.png' :
      contentType.includes('webp') ? '.webp' :
      contentType.includes('gif') ? '.gif' : '.jpg';

    const key = uuid() + ext;

    const photos = store('photos'); // writes under assets/photos
    await photos.put(key, buf);

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key })
    };
  } catch (e) {
    return { statusCode: 500, body: `upload error: ${e.message}` };
  }
}

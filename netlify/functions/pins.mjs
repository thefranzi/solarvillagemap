// netlify/functions/pins.mjs
import { store } from './_store.js';

export const config = { path: "/api/pins" };

export async function handler(event) {
  const pins = store('pins'); // reads/writes under assets/pins

  try {
    if (event.httpMethod === 'GET') {
      const body = await pins.list(); // returns JSON string "[]"/"[{...}]"
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body
      };
    }

    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}');
      if (typeof data.lat !== 'number' || typeof data.lng !== 'number' || !data.photoKey) {
        return { statusCode: 400, body: 'invalid pin payload' };
      }
      const id = `${Date.now()}.json`;
      await pins.put(id, JSON.stringify({
        lat: data.lat,
        lng: data.lng,
        photoKey: data.photoKey,
        timestamp: data.timestamp || new Date().toISOString()
      }));
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, id })
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (e) {
    return { statusCode: 500, body: `pins error: ${e.message}` };
  }
}

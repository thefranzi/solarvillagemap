
import { store } from './_store.js';
export const config = { path: "/api/pins" };

export async function handler(event) {
  const s = store('pins');

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: await s.list()
    };
  }

  if (event.httpMethod === 'POST') {
    const data = JSON.parse(event.body);
    const id = Date.now().toString() + '.json';
    await s.put(id, JSON.stringify(data));
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: "Method Not Allowed" };
}

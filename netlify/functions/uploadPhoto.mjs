
import { store } from './_store.js';
import { v4 as uuid } from 'uuid';

export const config = { path: "/api/uploadPhoto" };

export async function handler(event) {
  const body = event.body;
  const contentType = event.headers['content-type'];

  if (!body || !contentType) {
    return { statusCode: 400, body: 'missing image or content-type' };
  }

  const ext = contentType.includes('png') ? '.png' : '.jpg';
  const id = uuid() + ext;

  const s = store('photos');
  await s.put(id, Buffer.from(body, 'base64'), { contentType });

  return {
    statusCode: 200,
    body: JSON.stringify({ key: id }),
  };
}

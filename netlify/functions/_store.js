import { getStore } from '@netlify/blobs';

const siteID = process.env.NETLIFY_SITE_ID || '';
const token  = process.env.NETLIFY_AUTH_TOKEN || '';

function makeStore(name) {
  const opts = { name };
  if (siteID && token) { opts.siteID = siteID; opts.token = token; } // helps in `netlify dev`
  return getStore(opts);
}

export function pinsStore() {
  const s = makeStore('pins');
  return {
    async put(key, jsonText) { await s.set(key, jsonText, { contentType:'application/json' }); },
    async list() {
      const { blobs } = await s.list();
      const arr = await Promise.all(blobs.map(async ({key}) => {
        const txt = await s.get(key, { type:'text' });
        try { return JSON.parse(txt); } catch { return null; }
      }));
      return arr.filter(Boolean);
    }
  };
}

export function photosStore() {
  const s = makeStore('photos');
  return {
    async put(key, buffer, contentType='application/octet-stream') {
      await s.set(key, buffer, { contentType });
    },
    async get(key) { return await s.get(key, { type:'buffer' }); }
  };
}

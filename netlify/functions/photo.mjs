import { getStore } from '@netlify/blobs';
export const config = { path: "photo/*" };

export async function handler(event) {
  try {
    // key is everything after /api/photo/
const key = event.path.replace(/^\/?photo\/?/, "");
    if (!key) return { statusCode: 400, body: "missing key" };

const store = getStore('photos');
// The getWithMetadata method retrieves the blob and its metadata
const { data, metadata } = await store.getWithMetadata(key, { type: 'stream' }); 
if (!data) return { statusCode: 404, body: "not found" };

return {
  statusCode: 200,
  headers: { 
    'content-type': metadata?.contentType || 'image/jpeg', // Use stored metadata
    'cache-control': 'public, max-age=31536000, immutable' 
  },
  body: data
};
  } catch (e) {
    return { statusCode: 500, body: 'error: ' + e.message };
  }
}

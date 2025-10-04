// netlify/functions/photo.mjs
export async function handler(event) {
  try {
    const parts = (event.path || '').split('/');
    const idx = parts.indexOf('photo');
    const key = idx >= 0 ? parts.slice(idx + 1).join('/') : '';
    if (!key) return { statusCode: 400, body: 'missing key' };

    const owner  = process.env.GH_OWNER;
    const repo   = process.env.GH_REPO;
    const branch = process.env.GH_BRANCH || 'main';
    const base   = process.env.GH_IMAGES_DIR || 'data/photos';

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${base}/${key}`;
    return { statusCode: 302, headers: { location: rawUrl, 'access-control-allow-origin': '*' } };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}

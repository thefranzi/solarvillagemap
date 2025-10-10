// netlify/functions/uploadPhoto.mjs
import { Buffer } from 'buffer';
import { gh, cfg } from './gh-utils.mjs';

// Configuration specific to the upload function
function cfgUpload() {
  const baseCfg = cfg();
  const imgDir  = process.env.GH_IMAGES_DIR || process.env.GH_IMG_DIR || 'data/photos';
  const metaDir = process.env.GH_PHOTOS_DIR || 'data/photo-features';
  return { ...baseCfg, imgDir, metaDir };
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type'
      }};
    }

    if (event.httpMethod !== 'POST' || !event.headers['content-type']?.includes('multipart/form-data')) {
      return { statusCode: 400, body: 'POST multipart/form-data required' };
    }

    // --- Parse multipart form data ---
    // NOTE: This assumes the parser utility 'uploadPhoto-parser.mjs' exists locally in the netlify/functions folder.
    const { parse } = await import('netlify/functions/uploadPhoto-parser.mjs'); 
    const data = parse(event.body, event.headers['content-type']);

    const file = data.find(p => p.name === 'file');
    const lat = data.find(p => p.name === 'lat')?.data;
    const lng = data.find(p => p.name === 'lng')?.data;
    const title = data.find(p => p.name === 'title')?.data || '';
    const description = data.find(p => p.name === 'description')?.data || '';

    if (!file || !lat || !lng) {
      return { statusCode: 400, body: 'Missing file, lat, or lng field' };
    }

    const { owner, repo, branch, imgDir, metaDir } = cfgUpload();
    const stamp = Date.now();
    const ext = (file.filename || '').split('.').pop()?.toLowerCase() || 'jpg';
    const key = 'photo_' + stamp + '.' + ext;

    // 1) Write image to repo
    const imgPath = imgDir + '/' + key;
    await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(imgPath), 'PUT', {
      message: 'Add photo ' + key,
      content: file.data.toString('base64'),
      branch
    });

    // 2) Write GeoJSON metadata
    // Use the Netlify function as a redirection proxy for the image URL
    const imageUrl = '/.netlify/functions/photo/' + encodeURIComponent(key);

    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      properties: { title, description, imageUrl, ts: stamp }
    };
    const metaPath = metaDir + '/photo_' + stamp + '.json';
    await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(metaPath), 'PUT', {
      message: 'Add photo feature ' + stamp,
      content: Buffer.from(JSON.stringify(feature, null, 2)).toString('base64'),
      branch
    });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ok: true, imageUrl })
    };
  } catch (e) {
    return { statusCode: 500, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: e.stack || e.message };
  }
}


import { Buffer } from 'buffer';
import { gh, cfg } from '../github-api-utils.mjs';
// netlify/functions/uploadPhoto.mjsfunction cfg() {
  const token   = process.env.GITHUB_TOKEN;
  const owner   = process.env.GH_OWNER;
  const repo    = process.env.GH_REPO;
  const branch  = process.env.GH_BRANCH || 'main';
  const imgDir  = process.env.GH_IMAGES_DIR || process.env.GH_IMG_DIR || 'data/photos';
  const metaDir = process.env.GH_PHOTOS_DIR || 'data/photo-features';
  if (!token || !owner || !repo) throw new Error('Missing GITHUB_TOKEN / GH_OWNER / GH_REPO');
  return { token, owner, repo, branch, imgDir, metaDir };
}

async function gh(path, method = 'GET', body) {
  const { token } = cfg();
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

// Parse multipart/form-data from Lambda event (base64-safe)
function parseMultipartFromEvent(event) {
  const ctRaw = event.headers['content-type'] || event.headers['Content-Type'] || '';
  const m = /multipart\/form-data;\s*boundary=([^;]+)/i.exec(ctRaw);
  if (!m) throw new Error('multipart/form-data required');
  const boundaryToken = m[1].trim().replace(/^"|"$/g, '');  // <-- handle quoted boundary
  const boundary = `--${boundaryToken}`;


  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8');

  const parts = {};
  const endBoundary = Buffer.from(`${boundary}--`);
  const delim = Buffer.from(`\r\n${boundary}`);
  let idx = raw.indexOf(boundary);
  if (idx === -1) throw new Error('boundary not found');
  idx += boundary.length + 2;

  while (idx < raw.length) {
    const sep = raw.indexOf(Buffer.from('\r\n\r\n'), idx);
    if (sep === -1) break;
    const headersBuf = raw.subarray(idx, sep);
    let next = raw.indexOf(delim, sep + 4);
    if (next === -1) next = raw.indexOf(endBoundary, sep + 4);
    if (next === -1) break;
    let body = raw.subarray(sep + 4, next);
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.subarray(0, body.length - 2);
    }

    const headers = headersBuf.toString('latin1').split('\r\n').reduce((acc, line) => {
      const i = line.indexOf(':');
      if (i > -1) acc[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
      return acc;
    }, {});
    const dispo = headers['content-disposition'] || '';
    const name = /name="([^"]+)"/.exec(dispo)?.[1];
    const filename = /filename="([^"]+)"/.exec(dispo)?.[1];
    const contentType = (headers['content-type'] || '').trim();

    if (name) {
      if (filename) parts[name] = { filename, contentType, data: body };
      else parts[name] = body.toString('utf8');
    }
    idx = next + delim.length;
  }
  return parts;
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST,OPTIONS',
          'access-control-allow-headers': 'content-type'
        }
      };
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const fields = parseMultipartFromEvent(event);
    const file = fields.file;
    if (!file?.data?.length) return { statusCode: 400, body: 'file required' };

    const lat = parseFloat(fields.lat);
    const lng = parseFloat(fields.lng);
    const title = fields.title || '';
    const description = fields.description || '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { statusCode: 400, body: 'lat and lng required' };
    }

    const { owner, repo, branch, imgDir, metaDir } = cfg();
    const stamp = Date.now();
    const ext = (file.filename || '').split('.').pop()?.toLowerCase() || 'jpg';
    const key = `photo_${stamp}.${ext}`;

    // 1) Write image to repo
    const imgPath = `${imgDir}/${key}`;
    await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(imgPath)}`, 'PUT', {
      message: `Add photo ${key}`,
      content: file.data.toString('base64'),
      branch
    });

    // 2) Write GeoJSON metadata
// replace the raw URL line with:
const imageUrl = `/.netlify/functions/photo/${encodeURIComponent(key)}`;

    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { title, description, imageUrl, ts: stamp }
    };
    const metaPath = `${metaDir}/photo_${stamp}.json`;
    await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(metaPath)}`, 'PUT', {
      message: `Add photo feature ${stamp}`,
      content: Buffer.from(JSON.stringify(feature, null, 2)).toString('base64'),
      branch
    });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ imageUrl, feature })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' },
      body: e.stack || e.message
    };
  }
}



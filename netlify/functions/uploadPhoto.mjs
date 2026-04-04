import { Buffer } from 'buffer';
import { gh, cfg } from './gh-utils.mjs';

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

        if (event.httpMethod !== 'POST') {
            return { statusCode: 400, body: 'POST JSON required' };
        }

        const body = JSON.parse(event.body || '{}');
        const { dataUrl, lat, lng, title = '', description = '' } = body;

        if (!dataUrl || lat === undefined || lng === undefined) {
            return { statusCode: 400, body: 'Missing dataUrl, lat, or lng' };
        }

        const m = /^data:([\w/+\-.]+);base64,(.*)$/i.exec(dataUrl);
        if (!m) {
            return { statusCode: 400, body: 'Bad dataUrl format' };
        }

        const b64 = m[2];
        const { owner, repo, branch, imgDir, metaDir } = cfg();

        const stamp = Date.now();
        const key = 'photo_' + stamp + '.jpg';

        const imgPath = imgDir + '/' + key;
        await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(imgPath), 'PUT', {
            message: 'Add photo ' + key,
            content: b64,
            branch
        });

        const imageUrl = '/.netlify/functions/photo/' + encodeURIComponent(key);

        const feature = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            properties: {
                title,
                description,
                imageUrl,
                ts: stamp
            }
        };

        const metaPath = metaDir + '/photo_' + stamp + '.json';
        await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(metaPath), 'PUT', {
            message: 'Add photo feature ' + stamp,
            content: Buffer.from(JSON.stringify(feature, null, 2)).toString('base64'),
            branch
        });

        return {
            statusCode: 200,
            headers: {
                'content-type': 'application/json',
                'access-control-allow-origin': '*'
            },
            body: JSON.stringify({ ok: true, imageUrl })
        };
    } catch (e) {
        console.error('uploadPhoto error:', e);
        return {
            statusCode: 500,
            headers: {
                'content-type': 'text/plain',
                'access-control-allow-origin': '*'
            },
            body: e.stack || e.message
        };
    }
}

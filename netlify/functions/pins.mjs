import { gh, cfg } from './gh-utils.mjs';

async function listPins() {
    const { owner, repo, branch, pinsDir } = cfg();

    let items = [];
    try {
        items = await gh(
            '/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(pinsDir) + '?ref=' + branch
        );
    } catch (e) {
        console.error('listPins directory read failed:', e);
        return { type: 'FeatureCollection', features: [] };
    }

    const features = [];

    for (const item of items) {
        if (item.type !== 'file' || !item.name.endsWith('.json')) continue;

        try {
            const file = await fetch(item.download_url);
            if (!file.ok) continue;

            const json = await file.json();
            if (json?.type === 'Feature' && json?.geometry?.type === 'Point') {
                features.push(json);
            }
        } catch (e) {
            console.error('listPins file parse failed for', item.name, e);
        }
    }

    return { type: 'FeatureCollection', features };
}

async function createPin(feature) {
    const { Buffer } = await import('buffer');
    const { owner, repo, branch, pinsDir } = cfg();

    const stamp = Date.now();
    const key = 'pin_' + stamp + '.json';
    const path = pinsDir + '/' + key;

    const payload = {
        message: 'Add pin ' + stamp,
        content: Buffer.from(JSON.stringify(feature, null, 2)).toString('base64'),
        branch
    };

    await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path), 'PUT', payload);

    return feature;
}

async function deletePin(key) {
    const { owner, repo, branch, pinsDir } = cfg();

    const path = pinsDir + '/' + key;
    const file = await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path) + '?ref=' + branch);

    const payload = {
        message: 'Delete pin ' + key,
        sha: file.sha,
        branch
    };

    await gh('/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(path), 'DELETE', payload);
    return { ok: true };
}

export async function handler(event) {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 204,
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
                    'access-control-allow-headers': 'content-type'
                }
            };
        }

        if (event.httpMethod === 'GET') {
            const fc = await listPins();
            return {
                statusCode: 200,
                headers: {
                    'content-type': 'application/json',
                    'cache-control': 'no-store',
                    'access-control-allow-origin': '*'
                },
                body: JSON.stringify(fc)
            };
        }

        if (event.httpMethod === 'POST') {
            const feature = JSON.parse(event.body || '{}');

            if (feature?.geometry?.type !== 'Point') {
                return { statusCode: 400, body: 'Point feature required' };
            }

            const saved = await createPin(feature);

            return {
                statusCode: 200,
                headers: {
                    'content-type': 'application/json',
                    'access-control-allow-origin': '*'
                },
                body: JSON.stringify(saved)
            };
        }

        if (event.httpMethod === 'DELETE') {
            const key = (new URL(event.rawUrl)).searchParams.get('key');
            if (!key) {
                return { statusCode: 400, body: 'key required' };
            }

            await deletePin(key);

            return {
                statusCode: 204,
                headers: { 'access-control-allow-origin': '*' }
            };
        }

        return {
            statusCode: 405,
            body: 'Method Not Allowed',
            headers: { 'access-control-allow-origin': '*' }
        };
    } catch (e) {
        console.error('pins handler error:', e);
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

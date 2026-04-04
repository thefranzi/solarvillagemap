import { gh, cfg } from './gh-utils.mjs';

async function listPhotoFeatures() {
    const { owner, repo, branch, metaDir } = cfg();

    let items = [];
    try {
        items = await gh(
            '/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(metaDir) + '?ref=' + branch
        );
    } catch (e) {
        console.error('listPhotoFeatures directory read failed:', e);
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
            console.error('listPhotoFeatures file parse failed for', item.name, e);
        }
    }

    return { type: 'FeatureCollection', features };
}

export async function handler(event) {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 204,
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'GET,OPTIONS',
                    'access-control-allow-headers': 'content-type'
                }
            };
        }

        if (event.httpMethod !== 'GET') {
            return {
                statusCode: 405,
                headers: {
                    'content-type': 'text/plain',
                    'access-control-allow-origin': '*'
                },
                body: 'Method Not Allowed'
            };
        }

        const fc = await listPhotoFeatures();

        return {
            statusCode: 200,
            headers: {
                'content-type': 'application/json',
                'cache-control': 'no-store',
                'access-control-allow-origin': '*'
            },
            body: JSON.stringify(fc)
        };
    } catch (e) {
        console.error('photos handler error:', e);
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

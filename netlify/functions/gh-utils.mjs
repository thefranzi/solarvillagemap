// netlify/functions/gh-utils.mjs - Centralized GitHub API access logic
const GH_API = 'https://api.github.com';

export function cfg() {
    const token   = process.env.GITHUB_TOKEN;
    const owner   = process.env.GH_OWNER;
    const repo    = process.env.GH_REPO;
    const branch  = process.env.GH_BRANCH || 'main';
    const pinsDir = process.env.GH_PINS_DIR || 'data/pins';
    const imgDir  = process.env.GH_IMAGES_DIR || 'data/photos';
    const metaDir = process.env.GH_PHOTOS_DIR || 'data/photo-features';

    if (!token || !owner || !repo) {
        throw new Error('Missing critical GitHub environment variables: GITHUB_TOKEN, GH_OWNER, GH_REPO');
    }

    return { token, owner, repo, branch, pinsDir, imgDir, metaDir };
}

export async function gh(path, method = 'GET', body) {
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
        throw new Error(`GitHub API Error: ${method} ${path} -> ${res.status}: ${text}`);
    }

    return method === 'GET' ? res.json() : res.status;
}

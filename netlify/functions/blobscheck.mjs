// netlify/functions/blobscheck.mjs
import { getStore } from '@netlify/blobs';

function getBlobsStore(name, context) {
  // Use context when available; fall back to env vars
  return getStore(name, {
    context,
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_BLOBS_TOKEN
  });
}

export async function handler(event, context) {
  try {
    const pinsStore = getBlobsStore('pins', context);

    // 1) list() should succeed
    const list = await pinsStore.list(); // { blobs: [...] }

    // 2) write a tiny probe (won’t clash with your schema)
    const key = `__probe_${Date.now()}.txt`;
    await pinsStore.set(key, 'ok', { contentType: 'text/plain' });

    // 3) read it back
    const val = await pinsStore.get(key, { type: 'text' });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        listOk: Array.isArray(list?.blobs),
        wroteKey: key,
        readVal: val
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'text/plain' },
      body: e.stack || e.message
    };
  }
}

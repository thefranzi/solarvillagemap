export async function handler() {
  const hasSite = !!process.env.NETLIFY_SITE_ID;
  const hasTok  = !!process.env.NETLIFY_BLOBS_TOKEN;
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ok: hasSite && hasTok,
      NETLIFY_SITE_ID_present: hasSite,
      NETLIFY_BLOBS_TOKEN_present: hasTok
    })
  };
}

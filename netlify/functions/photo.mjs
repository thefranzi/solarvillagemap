// netlify/functions/photo.mjs
import { photosStore } from './_store.js';

export const config = {
  // The :key part is a placeholder for the image's unique filename
  path: "/api/photo/:key"
};

export async function handler(event, context) {
  try {
    // Get the image key from the URL (e.g., "abc-123.jpg")
    const { key } = context.params;
    if (!key) {
      return { statusCode: 400, body: 'Image key is missing.' };
    }

    const photos = photosStore();
    const imageBuffer = await photos.get(key);

    if (!imageBuffer) {
      return { statusCode: 404, body: 'Image not found.' };
    }

    // Guess the content type from the file extension for the browser
    const extension = key.split('.').pop().toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg';
    if (extension === 'png') contentType = 'image/png';
    if (extension === 'gif') contentType = 'image/gif';
    if (extension === 'webp') contentType = 'image/webp';

    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType },
      body: imageBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error('Error serving photo:', e);
    return { statusCode: 500, body: `Error serving photo: ${e.message}` };
  }
}
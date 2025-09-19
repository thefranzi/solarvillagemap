// netlify/functions/pins.mjs
import { pinsStore } from './_store.js';

export const config = { path: "/api/pins" };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function handler(event) {
  const pins = pinsStore();

  try {
    // GET request: Fetch all pins and return as a GeoJSON FeatureCollection
    if (event.httpMethod === 'GET') {
      const pinObjects = await pins.list(); // Returns an array of pin data

      const features = pinObjects.map(pin => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pin.lng, pin.lat]
        },
        properties: {
          title: pin.title || 'Pin',
          description: pin.description || '',
          timestamp: pin.timestamp,
          photoKey: pin.photoKey || null
        }
      }));

      const featureCollection = {
        type: 'FeatureCollection',
        features: features
      };

      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify(featureCollection)
      };
    }

    // POST request: Save a new pin
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body || '{}');

      // Validate required fields
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      if (!isFinite(lat) || !isFinite(lng)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid lat/lng' }) };
      }

      const pinData = {
        lat,
        lng,
        title: data.title || 'Pin',
        description: data.description || '',
        photoKey: data.photoKey || null, // photoKey is now optional
        timestamp: new Date().toISOString()
      };

      const id = `${Date.now()}.json`;
      await pins.put(id, JSON.stringify(pinData));

      return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify({ success: true, id }) };
    }

    // Handle other methods
    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (e) {
    console.error('Pins function error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
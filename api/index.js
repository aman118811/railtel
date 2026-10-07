// Vercel serverless entry: serves the whole Express API (see server/app.js) under /api.
// The MongoDB connection is created once per warm function instance and reused.
import { createApp } from '../server/app.js';
import { connect } from '../server/db.js';

let app;
let ready;

export default async function handler(req, res) {
  try {
    ready ||= connect();
    await ready;
    app ||= createApp();
  } catch (e) {
    ready = undefined; // try again on the next request
    console.error('database connection failed:', e.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database is not reachable' }));
    return;
  }
  app(req, res);
}

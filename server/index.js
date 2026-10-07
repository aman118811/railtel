import { connect, describeConnection, disconnect } from './db.js';
import { createApp } from './app.js';

let conn;
try {
  conn = await connect();
} catch (e) {
  console.error(`\nCould not connect to MongoDB.\n${e.message}\n`);
  process.exit(1);
}
console.log(`Connected to MongoDB: ${describeConnection(conn)}`);

const port = Number(process.env.PORT) || 4000;
const server = createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${port} is already in use by another process.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

const stop = async () => { server.close(); await disconnect(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

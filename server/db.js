import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Project, ProjectStation, ProjectHistory, Station, StationHistory, Counter } from './models/index.js';

// Always read server/.env (git-ignored), whatever directory the process is started from.
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

/** Turn the driver's connection errors into something a person can act on. Never includes the password. */
export function explainConnectionError(e) {
  const msg = String(e?.message || e);
  if (/bad auth|authentication failed/i.test(msg)) {
    return 'Authentication failed. Check the username and password in MONGODB_URI (the password must not be wrapped in < >, and special characters must be URL-encoded).';
  }
  if (/ENOTFOUND|querySrv|EREFUSED|ECONNREFUSED.*(_mongodb|srv)/i.test(msg)) {
    return 'Could not resolve the cluster address. Check the host in MONGODB_URI and your internet/DNS connection.';
  }
  if (/Server selection timed out|ReplicaSetNoPrimary|ETIMEDOUT|whitelist|not allowed|IP/i.test(msg)) {
    return 'Could not reach the cluster. In Atlas open Network Access and add this machine\'s IP address (or 0.0.0.0/0 while testing), and make sure the cluster is not paused.';
  }
  if (/Invalid scheme|Invalid connection string|URI must/i.test(msg)) {
    return 'MONGODB_URI is not a valid MongoDB connection string. It should start with mongodb+srv:// or mongodb://';
  }
  return msg;
}

/** "cluster0-shard-00-00.xxxx.mongodb.net / cctv", with no credentials. */
export function describeConnection(conn = mongoose.connection) {
  return `${conn.host || 'unknown host'} / ${conn.name}`;
}

/**
 * Connect with MONGODB_URI (never hard-coded; read from the environment / server/.env) and build the indexes.
 * The database name comes from MONGODB_DB (default "cctv") so the URI does not have to contain one.
 */
export async function connect(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB || 'cctv') {
  if (!uri) throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.');
  try {
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 15000 });
    // Creates any collection that does not exist yet and builds the schema's indexes (safe to repeat; existing data is untouched).
    await Promise.all([Project.init(), ProjectStation.init(), ProjectHistory.init(), Station.init(), StationHistory.init(), Counter.init()]);
  } catch (e) {
    await mongoose.disconnect().catch(() => {});
    const err = new Error(explainConnectionError(e));
    err.cause = e;
    throw err;
  }
  return mongoose.connection;
}

export const disconnect = () => mongoose.disconnect();

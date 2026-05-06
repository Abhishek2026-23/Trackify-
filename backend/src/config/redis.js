const redis = require('redis');
require('dotenv').config();

let redisAvailable = false;

// ── In-memory fallback store ──────────────────────────────────────
// Used when Redis is not available. Supports TTL via expiry timestamps.
const memStore = new Map(); // key → { value, expiresAt }

function memSet(key, ttlSeconds, value) {
  memStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memKeys(pattern) {
  // Convert Redis glob pattern (e.g. "driver:location:*") to a regex
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  const now = Date.now();
  const result = [];
  for (const [key, entry] of memStore.entries()) {
    if (now > entry.expiresAt) { memStore.delete(key); continue; }
    if (regex.test(key)) result.push(key);
  }
  return result;
}

// Periodically evict expired keys from the in-memory store
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore.entries()) {
    if (now > entry.expiresAt) memStore.delete(key);
  }
}, 10_000);

// ── In-memory client (Redis-compatible interface) ─────────────────
const inMemoryClient = {
  setEx: async (key, ttl, value) => { memSet(key, ttl, value); return 'OK'; },
  get:   async (key) => memGet(key),
  del:   async (key) => { memStore.delete(key); return 1; },
  keys:  async (pattern) => memKeys(pattern),
  ping:  async () => { throw new Error('Redis not available (using in-memory fallback)'); },
  on:    () => {},
};

// ── Redis client creation ─────────────────────────────────────────
async function createRedisClient() {
  const clientConfig = process.env.REDIS_URL
    ? {
        url: process.env.REDIS_URL,
        socket: {
          tls: process.env.REDIS_URL.startsWith('rediss://'),
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 3) return false; // stop retrying, fall back to memory
            return 1000;
          },
        },
      }
    : {
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          connectTimeout: 3000,
          reconnectStrategy: (retries) => {
            if (retries > 3) return false;
            return 1000;
          },
        },
        password: process.env.REDIS_PASSWORD || undefined,
      };

  const client = redis.createClient(clientConfig);

  client.on('ready', () => {
    console.log('✓ Redis connected');
    redisAvailable = true;
  });

  client.on('error', () => {
    redisAvailable = false;
  });

  client.on('end', () => {
    redisAvailable = false;
  });

  try {
    await client.connect();
    redisAvailable = true;
    return client;
  } catch {
    console.warn('⚠ Redis unavailable — using in-memory location store (data lost on restart)');
    return null;
  }
}

// ── Proxy: routes calls to Redis when available, in-memory otherwise ──
let _redisClient = null;

const proxy = new Proxy({}, {
  get(_target, prop) {
    if (redisAvailable && _redisClient) {
      const val = _redisClient[prop];
      return typeof val === 'function' ? val.bind(_redisClient) : val;
    }
    return inMemoryClient[prop] ?? (() => Promise.resolve(null));
  },
});

// Bootstrap — connect to Redis, fall back silently if unavailable
createRedisClient().then(client => {
  _redisClient = client;
});

module.exports = proxy;

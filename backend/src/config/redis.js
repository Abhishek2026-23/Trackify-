const redis = require('redis');
require('dotenv').config();

let redisClient = null;
let redisAvailable = false;

// Create a mock client for when Redis is unavailable
const mockClient = {
  setEx: async () => {},
  get: async () => null,
  del: async () => {},
  keys: async () => [],
  ping: async () => { throw new Error('Redis not available'); },
  on: () => {},
};

async function createRedisClient() {
  const client = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      connectTimeout: 3000,
      reconnectStrategy: (retries) => {
        if (retries > 3) return false; // stop retrying
        return 1000;
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  client.on('connect', () => {
    console.log('✓ Redis connected');
    redisAvailable = true;
  });

  client.on('error', (err) => {
    if (!redisAvailable) {
      // Only log once, don't spam
    }
    redisAvailable = false;
  });

  try {
    await client.connect();
    redisAvailable = true;
    return client;
  } catch (err) {
    console.warn('⚠ Redis unavailable — running without cache (location features limited)');
    return null;
  }
}

// Initialize and export a proxy that falls back to mock
const handler = {
  get(target, prop) {
    const client = target._client;
    if (!client || !redisAvailable) {
      return mockClient[prop] || (() => Promise.resolve(null));
    }
    return typeof client[prop] === 'function' ? client[prop].bind(client) : client[prop];
  }
};

const proxy = new Proxy({ _client: null }, handler);

createRedisClient().then(client => {
  proxy._client = client;
});

module.exports = proxy;

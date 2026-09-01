const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

redisClient.on('error', (err) => console.error('[❌] Redis error:', err));
redisClient.on('connect', () => console.log('[✅] Redis connected'));

async function initializeRedis() {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('[❌] Redis initialization failed:', error);
    throw error;
  }
}

module.exports = {
  redisClient,
  initializeRedis
};

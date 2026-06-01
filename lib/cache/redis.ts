import { createClient, type RedisClientType } from "redis";

type MemoryEntry = {
  expiresAt: number;
  value: string;
};

const memoryStore = new Map<string, MemoryEntry>();

let redisClientPromise: Promise<RedisClientType> | null = null;

function cleanupExpiredMemoryEntries(now = Date.now()) {
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

export function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

async function getRedisClient() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  redisClientPromise ??= (async () => {
    const client = createClient({ url: process.env.REDIS_URL });

    client.on("error", (error) => {
      console.error("Redis client error", error);
    });

    await client.connect();

    return client as RedisClientType;
  })();

  try {
    return await redisClientPromise;
  } catch (error) {
    redisClientPromise = null;
    console.error("Redis connection failed, using memory fallback", error);
    return null;
  }
}

export async function incrementWithExpiry(key: string, ttlSeconds: number) {
  const client = await getRedisClient();

  if (client) {
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }

    return count;
  }

  const now = Date.now();
  cleanupExpiredMemoryEntries(now);
  const current = memoryStore.get(key);
  const nextValue =
    current && current.expiresAt > now ? Number(current.value) + 1 : 1;

  memoryStore.set(key, {
    expiresAt: now + ttlSeconds * 1000,
    value: String(nextValue),
  });

  return nextValue;
}

export async function resetCacheKey(key: string) {
  const client = await getRedisClient();

  if (client) {
    await client.del(key);
    return;
  }

  memoryStore.delete(key);
}

export async function getCacheNumber(key: string) {
  const client = await getRedisClient();

  if (client) {
    const value = await client.get(key);

    return value === null ? 0 : Number(value) || 0;
  }

  const now = Date.now();
  cleanupExpiredMemoryEntries(now);
  const current = memoryStore.get(key);

  return current && current.expiresAt > now ? Number(current.value) || 0 : 0;
}

export async function getCacheValue(key: string) {
  const client = await getRedisClient();

  if (client) {
    return client.get(key);
  }

  const now = Date.now();
  cleanupExpiredMemoryEntries(now);
  const current = memoryStore.get(key);

  return current && current.expiresAt > now ? current.value : null;
}

export async function setCacheValue(
  key: string,
  value: string,
  ttlSeconds: number,
) {
  const client = await getRedisClient();

  if (client) {
    await client.set(key, value, { EX: ttlSeconds });
    return;
  }

  const now = Date.now();
  cleanupExpiredMemoryEntries(now);
  memoryStore.set(key, {
    expiresAt: now + ttlSeconds * 1000,
    value,
  });
}

export async function resetCacheByPrefix(prefix: string) {
  const client = await getRedisClient();

  if (client) {
    let cursor = "0";

    do {
      const result = await client.scan(cursor, {
        COUNT: 100,
        MATCH: `${prefix}*`,
      });
      cursor = result.cursor;

      if (result.keys.length > 0) {
        await client.del(result.keys);
      }
    } while (cursor !== "0");

    return;
  }

  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
}

export async function acquireLock(
  key: string,
  token: string,
  ttlSeconds: number,
) {
  const client = await getRedisClient();

  if (client) {
    const result = await client.set(key, token, {
      NX: true,
      PX: ttlSeconds * 1000,
    });

    return result === "OK";
  }

  const now = Date.now();
  cleanupExpiredMemoryEntries(now);

  if (memoryStore.has(key)) {
    return false;
  }

  memoryStore.set(key, {
    expiresAt: now + ttlSeconds * 1000,
    value: token,
  });

  return true;
}

export async function releaseLock(key: string, token: string) {
  const client = await getRedisClient();

  if (client) {
    const currentValue = await client.get(key);

    if (currentValue === token) {
      await client.del(key);
    }

    return;
  }

  const current = memoryStore.get(key);

  if (current?.value === token) {
    memoryStore.delete(key);
  }
}

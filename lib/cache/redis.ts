import { createClient, type RedisClientType } from "redis";

type MemoryEntry = {
  expiresAt: number;
  value: string;
};

const memoryStore = new Map<string, MemoryEntry>();

let redisClientPromise: Promise<RedisClientType> | null = null;
let redisDisabledUntil = 0;

const REDIS_OPERATION_TIMEOUT_MS = 800;
const REDIS_RETRY_PAUSE_MS = 30_000;

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

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs = REDIS_OPERATION_TIMEOUT_MS,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Redis operation timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function pauseRedisAfterFailure() {
  redisDisabledUntil = Date.now() + REDIS_RETRY_PAUSE_MS;
}

function handleRedisOperationFailure(error: unknown) {
  pauseRedisAfterFailure();
  console.error("Redis operation failed, using memory fallback", error);
}

async function getRedisClient() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (Date.now() < redisDisabledUntil) {
    return null;
  }

  redisClientPromise ??= (async () => {
    const client = createClient({
      socket: {
        connectTimeout: REDIS_OPERATION_TIMEOUT_MS,
        reconnectStrategy: false,
      },
      url: process.env.REDIS_URL,
    });

    client.on("error", (error) => {
      console.error("Redis client error", error);
    });

    try {
      await withTimeout(client.connect());
    } catch (error) {
      client.destroy();
      throw error;
    }

    return client as RedisClientType;
  })();

  try {
    return await redisClientPromise;
  } catch (error) {
    redisClientPromise = null;
    pauseRedisAfterFailure();
    console.error("Redis connection failed, using memory fallback", error);
    return null;
  }
}

export async function incrementWithExpiry(key: string, ttlSeconds: number) {
  const client = await getRedisClient();

  if (client) {
    try {
      const count = await withTimeout(client.incr(key));

      if (count === 1) {
        await withTimeout(client.expire(key, ttlSeconds));
      }

      return count;
    } catch (error) {
      handleRedisOperationFailure(error);
    }
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
    try {
      await withTimeout(client.del(key));
      return;
    } catch (error) {
      handleRedisOperationFailure(error);
    }
  }

  memoryStore.delete(key);
}

export async function getCacheNumber(key: string) {
  const client = await getRedisClient();

  if (client) {
    try {
      const value = await withTimeout(client.get(key));

      return value === null ? 0 : Number(value) || 0;
    } catch (error) {
      handleRedisOperationFailure(error);
    }
  }

  const now = Date.now();
  cleanupExpiredMemoryEntries(now);
  const current = memoryStore.get(key);

  return current && current.expiresAt > now ? Number(current.value) || 0 : 0;
}

export async function getCacheValue(key: string) {
  const client = await getRedisClient();

  if (client) {
    try {
      return await withTimeout(client.get(key));
    } catch (error) {
      handleRedisOperationFailure(error);
    }
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
    try {
      await withTimeout(client.set(key, value, { EX: ttlSeconds }));
      return;
    } catch (error) {
      handleRedisOperationFailure(error);
    }
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
    try {
      let cursor = "0";

      do {
        const result = await withTimeout(client.scan(cursor, {
          COUNT: 250,
          MATCH: `${prefix}*`,
        }));
        cursor = result.cursor;

        if (result.keys.length > 0) {
          await withTimeout(client.del(result.keys));
        }
      } while (cursor !== "0");

      return;
    } catch (error) {
      handleRedisOperationFailure(error);
    }
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
    try {
      const result = await withTimeout(client.set(key, token, {
        NX: true,
        PX: ttlSeconds * 1000,
      }));

      return result === "OK";
    } catch (error) {
      handleRedisOperationFailure(error);
    }
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
    try {
      const currentValue = await withTimeout(client.get(key));

      if (currentValue === token) {
        await withTimeout(client.del(key));
      }

      return;
    } catch (error) {
      handleRedisOperationFailure(error);
    }
  }

  const current = memoryStore.get(key);

  if (current?.value === token) {
    memoryStore.delete(key);
  }
}

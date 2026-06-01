import {
  getCacheValue,
  resetCacheByPrefix,
  setCacheValue,
} from "./redis";

const APP_CACHE_PREFIX = "app:";

export const appCachePrefixes = {
  adminDashboard: `${APP_CACHE_PREFIX}admin-dashboard:`,
  dashboard: `${APP_CACHE_PREFIX}dashboard:`,
  reports: `${APP_CACHE_PREFIX}reports:`,
  studentEvaluations: `${APP_CACHE_PREFIX}student-evaluations:`,
  teacherResults: `${APP_CACHE_PREFIX}teacher-results:`,
} as const;

type CacheOptions<T> = {
  key: string;
  loader: () => Promise<T>;
  maxBytes?: number;
  revive?: (value: unknown) => T;
  ttlSeconds: number;
};

const DEFAULT_MAX_CACHE_BYTES = 512 * 1024;

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
}

function parseCachedJson<T>(value: string): T {
  return JSON.parse(value, (_key, item) => {
    if (typeof item === "string" && isIsoDateString(item)) {
      return new Date(item);
    }

    return item;
  }) as T;
}

export function stableCachePart(value: unknown) {
  return Buffer.from(stableStringify(value)).toString("base64url");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([first], [second]) =>
      first.localeCompare(second),
    );

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export async function cachedJson<T>({
  key,
  loader,
  maxBytes = DEFAULT_MAX_CACHE_BYTES,
  revive,
  ttlSeconds,
}: CacheOptions<T>) {
  const cachedValue = await getCacheValue(key);

  if (cachedValue) {
    const parsed = parseCachedJson<unknown>(cachedValue);

    return revive ? revive(parsed) : (parsed as T);
  }

  const freshValue = await loader();
  const serializedValue = JSON.stringify(freshValue);

  if (Buffer.byteLength(serializedValue, "utf8") <= maxBytes) {
    await setCacheValue(key, serializedValue, ttlSeconds);
  } else {
    console.warn("Cache write skipped because payload is too large", {
      key,
      maxBytes,
      payloadBytes: Buffer.byteLength(serializedValue, "utf8"),
    });
  }

  return freshValue;
}

export async function invalidateAppCaches() {
  await resetCacheByPrefix(APP_CACHE_PREFIX);
}

export async function invalidateDashboardCaches() {
  await Promise.all([
    resetCacheByPrefix(appCachePrefixes.adminDashboard),
    resetCacheByPrefix(appCachePrefixes.dashboard),
  ]);
}

export async function invalidateReportCaches() {
  await resetCacheByPrefix(appCachePrefixes.reports);
}

export async function invalidateTeacherResultCaches(teacherId?: string) {
  await resetCacheByPrefix(
    teacherId
      ? `${appCachePrefixes.teacherResults}${stableCachePart(teacherId)}`
      : appCachePrefixes.teacherResults,
  );
}

export async function invalidateStudentEvaluationCaches(userId?: string) {
  await resetCacheByPrefix(
    userId
      ? `${appCachePrefixes.studentEvaluations}${stableCachePart(userId)}:`
      : appCachePrefixes.studentEvaluations,
  );
}

export async function invalidateEvaluationCaches() {
  await Promise.all([
    invalidateDashboardCaches(),
    invalidateReportCaches(),
    invalidateStudentEvaluationCaches(),
    invalidateTeacherResultCaches(),
  ]);
}

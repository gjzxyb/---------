import { describe, expect, it } from "vitest";

import {
  appCachePrefixes,
  cachedJson,
  invalidateDashboardCaches,
  invalidateStudentEvaluationCaches,
  stableCachePart,
} from "../../lib/cache/app-cache";

describe("app cache helpers", () => {
  it("returns cached JSON until the matching prefix is invalidated", async () => {
    const key = `${appCachePrefixes.dashboard}${crypto.randomUUID()}`;
    let loadCount = 0;

    const first = await cachedJson({
      key,
      loader: async () => {
        loadCount += 1;
        return { value: "fresh" };
      },
      ttlSeconds: 30,
    });
    const second = await cachedJson({
      key,
      loader: async () => {
        loadCount += 1;
        return { value: "changed" };
      },
      ttlSeconds: 30,
    });

    expect(first).toEqual({ value: "fresh" });
    expect(second).toEqual({ value: "fresh" });
    expect(loadCount).toBe(1);

    await invalidateDashboardCaches();

    const third = await cachedJson({
      key,
      loader: async () => {
        loadCount += 1;
        return { value: "changed" };
      },
      ttlSeconds: 30,
    });

    expect(third).toEqual({ value: "changed" });
    expect(loadCount).toBe(2);
  });

  it("invalidates one student's evaluation list without clearing others", async () => {
    const firstUserId = crypto.randomUUID();
    const secondUserId = crypto.randomUUID();
    const firstKey = `${appCachePrefixes.studentEvaluations}${stableCachePart(
      firstUserId,
    )}:list`;
    const secondKey = `${appCachePrefixes.studentEvaluations}${stableCachePart(
      secondUserId,
    )}:list`;

    await cachedJson({
      key: firstKey,
      loader: async () => ({ count: 1 }),
      ttlSeconds: 30,
    });
    await cachedJson({
      key: secondKey,
      loader: async () => ({ count: 2 }),
      ttlSeconds: 30,
    });
    await invalidateStudentEvaluationCaches(firstUserId);

    const first = await cachedJson({
      key: firstKey,
      loader: async () => ({ count: 3 }),
      ttlSeconds: 30,
    });
    const second = await cachedJson({
      key: secondKey,
      loader: async () => ({ count: 4 }),
      ttlSeconds: 30,
    });

    expect(first).toEqual({ count: 3 });
    expect(second).toEqual({ count: 2 });
  });
});

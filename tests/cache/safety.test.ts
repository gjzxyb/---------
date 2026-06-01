import { describe, expect, it } from "vitest";

import {
  isLoginLimited,
  recordLoginFailure,
  resetLoginFailures,
  withEvaluationSubmissionLock,
} from "../../lib/cache/safety";

describe("cache safety helpers", () => {
  it("limits login after repeated failures", async () => {
    const email = `limit-${crypto.randomUUID()}@example.edu`;

    await resetLoginFailures(email);

    expect(await isLoginLimited(email)).toBe(false);

    for (let index = 0; index < 5; index += 1) {
      await recordLoginFailure(email);
    }

    expect(await isLoginLimited(email)).toBe(true);

    await resetLoginFailures(email);
    expect(await isLoginLimited(email)).toBe(false);
  });

  it("prevents duplicate evaluation submissions while a lock is active", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const assignmentId = `assignment-${crypto.randomUUID()}`;
    let releaseFirstLock!: () => void;

    const firstSubmission = withEvaluationSubmissionLock(userId, assignmentId, () =>
      new Promise<string>((resolve) => {
        releaseFirstLock = () => resolve("done");
      }),
    );

    await expect(
      withEvaluationSubmissionLock(userId, assignmentId, async () => "duplicate"),
    ).rejects.toThrow("当前评教正在提交处理中，请稍后再试。");

    releaseFirstLock();
    await expect(firstSubmission).resolves.toBe("done");

    await expect(
      withEvaluationSubmissionLock(userId, assignmentId, async () => "next"),
    ).resolves.toBe("next");
  });
});

import { randomUUID } from "node:crypto";

import {
  acquireLock,
  getCacheNumber,
  incrementWithExpiry,
  releaseLock,
  resetCacheKey,
} from "./redis";

const LOGIN_LIMIT_WINDOW_SECONDS = 5 * 60;
const LOGIN_FAILURE_LIMIT = 5;
const EVALUATION_LOCK_SECONDS = 30;

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9@._:-]/gi, "_");
}

export function loginFailureKey(email: string) {
  return `login:fail:${normalizeKeyPart(email)}`;
}

export function evaluationLockKey(userId: string, assignmentId: string) {
  return `evaluation:submit:${normalizeKeyPart(userId)}:${normalizeKeyPart(assignmentId)}`;
}

export async function recordLoginFailure(email: string) {
  return incrementWithExpiry(loginFailureKey(email), LOGIN_LIMIT_WINDOW_SECONDS);
}

export async function resetLoginFailures(email: string) {
  await resetCacheKey(loginFailureKey(email));
}

export async function isLoginLimited(email: string) {
  return (await getCacheNumber(loginFailureKey(email))) >= LOGIN_FAILURE_LIMIT;
}

export async function recordAndCheckLoginFailure(email: string) {
  const count = await recordLoginFailure(email);

  return count >= LOGIN_FAILURE_LIMIT;
}

export async function withEvaluationSubmissionLock<T>(
  userId: string,
  assignmentId: string,
  operation: () => Promise<T>,
) {
  const key = evaluationLockKey(userId, assignmentId);
  const token = randomUUID();
  const acquired = await acquireLock(key, token, EVALUATION_LOCK_SECONDS);

  if (!acquired) {
    throw new Error("当前评教正在提交处理中，请稍后再试。");
  }

  try {
    return await operation();
  } finally {
    await releaseLock(key, token);
  }
}

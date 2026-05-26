import { describe, expect, it } from "vitest";

import { resolveSafeAuditActorId } from "../lib/audit-log";

describe("audit log actor resolution", () => {
  it("keeps an actor id when the user still exists", () => {
    expect(resolveSafeAuditActorId("user-1", { id: "user-1" })).toBe("user-1");
  });

  it("uses null when the session actor no longer exists", () => {
    expect(resolveSafeAuditActorId("old-user", null)).toBeNull();
  });

  it("uses null when actor id is empty", () => {
    expect(resolveSafeAuditActorId("", null)).toBeNull();
  });
});

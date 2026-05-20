import { describe, expect, it } from "vitest";

import { canAccessDepartment, hasRole } from "../../lib/auth/guards";

describe("auth guards", () => {
  it("allows matching roles", () => {
    expect(hasRole("TEACHER", ["TEACHER"])).toBe(true);
  });

  it("rejects missing roles", () => {
    expect(hasRole("STUDENT", ["TEACHER"])).toBe(false);
  });

  it("allows super admins to access any department", () => {
    expect(canAccessDepartment("SUPER_ADMIN", "dep-a", "dep-b")).toBe(true);
  });

  it("allows department admins to access their own department", () => {
    expect(canAccessDepartment("DEPARTMENT_ADMIN", "dep-a", "dep-a")).toBe(
      true,
    );
  });

  it("rejects department admins from other departments", () => {
    expect(canAccessDepartment("DEPARTMENT_ADMIN", "dep-a", "dep-b")).toBe(
      false,
    );
  });
});

import { describe, expect, it } from "vitest";

import { canUpdateUserRole } from "../../lib/admin/user-role-permissions";

describe("admin user role permissions", () => {
  it("allows super admins to update roles", () => {
    expect(
      canUpdateUserRole({
        actorRole: "SUPER_ADMIN",
        nextRole: "SUPER_ADMIN",
        superAdminCount: 2,
        targetRole: "SCHOOL_ADMIN",
      }),
    ).toEqual({ allowed: true });
  });

  it("allows school admins to update non-super-admin roles", () => {
    expect(
      canUpdateUserRole({
        actorRole: "SCHOOL_ADMIN",
        nextRole: "TEACHER",
        superAdminCount: 0,
        targetRole: "STUDENT",
      }),
    ).toEqual({ allowed: true });
  });

  it("prevents school admins from changing super-admin privileges", () => {
    expect(
      canUpdateUserRole({
        actorRole: "SCHOOL_ADMIN",
        nextRole: "SUPER_ADMIN",
        superAdminCount: 0,
        targetRole: "TEACHER",
      }).allowed,
    ).toBe(false);
    expect(
      canUpdateUserRole({
        actorRole: "SCHOOL_ADMIN",
        nextRole: "TEACHER",
        superAdminCount: 2,
        targetRole: "SUPER_ADMIN",
      }).allowed,
    ).toBe(false);
  });

  it("protects the last super admin from demotion", () => {
    expect(
      canUpdateUserRole({
        actorRole: "SUPER_ADMIN",
        nextRole: "SCHOOL_ADMIN",
        superAdminCount: 1,
        targetRole: "SUPER_ADMIN",
      }),
    ).toEqual({
      allowed: false,
      reason: "Cannot demote the last super administrator.",
    });
  });
});

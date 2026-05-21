import { describe, expect, it } from "vitest";

import { getNavigationForRole } from "../lib/navigation";
import type { Role } from "../lib/generated/prisma/enums";

function hrefsFor(role: Role) {
  return getNavigationForRole(role).flatMap((group) =>
    group.items.map((item) => item.href),
  );
}

describe("role navigation", () => {
  it("shows student evaluation links without admin dashboard access", () => {
    const hrefs = hrefsFor("STUDENT");

    expect(hrefs).toContain("/student/evaluations");
    expect(hrefs).not.toContain("/admin/dashboard");
  });

  it("shows teacher result links without admin task access", () => {
    const hrefs = hrefsFor("TEACHER");

    expect(hrefs).toContain("/teacher/results");
    expect(hrefs).not.toContain("/admin/tasks");
  });

  it("shows school admin management links", () => {
    const hrefs = hrefsFor("SCHOOL_ADMIN");

    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/admin/dashboard",
        "/admin/templates",
        "/admin/tasks",
        "/admin/reports",
      ]),
    );
  });

  it("does not expose unscoped admin pages to department admins", () => {
    const hrefs = hrefsFor("DEPARTMENT_ADMIN");

    expect(hrefs).not.toContain("/admin/dashboard");
    expect(hrefs).not.toContain("/admin/tasks");
    expect(hrefs).not.toContain("/admin/base-data");
    expect(hrefs).not.toContain("/admin/settings");
  });

  it("shows analyst report access without admin task or settings access", () => {
    const hrefs = hrefsFor("ANALYST");

    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).not.toContain("/admin/tasks");
    expect(hrefs).not.toContain("/admin/settings");
  });

  it("shows extension modules only to admins and analysts", () => {
    const extensionHref = "/extensions/supervision";

    expect(hrefsFor("SCHOOL_ADMIN")).toContain(extensionHref);
    expect(hrefsFor("ANALYST")).toContain(extensionHref);
    expect(hrefsFor("TEACHER")).not.toContain(extensionHref);
    expect(hrefsFor("STUDENT")).not.toContain(extensionHref);
  });
});

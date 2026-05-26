import { describe, expect, it } from "vitest";

import { parseCreateSuperAdminArgs } from "../../lib/admin/create-super-admin";

describe("create super admin args", () => {
  it("parses email, complex password and custom name", () => {
    expect(
      parseCreateSuperAdminArgs([
        "superadmin@example.edu",
        "StrongPass123!",
        "张管理员",
      ]),
    ).toEqual({
      email: "superadmin@example.edu",
      password: "StrongPass123!",
      name: "张管理员",
    });
  });

  it("uses a default name when name is omitted", () => {
    expect(
      parseCreateSuperAdminArgs(["superadmin@example.edu", "StrongPass123!"]),
    ).toEqual({
      email: "superadmin@example.edu",
      password: "StrongPass123!",
      name: "超级管理员",
    });
  });

  it("rejects invalid email", () => {
    expect(() =>
      parseCreateSuperAdminArgs(["not-an-email", "StrongPass123!"]),
    ).toThrow("请输入有效邮箱");
  });

  it("rejects missing email", () => {
    expect(() => parseCreateSuperAdminArgs([])).toThrow("请输入超级管理员邮箱");
  });

  it("rejects weak passwords with complexity hints", () => {
    expect(() =>
      parseCreateSuperAdminArgs(["superadmin@example.edu", "short"]),
    ).toThrow("密码不符合复杂度要求");
  });
});

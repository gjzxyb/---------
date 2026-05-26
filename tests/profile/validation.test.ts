import { describe, expect, it } from "vitest";

import {
  getPasswordComplexityErrors,
  passwordChangeSchema,
  studentClassUpdateSchema,
  profileUpdateSchema,
} from "../../lib/profile/validation";

describe("profile validation", () => {
  it("accepts valid profile names", () => {
    const parsed = profileUpdateSchema.safeParse({ name: "张三" });

    expect(parsed.success).toBe(true);
  });

  it("rejects short profile names", () => {
    const parsed = profileUpdateSchema.safeParse({ name: "A" });

    expect(parsed.success).toBe(false);
  });
});

describe("student class validation", () => {
  it("accepts a selected class organization", () => {
    const parsed = studentClassUpdateSchema.safeParse({
      organizationId: "class-1",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects an empty class organization", () => {
    const parsed = studentClassUpdateSchema.safeParse({
      organizationId: "",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("password complexity", () => {
  it("requires length, uppercase, lowercase, number and special character", () => {
    expect(getPasswordComplexityErrors("short")).toEqual([
      "至少 10 位字符",
      "包含大写字母",
      "包含数字",
      "包含特殊字符",
    ]);
  });

  it("accepts a complex changed password", () => {
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmPassword: "NewPassword456!",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unchanged or mismatched passwords", () => {
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: "SamePassword123!",
      newPassword: "SamePassword123!",
      confirmPassword: "OtherPassword123!",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.flatten().fieldErrors.newPassword).toContain(
      "新密码不能与当前密码相同",
    );
    expect(parsed.error?.flatten().fieldErrors.confirmPassword).toContain(
      "两次输入的新密码不一致",
    );
  });
});

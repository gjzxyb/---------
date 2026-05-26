import type { Role } from "@/lib/generated/prisma/enums";

export type UserRolePermissionResult =
  | { allowed: true; reason?: never }
  | { allowed: false; reason: string };

export function canUpdateUserRole({
  actorRole,
  nextRole,
  superAdminCount,
  targetRole,
}: {
  actorRole: Role;
  nextRole: Role;
  superAdminCount: number;
  targetRole: Role;
}): UserRolePermissionResult {
  if (actorRole !== "SUPER_ADMIN" && actorRole !== "SCHOOL_ADMIN") {
    return { allowed: false, reason: "Only administrators can update user roles." };
  }

  if (actorRole === "SCHOOL_ADMIN") {
    if (targetRole === "SUPER_ADMIN" || nextRole === "SUPER_ADMIN") {
      return {
        allowed: false,
        reason: "School administrators cannot change super administrator privileges.",
      };
    }

    return { allowed: true };
  }

  if (
    targetRole === "SUPER_ADMIN" &&
    nextRole !== "SUPER_ADMIN" &&
    superAdminCount <= 1
  ) {
    return {
      allowed: false,
      reason: "Cannot demote the last super administrator.",
    };
  }

  return { allowed: true };
}

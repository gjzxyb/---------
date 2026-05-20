import type { Role } from "@/lib/generated/prisma/enums";
import { redirect } from "next/navigation";

export function hasRole(role: Role, allowedRoles: Role[]) {
  return allowedRoles.includes(role);
}

export function canAccessDepartment(
  role: Role,
  userDepartmentId: string,
  targetDepartmentId: string,
) {
  if (role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN") {
    return true;
  }

  return role === "DEPARTMENT_ADMIN" && userDepartmentId === targetDepartmentId;
}

export async function requireSession() {
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import("next-auth"),
    import("./config"),
  ]);
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(allowedRoles: Role[]) {
  const session = await requireSession();

  if (!hasRole(session.user.role, allowedRoles)) {
    redirect("/forbidden");
  }

  return session;
}

import type { Role } from "@/lib/generated/prisma/enums";

export type NavigationItem = {
  title: string;
  href: string;
  roles?: Role[];
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

const adminRoles: Role[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DEPARTMENT_ADMIN"];
const extensionRoles: Role[] = [...adminRoles, "ANALYST"];

export const navigationTree: NavigationGroup[] = [
  {
    title: "统一门户",
    items: [
      { title: "工作台", href: "/dashboard" },
      { title: "个人资料", href: "/profile" },
    ],
  },
  {
    title: "学生评教",
    items: [{ title: "我的评教", href: "/student/evaluations", roles: ["STUDENT"] }],
  },
  {
    title: "教师发展",
    items: [
      { title: "授课班级", href: "/teacher/courses", roles: ["TEACHER"] },
      { title: "评价结果", href: "/teacher/results", roles: ["TEACHER"] },
      { title: "改进计划", href: "/teacher/improvements", roles: ["TEACHER"] },
    ],
  },
  {
    title: "管理中心",
    items: [
      { title: "管理看板", href: "/admin/dashboard", roles: adminRoles },
      { title: "模板管理", href: "/admin/templates", roles: adminRoles },
      { title: "评教任务", href: "/admin/tasks", roles: adminRoles },
      { title: "统计报告", href: "/admin/reports", roles: adminRoles },
      { title: "基础数据", href: "/admin/base-data", roles: adminRoles },
      { title: "系统设置", href: "/admin/settings", roles: adminRoles },
    ],
  },
  {
    title: "扩展模块",
    items: [
      { title: "督导听课", href: "/extensions/supervision", roles: extensionRoles },
      { title: "同行评议", href: "/extensions/peer-review", roles: extensionRoles },
      {
        title: "教师自评",
        href: "/extensions/teacher-self-evaluation",
        roles: extensionRoles,
      },
      { title: "家长反馈", href: "/extensions/parent-feedback", roles: extensionRoles },
      {
        title: "课堂观察",
        href: "/extensions/classroom-observation",
        roles: extensionRoles,
      },
    ],
  },
];

export function getNavigationForRole(role: Role): NavigationGroup[] {
  return navigationTree
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}

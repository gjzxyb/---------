"use client";

import type { Session } from "next-auth";
import Link from "next/link";
import { signOut } from "next-auth/react";

import { Nav } from "@/components/nav";
import { PageContextBar } from "@/components/page-context-bar";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NavigationGroup } from "@/lib/navigation";
import type { Role } from "@/lib/generated/prisma/enums";

type AppShellProps = {
  children: React.ReactNode;
  navigation: NavigationGroup[];
  session: Session;
};

const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "超级管理员",
  SCHOOL_ADMIN: "校级管理员",
  DEPARTMENT_ADMIN: "院系管理员",
  TEACHER: "教师",
  STUDENT: "学生",
  ANALYST: "分析员",
};

export function AppShell({ children, navigation, session }: AppShellProps) {
  const user = session.user;

  return (
    <div className="app-shell flex min-h-screen bg-slate-100 text-slate-950">
      <aside className="app-sidebar hidden w-72 flex-col bg-slate-950 px-5 py-6 text-slate-100 lg:flex">
        <div className="brand-panel px-3">
          <p className="text-xs font-medium text-sky-300">智慧评教</p>
          <h1 className="mt-2 text-lg font-semibold tracking-normal text-white">
            评教与反馈平台
          </h1>
        </div>
        <div className="mt-8 flex-1 overflow-y-auto pr-1">
          <Nav groups={navigation} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header flex min-h-20 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Link
            href="/profile"
            className="min-w-0 self-stretch rounded-md outline-none transition hover:opacity-85 focus:ring-2 focus:ring-sky-500 sm:self-auto"
          >
            <p className="truncate text-sm font-medium text-slate-500">
              {user.email}
            </p>
            <h2 className="truncate text-base font-semibold text-slate-950">
              {user.name ?? "未命名用户"}
            </h2>
          </Link>
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:gap-3">
            <ThemeToggle compact />
            <StatusBadge tone="info">{roleLabels[user.role]}</StatusBadge>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="ml-auto rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 sm:ml-0"
            >
              退出
            </button>
          </div>
        </header>

        <div className="app-mobile-nav overflow-x-auto border-b border-slate-200 bg-slate-950 px-4 py-3 lg:hidden">
          <Nav groups={navigation} />
        </div>

        <main className="flex-1 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          <PageContextBar navigation={navigation} />
          {children}
        </main>
      </div>
    </div>
  );
}

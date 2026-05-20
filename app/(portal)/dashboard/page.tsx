import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth/guards";
import type { Role } from "@/lib/generated/prisma/enums";

type DashboardMetric = {
  label: string;
  value: number | string;
  hint: string;
};

type DashboardContent = {
  title: string;
  description: string;
  metrics: DashboardMetric[];
  todos: string[];
  primaryHref: string;
  primaryLabel: string;
};

const adminRoles: Role[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DEPARTMENT_ADMIN"];

function fallbackContent(role: Role): DashboardContent {
  if (role === "STUDENT") {
    return {
      title: "学生工作台",
      description: "查看当前评教任务、草稿和已提交记录。",
      metrics: [
        { label: "待完成评教", value: "-", hint: "等待数据库连接后显示" },
        { label: "进行中", value: "-", hint: "本学期正在填写的评教" },
        { label: "已提交", value: "-", hint: "已完成的评价记录" },
      ],
      todos: ["完成未提交的课程评价", "检查是否有临近截止的评教任务"],
      primaryHref: "/student/evaluations",
      primaryLabel: "进入我的评教",
    };
  }

  if (role === "TEACHER") {
    return {
      title: "教师工作台",
      description: "跟踪授课班级、评价结果和教学改进计划。",
      metrics: [
        { label: "授课班级", value: "-", hint: "当前教师名下班级" },
        { label: "待处理改进", value: "-", hint: "开放或推进中的改进项" },
        { label: "评价结果", value: "-", hint: "可查看的结果汇总" },
      ],
      todos: ["查看最新评价结果", "更新进行中的教学改进计划"],
      primaryHref: "/teacher/results",
      primaryLabel: "查看评价结果",
    };
  }

  if (adminRoles.includes(role)) {
    return {
      title: "管理工作台",
      description: "管理评教模板、任务发布、统计报告和基础数据。",
      metrics: [
        { label: "评教任务", value: "-", hint: "全部任务数量" },
        { label: "模板", value: "-", hint: "可用评价模板" },
        { label: "平台用户", value: "-", hint: "当前组织用户规模" },
      ],
      todos: ["检查待发布评教任务", "维护模板与基础数据", "查看管理统计报告"],
      primaryHref: "/admin/dashboard",
      primaryLabel: "进入管理看板",
    };
  }

  return {
    title: "分析工作台",
    description: "查看评教分析和扩展模块数据。",
    metrics: [
      { label: "统计报告", value: "-", hint: "可分析的报告范围" },
      { label: "扩展模块", value: 5, hint: "已开放的扩展入口" },
      { label: "数据连接", value: "-", hint: "等待数据库连接后显示" },
    ],
    todos: ["查看扩展模块数据", "准备面向管理者的分析摘要"],
    primaryHref: "/extensions/supervision",
    primaryLabel: "查看扩展模块",
  };
}

async function loadDashboardContent(
  role: Role,
  userId: string,
): Promise<DashboardContent> {
  const content = fallbackContent(role);

  if (!process.env.DATABASE_URL) {
    return content;
  }

  try {
    const { prisma } = await import("@/lib/db");

    if (role === "STUDENT") {
      const [pending, inProgress, submitted] = await Promise.all([
        prisma.evaluationAssignment.count({
          where: { evaluatorId: userId, status: "PENDING" },
        }),
        prisma.evaluationAssignment.count({
          where: { evaluatorId: userId, status: "IN_PROGRESS" },
        }),
        prisma.evaluationAssignment.count({
          where: { evaluatorId: userId, status: "SUBMITTED" },
        }),
      ]);

      return {
        ...content,
        metrics: [
          { label: "待完成评教", value: pending, hint: "尚未开始的评价任务" },
          { label: "进行中", value: inProgress, hint: "正在填写的评教" },
          { label: "已提交", value: submitted, hint: "已完成的评价记录" },
        ],
      };
    }

    if (role === "TEACHER") {
      const [classes, improvements, submittedResponses] = await Promise.all([
        prisma.teachingClass.count({ where: { teacherId: userId } }),
        prisma.improvementPlan.count({
          where: { teacherId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        }),
        prisma.evaluationResponse.count({
          where: {
            status: "SUBMITTED",
            assignment: { teachingClass: { teacherId: userId } },
          },
        }),
      ]);

      return {
        ...content,
        metrics: [
          { label: "授课班级", value: classes, hint: "当前教师名下班级" },
          { label: "待处理改进", value: improvements, hint: "开放或推进中的改进项" },
          { label: "评价结果", value: submittedResponses, hint: "已提交评价样本" },
        ],
      };
    }

    if (adminRoles.includes(role)) {
      const [tasks, templates, users] = await Promise.all([
        prisma.evaluationTask.count(),
        prisma.evaluationTemplate.count(),
        prisma.user.count(),
      ]);

      return {
        ...content,
        metrics: [
          { label: "评教任务", value: tasks, hint: "全部任务数量" },
          { label: "模板", value: templates, hint: "可用评价模板" },
          { label: "平台用户", value: users, hint: "当前用户规模" },
        ],
      };
    }
  } catch {
    return content;
  }

  return content;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const content = await loadDashboardContent(session.user.role, session.user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge tone="info">工作台</StatusBadge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            {content.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {content.description}
          </p>
        </div>
        <Link
          href={content.primaryHref}
          className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {content.primaryLabel}
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3" aria-label="关键指标">
        {content.metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{metric.hint}</p>
          </article>
        ))}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">待办重点</h2>
          <StatusBadge tone="warning">{content.todos.length} 项</StatusBadge>
        </div>
        <ul className="mt-4 space-y-3">
          {content.todos.map((todo) => (
            <li key={todo} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {todo}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

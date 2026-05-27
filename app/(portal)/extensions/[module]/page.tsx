import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/lib/auth/guards";
import type { Role } from "@/lib/generated/prisma/enums";

type ExtensionModule = {
  title: string;
  description: string;
  scope: string[];
};

const extensionRoles: Role[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ANALYST"];

const extensionModules: Record<string, ExtensionModule> = {
  supervision: {
    title: "督导听课",
    description: "面向督导评价、听课记录和课堂质量反馈的扩展入口。",
    scope: ["督导听课任务", "听课评价表", "问题反馈", "整改跟踪"],
  },
  "peer-review": {
    title: "同行评议",
    description: "面向院系内部同行互评、教研组评议和课程建设建议的扩展入口。",
    scope: ["同行互评任务", "课程建设建议", "评议记录", "横向对比"],
  },
  "teacher-self-evaluation": {
    title: "教师自评",
    description: "面向教师自我诊断、教学反思和成长档案的扩展入口。",
    scope: ["自评问卷", "教学反思", "成长记录", "改进计划联动"],
  },
  "parent-feedback": {
    title: "家长反馈",
    description: "面向家长意见收集、服务反馈和匿名建议治理的扩展入口。",
    scope: ["家长建议", "事务反馈", "服务评价", "文本治理"],
  },
  "classroom-observation": {
    title: "课堂观察",
    description: "面向课堂行为观察、教学互动记录和观察量表分析的扩展入口。",
    scope: ["课堂观察表", "互动记录", "观察标签", "趋势分析"],
  },
};

type ExtensionPageProps = {
  params: Promise<{ module: string }>;
};

export function generateStaticParams() {
  return Object.keys(extensionModules).map((module) => ({ module }));
}

export default async function ExtensionPage({ params }: ExtensionPageProps) {
  await requireRole(extensionRoles);
  const { module } = await params;
  const extension = extensionModules[module];

  if (!extension) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <StatusBadge tone="info">扩展模块</StatusBadge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
          {extension.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {extension.description}
        </p>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">首版状态</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              当前模块为预留入口，后续可接入任务发布、表单配置、数据采集和统计报表。
            </p>
          </div>
          <StatusBadge tone="warning">待建设</StatusBadge>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">计划能力</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {extension.scope.map((item) => (
            <div
              key={item}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

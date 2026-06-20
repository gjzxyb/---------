import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import {
  createEvaluationTemplate,
  createQuestionBankItem,
  deleteQuestionBankItem,
} from "@/app/actions/admin";
import { TemplateQuestionEditor } from "./TemplateQuestionEditor";
import { TemplateVersionManager } from "./TemplateVersionManager";
import { requireRole } from "@/lib/auth/guards";
import {
  ADMIN_ROLES,
  activeStatusLabel,
  activeStatusTone,
  emptyWhenDatabaseMissing,
  formatInteger,
  isDatabaseConfigured,
} from "@/lib/demo-data";

type QuestionBankRow = {
  id: string;
  title: string;
  type: string;
  maxScore: number | null;
  isActive: boolean;
  _count: { templateQuestions: number };
};

type TemplateRow = {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  questions: {
    id: string;
    questionItemId: string | null;
    type: "SCALE" | "TEXT";
    title: string;
    description: string | null;
    sortOrder: number;
    maxScore: number | null;
    required: boolean;
  }[];
  _count: { questions: number; tasks: number };
};

type TemplateData = {
  questionBankItems: QuestionBankRow[];
  templates: TemplateRow[];
  questionTypes: { type: string; _count: { type: number } }[];
  isDatabaseConfigured: boolean;
};

async function loadTemplateData(): Promise<TemplateData> {
  if (!isDatabaseConfigured()) {
    return {
      questionBankItems: [],
      templates: [],
      questionTypes: [],
      isDatabaseConfigured: false,
    };
  }

  const { prisma } = await import("@/lib/db");
  const [questionBankItems, templates, questionTypes] =
    await Promise.all([
      prisma.questionBankItem.findMany({
        select: {
          id: true,
          title: true,
          type: true,
          maxScore: true,
          isActive: true,
          _count: { select: { templateQuestions: true } },
        },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      }),
      prisma.evaluationTemplate.findMany({
        include: {
          questions: {
            select: {
              id: true,
              questionItemId: true,
              type: true,
              title: true,
              description: true,
              sortOrder: true,
              maxScore: true,
              required: true,
            },
            orderBy: { sortOrder: "asc" },
          },
          _count: { select: { questions: true, tasks: true } },
        },
        orderBy: [{ name: "asc" }, { version: "desc" }],
      }),
      prisma.questionBankItem.groupBy({
        by: ["type"],
        _count: { type: true },
        orderBy: { type: "asc" },
      }),
    ]);

  return {
    questionBankItems,
    templates,
    questionTypes,
    isDatabaseConfigured: true,
  };
}

function questionTypeLabel(type: string) {
  return type === "SCALE" ? "量表题" : "文本题";
}

export default async function AdminTemplatesPage() {
  await requireRole([...ADMIN_ROLES]);
  const {
    questionBankItems,
    templates,
    questionTypes,
    isDatabaseConfigured,
  } = await loadTemplateData();
  const activeTemplates = templates.filter((template) => template.isActive).length;
  const activeQuestions = questionBankItems.filter((item) => item.isActive).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge tone="info">模板管理</StatusBadge>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            评价模板与题库
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            管理题库条目、模板版本、题型和启用状态，支持首版新建模板并关联已有题目。
          </p>
        </div>
      </div>

      {!isDatabaseConfigured ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {emptyWhenDatabaseMissing("模板数据")}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4" aria-label="模板概览">
        <StatCard label="题库条目" value={formatInteger(questionBankItems.length)} hint={`${formatInteger(activeQuestions)} 个启用`} />
        <StatCard label="评价模板" value={formatInteger(templates.length)} hint={`${formatInteger(activeTemplates)} 个启用`} />
        <StatCard label="模板版本" value={formatInteger(templates.length)} hint="模板与版本统一管理" />
        <StatCard label="题型" value={formatInteger(questionTypes.length)} hint="当前题库覆盖题型" />
      </section>

      <section className="space-y-6">
        <form
          action={createQuestionBankItem}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-950">新建题库题目</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-6">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              题型
              <select
                name="type"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                defaultValue="SCALE"
                disabled={!isDatabaseConfigured}
              >
                <option value="SCALE">量表题</option>
                <option value="TEXT">文本题</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 lg:col-span-3">
              题干
              <input
                name="title"
                required
                placeholder="例如：教学内容重点突出，课堂组织清晰"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 lg:col-span-2">
              满分
              <input
                name="maxScore"
                type="number"
                min={0}
                max={100}
                defaultValue={5}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 lg:col-span-5">
              说明
              <textarea
                name="description"
                rows={3}
                placeholder="可填写评价口径、评分说明或适用场景"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={!isDatabaseConfigured}
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked
                className="size-4 rounded border-slate-300"
                disabled={!isDatabaseConfigured}
              />
              启用题目
            </label>
            <button
              type="submit"
              disabled={!isDatabaseConfigured}
              className="inline-flex w-fit self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            >
              创建题目
            </button>
          </div>
        </form>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-950">题库条目</h2>
          <DataTable
            headers={["题目", "题型", "满分", "状态", "引用", "操作"]}
            emptyText="暂无题库条目。"
            rows={questionBankItems.map((item) => {
              const canDelete = item._count.templateQuestions === 0;

              return [
                <div key="title" className="max-w-3xl font-medium text-slate-900">
                  {item.title}
                </div>,
                questionTypeLabel(item.type),
                item.maxScore ?? "不计分",
                <StatusBadge key="status" tone={activeStatusTone(item.isActive)}>
                  {activeStatusLabel(item.isActive)}
                </StatusBadge>,
                formatInteger(item._count.templateQuestions),
                <form key="delete" action={deleteQuestionBankItem}>
                  <input type="hidden" name="questionId" value={item.id} />
                  <button
                    disabled={!canDelete}
                    title={canDelete ? "删除该题库条目" : "已被模板引用，不可删除"}
                    className="text-sm font-medium text-rose-700 disabled:text-slate-400"
                  >
                    删除
                  </button>
                </form>,
              ];
            })}
          />
        </div>

        <form
          action={createEvaluationTemplate}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-950">新建评价模板</h2>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                模板名称
                <input
                  name="name"
                  required
                  placeholder="例如：课堂教学质量评价"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!isDatabaseConfigured}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                版本
                <input
                  name="version"
                  type="number"
                  min={1}
                  defaultValue={1}
                  required
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  disabled={!isDatabaseConfigured}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked
                className="size-4 rounded border-slate-300"
                disabled={!isDatabaseConfigured}
              />
              启用模板
            </label>
            <TemplateQuestionEditor
              questionBankItems={questionBankItems}
              disabled={!isDatabaseConfigured}
            />
          </div>
        </form>
      </section>

      <section>
        <TemplateVersionManager
          templates={templates}
          questionBankItems={questionBankItems}
        />
      </section>
    </div>
  );
}

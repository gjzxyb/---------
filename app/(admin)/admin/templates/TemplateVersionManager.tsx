"use client";

import { useState } from "react";

import {
  deleteEvaluationTemplate,
  updateEvaluationTemplateQuestions,
} from "@/app/actions/admin";
import { StatusBadge } from "@/components/status-badge";
import { activeStatusLabel, activeStatusTone, formatInteger } from "@/lib/demo-data";
import { TemplateQuestionEditor } from "./TemplateQuestionEditor";

type QuestionBankOption = {
  id: string;
  title: string;
  type: string;
  maxScore: number | null;
  isActive: boolean;
};

type TemplateQuestionRow = {
  id: string;
  questionItemId: string | null;
  type: "SCALE" | "TEXT";
  title: string;
  description: string | null;
  sortOrder: number;
  maxScore: number | null;
  required: boolean;
};

type TemplateVersionRow = {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  questions: TemplateQuestionRow[];
  _count: { questions: number; tasks: number };
};

type TemplateVersionManagerProps = {
  templates: TemplateVersionRow[];
  questionBankItems: QuestionBankOption[];
};

function parseQuestionDescription(description: string | null) {
  const result = { category: "", optionsText: "" };

  if (!description) {
    return result;
  }

  description.split("；").forEach((part) => {
    if (part.startsWith("分类：")) {
      result.category = part.slice("分类：".length);
    }

    if (part.startsWith("选项：")) {
      result.optionsText = part.slice("选项：".length);
    }
  });

  return result;
}

export function TemplateVersionManager({
  templates,
  questionBankItems,
}: TemplateVersionManagerProps) {
  const [expandedTemplateId, setExpandedTemplateId] = useState(
    templates[0]?.id ?? "",
  );

  const expandedTemplate = templates.find(
    (template) => template.id === expandedTemplateId,
  );

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-slate-950">模板版本</h2>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["模板", "版本", "题目数", "关联任务", "状态", "操作"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templates.length ? (
              templates.map((template) => {
                const isExpanded = template.id === expandedTemplateId;
                const canDelete = template._count.tasks === 0;

                return (
                  <tr
                    key={template.id}
                    className={isExpanded ? "bg-sky-50/50" : "bg-white"}
                  >
                    <td className="px-4 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setExpandedTemplateId(template.id)}
                        className="text-left font-medium text-sky-700 hover:text-sky-900"
                      >
                        {template.name}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      v{template.version}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatInteger(template._count.questions)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatInteger(template._count.tasks)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <StatusBadge tone={activeStatusTone(template.isActive)}>
                        {activeStatusLabel(template.isActive)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setExpandedTemplateId(template.id)}
                          className="font-medium text-sky-700 hover:text-sky-900"
                        >
                          {isExpanded ? "正在编辑" : "查看/编辑"}
                        </button>
                        <form action={deleteEvaluationTemplate}>
                          <input
                            type="hidden"
                            name="templateId"
                            value={template.id}
                          />
                          <button
                            disabled={!canDelete}
                            title={
                              canDelete
                                ? "删除该模板版本"
                                : "有关联任务，不可删除"
                            }
                            className="font-medium text-rose-700 disabled:text-slate-400"
                          >
                            删除
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  暂无模板。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedTemplate ? (
        <form
          action={updateEvaluationTemplateQuestions}
          className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="templateId" value={expandedTemplate.id} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-950">
                {expandedTemplate.name} v{expandedTemplate.version}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                修改后会替换该模板版本下的题目快照，不影响题库原始条目。
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={expandedTemplate.isActive}
                className="size-4 rounded border-slate-300"
              />
              启用模板
            </label>
          </div>
          <div className="mt-4">
            <TemplateQuestionEditor
              key={expandedTemplate.id}
              questionBankItems={questionBankItems}
              initialQuestions={expandedTemplate.questions
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((question) => {
                  const parsedDescription = parseQuestionDescription(
                    question.description,
                  );

                  return {
                    questionItemId: question.questionItemId ?? undefined,
                    category: parsedDescription.category,
                    sortOrder: question.sortOrder,
                    title: question.title,
                    type: question.type,
                    maxScore: question.maxScore,
                    optionsText: parsedDescription.optionsText,
                    required: question.required,
                  };
                })}
              submitLabel="保存题目修改"
            />
          </div>
        </form>
      ) : null}
    </section>
  );
}

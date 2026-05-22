"use client";

import { useMemo, useState } from "react";

import { parseQuestionCsv } from "@/lib/admin/question-import";

type QuestionBankOption = {
  id: string;
  title: string;
  type: string;
  maxScore: number | null;
  isActive: boolean;
};

type DraftQuestion = {
  localId: string;
  questionItemId?: string;
  category: string;
  sortOrder: number;
  title: string;
  type: "SCALE" | "TEXT";
  maxScore: number | null;
  optionsText: string;
  required: boolean;
};

type TemplateQuestionEditorProps = {
  questionBankItems: QuestionBankOption[];
  initialQuestions?: Array<Omit<DraftQuestion, "localId">>;
  submitLabel?: string;
  disabled?: boolean;
};

function createLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createBlankQuestion(sortOrder: number): DraftQuestion {
  return {
    localId: createLocalId(),
    category: "",
    sortOrder,
    title: "",
    type: "SCALE",
    maxScore: 5,
    optionsText: "A.非常满意|B.满意|C.一般|D.不太满意|E.不满意",
    required: true,
  };
}

function questionTypeLabel(type: string) {
  return type === "TEXT" ? "文本题" : "量表题";
}

function serializeQuestion(question: DraftQuestion) {
  return {
    questionItemId: question.questionItemId,
    category: question.category,
    sortOrder: question.sortOrder,
    title: question.title,
    type: question.type,
    maxScore: question.maxScore,
    optionsText: question.optionsText,
    required: question.required,
  };
}

export function TemplateQuestionEditor({
  questionBankItems,
  initialQuestions = [],
  submitLabel = "创建模板",
  disabled = false,
}: TemplateQuestionEditorProps) {
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initialQuestions.map((question) => ({
      ...question,
      localId: createLocalId(),
      category: question.category ?? "",
      optionsText: question.optionsText ?? "",
    })),
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    questionBankItems[0]?.id ?? "",
  );
  const [importMessage, setImportMessage] = useState("");

  const serializedQuestions = useMemo(
    () => JSON.stringify(questions.map((question) => serializeQuestion(question))),
    [questions],
  );

  function addBlankQuestion() {
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      createBlankQuestion(currentQuestions.length + 1),
    ]);
  }

  function addSelectedQuestion() {
    const item = questionBankItems.find(
      (question) => question.id === selectedQuestionId,
    );

    if (!item) {
      return;
    }

    setQuestions((currentQuestions) => [
      ...currentQuestions,
      {
        localId: createLocalId(),
        questionItemId: item.id,
        category: "",
        sortOrder: currentQuestions.length + 1,
        title: item.title,
        type: item.type === "TEXT" ? "TEXT" : "SCALE",
        maxScore: item.maxScore,
        optionsText:
          item.type === "TEXT"
            ? ""
            : "A.非常满意|B.满意|C.一般|D.不太满意|E.不满意",
        required: true,
      },
    ]);
  }

  function updateQuestion(
    localId: string,
    patch: Partial<Omit<DraftQuestion, "localId">>,
  ) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question) =>
        question.localId === localId ? { ...question, ...patch } : question,
      ),
    );
  }

  function removeQuestion(localId: string) {
    setQuestions((currentQuestions) =>
      currentQuestions
        .filter((question) => question.localId !== localId)
        .map((question, index) => ({ ...question, sortOrder: index + 1 })),
    );
  }

  async function importCsv(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const importedQuestions = parseQuestionCsv(content);

      setQuestions((currentQuestions) => [
        ...currentQuestions,
        ...importedQuestions.map((question, index) => ({
          ...question,
          localId: createLocalId(),
          sortOrder: currentQuestions.length + index + 1,
          category: question.category ?? "",
        })),
      ]);
      setImportMessage(`已导入 ${importedQuestions.length} 道题。`);
    } catch (error) {
      setImportMessage(
        error instanceof Error
          ? error.message
          : "导入失败，请使用 Excel 另存为 CSV 后重试。",
      );
    }
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <input type="hidden" name="questionsJson" value={serializedQuestions} />
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-700">选择题目</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            可从题库添加，也可以手动新增或导入 Excel 另存的 CSV 文件。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedQuestionId}
            onChange={(event) => setSelectedQuestionId(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm sm:min-w-72"
            disabled={disabled || questionBankItems.length === 0}
          >
            {questionBankItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addSelectedQuestion}
            disabled={disabled || questionBankItems.length === 0}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:text-slate-400"
          >
            从题库添加
          </button>
          <button
            type="button"
            onClick={addBlankQuestion}
            disabled={disabled}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:text-slate-400"
          >
            手动添加
          </button>
          <label className="cursor-pointer rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white">
            导入 CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                void importCsv(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {importMessage ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {importMessage}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1080px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["分类", "题号", "题目", "分值", "题型", "选项串", "必填", "操作"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-3 py-2 text-left text-xs font-semibold text-slate-500"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {questions.length ? (
              questions.map((question) => (
                <tr key={question.localId}>
                  <td className="px-3 py-2">
                    <input
                      value={question.category}
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          category: event.target.value,
                        })
                      }
                      className="w-28 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={question.sortOrder}
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          sortOrder: Number(event.target.value),
                        })
                      }
                      className="w-20 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      required
                      value={question.title}
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          title: event.target.value,
                        })
                      }
                      className="w-72 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={question.maxScore ?? ""}
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          maxScore: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                      className="w-20 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={question.type}
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          type:
                            event.target.value === "TEXT" ? "TEXT" : "SCALE",
                        })
                      }
                      className="w-24 rounded-md border border-slate-300 px-2 py-1"
                    >
                      <option value="SCALE">{questionTypeLabel("SCALE")}</option>
                      <option value="TEXT">{questionTypeLabel("TEXT")}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={question.optionsText}
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          optionsText: event.target.value,
                        })
                      }
                      className="w-80 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          required: event.target.checked,
                        })
                      }
                      className="size-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeQuestion(question.localId)}
                      className="text-sm font-medium text-rose-700"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  暂无题目，请从题库添加、手动添加或导入 CSV。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={disabled || questions.length === 0}
        className="mt-4 inline-flex w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
      >
        {submitLabel}
      </button>
    </div>
  );
}

import {
  saveEvaluationDraft,
  submitEvaluation,
} from "../app/actions/evaluations";
import { getScaleOptions } from "../lib/evaluation/scale-options";

type QuestionType = "SCALE" | "TEXT";

export type QuestionnaireQuestion = {
  id: string;
  type: QuestionType;
  title: string;
  description: string | null;
  sortOrder: number;
  maxScore: number | null;
  required: boolean;
};

export type QuestionnaireAnswer = {
  questionId: string;
  score: number | null;
  text: string | null;
};

type QuestionnaireProps = {
  assignmentId: string;
  questions: QuestionnaireQuestion[];
  answers?: QuestionnaireAnswer[];
  disabled?: boolean;
};

function getVisibleQuestionDescription(description: string | null) {
  if (!description) {
    return null;
  }

  const normalizedDescription = description.trim();

  if (normalizedDescription.startsWith("分类：")) {
    return null;
  }

  return normalizedDescription;
}

export function Questionnaire({
  assignmentId,
  questions,
  answers = [],
  disabled = false,
}: QuestionnaireProps) {
  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );

  return (
    <form className="space-y-5 sm:space-y-6">
      <input type="hidden" name="assignmentId" value={assignmentId} />

      <div className="space-y-4">
        {questions.map((question, index) => {
          const answer = answersByQuestionId.get(question.id);
          const visibleDescription = getVisibleQuestionDescription(
            question.description,
          );

          return (
            <fieldset
              key={question.id}
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              disabled={disabled}
            >
              <legend className="text-base font-semibold leading-7 text-slate-950">
                {index + 1}. {question.title}
              </legend>
              {visibleDescription ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {visibleDescription}
                </p>
              ) : null}

              {question.type === "SCALE" ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
                  {getScaleOptions(question.maxScore).map((option) => {
                    const isSelected = answer?.score === option.value;

                    return (
                      <label
                        key={option.value}
                        className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-3 text-sm font-medium transition sm:min-h-10 sm:justify-center sm:gap-2 sm:py-2 ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`answers.${question.id}.score`}
                          value={option.value}
                          defaultChecked={isSelected}
                          required={question.required}
                          className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="min-w-0 flex-1 sm:flex-none">
                          {option.label}
                        </span>
                        {disabled && isSelected ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            已选
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                  {disabled && answer?.score == null ? (
                    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500 lg:col-span-5">
                      未作答
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  {disabled ? (
                    <div className="mt-4 min-h-24 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800">
                      {answer?.text?.trim() || "未填写"}
                    </div>
                  ) : (
                    <textarea
                      name={`answers.${question.id}.text`}
                      defaultValue={answer?.text ?? ""}
                      required={question.required}
                      rows={5}
                      className="mt-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="请输入你的评价意见"
                    />
                  )}
                </>
              )}
            </fieldset>
          );
        })}
      </div>

      {!disabled ? (
        <div className="sticky bottom-0 z-10 -mx-3 flex flex-col gap-3 border-t border-slate-200 bg-slate-100/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button
            type="submit"
            formAction={saveEvaluationDraft}
            formNoValidate
            className="inline-flex min-h-11 justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 sm:min-h-0 sm:py-2"
          >
            保存草稿
          </button>
          <button
            type="submit"
            formAction={submitEvaluation}
            className="inline-flex min-h-11 justify-center rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 sm:min-h-0 sm:py-2"
          >
            提交评教
          </button>
        </div>
      ) : null}
    </form>
  );
}

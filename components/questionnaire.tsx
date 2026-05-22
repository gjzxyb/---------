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
    <form className="space-y-6">
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
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
              disabled={disabled}
            >
              <legend className="text-base font-semibold text-slate-950">
                {index + 1}. {question.title}
              </legend>
              {visibleDescription ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {visibleDescription}
                </p>
              ) : null}

              {question.type === "SCALE" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {getScaleOptions(question.maxScore).map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      <input
                        type="radio"
                        name={`answers.${question.id}.score`}
                        value={option.value}
                        defaultChecked={answer?.score === option.value}
                        required={question.required}
                        className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
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
            </fieldset>
          );
        })}
      </div>

      {!disabled ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            formAction={saveEvaluationDraft}
            formNoValidate
            className="inline-flex justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Save draft
          </button>
          <button
            type="submit"
            formAction={submitEvaluation}
            className="inline-flex justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Submit
          </button>
        </div>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";

import {
  generateEnrollmentsByGradePrefixWithState,
  type BaseDataActionState,
} from "@/app/actions/base-data";

const initialState: BaseDataActionState = {
  ok: false,
  message: "",
};

export function GenerateEnrollmentsForm({
  disabled,
}: {
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    generateEnrollmentsByGradePrefixWithState,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            按年级生成选课
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            系统会将学生资料中的年级字段，与教学班名称前 7 位进行匹配；匹配成功后，为每名学生生成所有对应教学班的选课记录，已存在的选课会自动跳过。
          </p>
        </div>
        <button
          disabled={disabled || pending}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
        >
          {pending ? "生成中..." : "生成选课"}
        </button>
      </div>

      {state.message ? (
        <p
          role="alert"
          className={`mt-4 rounded-md px-3 py-2 text-sm font-medium ${
            state.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { BaseDataActionState } from "@/app/actions/base-data";

type BaseDataImportFormProps = {
  accept?: string;
  action: (
    previousState: BaseDataActionState,
    formData: FormData,
  ) => Promise<BaseDataActionState>;
  disabled?: boolean;
  helpText: string;
  templateHref: string;
  title: string;
  uploadLabel?: string;
};

const initialState: BaseDataActionState = {
  ok: false,
  message: "",
};

export function BaseDataImportForm({
  accept = ".csv,text/csv",
  action,
  disabled = false,
  helpText,
  templateHref,
  title,
  uploadLabel = "导入文件",
}: BaseDataImportFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{helpText}</p>
        </div>
        <Link href={templateHref} className="text-sm font-medium text-sky-700">
          下载 CSV 模板
        </Link>
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

      <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
        {uploadLabel}
        <input
          name="file"
          type="file"
          accept={accept}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled || pending}
        />
      </label>
      <button
        className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
        disabled={disabled || pending}
      >
        {pending ? "导入中..." : title.replace("批量", "")}
      </button>
    </form>
  );
}

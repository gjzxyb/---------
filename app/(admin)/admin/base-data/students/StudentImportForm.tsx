"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  importStudentsWithState,
  type BaseDataActionState,
} from "@/app/actions/base-data";

const initialState: BaseDataActionState = {
  ok: false,
  message: "",
};

export function StudentImportForm({
  isDatabaseConfigured,
}: {
  isDatabaseConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    importStudentsWithState,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">批量导入学生</h2>
          <p className="mt-1 text-sm text-slate-600">
            支持 CSV，字段为姓名、邮箱、学号、年级、专业、组织、状态。
          </p>
        </div>
        <Link
          href="/admin/base-data/students/import-template"
          className="text-sm font-medium text-sky-700"
        >
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
        导入文件
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={!isDatabaseConfigured || pending}
        />
      </label>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        组织可填写组织名称或组织 ID；邮箱或学号已存在的记录会自动跳过。状态支持 ACTIVE、INACTIVE、GRADUATED、启用、停用、已毕业。
      </p>
      <button
        className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
        disabled={!isDatabaseConfigured || pending}
      >
        {pending ? "导入中..." : "导入学生"}
      </button>
    </form>
  );
}
